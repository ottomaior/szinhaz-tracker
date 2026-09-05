-- ============================================================
-- Seen, without necessarily knowing when — or what you thought
--
-- Onboarding asks a new account "which of these have you seen?" over the
-- theatres' own archives, because a diary that starts empty is a form and a
-- diary with fifteen entries on day one is a product. Ticking fifteen
-- productions is one tap each, and the honest answer to "when?" for most of
-- them is *I don't remember*, while the honest answer to "how many masks?" is
-- often nothing at all.
--
-- 0022 made both of those impossible. `seen_at` was `not null` and
-- `rating_overall` has been `not null` since 0001, so the only way to record
-- "I saw this" was to invent a date and a score.
--
-- Inventing them would have undone the two things this schema just fixed.
-- Today's date is exactly the bug 0022 exists to correct, and a fabricated
-- rating feeds straight into `plays.rating_overall`, which is the number Play
-- Detail publishes. Fifteen invented fours would corrupt the ratings of fifteen
-- real productions to save one form field.
--
-- So both columns become nullable, and the distinction Letterboxd draws between
-- *watched* and a *diary entry* becomes expressible here too:
--
--   seen_at null        seen it, cannot say when
--   rating_overall null seen it, not putting a number on it
--
-- Check-in still fills both in — it defaults the date to today and the rating
-- to four — so ordinary logging is unchanged. This only makes room for the
-- entries onboarding creates.
-- ============================================================

alter table public.reviews alter column seen_at drop not null;
alter table public.reviews alter column rating_overall drop not null;

comment on column public.reviews.seen_at is
  'The evening, in Budapest. Null means seen but the date is unknown — what '
  'onboarding writes when somebody ticks a production from the archive.';

comment on column public.reviews.rating_overall is
  'Null means seen and deliberately unrated. Such rows are excluded from the '
  'production''s public average and from its rating count.';

-- ============================================================
-- An unrated entry must not count as a rating
-- ============================================================
--
-- `avg()` already skips nulls at both levels, so somebody who only ticked a
-- production contributes nothing to the average on their own. `rating_count`
-- was the part that would have lied: it counted *people with any row*, so
-- fifteen onboarding ticks would have made fifteen productions each claim "1
-- értékelés" while showing no score.
--
-- It now counts people who actually rated.
create or replace function public.recompute_play_rating()
returns trigger
language plpgsql
as $$
declare
  target_play_id uuid;
begin
  target_play_id := coalesce(new.play_id, old.play_id);

  with per_user as (
    select
      user_id,
      avg(rating_overall)    as overall,
      avg(rating_acting)     as acting,
      avg(rating_directing)  as directing,
      avg(rating_set_design) as set_design
    from public.reviews
    where play_id = target_play_id
    group by user_id
  )
  update public.plays p set
    rating_overall    = coalesce((select round(avg(overall)::numeric, 1)    from per_user), 0),
    rating_acting     = coalesce((select round(avg(acting)::numeric, 1)     from per_user), 0),
    rating_directing  = coalesce((select round(avg(directing)::numeric, 1)  from per_user), 0),
    rating_set_design = coalesce((select round(avg(set_design)::numeric, 1) from per_user), 0),
    -- The one changed line: a person who ticked without rating is not a rating.
    rating_count      = (select count(*) from per_user where overall is not null)
  where p.id = target_play_id;

  return null;
end;
$$;

-- Bring existing rows in line with the new count, as 0022 did for its own change.
with per_user as (
  select play_id, user_id,
    avg(rating_overall)    as overall,
    avg(rating_acting)     as acting,
    avg(rating_directing)  as directing,
    avg(rating_set_design) as set_design
  from public.reviews
  group by play_id, user_id
),
per_play as (
  select play_id,
    round(avg(overall)::numeric, 1)    as overall,
    round(avg(acting)::numeric, 1)     as acting,
    round(avg(directing)::numeric, 1)  as directing,
    round(avg(set_design)::numeric, 1) as set_design,
    count(*) filter (where overall is not null) as raters
  from per_user
  group by play_id
)
update public.plays p set
  rating_overall    = coalesce(pp.overall, 0),
  rating_acting     = coalesce(pp.acting, 0),
  rating_directing  = coalesce(pp.directing, 0),
  rating_set_design = coalesce(pp.set_design, 0),
  rating_count      = pp.raters
from per_play pp
where pp.play_id = p.id;

-- The histogram already excluded unrated people by accident — `ceil(null)` is
-- null and matches no band — but "correct by accident" is a thing that stops
-- being true when somebody edits it, so it is now said out loud.
create or replace function public.play_rating_histogram(target_play_id uuid)
returns table (band int, people int)
language sql
stable
as $$
  with per_user as (
    select user_id, avg(rating_overall) as overall
    from public.reviews
    where play_id = target_play_id
    group by user_id
    having avg(rating_overall) is not null
  ),
  bands as (select generate_series(1, 5) as band)
  select
    b.band::int,
    coalesce(count(pu.user_id), 0)::int
  from bands b
  left join per_user pu on ceil(pu.overall) = b.band
  group by b.band
  order by b.band;
$$;

-- ============================================================
-- What to offer, and in what order
-- ============================================================
--
-- Onboarding shows a grid of "have you seen this?" tiles. Ordering them by
-- premiere date alone looked obvious and was wrong: the first sixty came out as
-- 20 Örkény and 16 Vojtina against 3 Katona and 1 Centrál. That is not what
-- those theatres stage, it is how densely their adapters publish premiere dates
-- — Örkény's JSON API gives an exact date for everything, a scraped page often
-- gives none. A first screen a third Örkény and a quarter puppet theatre asks
-- the wrong questions of most people.
--
-- So the productions are dealt round-robin: each theatre's most recent first,
-- then each theatre's second, and so on. Recency still decides the order within
-- a house, and no house can crowd out the rest because one source happens to be
-- better structured.
--
-- The cap at `current_date` matters too — nobody has seen next month's opening,
-- and 2026/27 premieres are already in the catalogue.
create or replace function public.onboarding_candidates(
  city_filter text default null,
  limit_count int default 60
)
returns setof public.plays
language sql
stable
as $$
  with ranked as (
    select
      p.id,
      p.premiere_date,
      row_number() over (partition by p.venue_id order by p.premiere_date desc) as rn
    from public.plays p
    join public.venues v on v.id = p.venue_id
    where p.poster_path is not null
      and p.premiere_date between (current_date - interval '12 years') and current_date
      and (city_filter is null or v.city = city_filter)
  )
  select p.*
  from ranked r
  join public.plays p on p.id = r.id
  order by r.rn, r.premiere_date desc
  limit limit_count;
$$;

grant execute on function public.onboarding_candidates(text, int) to anon, authenticated;
