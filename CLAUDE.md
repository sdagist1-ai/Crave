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

## Shipping changes: live update or App Store build?

**Web-only change** (screens, styles, app logic, anything under `src/`, `index.html`, CSS):
ship it as a **live update**, no App Store review. After the PR is merged, the user runs on
their Mac, from main:

```
git pull --no-edit && npm install
npm run ota -- <next version>     # e.g. 1.4.5, then 1.4.6 …
```

The script refuses to publish unless the Mac matches GitHub's main (so what ships is what
was reviewed), and afterwards commits and pushes the `WEB_VERSION` bump itself. Never tell
the user to commit `version.ts` by hand.

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
3. User on their Mac: `git checkout -- ios/App/App.xcodeproj` (discard Xcode's local edits,
   which otherwise block the pull), `git pull`, `npm install`, `npm run build`,
   `npx cap sync ios`, `npx cap open ios`, check App + CraveShare show the new build under
   General, then Product → Archive and upload. Submit that build for review.

Build numbers only go up across versions (a version holds many builds; each upload needs a
new, higher number). Current: App Store build **10** (1.4); the latest live update is `WEB_VERSION` in
`src/config/version.ts`.

If Xcode says "Unable to find module dependency" after a plugin change: quit Xcode,
`rm -rf ~/Library/Developer/Xcode/DerivedData/App-*`, reopen, File → Packages → Reset
Package Caches, then Resolve Package Versions, then Product → Clean Build Folder.

Details, working practice, security notes and history (why builds 7 and 8 can't
live-update): docs/LIVE_UPDATES.md. Next App Store build should add bundle signing
(docs/ROADMAP.md → Security (next)).
