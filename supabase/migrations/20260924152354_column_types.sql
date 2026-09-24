-- ============================================================================
-- Column types
--
--  * restaurants.owner: text -> uuid, FK to profiles (on delete set null), so
--    shared restaurants survive their adder deleting their account and the API
--    can embed the adder's profile.
--  * latitude / longitude / rating: text -> numbers.
--  * vibes: text holding JSON -> jsonb array; opening_hours: jsonb *string*
--    (double-encoded) -> jsonb array. A trigger unwraps double-encoded values so
--    app builds that still send JSON.stringify(...) keep working.
--  * reviews.user_id: FK now points at profiles (still cascades from auth.users
--    through profiles), so the API can embed a review's author.
--  * Drops restaurants.user_score / visit_photo_url / visited_at: pre-reviews
--    legacy columns, unused by the app; their 3 populated rows already have the
--    same data in reviews (and a copy is in backup_20260924.restaurants).
-- ============================================================================

-- The insert policy references owner, which blocks the type change.
drop policy "Members can add restaurants to their groups" on public.restaurants;

alter table public.restaurants
  alter column owner drop not null,
  alter column owner type uuid using owner::uuid,
  alter column owner set default auth.uid(),
  alter column latitude type double precision using latitude::double precision,
  alter column longitude type double precision using longitude::double precision,
  alter column rating type numeric(2,1) using rating::numeric,
  alter column vibes drop default,
  alter column vibes type jsonb using vibes::jsonb,
  alter column vibes set default '[]'::jsonb,
  drop column user_score,
  drop column visit_photo_url,
  drop column visited_at;

update public.restaurants
set opening_hours = (opening_hours #>> '{}')::jsonb
where jsonb_typeof(opening_hours) = 'string';

alter table public.restaurants
  add constraint restaurants_owner_fkey
    foreign key (owner) references public.profiles(id) on delete set null,
  add constraint restaurants_vibes_is_array
    check (jsonb_typeof(vibes) = 'array'),
  add constraint restaurants_opening_hours_is_array
    check (opening_hours is null or jsonb_typeof(opening_hours) = 'array'),
  add constraint restaurants_rating_range
    check (rating is null or rating between 0 and 5),
  add constraint restaurants_coordinates_range
    check (latitude between -90 and 90 and longitude between -180 and 180);

create index if not exists restaurants_owner_idx on public.restaurants (owner);

create policy "Members can add restaurants to their groups" on public.restaurants
  for insert to authenticated
  with check (
    group_id in (select private.my_group_ids())
    and owner = (select auth.uid())
  );

-- Unwrap JSON that arrives double-encoded ("[\"Casual\"]" as a JSON string).
create or replace function private.restaurants_normalize_json()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.vibes is null then
    new.vibes := '[]'::jsonb;
  elsif jsonb_typeof(new.vibes) = 'string' then
    new.vibes := (new.vibes #>> '{}')::jsonb;
  end if;

  if jsonb_typeof(new.opening_hours) = 'string' then
    new.opening_hours := (new.opening_hours #>> '{}')::jsonb;
  end if;

  return new;
end;
$$;

revoke all on function private.restaurants_normalize_json() from public, anon, authenticated;

create trigger restaurants_normalize_json
  before insert or update of vibes, opening_hours on public.restaurants
  for each row execute function private.restaurants_normalize_json();

-- ─── reviews ────────────────────────────────────────────────────────────────
alter table public.reviews
  drop constraint reviews_user_id_fkey,
  add constraint reviews_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  add constraint reviews_score_range
    check (score is null or score between 0 and 10);
