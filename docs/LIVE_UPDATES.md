# Live updates

Crave can ship new web code (screens, styles, app logic) to phones without an App Store
review. Native changes (Swift, the share sheet, a new Capacitor plugin) still need a
build through review.

## How it works

- The app ships Capgo's open-source updater plugin, self-hosted: bundles live in the
  public Supabase Storage bucket `app-releases`, and the `app_updates` table lists them.
  Nothing talks to Capgo's cloud (auto-update and stats are off in `capacitor.config.ts`).
- On launch and whenever it comes back to the foreground, the app (`src/lib/liveUpdate.ts`)
  asks for the newest active release whose `min_build` is at or below its App Store build.
  If that's newer than the code it's running (`WEB_VERSION`), it downloads it in the
  background and switches to it **the next time the app is backgrounded**. Nobody is
  interrupted, and launch isn't slowed down.
- It only ever moves forward, so a fresh App Store build is never pulled back to an older
  update, and a new App Store build starts from its own code (`resetWhenUpdate`).

## Safety nets

- If a new bundle doesn't start properly (doesn't reach `notifyAppReady` within 10 s),
  the plugin rolls back automatically.
- If it crashes on screen, the error boundary reports it to `ota_crash_logs`, marks that
  version as bad on the device (never downloaded again there) and goes back to the last
  version that worked.
- The plugin checks each download against its sha256.

## Publishing an update

One-time setup: put the service role key in `.env.local` (never commit it):

```
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase → Project Settings → API keys
```

Then, from main:

```
npm run ota -- 1.4.1 --notes "Fix the Spin button"
```

It sets `WEB_VERSION` in `src/config/version.ts`, builds, zips `dist/`, uploads it and adds
the release. **Commit `src/config/version.ts` afterwards** so the next App Store build starts
from that version. `--dry-run` builds and zips without uploading.

- **Pull a bad update:** set `is_active = false` on its row in `app_updates`. Phones that
  already switched stay on it until the next release; publish a fixed version to move them on.
- **Crash reports:** `select * from ota_crash_logs order by created_at desc` (service role
  or the Supabase dashboard).

## When the native app changes

`MIN_NATIVE_BUILD` in `src/config/version.ts` is the oldest App Store build the current code
runs on. When you add or change a native plugin (or anything the web code needs from the
native side), set it to the new build number. Updates published after that only go to that
build and newer; older installs keep their code until they update from the App Store.

Versions: an App Store build ships with `WEB_VERSION` (e.g. 1.4.0); live updates on top
of it are 1.4.1, 1.4.2… Starting the next App Store version, bump to 1.5.0.
