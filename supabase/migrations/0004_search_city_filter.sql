-- Adds an optional city filter to search_plays, alongside the existing
-- venue-type filter, so Discover can filter by city (Budapest, Debrecen,
-- and whatever gets added later) independently of venue type.
-- `create or replace` on a function with a new parameter list requires
-- dropping the old one first (Postgres doesn't let you add a parameter
-- in place).

drop function if exists public.search_plays(text, text);

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null
)
returns setof public.plays
language sql stable
as $$
  select distinct p.*
  from public.plays p
  left join public.venues v on v.id = p.venue_id
  left join public.play_cast c on c.play_id = p.id
  where (
    p.title ilike '%' || search_term || '%'
    or p.author ilike '%' || search_term || '%'
    or p.genre ilike '%' || search_term || '%'
    or v.name ilike '%' || search_term || '%'
    or c.name ilike '%' || search_term || '%'
  )
  and (venue_type_filter is null or v.type = venue_type_filter)
  and (city_filter is null or v.city = city_filter)
  order by p.title;
$$;

grant execute on function public.search_plays(text, text, text) to anon, authenticated;
