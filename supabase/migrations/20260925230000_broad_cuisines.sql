-- Cuisines, simplified to eight broad groups for now.
--
-- restaurants.cuisine now holds one of: Caribbean, Latin American, African, Asian,
-- South Asian, Mediterranean & Middle Eastern, European, American. That's what the
-- filters and the picker use. The specific cuisine the guess found (Thai, Nigerian…)
-- is kept in cuisine_detail, for cards and for splitting the groups up later.
-- cuisine_catalog stays as the rules for guessing; its `region` is now the group.

create or replace function private.cuisine_groups()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['Caribbean', 'Latin American', 'African', 'Asian', 'South Asian',
               'Mediterranean & Middle Eastern', 'European', 'American'];
$$;

alter table public.restaurants add column if not exists cuisine_detail text;

-- ── Catalog: regroup, and a few more cuisines Google and names know ─────────────
update public.cuisine_catalog set region = case
  when label in ('Jamaican', 'Haitian', 'Trinidadian', 'Dominican', 'Puerto Rican', 'Cuban', 'Caribbean') then 'Caribbean'
  when region = 'Caribbean & Latin' then 'Latin American'
  when label = 'Indian' then 'South Asian'
  when label = 'Moroccan' or region = 'Mediterranean & Middle East' then 'Mediterranean & Middle Eastern'
  else region end;

-- A diet, not a cuisine.
delete from public.cuisine_catalog where label = 'Vegan';

insert into public.cuisine_catalog (label, region, sort, generic, google_types, name_keywords) values
  ('Salvadoran',       'Latin American', 24, false, '{salvadoran_restaurant}', '{salvadoran,pupusa,pupusas,pupuseria}'),
  ('Ecuadorian',       'Latin American', 25, false, '{ecuadorian_restaurant}', '{ecuadorian}'),
  ('Chilean',          'Latin American', 26, false, '{chilean_restaurant}',    '{chilean}'),
  ('Malaysian',        'Asian',          50, false, '{malaysian_restaurant}',  '{malaysian}'),
  ('Taiwanese',        'Asian',          51, false, '{taiwanese_restaurant}',  '{taiwanese}'),
  ('Pakistani',        'South Asian',    55, false, '{pakistani_restaurant}',  '{pakistani}'),
  ('Bangladeshi',      'South Asian',    56, false, '{bangladeshi_restaurant}','{bangladeshi}'),
  ('Nepalese',         'South Asian',    57, false, '{nepalese_restaurant}',   '{nepalese,nepali,momo,momos}'),
  ('Sri Lankan',       'South Asian',    58, false, '{sri_lankan_restaurant}', '{sri lankan}'),
  ('Persian',          'Mediterranean & Middle Eastern', 66, false, '{persian_restaurant,iranian_restaurant}', '{persian,iranian}'),
  ('Afghan',           'Mediterranean & Middle Eastern', 67, false, '{afghani_restaurant}', '{afghan,afghani}'),
  ('Portuguese',       'European',       75, false, '{portuguese_restaurant}', '{portuguese}'),
  ('British',          'European',       76, false, '{british_restaurant}',    '{british}'),
  ('Polish',           'European',       77, false, '{polish_restaurant}',     '{polish,pierogi}'),
  ('Eastern European', 'European',       78, true,  '{eastern_european_restaurant,russian_restaurant,ukrainian_restaurant}', '{russian,ukrainian}'),
  ('Cajun',            'American',       88, false, '{cajun_restaurant}',      '{cajun,creole}')
on conflict (label) do nothing;

-- ── Guessing ──────────────────────────────────────────────────────────────────

-- A member's pick: one of the groups, or a specific cuisine (its group). Else null.
create or replace function private.normalize_cuisine(p text)
returns text
language sql
stable
set search_path = ''
as $$
  with t as (select lower(btrim(coalesce(p, ''))) as v)
  select coalesce(
    (select g from t, unnest(private.cuisine_groups()) g where lower(g) = t.v),
    (select c.region from t, public.cuisine_catalog c where lower(c.label) = t.v)
  );
$$;

-- What other lists' members chose for this place, most common first.
create or replace function private.crowd_cuisines(p_place_id text, p_exclude_group uuid default null)
returns table (label text, lists bigint)
language sql
stable
set search_path = ''
as $$
  select r.cuisine, count(distinct r.group_id)
  from public.restaurants r
  where r.place_id = p_place_id
    and r.cuisine_source = 'member'
    and r.cuisine = any (private.cuisine_groups())
    and (p_exclude_group is null or r.group_id <> p_exclude_group)
  group by r.cuisine
  order by 2 desc, 1;
$$;

-- Best guess: the group other lists chose, else the group of the cuisine Google's type
-- or the name points to. `detail` is that specific cuisine when it fits the group.
drop function if exists private.guess_cuisine(text, text, text[], text, uuid);
create function private.guess_cuisine(p_place_id text, p_primary_type text, p_types text[], p_name text, p_exclude_group uuid default null)
returns table (cuisine text, detail text, source text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_google text;
  v_name text;
  v_detail text;
  v_source text;
  v_group text;
  v_crowd text;
begin
  v_google := private.cuisine_from_types(p_primary_type, p_types);
  v_name := private.cuisine_from_name(p_name);
  -- The name wins when Google's cuisine is one Crave can't group ("Uzbek"), or is a
  -- generic one (Caribbean) and the name is specific (Jamaican) in the same group.
  if v_google is not null and v_name is not null and (
       not exists (select 1 from public.cuisine_catalog c where c.label = v_google)
       or exists (select 1 from public.cuisine_catalog g join public.cuisine_catalog n on n.region = g.region
                  where g.label = v_google and g.generic and n.label = v_name and not n.generic)) then
    v_detail := v_name; v_source := 'name';
  elsif v_google is not null then
    v_detail := v_google; v_source := 'google';
  elsif v_name is not null then
    v_detail := v_name; v_source := 'name';
  end if;
  select c.region into v_group from public.cuisine_catalog c where c.label = v_detail;

  select c.label into v_crowd from private.crowd_cuisines(p_place_id, p_exclude_group) c limit 1;
  if v_crowd is not null then
    return query select v_crowd, case when v_group = v_crowd then v_detail end, 'crowd'::text;
    return;
  end if;
  return query select v_group, v_detail, case when v_group is null then null else v_source end;
end;
$$;

create or replace function private.restaurants_classify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guess record;
  v_pick text;
  v_detail text;
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
    -- Keep a specific cuisine only if it belongs to the chosen group.
    v_detail := coalesce(
      (select c.label from public.cuisine_catalog c where lower(c.label) = lower(v_pick)),
      case when tg_op = 'UPDATE' then old.cuisine_detail end,
      (select g.detail from private.guess_cuisine(new.place_id, new.primary_type, new.types, new.name, new.group_id) g));
    new.cuisine_detail := case
      when (select c.region from public.cuisine_catalog c where c.label = v_detail) = new.cuisine then v_detail end;
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

drop trigger if exists restaurants_classify on public.restaurants;
create trigger restaurants_classify
  before insert or update of primary_type, types, name, cuisine, occasions, cuisine_source, cuisine_detail, occasions_set
  on public.restaurants
  for each row execute function private.restaurants_classify();

-- ── For the app ───────────────────────────────────────────────────────────────

create or replace function public.guess_place_cuisine(p_place_id text, p_primary_type text default null, p_types text[] default null, p_name text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guess record;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select g.cuisine, g.detail, g.source into v_guess from private.guess_cuisine(p_place_id, p_primary_type, p_types, p_name) g;
  return jsonb_build_object(
    'cuisine', v_guess.cuisine,
    'detail', v_guess.detail,
    'source', v_guess.source,
    'crowd', coalesce((select jsonb_agg(c.label) from private.crowd_cuisines(p_place_id) c), '[]'::jsonb)
  );
end;
$$;

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
      select jsonb_agg(jsonb_build_object('label', x.cuisine, 'cravelist', x.cravelist, 'tried', x.tried)
        order by array_position(private.cuisine_groups(), x.cuisine) nulls last, x.cuisine)
      from (select cuisine, count(*) filter (where not visited) cravelist, count(*) filter (where visited) tried
            from r where cuisine is not null group by cuisine) x
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

-- Feed: cuisine_detail in each row, and search matches it.
create or replace function public.get_group_feed(
  p_group_id uuid,
  p_tab text default null,
  p_category text default null,
  p_vibes text[] default null,
  p_sort text default 'newest',
  p_limit integer default 20,
  p_offset integer default 0,
  p_restaurant_id integer default null,
  p_search text default null,
  p_cuisines text[] default null,
  p_occasion text default null
)
returns setof jsonb
language sql
stable
set search_path = ''
as $function$
  with
  me as (
    select (select auth.uid()) as uid
  ),
  reviewers as (
    select gm.user_id from public.group_members gm where gm.group_id = p_group_id
    union
    select uid from me
  ),
  search as (
    select nullif(btrim(p_search), '') as term
  ),
  feed as (
    select
      r.*,
      ap.id         as adder_id,
      ap.first_name as adder_first_name,
      ap.last_name  as adder_last_name,
      ap.avatar_url as adder_avatar_url,
      rv.reviews,
      rv.avg_score,
      rv.rated_count,
      rv.my_score,
      rv.my_reviewed_at,
      rv.last_reviewed_at
    from public.restaurants r
    left join public.profiles ap on ap.id = r.owner
    left join lateral (
      select
        coalesce(jsonb_agg(jsonb_build_object(
          'id',           v.id,
          'user_id',      v.user_id,
          'place_id',     v.place_id,
          'score',        v.score,
          'notes',        v.notes,
          'photo_url',    v.photo_url,
          'photo_urls',   v.photo_urls,
          'created_at',   v.created_at,
          'authorName',   coalesce(p.first_name, 'Lover'),
          'authorAvatar', p.avatar_url
        ) order by v.created_at), '[]'::jsonb)                            as reviews,
        round(avg(v.score) filter (where v.score is not null), 1)       as avg_score,
        count(*) filter (where v.score is not null)                      as rated_count,
        max(v.score) filter (where v.user_id = (select uid from me))      as my_score,
        max(v.created_at) filter (where v.user_id = (select uid from me)) as my_reviewed_at,
        max(v.created_at)                                                as last_reviewed_at
      from public.reviews v
      left join public.profiles p on p.id = v.user_id
      where v.place_id = r.place_id
        and v.user_id in (select user_id from reviewers)
    ) rv on true
    cross join search s
    where r.group_id = p_group_id
      and (p_restaurant_id is null or r.id = p_restaurant_id)
      and (p_tab is null or (p_tab = 'tried') = r.visited)
      and (p_vibes is null or cardinality(p_vibes) = 0 or r.vibes ?| p_vibes)
      and (p_category is null or private.matches_category(r.primary_type, r.name, p_category))
      and (p_cuisines is null or cardinality(p_cuisines) = 0
        or r.cuisine = any (p_cuisines)
        or ('' = any (p_cuisines) and r.cuisine is null))
      and (p_occasion is null or p_occasion = any (r.occasions))
      and (s.term is null
        or r.name ilike '%' || s.term || '%'
        or coalesce(r.cuisine, '') ilike '%' || s.term || '%'
        or coalesce(r.cuisine_detail, '') ilike '%' || s.term || '%'
        or replace(coalesce(r.primary_type, ''), '_', ' ') ilike '%' || s.term || '%'
        or coalesce(r.area, '') ilike '%' || s.term || '%'
        or r.address ilike '%' || s.term || '%'
        or r.vibes::text ilike '%' || s.term || '%')
  )
  select jsonb_build_object(
    'id',                x.id,
    'place_id',          x.place_id,
    'group_id',          x.group_id,
    'name',              x.name,
    'address',           x.address,
    'city',              x.city,
    'area',              x.area,
    'country_code',      x.country_code,
    'latitude',          x.latitude,
    'longitude',         x.longitude,
    'rating',            x.rating,
    'user_rating_count', x.user_rating_count,
    'price_level',       x.price_level,
    'primary_type',      x.primary_type,
    'cuisine',           x.cuisine,
    'cuisine_detail',    x.cuisine_detail,
    'occasions',         x.occasions,
    'photo_url',         x.photo_url,
    'website_url',       x.website_url,
    'booking_platform',  x.booking_platform,
    'booking_url',       x.booking_url,
    'vibes',             x.vibes,
    'notes',             x.notes,
    'opening_hours',     x.opening_hours,
    'last_synced_at',    x.last_synced_at,
    'visited',           x.visited,
    'created_at',        x.created_at,
    'added_by', case when x.adder_id is null then null else jsonb_build_object(
      'id', x.adder_id, 'first_name', x.adder_first_name,
      'last_name', x.adder_last_name, 'avatar_url', x.adder_avatar_url) end,
    'reviews',           x.reviews,
    'avg_score',         x.avg_score,
    'rated_count',       x.rated_count
  )
  from feed x
  order by
    case when p_sort = 'rating'  then x.rating end   desc nulls last,
    case when p_sort = 'score'   then x.my_score end desc nulls last,
    case when p_sort = 'visited' then coalesce(x.my_reviewed_at, x.last_reviewed_at) end desc nulls last,
    x.created_at desc,
    x.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- ── Existing places: specific cuisine → detail, group → cuisine ──────────────────
-- Written directly (trigger off) so each keeps its source.
alter table public.restaurants disable trigger restaurants_classify;

update public.restaurants r
set cuisine_detail = r.cuisine, cuisine = c.region
from public.cuisine_catalog c
where c.label = r.cuisine;

-- Anything left that isn't a group (e.g. a cuisine Google has but Crave can't group).
update public.restaurants
set cuisine_detail = cuisine, cuisine = null, cuisine_source = null
where cuisine is not null and not (cuisine = any (private.cuisine_groups()));

alter table public.restaurants enable trigger restaurants_classify;
