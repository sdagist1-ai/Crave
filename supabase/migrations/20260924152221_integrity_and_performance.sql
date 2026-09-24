-- ============================================================================
-- Data integrity & performance
--
--  * Foreign keys: deleting a user removes their reviews (was NO ACTION, which
--    made account deletion fail) and no longer cascades into shared groups they
--    created (was CASCADE, which wiped the whole group for everyone).
--  * Uniqueness: a place can be on a list once; a user reviews a place once.
--  * Indexes for every foreign key and for the list feed ordering.
--  * `restaurants.visited` is now derived in the database: a place is "tried"
--    in a list once any member of that list has reviewed it. This replaces the
--    app's launch-time "self-healing" pass and the unused consensus RPC.
-- ============================================================================

-- ─── Foreign keys ───────────────────────────────────────────────────────────
alter table public.reviews
  drop constraint reviews_user_id_fkey,
  add constraint reviews_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.groups
  drop constraint groups_created_by_fkey,
  add constraint groups_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

-- ─── Uniqueness ─────────────────────────────────────────────────────────────
-- Keep only the most recent review per user and place. Production had one
-- legacy "ghost" pair (same score, notes differing by one character).
delete from public.reviews dup
using public.reviews newer
where dup.user_id = newer.user_id
  and dup.place_id = newer.place_id
  and (dup.created_at, dup.id) < (newer.created_at, newer.id);

alter table public.reviews
  add constraint reviews_user_place_key unique (user_id, place_id);

alter table public.restaurants
  add constraint restaurants_group_place_key unique (group_id, place_id);

-- ─── Indexes ────────────────────────────────────────────────────────────────
-- restaurants.group_id is covered by restaurants_group_place_key (leading column);
-- this one serves the feed's "newest first" ordering within a list.
create index if not exists restaurants_group_created_idx on public.restaurants (group_id, created_at desc);
create index if not exists restaurants_place_id_idx on public.restaurants (place_id);
-- reviews.user_id is covered by reviews_user_place_key (leading column).
create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists groups_created_by_idx on public.groups (created_by);

-- ─── Derived "visited" ──────────────────────────────────────────────────────
create or replace function private.place_reviewed_in_group(p_place_id text, p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews v
    join public.group_members gm on gm.user_id = v.user_id and gm.group_id = p_group_id
    where v.place_id = p_place_id
  );
$$;

-- Restaurants: visited is always computed, whatever the client sends.
create or replace function private.restaurants_set_visited()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.visited := private.place_reviewed_in_group(new.place_id, new.group_id);
  return new;
end;
$$;

create trigger restaurants_set_visited
  before insert or update of visited, place_id, group_id on public.restaurants
  for each row execute function private.restaurants_set_visited();

-- Reviews: re-derive visited for every list holding the affected place.
create or replace function private.refresh_visited(p_place_id text)
returns void
language sql security definer set search_path = ''
as $$
  update public.restaurants r
  set visited = not r.visited
  where r.place_id = p_place_id
    and r.visited is distinct from private.place_reviewed_in_group(r.place_id, r.group_id);
$$;

create or replace function private.reviews_refresh_visited()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_visited(new.place_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.place_id is distinct from new.place_id) then
    perform private.refresh_visited(old.place_id);
  end if;
  return null;
end;
$$;

create trigger reviews_refresh_visited
  after insert or delete or update of place_id on public.reviews
  for each row execute function private.reviews_refresh_visited();

revoke all on function private.place_reviewed_in_group(text, uuid) from public, anon, authenticated;
revoke all on function private.restaurants_set_visited() from public, anon, authenticated;
revoke all on function private.refresh_visited(text) from public, anon, authenticated;
revoke all on function private.reviews_refresh_visited() from public, anon, authenticated;
