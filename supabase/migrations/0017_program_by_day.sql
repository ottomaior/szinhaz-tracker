-- Answer "what is on this Friday?" — a question the app could not ask at all.
--
-- Every query in the app so far starts from a production and asks when it
-- plays. There was no way in from the other direction, which is the way a
-- theatregoer actually plans: pick an evening, see what is available across
-- every theatre in reach. The data has been there the whole time — 148 future
-- performances, each with a venue and the stage it plays on — with nothing
-- able to read it that way.
--
-- Doing this client-side would mean fetching the performances, then the plays,
-- then the venues, and filtering across three round trips; as one function it
-- is a single indexed range scan over `performances (venue_id, starts_at)`.

begin;

create or replace function public.program_in_range(
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
    -- A play with no genre must not vanish when a genre chip is active, but it
    -- must not be claimed by one either: the filter matches only what is
    -- actually classified. 0016_genre_taxonomy.sql leaves genre_normalized null
    -- wherever the source published nothing, and that is a real answer.
    and (genre_filter    is null or p.genre_normalized = genre_filter)
  order by pf.starts_at asc, v.name asc, p.title asc;
$fn$;

grant execute on function public.program_in_range(timestamptz, timestamptz, text, uuid, text)
  to anon, authenticated;

/*
 * The days that have anything on them, for the date picker.
 *
 * Without this the day chips would either be a fixed fortnight — including
 * evenings with nothing scheduled, which is a row of dead ends — or would need
 * a query per day. Returns Budapest calendar days, not UTC ones: a 19:00
 * curtain is 17:00 UTC and lands on the right day either way, but a late show
 * does not, and grouping the calendar by the wrong day is exactly the bug this
 * avoids.
 */
create or replace function public.program_days(
  range_start timestamptz,
  range_end timestamptz,
  city_filter text default null,
  venue_id_filter uuid default null,
  genre_filter text default null
)
returns table (day date, performance_count int)
language sql
stable
as $fn$
  select
    (pf.starts_at at time zone 'Europe/Budapest')::date as day,
    count(*)::int
  from public.performances pf
  join public.plays  p on p.id = pf.play_id
  join public.venues v on v.id = pf.venue_id
  where pf.starts_at >= range_start
    and pf.starts_at <  range_end
    and (city_filter     is null or v.city = city_filter)
    and (venue_id_filter is null or pf.venue_id = venue_id_filter)
    and (genre_filter    is null or p.genre_normalized = genre_filter)
  group by 1
  order by 1;
$fn$;

grant execute on function public.program_days(timestamptz, timestamptz, text, uuid, text)
  to anon, authenticated;

-- The range scans above start from `starts_at` without a venue in hand, which
-- the existing (venue_id, starts_at) index cannot serve.
create index if not exists performances_starts_at_idx
  on public.performances (starts_at);

commit;
