-- search_plays treated the user's own text as a LIKE pattern.
--
-- The term was interpolated straight into `ilike '%' || search_term || '%'`,
-- so `%` and `_` arrived as wildcards rather than as characters. Typing a
-- single `%` matched the entire catalogue; `_` matched any character, quietly
-- widening results. A trailing backslash was worse — it escaped the closing
-- `%` and could make the pattern match nothing at all.
--
-- The fix escapes the three characters that mean something to LIKE and
-- declares the escape character explicitly, so a search for "100%" now finds
-- productions with "100%" in the title instead of everything.
--
-- Titles here really do contain these characters — "Saját [?] szoba",
-- "E(gy)P(ercesek)", "1,5 ezrelék" — so this is not a hypothetical.

begin;

create or replace function public.escape_like(term text)
returns text
language sql
immutable
strict
as $$
  -- Backslash first: escaping it after the others would double-escape them.
  select replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');
$$;

comment on function public.escape_like(text) is
  'Escapes LIKE/ILIKE metacharacters so a search term is matched literally.';

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true
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
  and (include_archived or not pl.is_archived)
  order by pl.title;
$$;

grant execute on function public.escape_like(text) to anon, authenticated;
grant execute on function public.search_plays(text, text, text, boolean) to anon, authenticated;

commit;
