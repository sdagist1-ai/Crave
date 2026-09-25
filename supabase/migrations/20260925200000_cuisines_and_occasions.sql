-- Cuisines and occasions.
--
-- Every place gets a `cuisine` (Thai, Nigerian, Pizza…) and `occasions` (Brunch, Coffee,
-- Drinks, Sweets, Quick bites). Both are filled in by the database whenever a place is
-- saved — from the app, the share sheet or an old app version — and list members can
-- change them. The list tab filters by them; the old category chips keep working for
-- app versions that still send p_category.

-- ── Catalog ───────────────────────────────────────────────────────────────────
-- One row per cuisine: its region (for grouping in the Cuisines sheet), the Google
-- place types that mean it, and words in a name that give it away. `generic` cuisines
-- (Caribbean, African…) give way to a specific one from the same region.
create table if not exists public.cuisine_catalog (
  label         text primary key,
  region        text not null,
  sort          int  not null,
  generic       boolean not null default false,
  google_types  text[] not null default '{}',
  name_keywords text[] not null default '{}'
);
alter table public.cuisine_catalog enable row level security;
drop policy if exists "Anyone signed in can read the cuisine catalog" on public.cuisine_catalog;
create policy "Anyone signed in can read the cuisine catalog" on public.cuisine_catalog
  for select to authenticated using (true);
grant select on public.cuisine_catalog to authenticated;

truncate public.cuisine_catalog;
insert into public.cuisine_catalog (label, region, sort, generic, google_types, name_keywords) values
  -- Caribbean & Latin
  ('Jamaican',       'Caribbean & Latin', 10, false, '{jamaican_restaurant}',  '{jamaican,jerk}'),
  ('Haitian',        'Caribbean & Latin', 11, false, '{haitian_restaurant}',   '{haitian,lakay,griot}'),
  ('Trinidadian',    'Caribbean & Latin', 12, false, '{}',                     '{trini,trinidadian,doubles}'),
  ('Dominican',      'Caribbean & Latin', 13, false, '{dominican_restaurant}', '{dominican}'),
  ('Puerto Rican',   'Caribbean & Latin', 14, false, '{puerto_rican_restaurant}', '{puerto rican,boricua,mofongo}'),
  ('Cuban',          'Caribbean & Latin', 15, false, '{cuban_restaurant}',     '{cuban}'),
  ('Mexican',        'Caribbean & Latin', 16, false, '{mexican_restaurant}',   '{mexican,taqueria,tacos,taco,antojitos,burrito,burritos}'),
  ('Colombian',      'Caribbean & Latin', 17, false, '{colombian_restaurant}', '{colombian}'),
  ('Venezuelan',     'Caribbean & Latin', 18, false, '{venezuelan_restaurant}','{venezuelan,arepa,arepas}'),
  ('Peruvian',       'Caribbean & Latin', 19, false, '{peruvian_restaurant}',  '{peruvian,ceviche,cevicheria}'),
  ('Brazilian',      'Caribbean & Latin', 20, false, '{brazilian_restaurant}', '{brazilian,churrascaria}'),
  ('Argentinian',    'Caribbean & Latin', 21, false, '{argentinian_restaurant}','{argentinian,argentine}'),
  ('Caribbean',      'Caribbean & Latin', 22, true,  '{caribbean_restaurant}', '{caribbean,roti}'),
  ('Latin American', 'Caribbean & Latin', 23, true,  '{latin_american_restaurant}', '{latin}'),
  -- African
  ('Nigerian',       'African', 30, false, '{nigerian_restaurant}',  '{nigerian,suya,jollof}'),
  ('Ghanaian',       'African', 31, false, '{ghanaian_restaurant}',  '{ghanaian,ghana}'),
  ('Sierra Leonean', 'African', 32, false, '{}',                     '{sierra leone,freetown}'),
  ('Senegalese',     'African', 33, false, '{senegalese_restaurant}','{senegalese,senegal}'),
  ('Ethiopian',      'African', 34, false, '{ethiopian_restaurant}', '{ethiopian,injera}'),
  ('Moroccan',       'African', 35, false, '{moroccan_restaurant}',  '{moroccan,tagine}'),
  ('African',        'African', 36, true,  '{african_restaurant}',   '{african}'),
  -- Asian
  ('Chinese',        'Asian', 40, false, '{chinese_restaurant,dim_sum_restaurant}', '{chinese,dim sum,dumpling,dumplings}'),
  ('Japanese',       'Asian', 41, false, '{japanese_restaurant,sushi_restaurant,ramen_restaurant}', '{japanese,sushi,ramen,izakaya,omakase}'),
  ('Korean',         'Asian', 42, false, '{korean_restaurant}',     '{korean,bibimbap}'),
  ('Thai',           'Asian', 43, false, '{thai_restaurant}',       '{thai}'),
  ('Vietnamese',     'Asian', 44, false, '{vietnamese_restaurant}', '{vietnamese,pho,banh mi}'),
  ('Indian',         'Asian', 45, false, '{indian_restaurant}',     '{indian,tandoor,tandoori,biryani,masala}'),
  ('Filipino',       'Asian', 46, false, '{filipino_restaurant}',   '{filipino}'),
  ('Indonesian',     'Asian', 47, false, '{indonesian_restaurant}', '{indonesian}'),
  ('Asian fusion',   'Asian', 48, true,  '{asian_fusion_restaurant}', '{}'),
  ('Asian',          'Asian', 49, true,  '{asian_restaurant}',      '{}'),
  -- Mediterranean & Middle East
  ('Greek',          'Mediterranean & Middle East', 60, false, '{greek_restaurant}',   '{greek,gyro,gyros,taverna}'),
  ('Turkish',        'Mediterranean & Middle East', 61, false, '{turkish_restaurant}', '{turkish}'),
  ('Lebanese',       'Mediterranean & Middle East', 62, false, '{lebanese_restaurant}','{lebanese}'),
  ('Israeli',        'Mediterranean & Middle East', 63, false, '{israeli_restaurant}', '{israeli}'),
  ('Middle Eastern', 'Mediterranean & Middle East', 64, true,  '{middle_eastern_restaurant,falafel_restaurant}', '{falafel,shawarma,halal}'),
  ('Mediterranean',  'Mediterranean & Middle East', 65, true,  '{mediterranean_restaurant}', '{mediterranean}'),
  -- European
  ('Italian',        'European', 70, false, '{italian_restaurant}', '{italian,trattoria,osteria,pasta}'),
  ('Pizza',          'European', 71, false, '{pizza_restaurant}',   '{pizza,pizzeria}'),
  ('French',         'European', 72, false, '{french_restaurant}',  '{french,brasserie}'),
  ('Spanish',        'European', 73, false, '{spanish_restaurant,tapas_restaurant}', '{spanish,tapas}'),
  ('German',         'European', 74, false, '{german_restaurant}',  '{german,biergarten}'),
  -- American
  ('American',       'American', 80, true,  '{american_restaurant,diner}', '{american}'),
  ('Soul food',      'American', 81, false, '{soul_food_restaurant,southern_restaurant}', '{soul food,southern}'),
  ('BBQ',            'American', 82, false, '{barbecue_restaurant}', '{bbq,barbecue,smokehouse}'),
  ('Burgers',        'American', 83, false, '{hamburger_restaurant}', '{burger,burgers,smash}'),
  ('Chicken',        'American', 84, false, '{chicken_restaurant,chicken_wings_restaurant}', '{chicken,wings}'),
  ('Seafood',        'American', 85, false, '{seafood_restaurant,oyster_bar_restaurant}', '{seafood,oyster,oysters,lobster,crab}'),
  ('Steakhouse',     'American', 86, false, '{steak_house}', '{steakhouse}'),
  ('Vegan',          'American', 87, false, '{vegan_restaurant,vegetarian_restaurant}', '{vegan,vegetarian}');

-- ── Columns ───────────────────────────────────────────────────────────────────
alter table public.restaurants
  add column if not exists types          text[],
  add column if not exists cuisine        text,
  -- How the cuisine was decided: 'member' (someone on the list chose it), 'crowd' (what
  -- other lists chose), 'google' (the place type) or 'name' (a word in the name).
  add column if not exists cuisine_source text check (cuisine_source in ('member', 'crowd', 'google', 'name')),
  add column if not exists occasions      text[] not null default '{}',
  -- True once a member has edited the occasions, so they aren't recomputed.
  add column if not exists occasions_set  boolean not null default false;

create index if not exists restaurants_place_cuisine on public.restaurants (place_id) where cuisine_source = 'member';

-- ── Guessing ──────────────────────────────────────────────────────────────────

-- Tidy a typed-in cuisine: known ones get their catalog spelling ("thai" -> "Thai"),
-- others are trimmed, stripped to letters and title-cased. Empty -> null.
create or replace function private.normalize_cuisine(p text)
returns text
language sql
stable
set search_path = ''
as $$
  with t as (
    select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[^[:alpha:] &''-]', '', 'g'), '\s+', ' ', 'g')), 30), '') as v
  )
  select coalesce(
    (select c.label from public.cuisine_catalog c, t where lower(c.label) = lower(t.v)),
    (select initcap(t.v) from t)
  );
$$;

-- The cuisine a place's Google types point to (primary type first), or null.
create or replace function private.cuisine_from_types(p_primary_type text, p_types text[])
returns text
language sql
stable
set search_path = ''
as $$
  with ordered as (
    select t, ord
    from unnest(array_prepend(p_primary_type, coalesce(p_types, '{}'))) with ordinality as u(t, ord)
    where t is not null
  )
  select coalesce(
    -- A type the catalog knows.
    (select c.label from ordered o join public.cuisine_catalog c on o.t = any (c.google_types)
     order by o.ord, c.generic limit 1),
    -- Any other "<something>_restaurant" is a cuisine Google added later ("uzbek_restaurant").
    (select initcap(replace(regexp_replace(o.t, '_restaurant$', ''), '_', ' '))
     from ordered o
     where o.t ~ '^[a-z_]+_restaurant$'
       and o.t not in ('fast_food_restaurant', 'breakfast_restaurant', 'brunch_restaurant', 'dessert_restaurant',
                       'family_restaurant', 'fine_dining_restaurant', 'buffet_restaurant', 'meal_takeaway_restaurant')
     order by o.ord limit 1)
  );
$$;

-- The cuisine a place's name gives away ("… Jamaican Restaurant", "Brooklyn Suya"), or null.
-- Whole words only; specific cuisines win over generic ones.
create or replace function private.cuisine_from_name(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select c.label
  from public.cuisine_catalog c, unnest(c.name_keywords) k
  where coalesce(p_name, '') ~* ('\m' || k || '\M')
  order by c.generic, length(k) desc
  limit 1;
$$;

-- What other lists' members chose for this place, most common first. A cuisine from the
-- catalog counts from one list; one someone typed in only once two lists agree.
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
    and r.cuisine is not null
    and (p_exclude_group is null or r.group_id <> p_exclude_group)
  group by r.cuisine
  having count(distinct r.group_id) >= 2
      or exists (select 1 from public.cuisine_catalog c where c.label = r.cuisine)
  order by 2 desc, 1;
$$;

-- Best guess for a place: what other lists chose, else its Google type, else its name.
-- A generic Google cuisine (Caribbean) gives way to a specific one from the name (Jamaican).
create or replace function private.guess_cuisine(p_place_id text, p_primary_type text, p_types text[], p_name text, p_exclude_group uuid default null)
returns table (cuisine text, source text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_crowd text;
  v_google text;
  v_name text;
begin
  select c.label into v_crowd from private.crowd_cuisines(p_place_id, p_exclude_group) c limit 1;
  if v_crowd is not null then
    return query select v_crowd, 'crowd'::text; return;
  end if;
  v_google := private.cuisine_from_types(p_primary_type, p_types);
  v_name := private.cuisine_from_name(p_name);
  if v_google is not null and v_name is not null
     and exists (select 1 from public.cuisine_catalog g join public.cuisine_catalog n on n.region = g.region
                 where g.label = v_google and g.generic and n.label = v_name and not n.generic) then
    return query select v_name, 'name'::text; return;
  end if;
  if v_google is not null then return query select v_google, 'google'::text; return; end if;
  if v_name is not null then return query select v_name, 'name'::text; return; end if;
  return query select null::text, null::text;
end;
$$;

-- Occasions from Google types and the name. A place can have several.
create or replace function private.occasions_for(p_primary_type text, p_types text[], p_name text)
returns text[]
language sql
stable
set search_path = ''
as $$
  with t as (select array_prepend(p_primary_type, coalesce(p_types, '{}')) as ts, coalesce(p_name, '') as n)
  select coalesce(array_agg(o order by ord), '{}')
  from t, lateral (values
    (1, 'Brunch',      t.ts && '{breakfast_restaurant,brunch_restaurant,bagel_shop,diner}'::text[]
                        or t.n ~* '\m(brunch|breakfast|bagels?)\M'),
    (2, 'Coffee',      t.ts && '{cafe,coffee_shop,tea_house,coffee_roastery}'::text[]
                        or t.n ~* '\m(coffee|espresso|café|cafe)\M'),
    (3, 'Drinks',      t.ts && '{bar,cocktail_bar,wine_bar,pub,brewery,brewpub,beer_hall,beer_garden,lounge_bar,night_club,sports_bar,bar_and_grill,irish_pub}'::text[]
                        or t.n ~* '\m(bar|lounge|pub|tavern|brewery|cocktails?)\M'),
    (4, 'Sweets',      t.ts && '{bakery,dessert_shop,dessert_restaurant,ice_cream_shop,donut_shop,chocolate_shop,confectionery,candy_store,pastry_shop,cake_shop}'::text[]
                        or t.n ~* '\m(bakery|patisserie|pâtisserie|gelato|ice cream|donuts?|doughnuts?|dessert|desserts)\M'),
    (5, 'Quick bites', t.ts && '{fast_food_restaurant,sandwich_shop,deli,food_court,meal_takeaway,hot_dog_stand,food_stand}'::text[]
                        or t.n ~* '\m(deli|bodega)\M')
  ) as v(ord, o, hit)
  where v.hit;
$$;

-- Fill in cuisine and occasions on save, and keep them in step with Google's data
-- unless a member set them.
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

  -- Occasions
  if tg_op = 'UPDATE' and new.occasions is distinct from old.occasions then
    new.occasions := coalesce((
      select array_agg(o order by array_position(array['Brunch', 'Coffee', 'Drinks', 'Sweets', 'Quick bites'], o))
      from (select distinct unnest(new.occasions) o) x
      where o in ('Brunch', 'Coffee', 'Drinks', 'Sweets', 'Quick bites')), '{}');
    new.occasions_set := true;
  elsif (tg_op = 'INSERT' and cardinality(new.occasions) = 0) or (v_type_changed and not old.occasions_set) then
    new.occasions := private.occasions_for(new.primary_type, new.types, new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_classify on public.restaurants;
create trigger restaurants_classify
  before insert or update of primary_type, types, name, cuisine, occasions on public.restaurants
  for each row execute function private.restaurants_classify();

-- The app writes these; the trigger decides cuisine_source and occasions_set.
grant insert (types, cuisine, occasions) on public.restaurants to authenticated;
grant update (types, cuisine, occasions) on public.restaurants to authenticated;

-- ── For the app ───────────────────────────────────────────────────────────────

-- The cuisine to show when adding a place, plus what other lists chose (the picker's
-- "Other Crave lists call it"). Only cuisine names leave this function, never lists.
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
  select g.cuisine, g.source into v_guess from private.guess_cuisine(p_place_id, p_primary_type, p_types, p_name) g;
  return jsonb_build_object(
    'cuisine', v_guess.cuisine,
    'source', v_guess.source,
    'crowd', coalesce((select jsonb_agg(c.label) from private.crowd_cuisines(p_place_id) c), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.guess_place_cuisine(text, text, text[], text) from public, anon;
grant execute on function public.guess_place_cuisine(text, text, text[], text) to authenticated, service_role;

-- Counts for a list's filter chips and Cuisines sheet, per tab.
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
        array_position(array['Brunch','Coffee','Drinks','Sweets','Quick bites'], o))
      from (select o, count(*) filter (where not visited) cl, count(*) filter (where visited) tr
            from r, unnest(r.occasions) o group by o) y
    ), '[]'::jsonb),
    'needs_cuisine', jsonb_build_object(
      'cravelist', (select count(*) from r where cuisine is null and not visited),
      'tried', (select count(*) from r where cuisine is null and visited))
  );
$$;
grant execute on function public.get_list_facets(uuid) to authenticated;

-- ── Feed: cuisine and occasion filters ────────────────────────────────────────
-- Same as before plus p_cuisines (any of; '' means "needs a cuisine") and p_occasion,
-- and cuisine/occasions in each row. p_category stays for app versions before 1.5.
drop function if exists public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text);

create function public.get_group_feed(
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
grant execute on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text, text[], text) to authenticated;

-- ── Backfill ──────────────────────────────────────────────────────────────────
-- Existing places: guess each one (crowd is empty so far). The trigger is off while
-- this runs, or it would take these guesses for member choices.
alter table public.restaurants disable trigger restaurants_classify;

update public.restaurants r
set cuisine = g.cuisine, cuisine_source = g.source
from (
  select id, (private.guess_cuisine(place_id, primary_type, types, name, group_id)).*
  from public.restaurants
  where cuisine is null
) g
where g.id = r.id;

update public.restaurants
set occasions = private.occasions_for(primary_type, types, name)
where not occasions_set;

alter table public.restaurants enable trigger restaurants_classify;

-- Places whose Google type is just "restaurant" and whose name doesn't say, labelled by
-- hand (the trigger records these as member choices).
update public.restaurants r
set cuisine = v.cuisine
from (values
  ('Antojitos BK', 'Mexican'),
  ('Brooklyn Suya PLG', 'Nigerian'),
  ('Freetown Kitchen', 'Sierra Leonean'),
  ('La Cachette du Coin', 'French'),
  ('Lakay Bistro', 'Haitian'),
  ('Naxos Brooklyn', 'Greek')
) v(name, cuisine)
where r.name = v.name and r.cuisine is distinct from v.cuisine;
