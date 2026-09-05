-- ============================================================
-- 6,397 credits get somewhere to land
--
-- `play_cast` has been the richest table in the database and the only one with
-- no screen pointing at it. Search ranks a cast match, so typing a performer's
-- name finds their productions — and then every result navigates to a
-- production, never to the person. There has been no way to ask "what else is
-- she in", which is the question a cast list exists to provoke.
--
-- Three things had to be true before that page could exist, and none was.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A name field does not always hold only a name
--
-- Hungarian theatres print a performer's honours and guest status in the same
-- string as the name, and they do not agree on how. Left alone, this splits one
-- person across several pages, which is the specific failure a person page
-- cannot survive: the whole value is in gathering credits together.
--
-- The biggest offender by far is **m.v.** — *mint vendég*, "as guest" —
-- suffixed to roughly 230 cast rows. That is exactly the wrong set of names to
-- get wrong: a guest is by definition someone appearing at a theatre that is
-- not their own, so guests are the people most likely to turn up under two
-- houses, and "Mészáros Béla m.v." and "Mészáros Béla" would have been two
-- strangers.
--
-- After that, the state prizes: "Szikora János Jászai-díjas, Érdemes Művész",
-- "Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas, Érdemes Művész, a
-- Magyar Művészeti Akadémia rendes tagja". Note the suspended compound in the
-- second — "Ferenczy Noémi- és Jászai Mari-díjas" is two prize names sharing
-- one suffix — which is why the pattern below matches an optional "X- és Y"
-- before `-díjas` rather than a single award name.
--
-- The prizes are listed explicitly rather than matched as "any word ending in
-- -díjas". That generic rule cannot tell whether the word before the suffix is
-- part of the award or part of the person: in "Szikora János Jászai-díjas" the
-- preceding word is his forename, and in "Létay Kiss Gabriella Liszt
-- Ferenc-díjas" it is half the award's name. Only knowing the awards resolves
-- it, and there are not many.
--
-- Everything from the first marker to the end of the string is dropped, because
-- Hungarian prints the name first and the titles after, without exception in
-- this catalogue.
-- ------------------------------------------------------------
create or replace function public.person_canonical_name(raw text)
returns text
language sql
immutable
as $$
  select trim(both ' ,;-/' from
    regexp_replace(
      coalesce(raw, ''),
      '(\s*[,(]?\s*(' ||
        -- "mint vendég" — as guest. Written m.v., m. v., or M.V.
        'm\.\s*v\.' || '|' ||
        -- A state prize, optionally a suspended pair sharing the -díjas suffix.
        '(Kossuth|Liszt Ferenc|Liszt|Jászai Mari|Jászai|Ferenczy Noémi|Blattner Géza|Erkel Ferenc|Balázs Béla|Munkácsy Mihály|Széchenyi)' ||
        '(-\s*és\s+(Kossuth|Liszt Ferenc|Liszt|Jászai Mari|Jászai|Ferenczy Noémi|Blattner Géza|Erkel Ferenc))?' ||
        '\s*-?\s*díjas' || '|' ||
        -- Honorary titles carrying no award name.
        'érdemes\s+művész|kiváló\s+művész|a\s+nemzet\s+\S+|a\s+Magyar\s+Művészeti\s+Akadémia' ||
      ').*)$',
      '', 'i'
    )
  );
$$;

-- ------------------------------------------------------------
-- 2. A name has to survive being put in a URL
--
-- Reuses `immutable_unaccent` from 0019_search_ranking.sql, so "Für Anikó" and
-- "Fur Aniko" reach the same page and the slug carries nothing needing escaping.
--
-- The app builds the same slug in `utils/people.ts`. The two have to agree
-- character for character, and the failure when they do not is nasty: the page
-- does not error, it comes back **empty**, which is indistinguishable from a
-- performer nobody has credited. `utils/people.test.ts` pins the TypeScript
-- side against a table of real names from this catalogue, and the same table is
-- run through this function, so a drift on either side is caught.
-- ------------------------------------------------------------
create or replace function public.person_slug(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        lower(public.immutable_unaccent(public.person_canonical_name(raw))),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;

-- ------------------------------------------------------------
-- 3. A director field is not always one person
--
-- 945 productions name a director and only 122 of those directors also appear
-- in `play_cast`, so a person page built on the cast table alone would miss
-- seven eighths of the directing work in the catalogue. The column has to be
-- read — and it does not hold what you would hope.
--
-- Ten rows carry more than one name. Vígszínház joins co-directors with an en
-- dash ("Valló Péter – Horvai István"); others use a comma. Splitting on the
-- comma alone invents people, because the same separator introduces honorifics:
-- "Juronics Tamás Kossuth-díjas, érdemes művész" is one director, and a naive
-- split files half his title as a colleague called "meritorious artist".
--
-- Splitting first and canonicalising each fragment afterwards handles both:
-- the honorific fragment canonicalises to nothing, and a genuine co-director
-- survives. The capital-letter guard then drops whatever is left that is not a
-- name — including "scher Tamás", a truncated "Ascher Tamás" in the source
-- data. That is a real credit lost, and still better than a person page for
-- somebody who does not exist.
-- ------------------------------------------------------------
create or replace function public.director_names(raw text)
returns setof text
language sql
immutable
as $$
  select name from (
    select public.person_canonical_name(part) as name
    from regexp_split_to_table(coalesce(raw, ''), '\s+–\s+|\s*,\s*') as part
  ) parts
  where name <> ''
    -- Capitalised, after accent folding so Ö and É count. Anything else is a
    -- leftover descriptive phrase rather than a person.
    and left(public.immutable_unaccent(name), 1) ~ '[A-Z]';
$$;

-- ------------------------------------------------------------
-- Roles that are not roles
--
-- The scrapers read a theatre's cast list as name/role pairs, and several sites
-- print list headings in the role column: "továbbá" (furthermore), "valamint"
-- (as well as), "játsszák" (played by). Those are connectives, not jobs, and a
-- person page listing "továbbá" as somebody's function would be nonsense.
--
-- "Szereplő" is deliberately *not* on this list. It is generic, but it is a
-- true claim — that person acted rather than designed or conducted — and on a
-- page whose whole purpose is separating the two, generic and useless are
-- different things.
-- ------------------------------------------------------------
create or replace function public.is_listing_artifact(role text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(role, ''))) in (
    'továbbá', 'valamint', 'és', 'játsszák', 'játssza',
    'közreműködik', 'közreműködnek', 'fellép', 'fellépnek', 'zenészek'
  );
$$;

-- ============================================================
-- The page's two queries
-- ============================================================

/*
 * Everything one person is credited on.
 *
 * Returns play ids rather than play rows on purpose: the app then fetches them
 * through the same `PLAY_SELECT` every other screen uses, so a column added to
 * `plays` later appears here without this function having to know about it.
 *
 * `roles` is deduplicated case-insensitively — the sources disagree about
 * capitalisation ("Rendező" 92 times, "rendező" 25), and a page listing both
 * has invented a second job.
 */
create or replace function public.person_credits(slug text)
returns table (play_id uuid, roles text[], directed boolean)
language sql
stable
as $$
  with cast_credits as (
    select pc.play_id, pc.role
    from public.play_cast pc
    where public.person_slug(pc.name) = slug
      and coalesce(pc.role, '') <> ''
      and not public.is_listing_artifact(pc.role)
  ),
  -- A cast row with an empty role still proves the credit, even though it
  -- cannot say what it was for. 814 rows are in that state.
  cast_bare as (
    select pc.play_id
    from public.play_cast pc
    where public.person_slug(pc.name) = slug
  ),
  directing as (
    select p.id as play_id
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) = slug
  ),
  all_plays as (
    select play_id from cast_bare
    union
    select play_id from directing
  )
  select
    ap.play_id,
    coalesce(
      (
        select array_agg(r.role order by r.role)
        from (
          select distinct on (lower(cc.role)) cc.role
          from cast_credits cc
          where cc.play_id = ap.play_id
          order by lower(cc.role), cc.role
        ) r
      ),
      '{}'::text[]
    ) as roles,
    exists (select 1 from directing d where d.play_id = ap.play_id) as directed
  from all_plays ap;
$$;

/*
 * The header: who this is, and how much of them the catalogue holds.
 *
 * `display_name` is the canonical spelling the sources use most often for this
 * slug. The theatres disagree about accents and capitalisation — "Ágoston
 * Péter" and "ÁGOSTON PÉTER" are the same person at two houses — and the page
 * has to print something. Ties break alphabetically so the answer is stable
 * between calls rather than shifting with the query plan.
 */
create or replace function public.person_profile(slug text)
returns table (
  display_name text,
  credit_count int,
  venue_count int,
  first_year int,
  last_year int,
  directed_count int
)
language sql
stable
as $$
  with names as (
    select public.person_canonical_name(pc.name) as name, count(*) as n
    from public.play_cast pc
    where public.person_slug(pc.name) = slug
    group by 1
    union all
    select dn.name, count(*) as n
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) = slug
    group by 1
  ),
  credits as (select * from public.person_credits(slug)),
  -- Named `pl`, not `plays`: a CTE called `plays` would shadow the table the
  -- join below needs.
  pl as (
    select p.venue_id, p.premiere_date, c.directed
    from credits c join public.plays p on p.id = c.play_id
  )
  select
    (select nm.name from (
       select name, sum(n) as total from names group by name
     ) nm order by nm.total desc, nm.name limit 1),
    (select count(*)::int from credits),
    (select count(distinct venue_id)::int from pl),
    (select min(extract(year from premiere_date))::int from pl),
    (select max(extract(year from premiere_date))::int from pl),
    (select count(*) filter (where directed)::int from pl);
$$;

-- The whole page is one lookup by slug against this expression, over 6,397 cast
-- rows. Without the index both functions are a sequential scan calling unaccent
-- once per row.
create index if not exists play_cast_person_slug_idx
  on public.play_cast (public.person_slug(name));

grant execute on function public.person_canonical_name(text) to anon, authenticated;
grant execute on function public.person_slug(text) to anon, authenticated;
grant execute on function public.director_names(text) to anon, authenticated;
grant execute on function public.is_listing_artifact(text) to anon, authenticated;
grant execute on function public.person_credits(text) to anon, authenticated;
grant execute on function public.person_profile(text) to anon, authenticated;

-- 0024 replaced the earlier `strip_honorifics()`, which handled the award names
-- but not m.v. and was applied only to directors.
drop function if exists public.strip_honorifics(text);
