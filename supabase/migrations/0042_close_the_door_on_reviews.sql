-- Opinions move behind a follow, part two: closing the door.
--
-- 0041 added `reviews_readable` and left everything else alone, so it could be
-- applied under the running app without breaking it. This is the half that
-- actually enforces anything, and it must not be applied until a client that
-- reads the view is live — until then, narrowing `reviews` empties the feed.
--
-- Four things:
--
--   1. `reviews` select narrows to own rows. The view becomes the only way to
--      read anybody else's entry, which is what makes the masking a boundary
--      rather than a decoration.
--   2. The two insert policies that read `reviews` are rewritten, because they
--      currently work only by virtue of the table being world-readable.
--   3. `review_comments`, `review_likes` and `review_cast` are narrowed to
--      match, or the gate leaks around the side.
--   4. `friends_ratings` and `friends_recent_plays` are repointed at the view.

begin;

-- ---------------------------------------------------------------------------
-- 1. The base table answers for your own entries only
-- ---------------------------------------------------------------------------
--
-- Own rows keep every column, which is what `submitReview` and `updateReview`
-- need: both end `.insert(...).select("*").single()` / `.update(...).select("*")`,
-- and a write that cannot read back what it wrote fails at the client.
--
-- Everything 0037 built stays true — a hidden or blocked row is still excluded,
-- now by the view, which repeats the rule rather than inheriting it.
drop policy if exists reviews_select_all on public.reviews;
create policy "reviews_select_own" on public.reviews
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. The policies that ask questions about somebody else's entry
-- ---------------------------------------------------------------------------
--
-- Both of these do `exists (select 1 from public.reviews r where r.id = ...)`.
-- A policy expression runs with the privileges of the role running the query —
-- the lesson 0037 paid for — so with the narrowing above, that subquery starts
-- returning nothing for every entry but your own, and liking or commenting on
-- anybody else's evening would fail with a check violation.
--
-- Rewritten against `private.entry_author`, which is definer and can see the
-- row. And gated on `can_see_entry` while we are here: an entry whose opinion
-- is closed to you should not be one you can applaud or answer. The feed does
-- not draw those controls any more, but a policy is the answer to every request
-- that will ever be made, including the ones no screen sends.
drop policy if exists "users like as themselves, on entries open to them" on public.review_likes;
create policy "users like as themselves, on entries open to them" on public.review_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.can_see_entry(private.entry_author(review_id))
    and not private.blocked_between(private.entry_author(review_id))
  );

drop policy if exists "users comment as themselves, on entries open to them" on public.review_comments;
create policy "users comment as themselves, on entries open to them" on public.review_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.can_see_entry(private.entry_author(review_id))
    and not private.blocked_between(private.entry_author(review_id))
  );

-- ---------------------------------------------------------------------------
-- 3. The tables that hang off an entry
-- ---------------------------------------------------------------------------
--
-- Masking `like_count` on the view achieves nothing while `review_likes` is
-- `using (true)`: the count is recoverable by counting rows, and the identity
-- of everybody who applauded comes with it. 0037 left likes public on the
-- grounds that a like carries no text, which was right when the entry it sat
-- on was public too, and is not right now.
--
-- Comments carry writing about a production, by people who chose to write it
-- under somebody's evening. They follow the evening.
--
-- The cast is the closest call in this migration, and it goes the same way at
-- Ottó's decision. It is the one genuinely public-good record the diary
-- produces — a foyer cast sheet is published nowhere else, and an understudy's
-- night otherwise leaves no trace. The argument that carried: it is still a
-- record of where a named person was on a given night, and consistency is
-- worth more than the archive while there are five accounts. If it comes back
-- out, it comes back out on its own terms, as a fact about the performance
-- rather than a column on somebody's diary entry.
drop policy if exists "review likes are readable by everyone" on public.review_likes;
create policy "review likes follow the entry they sit on" on public.review_likes
  for select using (private.can_see_entry(private.entry_author(review_id)));

drop policy if exists "review comments are readable unless hidden or blocked" on public.review_comments;
create policy "review comments follow the entry they sit on" on public.review_comments
  for select using (
    private.can_see_entry(private.entry_author(review_id))
    and (
      user_id = auth.uid()
      or (not is_hidden and not private.blocked_between(user_id))
    )
  );

drop policy if exists review_cast_select_all on public.review_cast;
create policy "review_cast follows the entry it belongs to" on public.review_cast
  for select using (private.can_see_entry(private.entry_author(review_id)));

-- ---------------------------------------------------------------------------
-- 4. The two functions that read reviews on the caller's behalf
-- ---------------------------------------------------------------------------
--
-- Both are `security invoker` (0033), so against the narrowed policy above they
-- would quietly return the caller's own rows and nothing else — an empty "A
-- követettek szerint" with no error anywhere to explain it.
--
-- Repointed at the view rather than made definer. The view already answers
-- exactly the question these ask, and for a followee it returns the columns
-- unmasked, so this is the shortest path that stays honest: no second copy of
-- the visibility rule, and no new definer function on a `/rpc/` endpoint.
create or replace function public.friends_ratings(viewer uuid, play uuid)
returns table (
  review_id uuid,
  user_id uuid,
  name text,
  handle text,
  initials text,
  avatar_path text,
  rating_overall numeric,
  seen_at date
)
language sql
stable
set search_path = public
as $$
  select distinct on (r.user_id)
    r.id,
    r.user_id,
    p.name,
    p.handle,
    p.initials,
    p.avatar_path,
    r.rating_overall,
    r.seen_at
  from public.follows f
  join public.reviews_readable r on r.user_id = f.followee_id
  join public.profiles p on p.id = r.user_id
  where f.follower_id = viewer
    and r.play_id = play
  order by r.user_id, r.seen_at desc nulls last, r.created_at desc;
$$;

create or replace function public.friends_recent_plays(viewer uuid, limit_count int default 10)
returns table (
  play_id uuid,
  friends int,
  avg_rating numeric,
  last_seen date
)
language sql
stable
set search_path = public
as $$
  select
    r.play_id,
    count(distinct r.user_id)::int as friends,
    -- Averaged per person first, then across people, for the same reason
    -- `recompute_play_rating()` does it: somebody who saw a production three
    -- times should not carry three times the weight of somebody who saw it once.
    round(avg(per_user.rating), 1) as avg_rating,
    max(r.seen_at) as last_seen
  from public.follows f
  join public.reviews_readable r on r.user_id = f.followee_id
  join public.plays pl on pl.id = r.play_id
  join lateral (
    select avg(r2.rating_overall) as rating
    from public.reviews_readable r2
    where r2.user_id = r.user_id and r2.play_id = r.play_id
  ) per_user on true
  where f.follower_id = viewer
    and pl.is_archived = false
  group by r.play_id
  order by max(r.seen_at) desc nulls last, count(distinct r.user_id) desc
  limit greatest(limit_count, 0);
$$;

grant execute on function public.friends_ratings(uuid, uuid) to authenticated;
grant execute on function public.friends_recent_plays(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- What this migration deliberately does not touch
-- ---------------------------------------------------------------------------
--
-- The 0031 season functions (`user_seasons`, `season_stats`, `season_genres`,
-- `season_people`) are invoker and take `viewer` as an argument. Against the
-- narrowed policy they now return the caller's own rows whatever uuid is
-- passed — unchanged in practice, since the client always passes its own id,
-- and it closes a hole nobody had noticed: until today, any uuid returned that
-- person's whole season.
--
-- `recompute_play_rating` (0036) is definer and keeps seeing every row, which
-- is right: the public averages it maintains are off the app but the columns
-- are still correct, and a per-person average must not start skipping the
-- people the reader does not happen to follow.
--
-- `play_rating_histogram` (0026) is invoker and has had no caller since
-- 08e9bb0. It now answers for the caller's own rows only. Left in place rather
-- than dropped, because dropping it is a separate decision from this one.

commit;
