# Supabase

Project: `Crave` (`kqdsgmiutfsxsjgubget`, us-west-2).

## Migrations

Every schema change lives in `migrations/` and is applied in filename order.
The file's timestamp prefix matches the version recorded in the project's
migration history (`supabase migration list`).

- `20260924000000_baseline.sql` — the hand-built schema as it was before
  migrations were tracked. Not applied to production (it already had this state);
  use it to bring up a local or branch database.
- `…_security_hardening.sql` — RLS rewrite, locked-down RPCs, storage policies.
- `…_integrity_and_performance.sql` — FK delete rules, uniqueness, indexes,
  database-derived `restaurants.visited`.
- `…_column_types.sql` — numeric coordinates/rating, jsonb vibes/hours, uuid owner.

Make new changes as new migration files rather than in the dashboard, then
regenerate the client types:

```sh
npx supabase gen types typescript --project-id kqdsgmiutfsxsjgubget > src/types/database.ts
```

## Rules the app relies on

- Groups are created only via `create_group(name)` and joined only via
  `join_group(code)`; both return the group id.
- Members see only their own groups, co-members' profiles and co-members' reviews.
- `restaurants.visited` is computed by triggers (a place is "tried" once any
  member of that list has reviewed it); values sent by the client are ignored.
- `restaurants.owner` defaults to the signed-in user.
- `(group_id, place_id)` and `(user_id, place_id)` on reviews are unique.

## Backup

`backup_20260924` (not exposed over the API) holds a copy of every public table,
the previous policies, functions and bucket settings taken just before the
2026-09-24 migrations. Drop it once you're confident nothing needs restoring:

```sql
drop schema backup_20260924 cascade;
```
