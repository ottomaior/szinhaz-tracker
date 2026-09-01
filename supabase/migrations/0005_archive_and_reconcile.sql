-- Adds an "archived" flag to plays, and reworks search_plays to respect it.
--
-- Why: the catalog is moving from "whatever has a performance in the next
-- three months" to the theaters' full repertoires, which for Örkény includes
-- 121 productions in their own "Archívum" category going back to 2002. Those
-- are worth having — a theatregoing diary should let you log a play you saw
-- in 2015 — but they must not show up in Discover's premieres/trending rails
-- alongside things you can actually buy a ticket for.
--
-- So: Discover's browse rails filter archived rows out, while search and the
-- check-in play picker still reach them (hence include_archived defaults to
-- true — search is where you go looking for something specific).

alter table public.plays
  add column if not exists is_archived boolean not null default false;

-- Partial index: every browse query filters on `is_archived = false`, and
-- that is the smaller and far more frequently read side of the split.
create index if not exists plays_current_idx
  on public.plays (is_archived)
  where is_archived = false;

-- `create or replace` with a different parameter count creates an overload
-- rather than replacing, which would leave the 3-arg version in place and
-- make 3-argument calls ambiguous. Drop first, same as 0004 had to.
drop function if exists public.search_plays(text, text, text);

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true
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
  and (include_archived or not p.is_archived)
  order by p.title;
$$;

grant execute on function public.search_plays(text, text, text, boolean) to anon, authenticated;
