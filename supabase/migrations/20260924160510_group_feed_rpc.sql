-- ============================================================================
-- get_group_feed: one call returns a page of a Cravelist, fully assembled.
--
-- Replaces the client's 3–4 sequential requests per page (restaurants, group
-- members, reviews with a place_id IN (...) list, profiles). Filtering happens
-- before pagination, so pages are never short or empty because of client-side
-- filtering, and all four sort options work.
--
-- SECURITY INVOKER: RLS applies, so a caller only ever sees their own groups.
-- Each row is a JSON object in the shape the app's Restaurant mapper expects.
-- ============================================================================

-- Category chips on the list and spin screens.
create or replace function private.matches_category(p_primary_type text, p_name text, p_category text)
returns boolean
language sql immutable set search_path = ''
as $$
  select case lower(p_category)
    when 'breakfast & brunch' then
      coalesce(p_primary_type, '') ~* '(bagel|breakfast|brunch|diner)'
      or coalesce(p_name, '') ~* '(bagel|breakfast|brunch|diner)'
    when 'bars' then
      coalesce(p_primary_type, '') ~* '(bar|pub|night_club|club|wine)'
    when 'bakeries' then
      coalesce(p_primary_type, '') ~* 'bakery' or coalesce(p_name, '') ~* 'bakery'
    when 'coffee & tea' then
      coalesce(p_primary_type, '') ~* '(cafe|coffee|tea)' or coalesce(p_name, '') ~* 'coffee'
    when 'ice cream & dessert' then
      coalesce(p_primary_type, '') ~* '(ice_cream|dessert)' or coalesce(p_name, '') ~* '(ice cream|gelato)'
    when 'restaurants' then
      coalesce(p_primary_type, '') ~* '(restaurant|food|diner)'
    else true
  end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.matches_category(text, text, text) to authenticated;

create or replace function public.get_group_feed(
  p_group_id      uuid,
  p_tab           text    default null,      -- 'cravelist' | 'tried' | null (all)
  p_category      text    default null,
  p_vibes         text[]  default null,      -- match any
  p_sort          text    default 'newest',  -- 'newest' | 'rating' | 'score' | 'visited'
  p_limit         integer default 20,        -- capped at 1000
  p_offset        integer default 0,
  p_restaurant_id integer default null       -- fetch a single restaurant
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
          'id',         v.id,
          'user_id',    v.user_id,
          'place_id',   v.place_id,
          'score',      v.score,
          'notes',      v.notes,
          'photo_url',  v.photo_url,
          'photo_urls', v.photo_urls,
          'created_at', v.created_at,
          'authorName', coalesce(p.first_name, 'Lover')
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
    where r.group_id = p_group_id
      and (p_restaurant_id is null or r.id = p_restaurant_id)
      and (p_tab is null or (p_tab = 'tried') = r.visited)
      and (p_vibes is null or cardinality(p_vibes) = 0 or r.vibes ?| p_vibes)
      and (p_category is null or private.matches_category(r.primary_type, r.name, p_category))
  )
  select jsonb_build_object(
    'id',               x.id,
    'place_id',         x.place_id,
    'group_id',         x.group_id,
    'name',             x.name,
    'address',          x.address,
    'latitude',         x.latitude,
    'longitude',        x.longitude,
    'rating',           x.rating,
    'user_rating_count', x.user_rating_count,
    'price_level',      x.price_level,
    'primary_type',     x.primary_type,
    'photo_url',        x.photo_url,
    'website_url',      x.website_url,
    'booking_platform', x.booking_platform,
    'booking_url',      x.booking_url,
    'vibes',            x.vibes,
    'notes',            x.notes,
    'opening_hours',    x.opening_hours,
    'last_synced_at',   x.last_synced_at,
    'visited',          x.visited,
    'created_at',       x.created_at,
    'added_by', case when x.adder_id is null then null else jsonb_build_object(
      'id', x.adder_id, 'first_name', x.adder_first_name,
      'last_name', x.adder_last_name, 'avatar_url', x.adder_avatar_url) end,
    'reviews',          x.reviews,
    'avg_score',        x.avg_score,
    'rated_count',      x.rated_count
  )
  from feed x
  order by
    case when p_sort = 'rating'  then x.rating end         desc nulls last,
    case when p_sort = 'score'   then x.my_score end       desc nulls last,
    case when p_sort = 'visited' then coalesce(x.my_reviewed_at, x.last_reviewed_at) end desc nulls last,
    x.created_at desc,
    x.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer) from public, anon;
grant execute on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer) to authenticated;
