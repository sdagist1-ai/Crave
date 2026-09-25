-- Privacy and edit limits.
--
-- 1. Reviews are readable only where you and the author share a list that has the
--    place. Before, sharing any list with someone let you read all their reviews and
--    notes through the API, including places on lists you're not on. (The app only
--    ever showed reviews for the list on screen; now the database enforces it.)
-- 2. Members can edit only the fields of a place the app actually changes. Before,
--    they could rewrite any column (name, who added it, which list it's in).
-- 3. A place's photo must be one Crave stored, so a member can't point it at an
--    outside server that would see everyone's IP address when the image loads.

-- ── 1. Reviews ────────────────────────────────────────────────────────────────
create or replace function private.can_read_review(p_place_id text, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants r
    join public.group_members me   on me.group_id = r.group_id and me.user_id = (select auth.uid())
    join public.group_members them on them.group_id = r.group_id and them.user_id = p_author
    where r.place_id = p_place_id
  );
$$;
revoke all on function private.can_read_review(text, uuid) from public, anon;
grant execute on function private.can_read_review(text, uuid) to authenticated;

drop policy if exists "Users can view their own and co-members' reviews" on public.reviews;
drop policy if exists "Users can view reviews of places they share" on public.reviews;
create policy "Users can view reviews of places they share" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_read_review(place_id, user_id));

-- ── 2. Which fields members can edit ──────────────────────────────────────────
-- What the app writes: the refresh from Google (hours, photo, rating, price, location,
-- types), cuisine and occasions, and `visited` (app versions before the redesign set
-- it directly; now the database does).
revoke update on public.restaurants from authenticated, anon;
grant update (
  last_synced_at, opening_hours, photo_url, rating, user_rating_count, price_level,
  city, area, country_code, types, primary_type, cuisine, occasions, visited
) on public.restaurants to authenticated;

-- ── 3. Photos come from Crave's own storage ───────────────────────────────────
create or replace function private.restaurants_photo_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.photo_url is not null and not starts_with(
       new.photo_url, 'https://kqdsgmiutfsxsjgubget.supabase.co/storage/v1/object/public/place_photos/') then
    new.photo_url := case when tg_op = 'UPDATE' then old.photo_url end;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_photo_guard on public.restaurants;
create trigger restaurants_photo_guard
  before insert or update of photo_url on public.restaurants
  for each row execute function private.restaurants_photo_guard();
