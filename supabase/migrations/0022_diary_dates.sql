-- ============================================================
-- The diary learns what night it was
--
-- `submitReview()` inserted no date at all, so the diary read `created_at` and
-- every entry was stamped with the moment the row was written. That is wrong in
-- the exact case the catalogue was built for: 0005_archive_and_reconcile.sql
-- keeps ~900 archived productions loggable precisely so somebody can record a
-- play they saw years ago, and then the diary claimed they saw it today.
--
-- Three columns and one trigger rewrite:
--
--   seen_at         the evening itself, as a date
--   performance_id  which showtime it was, when we can tell
--   is_rewatch      the second and third time you saw the same production
--
-- ============================================================

-- ------------------------------------------------------------
-- seen_at — the date the person was actually in the theatre.
--
-- A `date`, not a `timestamptz`. The curtain time is a property of the
-- performance, which `performance_id` points at when it is known; what the
-- diary needs from the user is the evening, and asking anyone to confirm a
-- minute they half-remember is a worse form with no better data at the end.
--
-- The default is today *in Budapest* rather than `current_date`, which is the
-- database's own zone: between midnight and 02:00 CEST those are different
-- days, and a check-in typed on the way home from a late curtain is exactly
-- when that window is busiest.
-- ------------------------------------------------------------
-- Added nullable, backfilled, then constrained — rather than added with the
-- default already in place. These migrations are applied by hand with nothing
-- recording which ones a given database has had, so a second run has to be
-- harmless: this shape backfills only rows that have no date yet, where adding
-- the column pre-defaulted would overwrite real dates people had entered.
alter table public.reviews
  add column if not exists seen_at date;

-- Existing rows keep the day they were written, read in Budapest for the same
-- reason. There are three of them today, but this is what the column would have
-- held all along had it existed, so it is the honest backfill rather than a
-- convenient one.
update public.reviews
  set seen_at = (created_at at time zone 'Europe/Budapest')::date
  where seen_at is null;

alter table public.reviews
  alter column seen_at set default (now() at time zone 'Europe/Budapest')::date;

alter table public.reviews
  alter column seen_at set not null;

-- ------------------------------------------------------------
-- performance_id — which showtime, when there is one to point at.
--
-- Nullable, and always will be: the archived half of the catalogue carries no
-- performance rows at all, and a production somebody saw in 2019 never will.
--
-- `on delete set null` is the important half. The sync job deletes performance
-- rows that a theatre stops publishing (see reconcile() in sync/run.ts), and a
-- theatre withdrawing a date from its website must never take somebody's diary
-- entry with it. The review survives, having merely forgotten which of that
-- production's evenings it was.
-- ------------------------------------------------------------
alter table public.reviews
  add column if not exists performance_id uuid
  references public.performances(id) on delete set null;

-- ------------------------------------------------------------
-- is_rewatch — seeing it again.
--
-- Deliberately *not* a unique constraint on (play_id, user_id). Seeing the same
-- production twice is ordinary here in a way it is not in film — a different
-- cast, a revival, a production you love — and the diary should hold both
-- nights. The flag is what lets the second entry read as a return rather than
-- looking like a duplicate somebody failed to notice.
-- ------------------------------------------------------------
alter table public.reviews
  add column if not exists is_rewatch boolean not null default false;

-- The diary's own query: one user's entries, newest evening first.
create index if not exists reviews_user_seen_at_idx
  on public.reviews (user_id, seen_at desc);

-- ============================================================
-- A production's rating stops counting one person several times
-- ============================================================
--
-- The old function averaged every row in `reviews` for the play. With rewatches
-- now a first-class thing rather than an accident, that is a real distortion:
-- somebody who saw a production three times and rated it 5 each time carried
-- three times the weight of somebody who saw it once, and the public rating on
-- Play Detail quietly became a measure of enthusiasm-times-attendance.
--
-- Averaging per person first, then across people, gives everyone one vote no
-- matter how many nights they logged. `rating_count` follows the same rule and
-- counts people, since that is what "55 értékelés" claims on screen.
create or replace function public.recompute_play_rating()
returns trigger
language plpgsql
as $$
declare
  target_play_id uuid;
begin
  target_play_id := coalesce(new.play_id, old.play_id);

  -- avg() skips nulls, so a person who rated the production overall but left
  -- the three facets blank contributes to `overall` and to none of the others
  -- — at both levels of the average. That is why each facet is averaged in its
  -- own column rather than filtered in a where clause, as the old version did.
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
    rating_count      = (select count(*) from per_user)
  where p.id = target_play_id;

  return null;
end;
$$;

-- Recompute every play that has ratings, so the change applies to rows already
-- written rather than only to the next review. Touching `reviews` would fire
-- the trigger per row; calling the aggregate directly is one pass.
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
    count(*)                           as people
  from per_user
  group by play_id
)
update public.plays p set
  rating_overall    = coalesce(pp.overall, 0),
  rating_acting     = coalesce(pp.acting, 0),
  rating_directing  = coalesce(pp.directing, 0),
  rating_set_design = coalesce(pp.set_design, 0),
  rating_count      = pp.people
from per_play pp
where pp.play_id = p.id;

-- ============================================================
-- How a production's ratings are spread
-- ============================================================
--
-- Play Detail can say 4.2 and has no way to show that it is eleven fives and
-- two ones. That distinction is most of what is interesting about a production:
-- "well liked" and "divisive" are different claims and currently render
-- identically.
--
-- Returns one row per whole-star band, always all five, so the caller renders a
-- complete axis rather than a chart with gaps where nobody voted. Per person,
-- for the same reason the average is.
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
  ),
  bands as (select generate_series(1, 5) as band)
  select
    b.band::int,
    -- ceil() so the half-star ratings the check-in form allows land in the band
    -- they read as: 3.5 is "three and a half", which belongs with the fours on
    -- a five-bar axis, not rounded down to the threes.
    coalesce(count(pu.user_id), 0)::int
  from bands b
  left join per_user pu on ceil(pu.overall) = b.band
  group by b.band
  order by b.band;
$$;

grant execute on function public.play_rating_histogram(uuid) to anon, authenticated;
