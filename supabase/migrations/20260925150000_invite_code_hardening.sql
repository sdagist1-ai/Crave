-- Invite codes: harder to guess, rate-limited, and resettable.
--
-- Before: 6 hex characters (16⁶ ≈ 16.7M codes) and unlimited join attempts, so a
-- script could eventually land in a stranger's list.
-- After: 6 characters from a 32-letter alphabet without look-alikes (32⁶ ≈ 1.07B
-- codes), at most 10 wrong codes per user per hour, and any member can reset a
-- list's code. Existing codes keep working.

-- ── New codes ──────────────────────────────────────────────────────────────────
-- No I, O, 0 or 1, so a code read out loud or in a text can't be misread.
-- 256 is a multiple of 32, so byte % 32 picks every letter equally often.
create or replace function private.new_share_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
  end loop;
  return code;
end;
$$;

revoke all on function private.new_share_code() from public;

create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text := btrim(group_name);
  v_id   uuid;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 60 then
    raise exception 'Cravelist name must be between 1 and 60 characters' using errcode = '22023';
  end if;

  -- Retry on the (rare) collision instead of failing.
  loop
    v_code := private.new_share_code();
    exit when not exists (select 1 from public.groups where share_code = v_code);
  end loop;

  insert into public.groups (name, share_code, created_by)
  values (v_name, v_code, v_uid)
  returning id into v_id;

  insert into public.group_members (group_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;

-- ── Wrong-code limit ───────────────────────────────────────────────────────────
create table if not exists private.join_attempts (
  user_id      uuid        not null,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time on private.join_attempts (user_id, attempted_at desc);
alter table private.join_attempts enable row level security;

-- Returns json instead of uuid so a wrong code can answer with an error status
-- *without* raising: an exception would roll back the attempt it just recorded.
-- Success still returns the group id as a JSON string, and failures return
-- PostgREST's error shape ({ code, message, details, hint }), so every app version
-- reads both exactly as before.
drop function if exists public.join_group(text);

create function public.join_group(invite_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_group_id uuid;
  v_wrong    int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select count(*) into v_wrong
  from private.join_attempts
  where user_id = v_uid and attempted_at > now() - interval '1 hour';

  if v_wrong >= 10 then
    perform set_config('response.status', '429', true);
    return json_build_object('code', 'P0001', 'details', null, 'hint', null,
      'message', 'Too many wrong codes. Wait an hour, then try again.');
  end if;

  select id into v_group_id
  from public.groups
  where share_code = upper(btrim(invite_code));

  if v_group_id is null then
    insert into private.join_attempts (user_id) values (v_uid);
    delete from private.join_attempts where attempted_at < now() - interval '1 day';
    perform set_config('response.status', '400', true);
    return json_build_object('code', 'P0002', 'details', null, 'hint', null,
      'message', 'Invalid share code. Please double check with your friend!');
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_uid)
  on conflict do nothing;

  return to_json(v_group_id);
end;
$$;

revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated, service_role;

-- ── Reset a list's code ────────────────────────────────────────────────────────
-- Any member can: current members stay, and the old code stops working.
create or replace function public.reset_share_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_uid
  ) then
    raise exception 'Only members of this Cravelist can reset its code' using errcode = '42501';
  end if;

  loop
    v_code := private.new_share_code();
    exit when not exists (select 1 from public.groups where share_code = v_code);
  end loop;

  update public.groups set share_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

revoke all on function public.reset_share_code(uuid) from public, anon;
grant execute on function public.reset_share_code(uuid) to authenticated, service_role;

-- ── Who added a place can't be rewritten ───────────────────────────────────────
-- Members edit places in their lists, but "Added by" (owner), the id and the
-- creation time are set once. The app never updates these.
revoke update (owner, id, created_at) on public.restaurants from authenticated;
