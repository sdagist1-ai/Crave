-- When a member switches a place between groups, keep its specific cuisine if it fits
-- the new group (Thai → Latin American → back to Asian keeps "Thai"). Before this, a
-- group whose name is also a catalog cuisine (Asian, Caribbean) replaced it.

create or replace function private.restaurants_classify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guess record;
  v_pick text;
  v_type_changed boolean := tg_op = 'UPDATE' and (
    new.primary_type is distinct from old.primary_type or new.types is distinct from old.types or new.name is distinct from old.name);
  v_date_night boolean;
begin
  -- Only this trigger decides these, whatever the app sends.
  if tg_op = 'INSERT' then
    new.cuisine_source := null;
    new.cuisine_detail := null;
    new.occasions_set := false;
  else
    new.cuisine_source := old.cuisine_source;
    new.cuisine_detail := old.cuisine_detail;
    new.occasions_set := old.occasions_set;
  end if;

  -- Cuisine
  if (tg_op = 'INSERT' and new.cuisine is not null) or (tg_op = 'UPDATE' and new.cuisine is distinct from old.cuisine) then
    -- A member chose (or cleared) it.
    v_pick := btrim(new.cuisine);
    new.cuisine := private.normalize_cuisine(v_pick);
    new.cuisine_source := case when new.cuisine is null then null else 'member' end;
    -- The specific cuisine: what they typed (if it wasn't a group), else the one it had,
    -- else the guess; the first that belongs to the chosen group.
    new.cuisine_detail := (
      select c.label
      from unnest(array[
        case when lower(v_pick) not in (select lower(g) from unnest(private.cuisine_groups()) g) then v_pick end,
        case when tg_op = 'UPDATE' then old.cuisine_detail end,
        (select g.detail from private.guess_cuisine(new.place_id, new.primary_type, new.types, new.name, new.group_id) g)
      ]) with ordinality as u(d, i)
      join public.cuisine_catalog c on lower(c.label) = lower(u.d)
      where c.region = new.cuisine
      order by u.i
      limit 1);
  elsif tg_op = 'INSERT' or (v_type_changed and coalesce(old.cuisine_source, '') <> 'member') then
    select g.cuisine, g.detail, g.source into v_guess
    from private.guess_cuisine(new.place_id, new.primary_type, new.types, new.name, new.group_id) g;
    new.cuisine := v_guess.cuisine;
    new.cuisine_detail := v_guess.detail;
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
