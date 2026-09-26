# Crave

React + Capacitor iOS app (`ios/`), marketing site (`site/`), Supabase backend.

## Supabase

- Project ref: `kqdsgmiutfsxsjgubget`.
- This project is connected through the **Supabase connector** (MCP tools `mcp__Supabase__*`).
  Use it directly for SQL (`execute_sql`), migrations, logs (`query_logs`: edge, function,
  realtime, auth, postgres), and Edge Function deploys (`deploy_edge_function`, keep
  `verify_jwt: true` for `places`). Don't tell the user you can't reach Supabase.
- The sandbox's own network can't open `*.supabase.co` directly (no curl, no realtime
  websocket), so end-to-end client tests still need a device.
- Edge Function source lives in `supabase/functions/`; keep the repo copy identical to what's deployed.

## Email and website

- cravelist.us DNS is on Vercel. The marketing site (`site/`) is the Vercel project
  "crave-site"; only main deploys (the Hobby plan has a daily build limit, so `claude/`
  branches are skipped in `vercel.json`). After merging a site change, check the deploy.
- Inbox: support@cravelist.us on Zoho Mail (MX/SPF/DKIM records in Vercel).
- Auth emails (sign-up, password reset) go out through Resend via Supabase SMTP, sender
  "Crave <support@cravelist.us>". Supabase Site URL: https://www.cravelist.us.

## Shipping changes: live update or App Store build?

Every PR is checked on GitHub (lint, types, build: `.github/workflows/check.yml`). Wait for
the green check before merging; `npm run check` runs the same thing locally.

**Web-only change** (screens, styles, app logic, anything under `src/`, `index.html`, CSS):
ships as a **live update**, no App Store review. **Merging to main publishes it**: the
"Live update" workflow (`.github/workflows/live-update.yml`) builds, uploads, bumps
`WEB_VERSION` (next patch, e.g. 1.4.5 → 1.4.6) and commits that bump to main as the
github-actions bot. The user does nothing on their Mac. A merge that also touches `ios/` or
`capacitor.config.ts` is treated as native and not published (add `[ota]` to the merge
message to publish anyway). After merging, tell the user which version to expect and
check the workflow run succeeded.

Manual fallback (only if the workflow failed): on the Mac, from main,
`git pull --no-edit && npm install && npm run ota` (add `-- 1.5.0` for a specific version).
The script refuses to publish unless the Mac matches GitHub's main, and commits the version
bump itself. Never tell the user to commit `version.ts` by hand.

Phones on build `MIN_NATIVE_BUILD`+ download it on the next open and switch to it the next
time the app is backgrounded (so it shows after closing/reopening the app twice). Settings
shows "Crave v<WEB_VERSION> · build <n>". Pull a bad release: `is_active = false` on its
`app_updates` row. Failed checks land in `ota_crash_logs` ("update check failed at <stage>").

**Native change** (anything in `ios/`: Swift, the CraveShare share sheet, Info.plist,
entitlements, a new or updated Capacitor plugin in package.json) needs a **new App Store
build**:
1. Bump `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` (all four
   entries, app + CraveShare) in the PR. Never edit the build number in Xcode by hand.
2. If the web code now depends on that native change, set `MIN_NATIVE_BUILD` in
   `src/config/version.ts` to the new build, so older installs don't get it by live update.
3. User on their Mac, from main: `npm run ios`. It discards Xcode's local project-file
   edits (which otherwise block the pull), pulls, installs, builds, syncs, prints the
   version and build, and opens Xcode. Then: check App + CraveShare show the new build under
   General, Product → Archive, upload, and submit that build for review.

Build numbers only go up across versions (a version holds many builds; each upload needs a
new, higher number). Current: App Store build **10** (1.4); the latest live update is `WEB_VERSION` in
`src/config/version.ts`.

If Xcode says "Unable to find module dependency" after a plugin change: quit Xcode,
`rm -rf ~/Library/Developer/Xcode/DerivedData/App-*`, reopen, File → Packages → Reset
Package Caches, then Resolve Package Versions, then Product → Clean Build Folder.

Details, working practice, security notes and history (why builds 7 and 8 can't
live-update): docs/LIVE_UPDATES.md. Next App Store build should add bundle signing
(docs/ROADMAP.md → Security (next)).
