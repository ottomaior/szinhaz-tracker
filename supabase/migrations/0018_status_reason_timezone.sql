-- Two times for the same performance, on the same screen.
--
-- Play detail renders the derived status reason under the badge, verbatim, so
-- that a production's state is explained rather than asserted. Chicago read:
--
--   Következő előadás: szept. 6., vasárnap · 19:00
--   next performance 2026-09-06 17:00 (4 known dates)
--
-- Both lines describe the same performance. The first is right. The second is
-- the UTC instant printed as though it were local: every `to_char()` in
-- recompute_play_status() formats a `timestamptz` without saying in which zone,
-- so Postgres uses the server's — UTC — while the app formats the same column
-- in Europe/Budapest, as a listing must.
--
-- Nothing downstream was wrong; the stored instants have always been correct
-- (sync/lib/huDate.ts resolves each source's naive wall-clock time against the
-- offset that applied on that date). It was only ever this diagnostic string.
-- It went unnoticed because nothing displayed it until the status reason was
-- surfaced, and a plausible-looking 17:00 is exactly the kind of wrong number
-- that survives being looked at.
--
-- The date-only reasons are fixed for the same reason, not just for tidiness:
-- a 23:30 curtain is already the next day in UTC, so "last performance
-- 2025-06-14" could name the wrong day.

begin;

create or replace function public.recompute_play_status()
returns void
language plpgsql
as $fn$
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
  source_coverage as (
    select
      p.source_adapter as src,
      count(pf.id)     as perf_rows
    from public.plays p
    left join public.performances pf on pf.play_id = p.id
    where p.source = 'sync' and p.source_adapter is not null
    group by 1
  ),
  computed as (
    select
      p.id,
      coalesce(perf.total, 0) as total,
      perf.next_at,
      perf.last_at,
      case
        when p.is_archived then 'ended'

        when p.source <> 'sync' then
          case
            when p.premiere_date is not null and p.premiere_date > current_date then 'announced'
            when perf.next_at is not null then 'running'
            else 'unknown'
          end

        when p.last_synced_at is null or p.last_synced_at < now() - interval '30 days'
          then 'unknown'

        when p.premiere_date is not null and p.premiere_date > current_date then 'announced'

        when perf.next_at is not null then 'running'

        when coalesce(cov.perf_rows, 0) = 0 then 'running'

        when public.is_dark_season(current_date, v.type) then 'running'

        when perf.last_at is not null and perf.last_at <= now() - interval '14 months' then 'ended'
        else 'dormant'
      end as status,
      case
        when p.is_archived and p.archived_reason = 'source_dropped'
          then 'the source stopped listing this production; kept because it has been reviewed or watchlisted'
        when p.is_archived
          then 'source lists this production in its archive'

        when p.source <> 'sync' then
          case
            when p.premiere_date is not null and p.premiere_date > current_date
              then 'premiere ' || p.premiere_date::text || ' is in the future'
            when perf.next_at is not null
              then 'next performance '
                   || to_char(perf.next_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI')
            else 'added by hand; there is no listing to check it against'
          end

        when p.last_synced_at is null or p.last_synced_at < now() - interval '30 days'
          then 'source data is stale (last synced '
               || coalesce(to_char(p.last_synced_at at time zone 'Europe/Budapest', 'YYYY-MM-DD'), 'never') || ')'
        when p.premiere_date is not null and p.premiere_date > current_date
          then 'premiere ' || p.premiere_date::text || ' is in the future'
        when perf.next_at is not null
          then 'next performance '
               || to_char(perf.next_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI')
               || ' (' || coalesce(perf.total, 0)::text || ' known dates)'
        when coalesce(cov.perf_rows, 0) = 0
          then 'source publishes no showtimes; still listed in current repertoire'
        when public.is_dark_season(current_date, v.type)
          then 'no upcoming dates, but held at running through the '
               || case when v.type = 'szabadtéri' then 'off-season' else 'summer break' end
        when perf.last_at is not null and perf.last_at <= now() - interval '14 months'
          then 'no future dates; last performance '
               || to_char(perf.last_at at time zone 'Europe/Budapest', 'YYYY-MM-DD')
               || ', over 14 months ago'
        when perf.last_at is not null
          then 'no future dates; last performance '
               || to_char(perf.last_at at time zone 'Europe/Budapest', 'YYYY-MM-DD')
        else 'listed in current repertoire but no dates known'
      end as reason
    from public.plays p
    left join perf on perf.play_id = p.id
    left join public.venues v on v.id = p.venue_id
    left join source_coverage cov on cov.src = p.source_adapter
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
$fn$;

select public.recompute_play_status();

commit;
