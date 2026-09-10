-- Remove the superseded draft of the follow-gate.
--
-- Two ways into the same diary were built on 9 September. `public.entries` came
-- from a draft that was applied to this database and then abandoned;
-- `public.reviews_readable` is the one that shipped, and it is the one every
-- read path in the app goes through. Both mask a stranger's opinion, so this
-- was never a leak — but it is a second, unreviewed door to the same room, and
-- the security advisor flags it as the last ERROR-level finding on the project
-- (`security_definer_view`). See T-003 in ISSUES.md.
--
-- Checked before dropping, because "nothing reads it" is the whole argument:
--
--   * No reference in any TypeScript source, worktrees included.
--   * No policy, function or view in the database mentions `public.entries` or
--     `private.can_read_entry` — pg_policies, pg_proc and pg_views all empty.
--   * No catalogue dependency: nothing is registered against the view in
--     pg_depend, so `drop` without `cascade` will refuse if that is wrong.
--   * The edge logs for the last 24 hours: 1,421 requests to
--     `reviews_readable`, and three to `entries` — all three `curl/8.19.0`,
--     which was this investigation checking it was safe to remove. The app has
--     never asked for it.
--
-- Deliberately no `cascade`. If any of the above is wrong, this migration
-- should fail rather than quietly take a dependent with it.

begin;

drop view public.entries;

-- The draft's gate function goes with the view it was built for. It is
-- `security definer` and granted to `anon`, which is a thing worth not leaving
-- lying around unowned: it is unreachable over HTTP because PostgREST only
-- exposes its configured schemas and `private` is not one (verified — a POST to
-- /rest/v1/rpc/can_read_entry answers 404), but any policy could still call it.
-- Nothing does. The shipped gate is `private.can_see_entry`, which stays.
drop function private.can_read_entry(uuid);

commit;
