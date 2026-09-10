-- ---------------------------------------------------------------------------
-- 0042 — Close the direct read
-- ---------------------------------------------------------------------------
--
-- The second half of 0041, held back deliberately and applied on its own.
--
-- 0041 is additive: it builds `public.entries` and leaves the table exactly as
-- readable as it was, so it can be applied under a running app without
-- anything noticing. This one is the moment the old way of reading stops
-- working, and the app in production still asks for `select *` on
-- `public.reviews` until the release that reads the view is out.
--
-- So the order is: 0041, then deploy, then this. Run out of order it does not
-- corrupt anything — it makes every diary read a "permission denied for table
-- reviews" until the deploy catches up.
--
-- Per column, and only the private half. `id`, `play_id`, `user_id`,
-- `created_at`, `seen_at`, `performance_id` and `is_rewatch` stay readable so
-- that the policies elsewhere in the schema that ask "whose entry is this"
-- keep working — the comment-delete arm in 0032, `review_cast_write_own` in
-- 0028, the comment and like insert policies in 0037, and the two new select
-- policies in 0041. A policy expression runs with the privileges of whoever
-- is querying, which is how a revoke took this database down once already
-- (0037, `blocked_between`). A table-wide revoke here would have done it
-- again.
--
-- `is_hidden` goes too: it is the moderator's flag, `public.entries` applies
-- it, and nothing in the app reads it.
-- ---------------------------------------------------------------------------

begin;

revoke select (
  rating_overall,
  rating_acting,
  rating_directing,
  rating_set_design,
  text,
  tags,
  seat,
  price_huf,
  stub_path,
  like_count,
  comment_count,
  is_hidden
) on public.reviews from anon, authenticated;

commit;
