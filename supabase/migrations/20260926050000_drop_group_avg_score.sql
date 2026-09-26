-- get_my_groups computes scores in one pass now (20260926040000), so its old per-place
-- helper has no callers.
drop function if exists private.group_avg_score(text, uuid);
