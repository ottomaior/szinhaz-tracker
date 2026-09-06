-- What the people you follow thought.
--
-- A rating average over the whole database answers "is this well liked". It is
-- not the question anybody actually asks in front of a listing, which is closer
-- to "would *I* like this" — and the cheapest honest proxy for that, long before
-- there is enough data for collaborative filtering, is what the handful of
-- people you chose to follow made of it.
--
-- Both functions read `reviews`, which `reviews_select_all` has made public
-- since 0001, so neither exposes anything a determined reader could not already
-- assemble. What they do is spare the client from assembling it: the alternative
-- is fetching every follow, then every review, then every profile, and joining
-- three lists in JavaScript on a screen that wants one row.

begin;

-- ---------------------------------------------------------------------------
-- On a production: who among the people you follow has seen it
-- ---------------------------------------------------------------------------
--
-- Ordered by the evening rather than by the rating: this is a list of people,
-- and sorting your friends by how much they liked something reads as a ranking
-- of them. Newest first, because "who has been recently" is the useful half.
--
-- One row per person per production, even when they saw it three times — the
-- most recent visit, with the rating they gave that night. A rewatcher
-- appearing three times would crowd out everybody else on a screen that has
-- room for a handful of faces.
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
  join public.reviews r on r.user_id = f.followee_id
  join public.profiles p on p.id = r.user_id
  where f.follower_id = viewer
    and r.play_id = play
  order by r.user_id, r.seen_at desc nulls last, r.created_at desc;
$$;

grant execute on function public.friends_ratings(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- On Discover: what they have been to lately
-- ---------------------------------------------------------------------------
--
-- Deliberately *not* "what they rated highest". A rail titled "the best of what
-- your friends saw" over four reviews is the same empty claim as the popularity
-- average this exists to sit beside; "what they have been to" is a fact and is
-- true from the first entry.
--
-- Archived productions are excluded because this rail is for deciding what to
-- go and see, and a production that closed in 2019 is not an answer to that —
-- however good it was.
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
  join public.reviews r on r.user_id = f.followee_id
  join public.plays pl on pl.id = r.play_id
  join lateral (
    select avg(r2.rating_overall) as rating
    from public.reviews r2
    where r2.user_id = r.user_id and r2.play_id = r.play_id
  ) per_user on true
  where f.follower_id = viewer
    and pl.is_archived = false
  group by r.play_id
  order by max(r.seen_at) desc nulls last, count(distinct r.user_id) desc
  limit greatest(limit_count, 0);
$$;

grant execute on function public.friends_recent_plays(uuid, int) to authenticated;

commit;
