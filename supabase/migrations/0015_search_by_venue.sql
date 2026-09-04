-- Let search narrow to one theatre, the way the browse rails now can.
--
-- Discover gained a venue filter under the city chips: pick Budapest, then pick
-- Katona. The rails apply it with a plain `venue_id` predicate, but search goes
-- through this function, which knew only about venue *type* and city — so
-- choosing a theatre filtered the rails and silently did nothing to the search
-- results underneath the same chip.
--
-- The old four-argument signature is dropped rather than left alongside this
-- one. PostgREST resolves an RPC by the names of the arguments it is given, and
-- two overloads that both accept (search_term, venue_type_filter, city_filter,
-- include_archived) are ambiguous — the call fails with "could not choose the
-- best candidate function" instead of picking either.

begin;

drop function if exists public.search_plays(text, text, text, boolean);

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true,
  venue_id_filter uuid default null
)
returns setof public.plays
language sql stable
as $$
  with pattern as (
    select '%' || public.escape_like(coalesce(search_term, '')) || '%' as p
  )
  select distinct pl.*
  from public.plays pl
  cross join pattern
  left join public.venues v on v.id = pl.venue_id
  left join public.play_cast c on c.play_id = pl.id
  where (
    pl.title ilike pattern.p escape '\'
    or pl.author ilike pattern.p escape '\'
    or pl.genre ilike pattern.p escape '\'
    or v.name ilike pattern.p escape '\'
    or c.name ilike pattern.p escape '\'
  )
  and (venue_type_filter is null or v.type = venue_type_filter)
  and (city_filter is null or v.city = city_filter)
  -- Read off the play itself rather than the joined venue: it is the same
  -- answer and it can use plays' own index on venue_id.
  and (venue_id_filter is null or pl.venue_id = venue_id_filter)
  and (include_archived or not pl.is_archived)
  order by pl.title;
$$;

grant execute on function public.search_plays(text, text, text, boolean, uuid) to anon, authenticated;

commit;
