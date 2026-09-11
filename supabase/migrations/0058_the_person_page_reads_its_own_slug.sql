-- Every person page showed Jánoskúti Márta with 886 credits, or failed to
-- load at all. Regression from 0056, found by Ottó on 11 September.
--
-- 0056 added a generated `slug` column to `play_cast`, so that search and
-- the people index could read a stored slug instead of running the
-- `person_slug()` regular expressions per row. `person_credits(slug text)`
-- and `person_profile(slug text)`, from 0024, are SQL functions whose
-- parameter is also called `slug`, and whose cast CTEs say
--
--     where public.person_slug(pc.name) = slug
--
-- In a SQL function a column name wins over a parameter name, so the moment
-- the table had a `slug` column that line became `pc.slug = pc.slug` — true
-- for every cast row in the catalogue. `person_profile()` then picked the
-- most-credited name in the whole table as the display name, and
-- `person_credits()` returned all 1,235 productions, which is the payload
-- the app timed out on. The `directing` CTE, which reads `plays` and not
-- `play_cast`, was unaffected, and `season_people()` never refers to the
-- column, so it is not touched.
--
-- Both functions are re-created with the comparison written against the
-- stored column and the parameter qualified by function name, which is the
-- form that cannot be shadowed again. Reading `pc.slug` rather than
-- recomputing `person_slug(pc.name)` is also what 0056 was for: the person
-- page's cast lookups now hit `play_cast_slug_idx` instead of running the
-- honorific-stripping regexes over 17,802 rows, so this fix is also the
-- speed-up the page was owed.
--
-- Nothing user-stored changes. Applied to the project the moment it was
-- written; the file is the record.

begin;

create or replace function public.person_credits(slug text)
returns table (play_id uuid, roles text[], directed boolean)
language sql
stable
set search_path = public
as $function$
  with cast_credits as (
    select pc.play_id, pc.role, false as directed
    from public.play_cast pc
    where pc.slug = person_credits.slug
      and coalesce(pc.role, '') <> ''
      and not public.is_listing_artifact(pc.role)
  ),
  cast_bare as (
    select pc.play_id
    from public.play_cast pc
    where pc.slug = person_credits.slug
  ),
  directing as (
    select p.id as play_id
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) = person_credits.slug
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
$function$;

create or replace function public.person_profile(slug text)
returns table (display_name text, credit_count int, venue_count int, first_year int, last_year int, directed_count int)
language sql
stable
set search_path = public
as $function$
  with names as (
    select public.person_canonical_name(pc.name) as name, count(*) as n
    from public.play_cast pc
    where pc.slug = person_profile.slug
    group by 1
    union all
    select dn.name, count(*) as n
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) = person_profile.slug
    group by 1
  ),
  credits as (select * from public.person_credits(person_profile.slug)),
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
$function$;

commit;

-- rollback: re-create both functions from 0024_people.sql lines 173-260 —
-- and then they are broken again, because the column still exists; the
-- real undo would be dropping play_cast.slug, which 0056 owns.
