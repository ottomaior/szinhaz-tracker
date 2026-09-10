-- Cover the six foreign keys that had no index.
--
-- A foreign key with no index on the child side makes every delete of a parent
-- row scan the child table: Postgres has to prove nothing still references what
-- is going away. Supabase's linter reports this as `unindexed_foreign_keys`.
-- See T-028 in ISSUES.md.
--
-- Two of the six are not hypothetical. `reconcile()` in `sync/run.ts` deletes
-- stale plays on every run, and `reconcilePerformances()` deletes stale
-- showtimes — so `notifications.play_id` and `reviews.performance_id` are
-- scanned nightly, and both tables only grow. The other four are account
-- deletion, which is rare but is exactly when a scan is least welcome.
--
-- **Partial where the column is nullable, and that is the interesting half.**
-- A foreign key check looks for one specific id, so it can never match a null
-- row; the nulls have no business being in the index. On `plays.created_by`
-- that is not a nicety — the column is null on all 1,215 rows, because
-- `created_by` records a person adding a production by hand and every row in
-- there so far came from the sync. A plain index would be 1,215 entries of
-- nothing, maintained on every upsert of every play, every night. The partial
-- one is empty and stays empty until somebody adds a production themselves.
--
-- Postgres can use a partial index for the foreign key check because
-- `col = $1` implies `col is not null`, so the predicate is proved rather than
-- assumed.
--
-- The two NOT NULL columns get plain indexes, since there is nothing to
-- exclude.

-- Deleted on every sync run that drops a stale production, and cascades.
create index if not exists notifications_play_id_idx
  on public.notifications (play_id);

create index if not exists notifications_review_id_idx
  on public.notifications (review_id)
  where review_id is not null;

-- Null on every row today; see the note above.
create index if not exists plays_created_by_idx
  on public.plays (created_by)
  where created_by is not null;

create index if not exists review_comments_user_id_idx
  on public.review_comments (user_id);

-- Deleted on every sync run that drops a stale showtime, and sets null here.
create index if not exists reviews_performance_id_idx
  on public.reviews (performance_id)
  where performance_id is not null;

create index if not exists venues_created_by_idx
  on public.venues (created_by)
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- The eight "unused" indexes are deliberately left alone.
-- ---------------------------------------------------------------------------
--
-- `plays_poster_pending_idx`, `plays_author_trgm_idx`, `lists_featured_idx`,
-- `review_cast_name_slug_idx`, `reviews_hidden_idx`,
-- `review_comments_hidden_idx`, `reports_open_idx` and `reports_target_idx` have
-- never been scanned, and the linter suggests dropping them. Not yet, and the
-- reason is the same for all eight: an index counter reading zero on an app
-- with six accounts measures the absence of users, not the uselessness of the
-- index. Four of them are on moderation tables that would only be read once
-- somebody had been reported or hidden, which has never happened;
-- `plays_author_trgm_idx` serves a search path that T-018 would start using;
-- `lists_featured_idx` serves editorial lists nobody has browsed yet.
--
-- The honest action is to re-run the advisor once there is traffic, which is
-- recorded on the entry rather than done here. Dropping an index because it is
-- unused before launch is how you discover at launch that it was needed.

