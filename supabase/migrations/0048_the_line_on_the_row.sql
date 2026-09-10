-- Carry the line the house prints under the title out to the programme rows.
--
-- `plays.subtitle` is what a theatre says a production is in its own words —
-- `vígjáték`, `opera két felvonásban`, `énekkari próba` — and since `0043`
-- `plays.produced_by` says whose it is when it is not the host's. The
-- production page prints both. The rows on Discover and in Műsor could not,
-- because `program_in_range()` returns a fixed table that predates both
-- columns, so a Saturday with two public choir rehearsals on it read as two
-- performances of a play until one was opened. See T-031 in ISSUES.md, and
-- T-002 for the evening that showed it.
--
-- DROP and CREATE rather than CREATE OR REPLACE: Postgres will not replace a
-- function whose `returns table` gains a column. Nothing else references the
-- function by OID — it is called through PostgREST's RPC by name — so the drop
-- costs nothing. The body is the `0017` body with two columns added to the
-- select list; the predicates and the ordering are unchanged.
--
-- `set search_path = public` is part of the definition here because `0044`
-- pinned it with ALTER, and a drop would otherwise have quietly undone that
-- for this one function. `program_days()` is not touched: its return shape is
-- the same as before.

begin;

drop function if exists public.program_in_range(timestamptz, timestamptz, text, uuid, text);

create function public.program_in_range(
  range_start timestamptz,
  range_end timestamptz,
  city_filter text default null,
  venue_id_filter uuid default null,
  genre_filter text default null
)
returns table (
  performance_id uuid,
  starts_at timestamptz,
  room text,
  play_id uuid,
  title text,
  author text,
  director text,
  genre_normalized text,
  subtitle text,
  produced_by text,
  runtime_minutes int,
  status text,
  is_archived boolean,
  poster_url text,
  poster_path text,
  poster_thumb_path text,
  poster_blurhash text,
  poster_width int,
  poster_height int,
  poster_credit text,
  venue_id uuid,
  venue_name text,
  venue_city text
)
language sql
stable
set search_path = public
as $fn$
  select
    pf.id,
    pf.starts_at,
    pf.room,
    p.id,
    p.title,
    p.author,
    p.director,
    p.genre_normalized,
    p.subtitle,
    p.produced_by,
    p.runtime_minutes,
    p.status,
    p.is_archived,
    p.poster_url,
    p.poster_path,
    p.poster_thumb_path,
    p.poster_blurhash,
    p.poster_width,
    p.poster_height,
    p.poster_credit,
    v.id,
    v.name,
    v.city
  from public.performances pf
  join public.plays  p on p.id = pf.play_id
  join public.venues v on v.id = pf.venue_id
  where pf.starts_at >= range_start
    and pf.starts_at <  range_end
    and (city_filter     is null or v.city = city_filter)
    and (venue_id_filter is null or pf.venue_id = venue_id_filter)
    -- As in 0017: a play with no genre is neither hidden nor claimed by a
    -- genre chip. The filter matches only what is actually classified.
    and (genre_filter    is null or p.genre_normalized = genre_filter)
  order by pf.starts_at asc, v.name asc, p.title asc;
$fn$;

grant execute on function public.program_in_range(timestamptz, timestamptz, text, uuid, text)
  to anon, authenticated;

commit;
