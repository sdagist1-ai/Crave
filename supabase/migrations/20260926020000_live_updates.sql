-- Live updates: new web code without an App Store review (docs/LIVE_UPDATES.md).
--
-- app_updates lists released web bundles; the app reads the newest active one its
-- App Store build can run (min_build <= its build). Only the service role (the
-- `npm run ota` script) can write it. Bundles live in the public `app-releases` bucket.

create table if not exists public.app_updates (
  id         bigint generated always as identity primary key,
  version    text not null unique check (version ~ '^\d+(\.\d+){1,3}$'),
  -- Oldest App Store build (CFBundleVersion) this bundle runs on.
  min_build  integer not null check (min_build > 0),
  zip_url    text not null check (starts_with(zip_url, 'https://kqdsgmiutfsxsjgubget.supabase.co/storage/v1/object/public/app-releases/')),
  -- sha256 of the zip; the plugin refuses a download that doesn't match.
  checksum   text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_updates enable row level security;
drop policy if exists "Anyone can see active releases" on public.app_updates;
create policy "Anyone can see active releases" on public.app_updates
  for select to anon, authenticated using (is_active);
revoke all on public.app_updates from anon, authenticated;
grant select on public.app_updates to anon, authenticated;

-- Crashes on screen, reported by the app before it rolls a bad update back.
-- Anyone signed in can add one; nobody but the service role can read them.
create table if not exists public.ota_crash_logs (
  id            bigint generated always as identity primary key,
  version       text not null check (length(version) <= 20),
  build         integer,
  error_message text not null check (length(error_message) <= 1000),
  user_id       uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
alter table public.ota_crash_logs enable row level security;
drop policy if exists "Signed-in users can report a crash" on public.ota_crash_logs;
create policy "Signed-in users can report a crash" on public.ota_crash_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.ota_crash_logs from anon, authenticated;
grant insert (version, build, error_message) on public.ota_crash_logs to authenticated;

-- Public so the app can download without signing in; only the service role uploads.
insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', true)
on conflict (id) do update set public = true;
