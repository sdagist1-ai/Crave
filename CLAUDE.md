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

## Live updates

Web code can ship without App Store review: `npm run ota -- <version>` (docs/LIVE_UPDATES.md).
Native changes need a build. Bump `MIN_NATIVE_BUILD` in `src/config/version.ts` whenever the
web code starts needing something new from the native side.
