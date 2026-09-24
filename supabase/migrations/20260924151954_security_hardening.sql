-- ============================================================================
-- Security hardening
--
-- Fixes, in order of severity:
--  1. Anyone could insert themselves into any group (bypassing the share code),
--     and group_members was readable by everyone, including anonymous users.
--  2. Anyone could insert restaurants into any group ("insert own restaurants"
--     only checked owner, and permissive policies are OR'd).
--  3. Every signed-in user could read every review and every profile.
--  4. Any group member could change a group's share_code / created_by or delete it.
--  5. Storage: any signed-in user could overwrite or delete anyone's photos/avatars.
--  6. SECURITY DEFINER functions had a mutable search_path and were callable by anon;
--     delete_user_account failed for anyone with a review and destroyed shared
--     groups created by the deleted user.
--
-- RLS helpers live in a non-exposed `private` schema and return sets, so policies
-- can use `x in (select private.fn())`, which Postgres evaluates once per query
-- instead of once per row.
-- ============================================================================

-- ─── Helpers ────────────────────────────────────────────────────────────────
create schema if not exists private;
grant usage on schema private to authenticated;

-- Groups the current user belongs to.
create or replace function private.my_group_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select group_id from public.group_members where user_id = (select auth.uid());
$$;

-- Users who share at least one group with the current user (includes the user).
create or replace function private.co_member_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct theirs.user_id
  from public.group_members mine
  join public.group_members theirs on theirs.group_id = mine.group_id
  where mine.user_id = (select auth.uid());
$$;

revoke all on function private.my_group_ids() from public, anon;
revoke all on function private.co_member_ids() from public, anon;
grant execute on function private.my_group_ids() to authenticated;
grant execute on function private.co_member_ids() to authenticated;

-- ─── Table privileges ───────────────────────────────────────────────────────
-- Nothing in the app is used signed-out; anon gets no table access at all.
revoke all on public.profiles, public.groups, public.group_members, public.restaurants, public.reviews from anon;
revoke truncate, references, trigger on public.profiles, public.groups, public.group_members, public.restaurants, public.reviews from authenticated;

-- Groups are created only through create_group(); members may rename a group or
-- change its avatar, but never its id, share_code, created_by or created_at.
revoke insert, update on public.groups from authenticated;
grant update (name, avatar_url) on public.groups to authenticated;

-- Memberships are created only through create_group() / join_group().
revoke insert, update on public.group_members from authenticated;

-- ─── groups ─────────────────────────────────────────────────────────────────
drop policy if exists "View groups you belong to" on public.groups;

create policy "Members can view their groups" on public.groups
  for select to authenticated
  using (id in (select private.my_group_ids()));

create policy "Members can update their groups" on public.groups
  for update to authenticated
  using (id in (select private.my_group_ids()))
  with check (id in (select private.my_group_ids()));

create policy "Creators can delete their groups" on public.groups
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- ─── group_members ──────────────────────────────────────────────────────────
drop policy if exists "View group members" on public.group_members;
drop policy if exists "Insert group members" on public.group_members;
drop policy if exists "Delete group members" on public.group_members;

create policy "Members can view their groups' members" on public.group_members
  for select to authenticated
  using (group_id in (select private.my_group_ids()));

create policy "Users can leave groups" on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── profiles ───────────────────────────────────────────────────────────────
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view themselves and co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or id in (select private.co_member_ids()));

create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ─── restaurants ────────────────────────────────────────────────────────────
drop policy if exists "Users can insert own restaurants" on public.restaurants;
drop policy if exists "Workspace Members can view restaurants" on public.restaurants;
drop policy if exists "Workspace Members can insert restaurants" on public.restaurants;
drop policy if exists "Workspace Members can update restaurants" on public.restaurants;
drop policy if exists "Workspace Members can delete restaurants" on public.restaurants;

create policy "Members can view their groups' restaurants" on public.restaurants
  for select to authenticated
  using (group_id in (select private.my_group_ids()));

create policy "Members can add restaurants to their groups" on public.restaurants
  for insert to authenticated
  with check (
    group_id in (select private.my_group_ids())
    and owner = (select auth.uid())::text
  );

create policy "Members can update their groups' restaurants" on public.restaurants
  for update to authenticated
  using (group_id in (select private.my_group_ids()))
  with check (group_id in (select private.my_group_ids()));

create policy "Members can delete their groups' restaurants" on public.restaurants
  for delete to authenticated
  using (group_id in (select private.my_group_ids()));

-- ─── reviews ────────────────────────────────────────────────────────────────
drop policy if exists "Universal Review Visibility" on public.reviews;
drop policy if exists "Users can manage their own reviews" on public.reviews;

create policy "Users can view their own and co-members' reviews" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or user_id in (select private.co_member_ids()));

create policy "Users can write their own reviews" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can edit their own reviews" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own reviews" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── Functions ──────────────────────────────────────────────────────────────
-- Dead or unused: link/unlink_partner reference columns that no longer exist;
-- the other two are not called by the app and are superseded by triggers/RPCs.
drop function if exists public.link_partner(text);
drop function if exists public.unlink_partner();
drop function if exists public.check_and_update_visited_status(integer);
drop function if exists public.get_random_restaurant(uuid);

create or replace function public.create_group(group_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text := btrim(group_name);
  v_id   uuid;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 60 then
    raise exception 'Cravelist name must be between 1 and 60 characters' using errcode = '22023';
  end if;

  -- 6-character code; retry on the (rare) collision instead of failing.
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (select 1 from public.groups where share_code = v_code);
  end loop;

  insert into public.groups (name, share_code, created_by)
  values (v_name, v_code, v_uid)
  returning id into v_id;

  insert into public.group_members (group_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;

-- Return type changes (void -> uuid, so the app can switch to the joined group),
-- which requires a drop.
drop function if exists public.join_group(text);
create function public.join_group(invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select id into v_group_id
  from public.groups
  where share_code = upper(btrim(invite_code));

  if v_group_id is null then
    raise exception 'Invalid share code. Please double check with your friend!' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_uid)
  on conflict do nothing;

  return v_group_id;
end;
$$;

create or replace function public.delete_user_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_group record;
  v_heir  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Shared lists outlive the person who created them: hand each group to its
  -- longest-standing remaining member. Groups with no one else are removed
  -- (their restaurants cascade).
  for v_group in select id from public.groups where created_by = v_uid loop
    select user_id into v_heir
    from public.group_members
    where group_id = v_group.id and user_id <> v_uid
    order by created_at
    limit 1;

    if v_heir is null then
      delete from public.groups where id = v_group.id;
    else
      update public.groups set created_by = v_heir where id = v_group.id;
    end if;
  end loop;

  delete from public.reviews where user_id = v_uid;

  -- Cascades to profiles and group_members.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.delete_user_account() to authenticated;

-- Trigger function only; never callable over the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ─── Storage ────────────────────────────────────────────────────────────────
drop policy if exists "Allow Auth Uploads" on storage.objects;
drop policy if exists "Allow Auth Updates" on storage.objects;
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow public read access" on storage.objects;
drop policy if exists "Auth users can insert photos" on storage.objects;
drop policy if exists "Authenticated users can upload photos" on storage.objects;
drop policy if exists "Authenticated users can update photos" on storage.objects;
drop policy if exists "Auth users can delete photos" on storage.objects;
drop policy if exists "Authenticated users can delete photos" on storage.objects;

-- All three buckets are public, so files are served by public URL without any
-- policy. Policies below only govern writes (and the API read that upsert needs).
-- owner_id is set by Storage to the uploader's user id.
create policy "Signed-in users can upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('photos', 'avatars', 'place_photos'));

create policy "Place photos are readable" on storage.objects
  for select
  using (bucket_id = 'place_photos');

create policy "Users can replace their own images" on storage.objects
  for update to authenticated
  using (bucket_id in ('photos', 'avatars') and owner_id = (select auth.uid())::text)
  with check (bucket_id in ('photos', 'avatars') and owner_id = (select auth.uid())::text);

create policy "Users can delete their own images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos', 'avatars') and owner_id = (select auth.uid())::text);

update storage.buckets
set allowed_mime_types = array['image/*'],
    file_size_limit = case id when 'place_photos' then 5242880 else 10485760 end  -- 5 MB / 10 MB
where id in ('photos', 'avatars', 'place_photos');
