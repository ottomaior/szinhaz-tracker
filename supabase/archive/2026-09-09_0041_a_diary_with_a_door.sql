-- ---------------------------------------------------------------------------
-- 0041 — A diary with a door
-- ---------------------------------------------------------------------------
--
-- Until now the diary was public in full. `reviews_select_all` has said so
-- since 0001, the legal texts said so in as many words, and 0033 leaned on it
-- as the reason two RPCs needed no viewer check: "neither exposes anything a
-- determined reader could not already assemble."
--
-- That was a defensible answer for a catalogue with an audience. It is the
-- wrong answer for what people actually write in here — a score out of five, a
-- paragraph about an evening, where they sat, what they paid, and a photograph
-- of a ticket that carries their name and booking reference. Seeing a stranger's
-- score in the feed without following them is what prompted this.
--
-- **The entry splits in two.** What stays public is the fact of the evening:
-- that this person saw this production, and when. What goes behind the follow is
-- everything they thought about it.
--
--   Anyone:            "Nagy Zsófia megnézte a Chicagót, tegnap."
--   She and her
--   followers:         the score, the writing, the seat, the price, the ticket.
--
-- Deliberately not row hiding. Hiding the rows would make the Mindenki feed
-- identical to Követettek, empty the first tab for every new account, blank
-- every public profile, and zero the one count — "Megnézett darab" — that a
-- stranger has to go on when deciding whether to follow somebody. Keeping the
-- row and withholding its contents keeps the app legible to a visitor while
-- making the opinions private, and it leaves the author's own reads working
-- untouched.
--
-- ---------------------------------------------------------------------------
-- Why this is a view and column privileges rather than a policy
-- ---------------------------------------------------------------------------
--
-- Row Level Security is row-level, as the name says. It can decide whether you
-- may see a row; it cannot hand you a row with three of its columns blanked.
-- Postgres has a separate mechanism for that — per-column SELECT privileges —
-- but those are not row-aware either, so revoking a column takes it from the
-- author as well.
--
-- So: both. `public.entries`, built here, hands the private columns to the
-- people entitled to them — the view runs as its owner, so it can read what its
-- callers cannot. The direct read is closed separately, in **0042**, because
-- that is the half that stops the deployed app working and so has to wait for a
-- release. This file is additive and safe to apply under a running app.
--
-- That revoke is *per column*, and that is load-bearing. A table-wide
-- `revoke select on public.reviews` would break every policy elsewhere in the
-- schema that asks a question about an entry — the comment-delete "own or host"
-- arm in 0032, `review_cast_write_own` in 0028, the comment and like insert
-- policies in 0037, and the two written below. A policy expression is evaluated
-- with the privileges of the role running the query, which is how revoking
-- EXECUTE on `private.blocked_between` took the live database down in 0037.
-- Those policies only ever read `id` and `user_id`, neither of which 0042
-- touches, so they are untouched. This pair deliberately does not repeat that
-- mistake.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Who may read an entry's contents
-- ---------------------------------------------------------------------------
--
-- In `private` for the reason 0037 puts `blocked_between` there: PostgREST only
-- exposes functions in its configured schemas, so a function here is reachable
-- from a policy and from a view, and unreachable over HTTP. Nobody gets an
-- endpoint that answers "does this person let me read them".
--
-- `security definer` because it reads `follows`, and `stable` because a policy
-- and a view both call it once per row.
create or replace function private.can_read_entry(author uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select author is not null
     and (
       author = auth.uid()
       or exists (
         select 1 from public.follows f
         where f.follower_id = auth.uid() and f.followee_id = author
       )
     );
$$;

grant execute on function private.can_read_entry(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The view every read path goes through
-- ---------------------------------------------------------------------------
--
-- Left at the default `security_invoker = false`, so it reads `public.reviews`
-- with its owner's privileges — which is the entire point, since its callers
-- are about to lose theirs.
--
-- That also means it does not inherit `reviews_select_all`, so the moderation
-- rules are restated here rather than assumed. A takedown (`is_hidden`) and a
-- block have to keep working through the view exactly as they do through the
-- table, and the author still sees their own entry either way — 0037 made that
-- arm explicit so that a hidden entry disappears from public view without
-- quietly deleting somebody's memory of a night at the theatre.
--
-- Every column of `reviews` is listed rather than `select *`: a column added to
-- the table later must be a decision about which side of this line it falls on,
-- not an accident of inheritance.
create or replace view public.entries as
select
  -- The evening itself. Public, and the reason this is a view and not a policy.
  r.id,
  r.play_id,
  r.user_id,
  r.created_at,
  r.seen_at,
  r.performance_id,
  r.is_rewatch,

  -- Everything below is what they made of it.
  case when private.can_read_entry(r.user_id) then r.rating_overall end     as rating_overall,
  case when private.can_read_entry(r.user_id) then r.rating_acting end      as rating_acting,
  case when private.can_read_entry(r.user_id) then r.rating_directing end   as rating_directing,
  case when private.can_read_entry(r.user_id) then r.rating_set_design end  as rating_set_design,
  case when private.can_read_entry(r.user_id) then r.text end               as text,
  case when private.can_read_entry(r.user_id) then r.tags end               as tags,
  case when private.can_read_entry(r.user_id) then r.seat end               as seat,
  case when private.can_read_entry(r.user_id) then r.price_huf end          as price_huf,
  -- The ticket photograph is the most sensitive thing in the row: most Hungarian
  -- theatres print the holder's name and booking reference on it. The `stubs`
  -- bucket is made private in the same release — masking the path while the
  -- object stays world-readable would be a promise the app does not keep.
  case when private.can_read_entry(r.user_id) then r.stub_path end          as stub_path,

  -- The engagement counters go with the writing. A stranger has nothing to like
  -- or comment on here, so a count beside their card would be a number about a
  -- conversation they cannot read.
  case when private.can_read_entry(r.user_id) then r.like_count end         as like_count,
  case when private.can_read_entry(r.user_id) then r.comment_count end      as comment_count
from public.reviews r
where r.user_id = auth.uid()
   or (not r.is_hidden and not private.blocked_between(r.user_id));

grant select on public.entries to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comments and likes follow the entry they hang on
-- ---------------------------------------------------------------------------
--
-- Without this the change would be cosmetic. Both tables are addressed by
-- `review_id`, and both select policies decide on the *commenter's* standing —
-- whether they are hidden, whether they are blocked — and never once look at
-- the entry underneath. A comment is up to a thousand characters of writing
-- about an evening, and it can quote the review it sits under.
--
-- 0037 left likes readable and gave a reason: "a like carries no text, reveals
-- nothing beyond a number, and filtering them would make two viewers disagree
-- about a total for no protection gained." That held while every review was
-- public. It does not hold now: a like row says that a particular entry exists
-- and who engaged with it, which is exactly the shape of thing this migration
-- exists to stop publishing.
--
-- The `exists` subquery reads `reviews.id` and `reviews.user_id` only, both of
-- which survive step 3 — see the header.
drop policy if exists "review comments are readable unless hidden or blocked" on public.review_comments;

create policy "review comments are readable to the entry's readers"
  on public.review_comments for select
  using (
    user_id = auth.uid()
    or (
      not is_hidden
      and not private.blocked_between(user_id)
      and exists (
        select 1 from public.reviews r
        where r.id = review_comments.review_id
          and private.can_read_entry(r.user_id)
      )
    )
  );

drop policy if exists "review likes are readable by everyone" on public.review_likes;

create policy "review likes are readable to the entry's readers"
  on public.review_likes for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.reviews r
      where r.id = review_likes.review_id
        and private.can_read_entry(r.user_id)
    )
  );

-- `review_cast` — who was on stage that night — stays readable by everyone. It
-- is a record of what happened in a theatre rather than of what one person
-- thought, which is the line this whole migration draws, and 0028 built it
-- precisely so that a cast sheet posted in a foyer and published nowhere
-- afterwards survives somewhere.

-- ---------------------------------------------------------------------------
-- 4. The functions that read the columns 0042 revokes
-- ---------------------------------------------------------------------------
--
-- All of these ran as the caller. The revoke in 0042 would turn each of them into
-- "permission denied for table reviews" rather than into a smaller answer, so
-- each is dealt with here. The trigger functions need nothing: 0032 and 0036
-- already made `recompute_play_rating`, the two recounts and
-- `notify_review_engagement` `security definer`, so the average still moves
-- when somebody rates a production they cannot otherwise read.

-- `season_stats` reads a rating, a price and a seat, and it takes the person it
-- is reporting on as a parameter while being granted to `anon`. As definer it
-- would answer that question about anybody, so it stops answering it about
-- anybody but the caller. No screen has ever passed another id — the season
-- recap is signed-in and self-only — so this closes a door nobody was using.
create or replace function public.season_stats(viewer uuid, season_start int)
returns table (
  entries int,
  rated int,
  venues int,
  cities int,
  rewatches int,
  first_night date,
  last_night date,
  spend_huf bigint,
  priced_entries int,
  seated_entries int,
  top_play_id uuid,
  top_rating numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with seen as (
    select r.*, p.venue_id, v.city
    from public.reviews r
    join public.plays p on p.id = r.play_id
    join public.venues v on v.id = p.venue_id
    where r.user_id = viewer
      -- The gate. A season is a year of somebody's evenings read together,
      -- which is the most revealing shape this data takes.
      and viewer = auth.uid()
      and r.seen_at is not null
      and public.season_start_year(r.seen_at) = season_start
  )
  select
    count(*)::int,
    count(rating_overall)::int,
    count(distinct venue_id)::int,
    count(distinct city)::int,
    count(*) filter (where is_rewatch)::int,
    min(seen_at),
    max(seen_at),
    coalesce(sum(price_huf), 0)::bigint,
    count(price_huf)::int,
    count(*) filter (where coalesce(seat, '') <> '')::int,
    (select s.play_id from seen s where s.rating_overall is not null
     order by s.rating_overall desc, s.seen_at desc, s.created_at desc limit 1),
    (select max(s.rating_overall) from seen s)
  from seen;
$$;

-- `user_seasons`, `season_genres` and `season_people` are left exactly as they
-- were. They read `user_id`, `seen_at` and `play_id` — activity, not opinion —
-- and none of those columns is revoked, so they neither break nor leak.

-- The two friends RPCs read a rating, so they need definer as well. Both took a
-- `viewer` parameter and never checked it against the caller, which was
-- harmless while every review was public — 0033 says so in its header, and that
-- reasoning expires today. As definer without a check, either would hand any
-- signed-in caller the ratings of anybody's followees.
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
security definer
set search_path = public, pg_temp
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
  join public.reviews r on r.user_id = f.followee_id
  join public.profiles p on p.id = r.user_id
  where f.follower_id = viewer
    and viewer = auth.uid()
    and r.play_id = play
    -- A block still hides an entry here, and a takedown still removes it. The
    -- view restates these; this function reads the table directly, so it has to
    -- restate them too.
    and not r.is_hidden
    and not private.blocked_between(r.user_id)
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
security definer
set search_path = public, pg_temp
as $$
  select
    r.play_id,
    count(distinct r.user_id)::int as friends,
    round(avg(per_user.rating), 1) as avg_rating,
    max(r.seen_at) as last_seen
  from public.follows f
  join public.reviews r on r.user_id = f.followee_id
  join public.plays pl on pl.id = r.play_id
  join lateral (
    select avg(r2.rating_overall) as rating
    from public.reviews r2
    where r2.user_id = r.user_id and r2.play_id = r.play_id
  ) per_user on true
  where f.follower_id = viewer
    and viewer = auth.uid()
    and pl.is_archived = false
    and not r.is_hidden
    and not private.blocked_between(r.user_id)
  group by r.play_id
  order by max(r.seen_at) desc nulls last, count(distinct r.user_id) desc
  limit greatest(limit_count, 0);
$$;

-- `play_rating_histogram()` counted everybody's ratings for one production into
-- five bands. The chart it fed came off the app when the public average did, so
-- nothing calls it — and as an open endpoint over private ratings it is now
-- exactly the wrong thing to leave reachable: on a production two people have
-- rated, five band counts are two people's scores. The function stays for
-- whenever the average comes back; the endpoint does not. No policy calls it,
-- so unlike 0037's revoke this one breaks nothing.
revoke execute on function public.play_rating_histogram(uuid) from anon, authenticated;

commit;
