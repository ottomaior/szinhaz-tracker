-- Constraints and columns the ingestion pipeline needs to be trustworthy.
--
-- Four independent fixes, grouped because they all land in the same pass over
-- the sync path and none is big enough to deserve its own migration.

begin;

-- 1. Duplicate venues -------------------------------------------------------
--
-- `venues` had no uniqueness at all, and services/playsService.ts inserted
-- into it unchecked from the add-play flow, so two people adding the same
-- theatre by hand produced two venues — and every play attached to the wrong
-- twin was invisible under the right one's filters.
--
-- Case- and whitespace-insensitive, because that is how the duplicates
-- actually arrive ("Katona József Színház" vs "katona józsef színház ").

-- Fold any existing duplicates onto the earliest row first, or the index below
-- cannot be created.
with canonical as (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name)), lower(btrim(city))
      order by created_at, id
    ) as keep_id
  from public.venues
)
update public.plays p
set venue_id = canonical.keep_id
from canonical
where p.venue_id = canonical.id
  and canonical.id <> canonical.keep_id;

with canonical as (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name)), lower(btrim(city))
      order by created_at, id
    ) as keep_id
  from public.venues
)
update public.performances pf
set venue_id = canonical.keep_id
from canonical
where pf.venue_id = canonical.id
  and canonical.id <> canonical.keep_id;

delete from public.venues v
where exists (
  select 1 from public.venues other
  where lower(btrim(other.name)) = lower(btrim(v.name))
    and lower(btrim(other.city)) = lower(btrim(v.city))
    and (other.created_at, other.id) < (v.created_at, v.id)
);

create unique index if not exists venues_name_city_key
  on public.venues (lower(btrim(name)), lower(btrim(city)));

-- 2. Adapter identity as a column ------------------------------------------
--
-- Which adapter produced a row was only ever encoded as a prefix inside
-- `source_key`, which is why 0006_play_status.sql has to split_part() inside a
-- join condition — unindexable, and easy to misread. The column is derived,
-- kept in step by a trigger, so nothing outside this file has to remember.

alter table public.plays
  add column if not exists source_adapter text;

update public.plays
set source_adapter = split_part(source_key, ':', 1)
where source_key is not null
  and source_adapter is distinct from split_part(source_key, ':', 1);

create or replace function public.plays_set_source_adapter()
returns trigger
language plpgsql
as $$
begin
  new.source_adapter := case
    when new.source_key is null then null
    else split_part(new.source_key, ':', 1)
  end;
  return new;
end;
$$;

drop trigger if exists plays_source_adapter on public.plays;
create trigger plays_source_adapter
  before insert or update of source_key on public.plays
  for each row execute function public.plays_set_source_adapter();

create index if not exists plays_source_adapter_idx
  on public.plays (source_adapter)
  where source_adapter is not null;

-- 3. Csokonai showtimes stored in the wrong zone ----------------------------
--
-- The adapter built "YYYY-MM-DDTHH:MM:00" with no offset and wrote it to a
-- timestamptz column. Postgres resolved that in the server's zone (UTC on
-- Supabase), so a 19:00 Debrecen curtain was stored as 19:00Z — the true
-- instant is 17:00Z in summer, 18:00Z in winter. Every Csokonai showtime
-- therefore displayed one to two hours late.
--
-- The correct time is recovered from the source key rather than by shifting
-- the stored value, because the key carries the original local wall clock
-- ("csokonai:<slug>:2026-05-22T19:00:00"). That makes this statement
-- idempotent: re-running it recomputes the same instant instead of shifting an
-- already-correct row again.
update public.performances
set starts_at = (
  (substring(source_key from '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$'))::timestamp
  at time zone 'Europe/Budapest'
)
where source = 'sync'
  and source_key like 'csokonai:%'
  and source_key ~ '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$';

-- 4. Sync observability -----------------------------------------------------
--
-- A run that upserted 40 of 50 productions and silently dropped 10 was
-- indistinguishable from a clean one. Now the failures are counted and the
-- reasons kept, so a partial success is visible without re-reading the logs.
alter table public.sync_runs
  add column if not exists plays_failed int not null default 0,
  add column if not exists performances_deleted int not null default 0,
  add column if not exists warnings jsonb;

commit;
