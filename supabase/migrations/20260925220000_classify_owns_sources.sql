-- The classify trigger owns cuisine_source and occasions_set.
--
-- Members can write any column of their list's places, so without this someone could
-- mark Google's guess as their own choice (feeding it to other lists as a suggestion)
-- or stop occasions being recomputed. The trigger now resets both and also runs when
-- only they are written.

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
  -- Only this trigger decides these two, whatever the app sends.
  if tg_op = 'INSERT' then
    new.cuisine_source := null;
    new.occasions_set := false;
  else
    new.cuisine_source := old.cuisine_source;
    new.occasions_set := old.occasions_set;
  end if;

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

drop trigger if exists restaurants_classify on public.restaurants;
create trigger restaurants_classify
  before insert or update of primary_type, types, name, cuisine, occasions, cuisine_source, occasions_set
  on public.restaurants
  for each row execute function private.restaurants_classify();
