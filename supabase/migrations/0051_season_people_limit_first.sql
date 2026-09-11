-- The Évad page timed out for anyone with a dated evening (T-043).
--
-- `season_people` (0031) grouped every cast row of every production seen this
-- season by slug, and then — before applying `limit top_n` — looked each slug
-- up through `person_profile()` to get a display name. `person_profile` walks
-- the whole of `play_cast` through `person_slug()` and costs about 280 ms a
-- call; a production credits around forty people, so two evenings were
-- twenty seconds against PostgREST's eight-second statement timeout. The
-- screen showed "Nem sikerült betölteni" to exactly the people it was built
-- for.
--
-- Two changes. The limit now comes first: the top N slugs are chosen on the
-- nights count alone, tie-broken by slug, which is the same order as before
-- in every case that matters (slugs sort like the names they come from). And
-- the display name no longer needs `person_profile` at all: the spelling
-- shown is the canonical form of the name as it appears on the evenings
-- counted, the most common one when a person is credited under several — the
-- same rule `person_profile` applies to the whole catalogue, applied to the
-- rows already in hand. Nothing else about the function changes: the same
-- rows are counted, `review_cast` still overrides `play_cast` per entry, and
-- the signature and grants are as they were.
--
-- No data is touched; a `create or replace` of one invoker function.

begin;

create or replace function public.season_people(viewer uuid, season_start int, top_n int default 5)
returns table (slug text, name text, nights int)
language sql
stable
set search_path = public
as $$
  with seen as (
    select r.id as review_id, r.play_id
    from public.reviews r
    where r.user_id = viewer
      and r.seen_at is not null
      and public.season_start_year(r.seen_at) = season_start
  ),
  recorded as (
    select s.review_id, rc.name
    from seen s
    join public.review_cast rc on rc.review_id = s.review_id
  ),
  assumed as (
    select s.review_id, pc.name
    from seen s
    join public.play_cast pc on pc.play_id = s.play_id
    where not exists (
      select 1 from public.review_cast rc where rc.review_id = s.review_id
    )
  ),
  everyone as (
    select e.review_id, e.name, public.person_slug(e.name) as slug
    from (select * from recorded union all select * from assumed) e
  ),
  -- The top N decided here, on the counts alone.
  by_slug as (
    select e.slug, count(distinct e.review_id)::int as nights
    from everyone e
    where e.slug is not null
    group by 1
    order by nights desc, slug
    limit greatest(top_n, 0)
  ),
  -- Then a name for each of those N, from the rows already counted: the most
  -- common canonical spelling, ties broken alphabetically so the answer is
  -- stable between loads.
  named as (
    select e.slug, public.person_canonical_name(e.name) as name, count(*) as n
    from everyone e
    join by_slug b on b.slug = e.slug
    group by 1, 2
  )
  select b.slug,
         coalesce(
           (select nm.name from named nm where nm.slug = b.slug order by nm.n desc, nm.name limit 1),
           b.slug
         ),
         b.nights
  from by_slug b
  order by b.nights desc, 2;
$$;

grant execute on function public.season_people(uuid, int, int) to anon, authenticated;

commit;

-- rollback: re-run the `create or replace function public.season_people`
-- block from 0031_the_evad.sql, which restores the previous body verbatim.
