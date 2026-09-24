-- ============================================================================
-- Data for the redesign
--
--  * restaurants.city / area / country_code — from Google address components.
--    `area` is the neighbourhood-level name shown on cards ("Williamsburg");
--    `city` and `country_code` power the Passport's Cities / Countries counts.
--  * get_group_feed: + p_search (plain search within a list), + location
--    columns, + each review author's avatar.
--  * get_my_groups(): every list the user belongs to, with its members and
--    counts (places, tried, MUSTs, cities, countries) — one call for the list
--    switcher, Passport stats and Profile.
--  * get_my_stats(): the Profile header numbers.
--
-- A "MUST" is a tried place whose members' average score is 9.0 or higher.
-- All functions are SECURITY INVOKER, so RLS decides what the caller sees.
-- ============================================================================

alter table public.restaurants
  add column if not exists city text,
  add column if not exists area text,
  add column if not exists country_code text;

-- ─── Shared: a place's average score among a list's members ─────────────────
create or replace function private.group_avg_score(p_place_id text, p_group_id uuid)
returns numeric
language sql stable security invoker set search_path = ''
as $$
  select round(avg(v.score), 1)
  from public.reviews v
  join public.group_members gm on gm.user_id = v.user_id and gm.group_id = p_group_id
  where v.place_id = p_place_id and v.score is not null;
$$;

revoke all on function private.group_avg_score(text, uuid) from public, anon;
grant execute on function private.group_avg_score(text, uuid) to authenticated;

-- ─── get_group_feed (signature changes: + p_search) ─────────────────────────
drop function if exists public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer);

create function public.get_group_feed(
  p_group_id      uuid,
  p_tab           text    default null,      -- 'cravelist' | 'tried' | null (all)
  p_category      text    default null,
  p_vibes         text[]  default null,      -- match any
  p_sort          text    default 'newest',  -- 'newest' | 'rating' | 'score' | 'visited'
  p_limit         integer default 20,        -- capped at 1000
  p_offset        integer default 0,
  p_restaurant_id integer default null,      -- fetch a single restaurant
  p_search        text    default null       -- name / type / area / address / vibe
)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  with
  me as (
    select (select auth.uid()) as uid
  ),
  -- Reviews count for this list if written by one of its members (or by me).
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
      and (s.term is null
        or r.name ilike '%' || s.term || '%'
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
$$;

revoke all on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text) from public, anon;
grant execute on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text) to authenticated;

-- ─── get_my_groups ──────────────────────────────────────────────────────────
create or replace function public.get_my_groups()
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id',         g.id,
    'name',       g.name,
    'share_code', g.share_code,
    'avatar_url', g.avatar_url,
    'created_by', g.created_by,
    'created_at', g.created_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'avatar_url', p.avatar_url
      ) order by gm.created_at)
      from public.group_members gm
      join public.profiles p on p.id = gm.user_id
      where gm.group_id = g.id
    ), '[]'::jsonb),
    'place_count',   s.place_count,
    'tried_count',   s.tried_count,
    'must_count',    s.must_count,
    'city_count',    s.city_count,
    'country_count', s.country_count
  )
  from public.groups g
  cross join lateral (
    select
      count(*)                                                        as place_count,
      count(*) filter (where r.visited)                               as tried_count,
      count(*) filter (where r.visited
        and private.group_avg_score(r.place_id, g.id) >= 9)           as must_count,
      count(distinct r.city) filter (where r.visited)                 as city_count,
      count(distinct r.country_code) filter (where r.visited)         as country_count
    from public.restaurants r
    where r.group_id = g.id
  ) s
  where g.id in (select private.my_group_ids())
  order by g.created_at;
$$;

revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;

-- ─── get_my_stats ───────────────────────────────────────────────────────────
create or replace function public.get_my_stats()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'tried',        (select count(*) from public.reviews v where v.user_id = (select auth.uid())),
    'saved',        (select count(distinct r.place_id) from public.restaurants r),
    'avg_score',    (select round(avg(v.score), 1) from public.reviews v
                     where v.user_id = (select auth.uid()) and v.score is not null),
    'member_since', (select p.created_at from public.profiles p where p.id = (select auth.uid()))
  );
$$;

revoke all on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;
