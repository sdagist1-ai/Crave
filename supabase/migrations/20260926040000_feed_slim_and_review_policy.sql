-- Faster lists and fewer per-row lookups.
--
-- 1. get_group_feed gets a `p_slim` option. The app fetches a whole list in one go
--    (Passport, Spin, and instant filter previews) and only needs what a card shows,
--    so slim rows leave out review notes and photos, opening hours, notes and links.
--    Old app versions never pass it and get the full rows as before.
-- 2. Reading reviews no longer runs a function for every review row. The set of
--    (place, author) pairs the caller may read is computed once per query instead.
-- 3. get_my_groups computes each place's average score in one pass over reviews
--    instead of calling a function per tried place.

-- ── 1. Slim feed rows ─────────────────────────────────────────────────────────
-- A new parameter is a new signature, so drop the old one first: two overloads with
-- defaults would make the RPC call ambiguous.
drop function if exists public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text, text[], text);

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
  p_occasion text default null,
  p_slim boolean default false
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
          'notes',        case when p_slim then null else v.notes end,
          'photo_url',    case when p_slim then null else v.photo_url end,
          'photo_urls',   case when p_slim then null else v.photo_urls end,
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
    'website_url',       case when p_slim then null else x.website_url end,
    'booking_platform',  case when p_slim then null else x.booking_platform end,
    'booking_url',       case when p_slim then null else x.booking_url end,
    'vibes',             x.vibes,
    'notes',             case when p_slim then null else x.notes end,
    'opening_hours',     case when p_slim then null else x.opening_hours end,
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

revoke all on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text, text[], text, boolean) from public, anon;
grant execute on function public.get_group_feed(uuid, text, text, text[], text, integer, integer, integer, text, text[], text, boolean) to authenticated;

-- ── 2. Reviews: one lookup per query, not per row ─────────────────────────────
-- The (place, author) pairs the caller can read: a place on a list they're on, by a
-- member of that list.
create or replace function private.review_keys_i_can_read()
returns table (place_id text, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct r.place_id::text, them.user_id
  from public.restaurants r
  join public.group_members me   on me.group_id = r.group_id and me.user_id = (select auth.uid())
  join public.group_members them on them.group_id = r.group_id;
$$;
revoke all on function private.review_keys_i_can_read() from public, anon;
grant execute on function private.review_keys_i_can_read() to authenticated;

drop policy if exists "Users can view reviews of places they share" on public.reviews;
create policy "Users can view reviews of places they share" on public.reviews
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (place_id::text, user_id) in (select k.place_id, k.user_id from private.review_keys_i_can_read() k)
  );

drop function if exists private.can_read_review(text, uuid);

-- ── 3. get_my_groups: scores in one pass ──────────────────────────────────────
create or replace function public.get_my_groups()
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  with scores as (
    -- Each place's average score among a list's members, for every list I'm in.
    select v.place_id, gm.group_id, round(avg(v.score), 1) as avg_score
    from public.reviews v
    join public.group_members gm on gm.user_id = v.user_id
    where v.score is not null
      and gm.group_id in (select private.my_group_ids())
    group by v.place_id, gm.group_id
  )
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
      count(*) filter (where r.visited and sc.avg_score >= 9)         as must_count,
      count(distinct r.city) filter (where r.visited)                 as city_count,
      count(distinct r.country_code) filter (where r.visited)         as country_count
    from public.restaurants r
    left join scores sc on sc.place_id = r.place_id and sc.group_id = g.id
    where r.group_id = g.id
  ) s
  where g.id in (select private.my_group_ids())
  order by g.created_at;
$$;
