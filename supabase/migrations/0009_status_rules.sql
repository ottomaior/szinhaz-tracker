-- Two wrong answers from recompute_play_status(), and the column needed to fix
-- the second one.
--
-- 1. Every user-added play was pinned at 'unknown', permanently.
--
--    Rule 2 reads "last_synced_at is null or older than 30 days -> unknown".
--    That is meant for a synced production whose source has gone quiet, but a
--    play someone typed in by hand has no source and so never has a
--    last_synced_at at all. It matched on the first rule it hit and stopped,
--    with the reason "source data is stale (last synced never)" — describing a
--    sync that was never supposed to happen. components/ui/StatusBadge.tsx
--    renders nothing for 'unknown', so those plays silently never showed a
--    badge, and no amount of re-running fixed it.
--
--    The staleness rule is now scoped to synced rows, and hand-added plays get
--    their own branch reasoning from what they do have: a premiere date, and
--    any performances attached to them.
--
-- 2. 'ended' claimed the theatre had archived a production it had merely
--    stopped listing.
--
--    reconcile() in sync/run.ts sets is_archived on plays that vanished from
--    the source but carry a review or watchlist entry — archiving instead of
--    deleting, so user data survives. Rule 1 then labelled those
--    "source lists this production in its archive", which is the opposite of
--    what happened: the source stopped mentioning it at all. Both cases still
--    read as 'ended', which is the honest status either way, but they no
--    longer tell the same story about why.

begin;

alter table public.plays
  add column if not exists archived_reason text
    check (archived_reason in ('source_archive', 'source_dropped'));

comment on column public.plays.archived_reason is
  'Why is_archived is set: source_archive = the theatre files it under its own '
  'archive; source_dropped = the source stopped listing it and reconcile() kept '
  'the row because it carries user data.';

-- Everything archived before this column existed came from an adapter reading
-- a theatre's archive section, since that was the only path that set the flag
-- at scale.
update public.plays
set archived_reason = 'source_archive'
where is_archived and archived_reason is null;

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
  -- Whether the *source* publishes showtimes at all. Katona's archive adapter
  -- syncs productions but no dates, so "zero future dates" there means "we
  -- never look", not "nothing is scheduled" — treating that as dormant would
  -- wrongly bench everything it supplies.
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
        -- 1. The source itself files this as history. Highest trust.
        when p.is_archived then 'ended'

        -- 2. Added by hand, with no listing anywhere to check it against.
        --    Reasoned from its own dates rather than from a sync that will
        --    never happen.
        when p.source <> 'sync' then
          case
            when p.premiere_date is not null and p.premiere_date > current_date then 'announced'
            when perf.next_at is not null then 'running'
            else 'unknown'
          end

        -- 3. Nothing recent to reason from. Reserved for stale sync data, not
        --    for "we happen to hold no dates" — see rule 7.
        when p.last_synced_at is null or p.last_synced_at < now() - interval '30 days'
          then 'unknown'

        -- 4. Announced, not yet opened.
        when p.premiere_date is not null and p.premiere_date > current_date then 'announced'

        -- 5. A dated future performance is the hard signal.
        when perf.next_at is not null then 'running'

        -- 6. No dates, but this source publishes no showtimes at all and still
        --    lists the production as current repertoire.
        when coalesce(cov.perf_rows, 0) = 0 then 'running'

        -- 7. Source does publish showtimes; this one has none upcoming.
        --    Through the dark season that means nothing at all — the theatre
        --    has simply not published next season yet — and the repertoire
        --    listing is the only signal available, so trust it.
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
              then 'next performance ' || to_char(perf.next_at, 'YYYY-MM-DD HH24:MI')
            else 'added by hand; there is no listing to check it against'
          end

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
$$;

grant execute on function public.recompute_play_status() to service_role;

select public.recompute_play_status();

commit;
