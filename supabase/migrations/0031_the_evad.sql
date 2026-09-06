-- The season in review, counted on the évad rather than the calendar year.
--
-- Nobody counts their theatregoing in calendar years. The Hungarian season runs
-- from September, and a page that splits at 31 December cuts every one of them
-- in half: the Vígszínház premiere you saw in November and the one you saw in
-- February belong to the same évad and would land in two different totals.
--
-- The profile has shown a `thisYear` stat since 0001, on exactly that wrong
-- calendar. This is that stat grown into a screen and given the right one.
--
-- Every input already exists: `seen_at` from 0022, seats and prices from 0028,
-- and who was actually on from `review_cast`.

begin;

-- ---------------------------------------------------------------------------
-- Which évad a night belongs to
-- ---------------------------------------------------------------------------
--
-- Named by the year it opens in: 2025 is "a 2025/26-os évad", 1 September 2025
-- through 31 August 2026.
--
-- August rather than June as the closing edge, deliberately. 0006 already
-- records that the kőszínházak go dark from mid-June and that the szabadtéri
-- venues invert that exactly — Nagyerdei, Margitsziget and Városmajor play only
-- in the summer. Ending the évad in June would drop those evenings into a gap
-- between seasons, and a summer at the Margitsziget is the tail of the season
-- that opened the previous September, not a season of its own. This way every
-- date belongs to exactly one évad, with no gaps and no overlap.
create or replace function public.season_start_year(at date)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when extract(month from at) >= 9 then extract(year from at)::int
    else extract(year from at)::int - 1
  end;
$$;

grant execute on function public.season_start_year(date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which évads this person has anything in
-- ---------------------------------------------------------------------------
--
-- Drives the picker. An account with three entries has one season worth
-- looking at, and offering it a dropdown of every year since 2001 would be a
-- control with nothing behind it.
--
-- Entries with no date are excluded rather than bucketed: since 0026 a null
-- `seen_at` means "seen it, cannot say when", and putting those in a season
-- would be inventing the one fact the column exists to admit is missing.
create or replace function public.user_seasons(viewer uuid)
returns table (season_start int, entries int)
language sql
stable
set search_path = public
as $$
  select public.season_start_year(r.seen_at) as season_start, count(*)::int
  from public.reviews r
  where r.user_id = viewer and r.seen_at is not null
  group by 1
  order by 1 desc;
$$;

grant execute on function public.user_seasons(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The season itself
-- ---------------------------------------------------------------------------
--
-- One round trip for the whole header. Every one of these is a `count` or a
-- `min` over the same handful of rows, and doing them as eight separate
-- requests would make a stats page eight times slower to say one thing.
create or replace function public.season_stats(viewer uuid, season_start int)
returns table (
  entries int,
  rated int,
  venues int,
  cities int,
  rewatches int,
  first_night date,
  last_night date,
  -- Forints, and the count of entries that answered — an average over three
  -- priced entries out of twenty is not "your average ticket this season", and
  -- the screen needs to know which it is holding.
  spend_huf bigint,
  priced_entries int,
  seated_entries int,
  top_play_id uuid,
  top_rating numeric
)
language sql
stable
set search_path = public
as $$
  with seen as (
    select r.*, p.venue_id, v.city
    from public.reviews r
    join public.plays p on p.id = r.play_id
    join public.venues v on v.id = p.venue_id
    where r.user_id = viewer
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
    -- The evening you rated highest. `created_at` breaks a tie so the answer is
    -- stable between two loads rather than whichever row the planner reached
    -- first.
    (select s.play_id from seen s where s.rating_overall is not null
     order by s.rating_overall desc, s.seen_at desc, s.created_at desc limit 1),
    (select max(s.rating_overall) from seen s)
  from seen;
$$;

grant execute on function public.season_stats(uuid, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The genre split
-- ---------------------------------------------------------------------------
create or replace function public.season_genres(viewer uuid, season_start int)
returns table (genre text, entries int)
language sql
stable
set search_path = public
as $$
  select p.genre_normalized, count(*)::int
  from public.reviews r
  join public.plays p on p.id = r.play_id
  where r.user_id = viewer
    and r.seen_at is not null
    and public.season_start_year(r.seen_at) = season_start
    and p.genre_normalized is not null
  group by 1
  order by 2 desc, 1;
$$;

grant execute on function public.season_genres(uuid, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who you saw most
-- ---------------------------------------------------------------------------
--
-- Two sources, in order of truthfulness.
--
-- `review_cast` is what the diary actually recorded about a night — who was on
-- — and where an entry answered that question, it is the only thing counted for
-- that entry. For every other evening the production's published cast stands
-- in, which is a reasonable guess and is the best the catalogue can do about a
-- night nobody logged a cast for.
--
-- Mixing the two per entry rather than per season is the point: an evening that
-- says "I saw the understudy" must not also be counted for the principal it
-- says did not go on.
create or replace function public.season_people(viewer uuid, season_start int, top_n int default 5)
returns table (slug text, name text, nights int)
language sql
stable
set search_path = public
as $$
  with seen as (
    select r.id as review_id, r.play_id
    from public.reviews r
    where r.user_id = viewer
      and r.seen_at is not null
      and public.season_start_year(r.seen_at) = season_start
  ),
  recorded as (
    select s.review_id, rc.name
    from seen s
    join public.review_cast rc on rc.review_id = s.review_id
  ),
  assumed as (
    select s.review_id, pc.name
    from seen s
    join public.play_cast pc on pc.play_id = s.play_id
    where not exists (
      select 1 from public.review_cast rc where rc.review_id = s.review_id
    )
  ),
  everyone as (
    select * from recorded
    union all
    select * from assumed
  ),
  by_slug as (
    select public.person_slug(e.name) as slug, count(distinct e.review_id)::int as nights
    from everyone e
    where public.person_slug(e.name) is not null
    group by 1
  )
  select b.slug, coalesce(pp.display_name, b.slug), b.nights
  from by_slug b
  cross join lateral public.person_profile(b.slug) pp
  order by b.nights desc, 2
  limit greatest(top_n, 0);
$$;

grant execute on function public.season_people(uuid, int, int) to anon, authenticated;

commit;
