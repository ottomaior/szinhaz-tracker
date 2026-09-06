-- Searching for a performer should find the performer.
--
-- 0024 built the person page and 0019 taught search to rank a cast match, and
-- between them they left a gap that is obvious the moment you use the box:
-- typing "Für Anikó" returns the eleven productions she is in, and not her.
-- Every result is a production, so the only way to reach a person page is to
-- open one of her plays first and press her name in the cast strip. The
-- catalogue holds 2,424 people and the search box could not return one of them.
--
-- This migration adds the missing half. `search_people()` answers the same term
-- with people rather than productions, and Discover shows both — the people
-- above the grid, because a name typed into a search box is usually a question
-- about the person.
--
-- Nothing here re-derives what a person *is*: the canonical name, the slug, the
-- director splitting and the listing artefacts all come from 0024, so a person
-- found by search and a person opened from a cast strip are provably the same
-- record, reached by the same slug.

begin;

-- ------------------------------------------------------------
-- How good a match a name is for the term, 0-100
--
-- Deliberately a different function from `search_rank()`, because a name is not
-- a production: there is no author, no venue and no genre to fall through to,
-- and — the part that actually matters — Hungarian prints the family name
-- first. Somebody typing "anikó" is typing a given name, which sits in the
-- middle of "Für Anikó" and would score no better than an incidental substring
-- under a rule that only knows "starts with" and "contains".
--
-- Hence the band at 80: the term begins a *word* of the name. That is what puts
-- "Für Anikó" above a name that merely contains the same letters, and it is why
-- searching a given name works at all. Two names in the same band are separated
-- by credit count, which is the honest tiebreak for a bare surname: the person
-- the catalogue knows more about is the likelier subject.
--
-- The fuzzy floor is capped at 60, under every literal band, for the same
-- reason 0019 caps its own at 30: a typo net must never outrank a real match.
-- ------------------------------------------------------------
create or replace function public.person_match_rank(p_name text, term text)
returns int
language sql
immutable
parallel safe
as $fn$
  select case
    when t = '' then 0
    when nm = t then 100
    -- Starts the name, starts a word inside it, appears anywhere in it.
    when nm like pat || '%' escape '\' then 90
    when nm like '% ' || pat || '%' escape '\' then 80
    when nm like '%' || pat || '%' escape '\' then 70
    else greatest(0, least(60, (word_similarity(t, nm) * 60)::int))
  end
  from (
    select
      public.search_norm(coalesce(p_name, '')) as nm,
      public.search_norm(coalesce(term, '')) as t,
      public.escape_like(public.search_norm(coalesce(term, ''))) as pat
  ) s;
$fn$;

comment on function public.person_match_rank(text, text) is
  'How well a performer or director name answers a search term, 0-100. '
  'A term starting a word of the name outranks one merely contained in it, '
  'because Hungarian names put the family name first.';

-- ------------------------------------------------------------
-- The people a term finds
--
-- Two sources, exactly as `person_credits()` reads them: `play_cast`, and the
-- names inside `plays.director` — 945 productions name a director and only 122
-- of those directors appear in the cast table, so a people search built on
-- `play_cast` alone would fail to find seven eighths of the directors in the
-- catalogue.
--
-- The counts are computed from the matched rows rather than by calling
-- `person_profile()` per result, and that is a performance decision worth
-- recording: `person_credits()` scans every production computing
-- `director_names()` per row, which is fine once for a page and ruinous when a
-- three-letter query matches two hundred candidate slugs. It is also correct
-- here — accent folding means that if one spelling of a name matches the term
-- then every spelling of it does, so the matched rows *are* the person's rows.
--
-- Archived and event rows are counted like any other. Search reaches the
-- theatres' archives on purpose — that is what makes a play you saw in 2009
-- loggable — and a performer's past work is no less theirs for the production
-- having closed.
--
-- The two CTEs are MATERIALIZED and the term is read through scalar subqueries
-- rather than a join, and both are load-bearing rather than stylistic. Written
-- the obvious way — `cross join q` — the planner turns the match into a join
-- filter, which no index can serve, and then pushes the slug computation from
-- the CTE below down into the scan, so `person_canonical_name`'s regular
-- expressions run over all 6,397 cast rows instead of over the handful that
-- matched. Measured on this catalogue with the term "nagy", which matches 187
-- cast rows: the obvious shape takes 870ms, this one 127ms, and the cast scan
-- inside it drops from 682ms to 8ms. A scalar subquery becomes a one-off
-- InitPlan that `play_cast_name_trgm_idx` (from 0019) can be scanned with, and
-- the materialisation keeps the expensive per-name work on matched rows only.
-- For scale, `search_plays()` answers the same term in 96ms.
-- ------------------------------------------------------------
create or replace function public.search_people(
  search_term text,
  limit_count int default 8
)
returns table (
  slug text,
  display_name text,
  credit_count int,
  venue_count int,
  directed_count int,
  first_year int,
  last_year int
)
language sql
stable
as $fn$
  with q as materialized (
    select
      public.search_norm(coalesce(search_term, '')) as term,
      '%' || public.escape_like(public.search_norm(coalesce(search_term, ''))) || '%' as pat,
      -- The typo net, held to terms of four characters or more for the reason
      -- 0019 gives: below that, trigram matching returns most of the
      -- catalogue. Null switches it off, since `%>` against null is null —
      -- expressed as a value rather than as an `and length(...) >= 4`, which
      -- would turn the whole clause into an unindexable filter.
      nullif(case when length(public.search_norm(coalesce(search_term, ''))) >= 4
                  then public.search_norm(coalesce(search_term, '')) end, '') as fuzzy
  ),
  hits as materialized (
    select public.person_canonical_name(pc.name) as name, pc.play_id as play_id, false as directed
    from public.play_cast pc
    where (select term from q) <> ''
      and (
        public.search_norm(pc.name) like (select pat from q) escape '\'
        -- `%>` reads as "this name contains a word close to the term", with the
        -- operand order of word_similarity(term, name) in 0019. It is the
        -- indexable form, but its cut-off comes from
        -- `pg_trgm.word_similarity_threshold` — 0.6 by default, and not a
        -- setting this function is permitted to pin — so the explicit
        -- comparison follows it. The index still narrows the scan; the second
        -- test only rechecks what came back, and holds the threshold at the
        -- value 0019 measured whatever the session was left set to.
        or (
          public.search_norm(pc.name) %> (select fuzzy from q)
          and word_similarity((select fuzzy from q), public.search_norm(pc.name)) > 0.6
        )
      )
    union all
    -- No index here, and none needed: 1,205 productions, of which 945 name a
    -- director. The regular expressions in `director_names` are the cost, and
    -- they are paid once over a table five times smaller than the cast.
    select dn.name, p.id, true
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where (select term from q) <> ''
      and (
        public.search_norm(dn.name) like (select pat from q) escape '\'
        or (
          public.search_norm(dn.name) %> (select fuzzy from q)
          and word_similarity((select fuzzy from q), public.search_norm(dn.name)) > 0.6
        )
      )
  ),
  -- `person_slug()` returns null for a fragment that reduces to nothing once
  -- honorifics are stripped, and those are not people.
  --
  -- MATERIALIZED again, and again for a measured reason: this CTE is read three
  -- times below, and left inlined the slug regular expressions are recomputed
  -- on every one of those reads.
  credits as materialized (
    select public.person_slug(h.name) as slug, h.name, h.play_id, h.directed
    from hits h
    where public.person_slug(h.name) is not null
  ),
  -- The theatres disagree about accents and capitalisation, so one slug can
  -- arrive under several spellings. The commonest wins, ties alphabetically, so
  -- the answer is stable between calls rather than shifting with the query plan
  -- — the same rule `person_profile()` applies, and it has to be the same rule
  -- or search and the page it opens would print different names.
  spellings as materialized (
    select c.slug, c.name, count(*) as n
    from credits c
    group by c.slug, c.name
  ),
  people as (
    select
      c.slug,
      count(distinct c.play_id)::int as credit_count,
      count(distinct p.venue_id)::int as venue_count,
      count(distinct c.play_id) filter (where c.directed)::int as directed_count,
      min(extract(year from p.premiere_date))::int as first_year,
      max(extract(year from p.premiere_date))::int as last_year,
      max(public.person_match_rank(c.name, (select term from q))) as rank
    from credits c
    join public.plays p on p.id = c.play_id
    group by c.slug
  )
  select
    pe.slug,
    (select s.name from spellings s where s.slug = pe.slug order by s.n desc, s.name limit 1) as display_name,
    pe.credit_count,
    pe.venue_count,
    pe.directed_count,
    pe.first_year,
    pe.last_year
  from people pe
  order by pe.rank desc, pe.credit_count desc, display_name
  limit greatest(coalesce(limit_count, 8), 0);
$fn$;

comment on function public.search_people(text, int) is
  'People in the catalogue matching a search term — the cast and director half '
  'of what search_plays() answers with productions.';

grant execute on function public.person_match_rank(text, text) to anon, authenticated;
grant execute on function public.search_people(text, int) to anon, authenticated;

commit;
