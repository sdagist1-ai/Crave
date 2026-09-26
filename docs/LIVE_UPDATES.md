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

## How to work with it

1. **One change, one PR, test first.** Merge only what you've tried (Xcode ▶ Run on your
   phone runs the current code directly; no publish needed to try it).
2. **Merging is publishing.** When a web change lands on main, GitHub builds it, uploads
   it and records the release (the "Live update" workflow), then commits the version bump.
   Watch the run under the repo's Actions tab; it takes about two minutes.
3. **Check it landed** on your own phone first (Settings shows the new version after
   reopening the app twice). If something's wrong, set `is_active = false` on its
   `app_updates` row, fix, and publish the next version. Phones that already switched stay on
   the bad one until a newer release arrives, so fix forward quickly.
4. **Watch `ota_crash_logs`** for a day after a release (screen crashes and failed checks).
5. **Batch native changes** into occasional App Store builds; everything else goes live.
   When an App Store build ships, it carries the latest web code, so publish nothing older.

## Security

What's in place:
- Only the service role can upload bundles (`app-releases`: no user storage policy covers it;
  zips only, 50 MB max) or add releases (`app_updates`: users can only read).
- `zip_url` must point at this project's `app-releases` bucket (check constraint), and the
  plugin verifies each download's sha256 against the release row.
- Bundles hold no secrets: only `VITE_` values (public Supabase URL and anon key, public
  Mapbox token) end up in them. The service role key is read only by `scripts/deploy-ota.mjs`.
- Capgo's cloud is never contacted (auto-update and stats off).
- `ota_crash_logs`: signed-in users can insert (length-capped), nobody but the service role
  can read.

The remaining risk is **the publishing key**: whoever holds `SUPABASE_SERVICE_ROLE_KEY` could
publish code that runs on every phone. So:
- It lives in two places: `.env.local` on your Mac (ignored by git; don't keep the project
  folder in iCloud Drive / Desktop & Documents sync or Dropbox, which would upload the
  file) and GitHub's **encrypted Actions secrets** for the auto-publish workflow. GitHub
  secrets can't be read back, even by you, and only workflows in this repo see them, so
  anyone who could publish through GitHub could already merge code to main.
- Publishing uses a **dedicated secret key, "ota_publish"** (Supabase → API keys), set as
  `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and in GitHub. If it's ever exposed, revoke
  that key there and create a new one; nothing else in the app uses it.
- **The GitHub copy, honestly.** Accepted risk, decided 2026-09-26.
  - What protects it: encrypted before it leaves the browser, can't be read back (only
    replaced), blanked out in logs, never given to pull requests from forks. The workflow
    uses only GitHub's own `actions/checkout` and `actions/setup-node`, no third-party
    actions, so nothing else runs with the secret in reach.
  - What doesn't: anyone who can push code to this repo could add a workflow step that
    leaks it, and whoever gets into the GitHub account gets everything. So: keep the repo
    private, keep two-factor on the GitHub account (authenticator app or passkey, not SMS),
    and think again before adding a collaborator.
  - Blast radius: it's a Supabase secret key, so it can read and write the whole database,
    not only publish. A leak means a compromised app on every phone *and* exposed user data,
    until bundle signing lands (below). If in doubt, rotate: Supabase → API Keys → delete
    `ota_publish`, create a new one, update `.env.local` and the GitHub secret. Two minutes.
- **Next App Store build: sign bundles.** Capgo supports end-to-end encryption/signing: a
  private key stays on your Mac, the public key ships in the app (`publicKey` in
  `capacitor.config.ts`), and phones reject any bundle not signed with it, even if someone
  gets write access to Supabase. Needs a native build because the public key is baked in.

## Which changes can go live without review?

| Change | How it ships |
|---|---|
| Screens, styles, copy, app logic (`src/`, CSS, `index.html`) | Live update: `npm run ota -- <version>` |
| Database / Edge Functions (`supabase/`) | Applied directly; no app release needed |
| Swift, share sheet (CraveShare), Info.plist, entitlements, app icon/splash | New App Store build |
| Adding or updating a Capacitor plugin (package.json native deps) | New App Store build (+ bump `MIN_NATIVE_BUILD` if web code uses it) |

Apple allows live updates of the web code as long as they don't change what the app is
for; new native capabilities always go through review.

## Publishing an update

One-time setup: put the service role key in `.env.local` (never commit it):

```
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase → Project Settings → API keys
```

Then, from main:

```
npm run ota                                   # next patch version, e.g. 1.4.5 → 1.4.6
npm run ota -- 1.5.0 --notes "Spin rewrite"   # a specific version
```

It first checks your Mac matches GitHub's main (stops if you're behind, have unpushed
commits, or have uncommitted changes outside `ios/`). Then it sets `WEB_VERSION` in
`src/config/version.ts`, builds, zips `dist/`, uploads it, adds the release, and commits and
pushes the version bump to main, so the next App Store build starts from that version.
`--dry-run` builds and zips without uploading.

**Normally you never run this.** `.github/workflows/live-update.yml` runs it with `--ci` on
every push to main that changes the web app (`src/`, `public/`, `index.html`,
`package-lock.json`, Vite/TS config; not `src/config/version.ts` alone). Merges that touch
`ios/` or `capacitor.config.ts` are skipped, since they may need the native side; put
`[ota]` in the merge message to publish those anyway, or `[skip ota]` to hold a web change
back. Runs are serialized, and the bot's version-bump
commit never starts another run.

- **Pull a bad update:** set `is_active = false` on its row in `app_updates`. Phones that
  already switched stay on it until the next release; publish a fixed version to move them on.
- **Crash reports:** `select * from ota_crash_logs order by created_at desc` (service role
  or the Supabase dashboard).

## History

- Builds 1.4 (7) and (8) have the plugin linked but never registered: Capacitor's automatic
  lookup by class name didn't find it ("plugin is not implemented on ios"), so they can't
  receive live updates. From build 9 it's registered by hand as a fallback:
  `registerMissingPlugins(on:)` in `ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift`,
  called from `ios/App/App/MainViewController.swift`. It does nothing if Capacitor already
  registered the plugin. Keep both if the iOS platform is ever re-created (`cap add ios`).
  Failed checks are reported to `ota_crash_logs` ("update check failed at <stage>").

## When the native app changes

`MIN_NATIVE_BUILD` in `src/config/version.ts` is the oldest App Store build the current code
runs on. When you add or change a native plugin (or anything the web code needs from the
native side), set it to the new build number. Updates published after that only go to that
build and newer; older installs keep their code until they update from the App Store.

Versions: an App Store build ships with `WEB_VERSION` (e.g. 1.4.0); live updates on top
of it are 1.4.1, 1.4.2… Starting the next App Store version, bump to 1.5.0.
