-- Ask who is signed in once per statement, not once per row.
--
-- `auth.uid()` inside a policy is STABLE, not IMMUTABLE, so Postgres re-runs it
-- for every row the policy is checked against. Wrapping it in a scalar
-- subquery — `(select auth.uid())` — lets the planner hoist it into an InitPlan
-- and evaluate it once. Supabase's linter reports the difference as
-- `auth_rls_initplan`; it reported 34 policies here. See T-027 in ISSUES.md.
--
-- Invisible at this size: the largest user table holds six rows. It stops being
-- invisible on the feed under real volume, which is the screen T-016 wants
-- measured — every row there consults a policy, and the follow-gate added more
-- of them. Doing this first means that measurement is of the feed rather than
-- of this.
--
-- **Written out policy by policy rather than looped.** A loop over `pg_policies`
-- doing a string substitution would be shorter and is how the same job is
-- usually done. It is the wrong shape for this one: these expressions are the
-- access rules of the whole application, and the version in the repository
-- should be the version a reader can check line by line against what they think
-- the rules are. `0044` looped because it changed no expression at all.
--
-- Nothing below changes what any policy permits. Every expression is the one
-- already in place with `auth.uid()` replaced by `(select auth.uid())`, which
-- returns the same value; the second half re-shapes four policies without
-- widening any of them, and says why for each.
--
-- `private.can_see_entry()` and `private.blocked_between()` are deliberately
-- *not* wrapped. They take a per-row argument, so there is nothing to hoist —
-- a subquery around them would be evaluated per row anyway, and would read as
-- though it were not.

-- ---------------------------------------------------------------------------
-- Part one: hoist auth.uid() out of the per-row loop.
-- ---------------------------------------------------------------------------

-- follows
alter policy "users follow accounts open to them" on public.follows
  with check (((follower_id = (select auth.uid())) and (not private.blocked_between(followee_id))));
alter policy "users remove their own follows" on public.follows
  using ((follower_id = (select auth.uid())));

-- notifications
alter policy "users read their own notifications" on public.notifications
  using ((user_id = (select auth.uid())));
alter policy "users update their own notifications" on public.notifications
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy "users delete their own notifications" on public.notifications
  using ((user_id = (select auth.uid())));

-- plays
alter policy "plays_insert_auth" on public.plays
  with check ((created_by = (select auth.uid())));
alter policy "plays_update_own" on public.plays
  using ((created_by = (select auth.uid())))
  with check ((created_by = (select auth.uid())));
alter policy "plays_delete_own" on public.plays
  using ((created_by = (select auth.uid())));

-- profiles
alter policy "profiles_insert_own" on public.profiles
  with check (((select auth.uid()) = id));
alter policy "profiles_update_own" on public.profiles
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));

-- reports
alter policy "users file their own reports" on public.reports
  with check ((reporter_id = (select auth.uid())));
alter policy "users read their own reports" on public.reports
  using ((reporter_id = (select auth.uid())));

-- review_comments
alter policy "review comments follow the entry they sit on" on public.review_comments
  using (((user_id = (select auth.uid()))
          or (private.can_see_entry(private.entry_author(review_id))
              and (not is_hidden)
              and (not private.blocked_between(user_id)))));
alter policy "users comment as themselves, on entries open to them" on public.review_comments
  with check (((user_id = (select auth.uid()))
               and private.can_see_entry(private.entry_author(review_id))
               and (not private.blocked_between(private.entry_author(review_id)))));
alter policy "users edit their own comments" on public.review_comments
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy "users delete comments they own or host" on public.review_comments
  using (((user_id = (select auth.uid()))
          or (exists (select 1
                        from public.reviews r
                       where ((r.id = review_comments.review_id)
                              and (r.user_id = (select auth.uid())))))));

-- review_likes
alter policy "review likes follow the entry they sit on" on public.review_likes
  using (((user_id = (select auth.uid()))
          or private.can_see_entry(private.entry_author(review_id))));
alter policy "users like as themselves, on entries open to them" on public.review_likes
  with check (((user_id = (select auth.uid()))
               and private.can_see_entry(private.entry_author(review_id))
               and (not private.blocked_between(private.entry_author(review_id)))));
alter policy "users remove their own likes" on public.review_likes
  using ((user_id = (select auth.uid())));

-- reviews
alter policy "reviews_select_own" on public.reviews
  using ((user_id = (select auth.uid())));
alter policy "reviews_insert_own" on public.reviews
  with check ((user_id = (select auth.uid())));
alter policy "reviews_update_own" on public.reviews
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy "reviews_delete_own" on public.reviews
  using ((user_id = (select auth.uid())));

-- subject_follows
alter policy "users manage their own subject follows" on public.subject_follows
  with check ((user_id = (select auth.uid())));
alter policy "users remove their own subject follows" on public.subject_follows
  using ((user_id = (select auth.uid())));

-- user_blocks
alter policy "users read their own blocks" on public.user_blocks
  using ((blocker_id = (select auth.uid())));
alter policy "users create their own blocks" on public.user_blocks
  with check ((blocker_id = (select auth.uid())));
alter policy "users remove their own blocks" on public.user_blocks
  using ((blocker_id = (select auth.uid())));

-- venues
alter policy "venues_insert_auth" on public.venues
  with check ((created_by = (select auth.uid())));

-- watchlist_entries
alter policy "watchlist_insert_own" on public.watchlist_entries
  with check ((user_id = (select auth.uid())));
alter policy "watchlist_delete_own" on public.watchlist_entries
  using ((user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Part two: stop the write policies adding a second SELECT branch.
-- ---------------------------------------------------------------------------
--
-- `for all` means *every* command, SELECT included. Each of these four tables
-- therefore carries two permissive SELECT policies, and Postgres evaluates both
-- on every read — an `exists (…)` subquery per row on `performances` and
-- `play_cast`, the two tables every listing screen reads. That is the
-- `multiple_permissive_policies` finding.
--
-- Splitting each into the three commands it was actually for widens nothing,
-- and in each case the dedicated SELECT policy already permits at least as much
-- as the branch being dropped:
--
--   performances / play_cast  the SELECT policy is `using (true)`.
--   review_cast               the SELECT policy is
--                             `can_see_entry(entry_author(review_id))`, and
--                             `can_see_entry` returns true when the author is
--                             the caller — so a person can already see the
--                             cast rows on their own entries.
--   list_items                the SELECT policy is `l.is_public or l.owner_id =
--                             auth.uid()`, of which the dropped branch is the
--                             right-hand half.
--
-- `alter policy` cannot change which commands a policy covers, so each is
-- dropped and recreated. The migration is one transaction, so there is no
-- moment when a table is writable without its rule.

-- performances
drop policy if exists "performances_write_own_play" on public.performances;
create policy "performances_insert_own_play" on public.performances for insert
  with check (exists (select 1 from public.plays p
                       where p.id = performances.play_id
                         and p.created_by = (select auth.uid())));
create policy "performances_update_own_play" on public.performances for update
  using (exists (select 1 from public.plays p
                  where p.id = performances.play_id
                    and p.created_by = (select auth.uid())))
  with check (exists (select 1 from public.plays p
                       where p.id = performances.play_id
                         and p.created_by = (select auth.uid())));
create policy "performances_delete_own_play" on public.performances for delete
  using (exists (select 1 from public.plays p
                  where p.id = performances.play_id
                    and p.created_by = (select auth.uid())));

-- play_cast
drop policy if exists "play_cast_write_own_play" on public.play_cast;
create policy "play_cast_insert_own_play" on public.play_cast for insert
  with check (exists (select 1 from public.plays p
                       where p.id = play_cast.play_id
                         and p.created_by = (select auth.uid())));
create policy "play_cast_update_own_play" on public.play_cast for update
  using (exists (select 1 from public.plays p
                  where p.id = play_cast.play_id
                    and p.created_by = (select auth.uid())))
  with check (exists (select 1 from public.plays p
                       where p.id = play_cast.play_id
                         and p.created_by = (select auth.uid())));
create policy "play_cast_delete_own_play" on public.play_cast for delete
  using (exists (select 1 from public.plays p
                  where p.id = play_cast.play_id
                    and p.created_by = (select auth.uid())));

-- review_cast
drop policy if exists "review_cast_write_own" on public.review_cast;
create policy "review_cast_insert_own" on public.review_cast for insert to authenticated
  with check (exists (select 1 from public.reviews r
                       where r.id = review_cast.review_id
                         and r.user_id = (select auth.uid())));
create policy "review_cast_update_own" on public.review_cast for update to authenticated
  using (exists (select 1 from public.reviews r
                  where r.id = review_cast.review_id
                    and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.reviews r
                       where r.id = review_cast.review_id
                         and r.user_id = (select auth.uid())));
create policy "review_cast_delete_own" on public.review_cast for delete to authenticated
  using (exists (select 1 from public.reviews r
                  where r.id = review_cast.review_id
                    and r.user_id = (select auth.uid())));

-- list_items
drop policy if exists "users write entries in their own lists" on public.list_items;
create policy "users add entries to their own lists" on public.list_items for insert to authenticated
  with check (exists (select 1 from public.lists l
                       where l.id = list_items.list_id
                         and l.owner_id = (select auth.uid())));
create policy "users edit entries in their own lists" on public.list_items for update to authenticated
  using (exists (select 1 from public.lists l
                  where l.id = list_items.list_id
                    and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l
                       where l.id = list_items.list_id
                         and l.owner_id = (select auth.uid())));
create policy "users remove entries from their own lists" on public.list_items for delete to authenticated
  using (exists (select 1 from public.lists l
                  where l.id = list_items.list_id
                    and l.owner_id = (select auth.uid())));
