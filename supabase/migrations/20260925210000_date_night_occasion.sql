-- Vibes become an occasion.
--
-- "Casual" was on nearly every place (44 of 57), so as a filter it did nothing; what
-- "Elegant" really meant was "somewhere for a date night". The app now shows a
-- Date night occasion instead of Casual/Elegant. `vibes` stays for app versions
-- before 1.5, and a place saved as Elegant by one of them gets Date night.

-- Occasions a member can set, in display order.
create or replace function private.valid_occasions(p text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(o order by array_position(
           array['Brunch', 'Coffee', 'Drinks', 'Date night', 'Sweets', 'Quick bites'], o)), '{}')
  from (select distinct unnest(p) o) x
  where o in ('Brunch', 'Coffee', 'Drinks', 'Date night', 'Sweets', 'Quick bites');
$$;

create or replace function private.restaurants_classify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guess record;
  v_type_changed boolean := tg_op = 'UPDATE' and (
    new.primary_type is distinct from old.primary_type or new.types is distinct from old.types or new.name is distinct from old.name);
  v_date_night boolean;
begin
  -- Cuisine
  if tg_op = 'INSERT' and new.cuisine is not null then
    new.cuisine := private.normalize_cuisine(new.cuisine);
    new.cuisine_source := case when new.cuisine is null then null else 'member' end;
  elsif tg_op = 'UPDATE' and new.cuisine is distinct from old.cuisine then
    -- A member changed (or cleared) it.
    new.cuisine := private.normalize_cuisine(new.cuisine);
    new.cuisine_source := case when new.cuisine is null then null else 'member' end;
  elsif tg_op = 'INSERT' or (v_type_changed and coalesce(old.cuisine_source, '') <> 'member') then
    select g.cuisine, g.source into v_guess
    from private.guess_cuisine(new.place_id, new.primary_type, new.types, new.name, new.group_id) g;
    new.cuisine := v_guess.cuisine;
    new.cuisine_source := v_guess.source;
  end if;

  -- Occasions. On save, what the member picked plus what the place's type and name
  -- say (and Date night for an old app's "Elegant").
  if tg_op = 'INSERT' then
    new.occasions := private.valid_occasions(
      coalesce(new.occasions, '{}')
      || private.occasions_for(new.primary_type, new.types, new.name)
      || case when coalesce(new.vibes, '[]'::jsonb) ? 'Elegant' then array['Date night'] else '{}' end);
  elsif new.occasions is distinct from old.occasions then
    new.occasions := private.valid_occasions(new.occasions);
    new.occasions_set := true;
  elsif v_type_changed and not old.occasions_set then
    -- Date night can't be read from Google's data, so keep it.
    v_date_night := 'Date night' = any (old.occasions);
    new.occasions := private.valid_occasions(
      private.occasions_for(new.primary_type, new.types, new.name)
      || case when v_date_night then array['Date night'] else '{}' end);
  end if;
  return new;
end;
$$;

-- Counts in display order.
create or replace function public.get_list_facets(p_group_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with r as (
    select cuisine, occasions, visited from public.restaurants where group_id = p_group_id
  )
  select jsonb_build_object(
    'cuisines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', x.cuisine, 'region', coalesce(c.region, 'Other'),
        'cravelist', x.cravelist, 'tried', x.tried) order by c.sort nulls last, x.cuisine)
      from (select cuisine, count(*) filter (where not visited) cravelist, count(*) filter (where visited) tried
            from r where cuisine is not null group by cuisine) x
      left join public.cuisine_catalog c on c.label = x.cuisine
    ), '[]'::jsonb),
    'occasions', coalesce((
      select jsonb_agg(jsonb_build_object('label', o, 'cravelist', cl, 'tried', tr) order by
        array_position(array['Brunch','Coffee','Drinks','Date night','Sweets','Quick bites'], o))
      from (select o, count(*) filter (where not visited) cl, count(*) filter (where visited) tr
            from r, unnest(r.occasions) o group by o) y
    ), '[]'::jsonb),
    'needs_cuisine', jsonb_build_object(
      'cravelist', (select count(*) from r where cuisine is null and not visited),
      'tried', (select count(*) from r where cuisine is null and visited))
  );
$$;

-- Places saved as Elegant. Written directly (trigger off) so they still follow
-- Google's data later rather than counting as a member's edit.
alter table public.restaurants disable trigger restaurants_classify;
update public.restaurants
set occasions = private.valid_occasions(occasions || array['Date night'])
where vibes ? 'Elegant' and not ('Date night' = any (occasions));
alter table public.restaurants enable trigger restaurants_classify;
