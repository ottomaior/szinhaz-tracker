-- "Currently playing" (műsoron van) as a derived property of a production.
--
-- This is never a scraped field. It is recomputed from three inputs:
--   1. the structural signal each source already publishes (plays.is_archived,
--      set by the adapters from Örkény's category_id, Katona's
--      /eloadasok/{repertoar,archivum} split, and Csokonai's repertoire index),
--   2. premiere_date,
--   3. the performances table.
--
-- Call public.recompute_play_status() after every sync run, and on a schedule
-- — status decays with time even when nothing is re-scraped, because a
-- production with no remaining future dates stops being "running" on its own.

alter table public.plays
  add column if not exists status text not null default 'unknown'
    check (status in ('announced', 'running', 'dormant', 'ended', 'unknown')),
  add column if not exists status_reason text,
  add column if not exists next_perf_at timestamptz,
  add column if not exists last_perf_at timestamptz,
  add column if not exists perf_count_total int not null default 0,
  add column if not exists status_computed_at timestamptz;

-- Browse queries only ever ask for the live end of the catalog.
create index if not exists plays_status_idx
  on public.plays (status)
  where status in ('running', 'announced');

-- ============================================================
-- Seasonality
-- ============================================================

-- Hungarian kőszínházak go dark roughly 15 June - 5 September and purge their
-- schedules while they do. Without a guard, every Budapest and Debrecen
-- production would flip to "not playing" every July purely because no future
-- dates are published.
create or replace function public.is_summer_break(at date)
returns boolean
language sql
immutable
as $$
  select (extract(month from at) = 6 and extract(day from at) >= 15)
      or extract(month from at) in (7, 8)
      or (extract(month from at) = 9 and extract(day from at) <= 5);
$$;

-- Szabadtéri (open-air) venues invert that exactly: Nagyerdei Szabadtéri and
-- the Margitsziget/Városmajor stages run *only* in the summer window and are
-- dark the rest of the year. `venues.type` already carries 'szabadtéri' as a
-- checked value, so the inversion keys off data that already exists rather
-- than needing a new seasonality column.
create or replace function public.is_dark_season(at date, venue_type text)
returns boolean
language sql
immutable
as $$
  select case
    when venue_type = 'szabadtéri' then not public.is_summer_break(at)
    else public.is_summer_break(at)
  end;
$$;

-- ============================================================
-- Recompute
-- ============================================================

create or replace function public.recompute_play_status()
returns void
language plpgsql
as $$
begin
  with perf as (
    select
      play_id,
      count(*)                                         as total,
      min(starts_at) filter (where starts_at >= now()) as next_at,
      max(starts_at) filter (where starts_at <  now()) as last_at
    from public.performances
    group by play_id
  ),
  -- Whether the *source* publishes showtimes at all. Katona's adapter syncs
  -- productions but not its separate /musor calendar, so "zero future dates"
  -- there means "we never look", not "nothing is scheduled" — treating that
  -- as dormant would wrongly bench that theater's entire live repertoire.
  source_coverage as (
    select
      split_part(p.source_key, ':', 1) as src,
      count(pf.id)                     as perf_rows
    from public.plays p
    left join public.performances pf on pf.play_id = p.id
    where p.source = 'sync' and p.source_key is not null
    group by 1
  ),
  computed as (
    select
      p.id,
      coalesce(perf.total, 0) as total,
      perf.next_at,
      perf.last_at,
      case
        -- 1. The source itself files this as history. Highest trust.
        when p.is_archived then 'ended'
        -- 2. Nothing recent to reason from. `unknown` is reserved for stale
        --    data, not for "we happen to hold no dates" — see rule 6.
        when p.last_synced_at is null or p.last_synced_at < now() - interval '30 days'
          then 'unknown'
        -- 3. Announced, not yet opened.
        when p.premiere_date is not null and p.premiere_date > current_date then 'announced'
        -- 4. A dated future performance is the hard signal.
        when perf.next_at is not null then 'running'
        -- 5. No dates, but this source publishes no showtimes at all and still
        --    lists the production as current repertoire.
        when coalesce(cov.perf_rows, 0) = 0 then 'running'
        -- 6. Source does publish showtimes; this one has none upcoming. Through
        --    the dark season that means nothing at all — the theater has simply
        --    not published next season yet — and the repertoire listing is the
        --    only signal available, so trust it. Note this deliberately does
        --    not depend on the previous status: on a first run every row is
        --    still 'unknown', and a rule that only held an existing 'running'
        --    would leave the whole catalog benched.
        when public.is_dark_season(current_date, v.type) then 'running'
        when perf.last_at is not null and perf.last_at <= now() - interval '14 months' then 'ended'
        else 'dormant'
      end as status,
      case
        when p.is_archived
          then 'source lists this production in its archive'
        when p.last_synced_at is null or p.last_synced_at < now() - interval '30 days'
          then 'source data is stale (last synced '
               || coalesce(to_char(p.last_synced_at, 'YYYY-MM-DD'), 'never') || ')'
        when p.premiere_date is not null and p.premiere_date > current_date
          then 'premiere ' || p.premiere_date::text || ' is in the future'
        when perf.next_at is not null
          then 'next performance ' || to_char(perf.next_at, 'YYYY-MM-DD HH24:MI')
               || ' (' || coalesce(perf.total, 0)::text || ' known dates)'
        when coalesce(cov.perf_rows, 0) = 0
          then 'source publishes no showtimes; still listed in current repertoire'
        when public.is_dark_season(current_date, v.type)
          then 'no upcoming dates, but held at running through the '
               || case when v.type = 'szabadtéri' then 'off-season' else 'summer break' end
        when perf.last_at is not null and perf.last_at <= now() - interval '14 months'
          then 'no future dates; last performance ' || to_char(perf.last_at, 'YYYY-MM-DD')
               || ', over 14 months ago'
        when perf.last_at is not null
          then 'no future dates; last performance ' || to_char(perf.last_at, 'YYYY-MM-DD')
        else 'listed in current repertoire but no dates known'
      end as reason
    from public.plays p
    left join perf on perf.play_id = p.id
    left join public.venues v on v.id = p.venue_id
    left join source_coverage cov
      on cov.src = split_part(coalesce(p.source_key, ''), ':', 1)
  )
  update public.plays p
  set
    perf_count_total   = computed.total,
    next_perf_at       = computed.next_at,
    last_perf_at       = computed.last_at,
    status             = computed.status,
    status_reason      = computed.reason,
    status_computed_at = now()
  from computed
  where computed.id = p.id;
end;
$$;

grant execute on function public.recompute_play_status() to service_role;

-- Seed the columns immediately. Without this the migration leaves every row
-- at the 'unknown' default until the next sync run happens to fire, so the
-- status badge silently does not appear and the schema looks broken when it
-- is merely unpopulated.
select public.recompute_play_status();
