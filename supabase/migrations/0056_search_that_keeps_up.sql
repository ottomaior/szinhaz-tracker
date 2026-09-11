-- Search that keeps up with typing.
--
-- Ottó recorded the search box on his phone: results arrive a beat or two
-- after the letters, and the screen empties into placeholders while they do.
-- Measured on 11 September 2026 against this project (1,235 plays, 17,802 cast
-- rows), calling the RPCs the way the app does:
--
--     search_plays('nagy')      296 rows    2.35 s
--     search_plays('hamlet')      4 rows    1.10 s
--     search_people('nagy', 5)    5 rows    0.54 s
--
-- One cause under all three, and it is the design of 0019 and 0035 meeting a
-- catalogue that has since grown: **accent folding is done per query, per
-- row.** `search_norm()` is `lower(unaccent())`, and unaccent costs about 40µs
-- a call — trivial once, ruinous 20,000 times. `search_plays` calls it up to
-- eleven times for every one of the 1,235 rows just to decide whether the row
-- matches, then up to nine more per match to rank it. The trigram indexes from
-- 0019 cannot help, because the predicate is an OR of seven such expressions
-- and no index serves an OR. `search_people` is worse: `person_slug()` is a
-- regular-expression pipeline at about 190µs a call, and it is run over every
-- matched cast row and every director on every keystroke — 0035 measured 127ms
-- at 6,397 cast rows; the table is 2.8× that now.
--
-- The fix is to fold once, at write time, and search what was stored:
--
-- 1. **Generated columns.** `plays` gets `title_norm`, `author_norm`,
--    `director_norm`, `room_norm`, `genre_norm` and one concatenated
--    `search_text`; `venues` gets `name_norm`; `play_cast` gets `name_norm` and
--    `slug`. All are `generated always … stored` over functions that are
--    already IMMUTABLE, so the sync's `replace_play_cast` and the app's
--    `create_play_with_cast` need no change — Postgres fills them in on every
--    insert and update.
--
-- 2. **A people index.** `play_people` is the `credits` CTE of 0035 made into a
--    table (one row per credit: play, slug, canonical spelling, whether it was
--    directing), and `people_index` is one row per person with the counts and
--    the display name `search_people()` used to compute per query. Both are
--    rebuilt by `refresh_people_index()` at the end of every sync, and kept
--    current for a play a member adds by hand through
--    `index_people_for_play()`, called from `create_play_with_cast`.
--
-- 3. **`search_plays` returns a page.** There was no LIMIT: "a" returned 1,227
--    full rows, synopsis and all, about a megabyte, for a grid that shows six
--    posters above the fold. It now takes `limit_count` and `offset_count`
--    (default 40, matching the browse rails) and returns the total and the
--    archived count alongside each row, so the header can still say
--    "296 találat · ebből 33 már nincs műsoron" over a page of forty.
--
-- Ranking is unchanged in substance — the bands of `search_rank()` and
-- `person_match_rank()` are kept to the number — only computed over the stored
-- text. The before/after id lists for "nagy", "hamlet", "orkeny", "Csokonay",
-- "szinhaz" and "Katonna" were compared as part of this migration's review:
-- identical for the first four; for "orkeny" and "Katonna" the function running
-- before this migration was returning venue-band (45) and fuzzy-band rows above
-- author-band (65) and title-band rows — "Egy rosszaságról", at the Örkény,
-- above Örkény István's own "Tóték" — which is to say it was not applying the
-- order 0019 documents. It does now, and that is part of what Ottó saw as the
-- search being "a bit off".
--
-- Measured after applying, warm session, via the RPCs:
--
--     search_plays('nagy')      40 of 296   27 ms   (was 2,354)
--     search_plays('hamlet')     4 of 4     26 ms   (was 1,101)
--     search_plays('a')         40 of 1,227 38 ms
--     search_people('nagy', 5)   5           1 ms   (was   538)
--
-- The first call on a fresh connection pays the plan once (about 150 ms);
-- PostgREST pools its connections, so that is paid rarely.
--
-- Additive, per CLAUDE.md: `search_rank()`, `person_match_rank()`, the 0019
-- expression indexes and `play_cast_person_slug_idx` all stay until a later
-- migration has confirmed nothing reads them. The one signature that has to go
-- is `search_plays(text,text,text,boolean,uuid,text,text,text)`, for the reason
-- 0015 and 0019 give: PostgREST resolves an RPC by argument names, and two
-- overloads sharing a prefix make every call ambiguous.
--
-- Nothing here touches data a member has stored: every new column and table is
-- derived from the catalogue, and the rebuild reads `play_cast` and `plays`
-- only.

begin;

-- ---------------------------------------------------------------------------
-- 1. Fold once, at write time
-- ---------------------------------------------------------------------------

alter table public.plays
  add column if not exists title_norm text
    generated always as (public.search_norm(title)) stored,
  add column if not exists author_norm text
    generated always as (public.search_norm(coalesce(author, ''))) stored,
  add column if not exists director_norm text
    generated always as (public.search_norm(coalesce(director, ''))) stored,
  add column if not exists room_norm text
    generated always as (public.search_norm(coalesce(primary_room, ''))) stored,
  add column if not exists genre_norm text
    generated always as (public.search_norm(coalesce(genre_normalized, ''))) stored,
  -- Everything the old predicate tested on the row itself, in one haystack.
  -- The separator keeps a two-word term from matching across a field boundary:
  -- "nagy laszlo" does not find a title ending in "nagy" by an author starting
  -- "László", because between them sits " | ".
  -- `||` rather than concat_ws(): concat_ws is only STABLE, and a generated
  -- column's expression has to be IMMUTABLE.
  add column if not exists search_text text
    generated always as (
      public.search_norm(
        title
        || ' | ' || coalesce(author, '')
        || ' | ' || coalesce(director, '')
        || ' | ' || coalesce(genre, '')
        || ' | ' || coalesce(genre_normalized, '')
        || ' | ' || coalesce(primary_room, ''))
    ) stored;

alter table public.venues
  add column if not exists name_norm text
    generated always as (public.search_norm(name)) stored;

alter table public.play_cast
  add column if not exists name_norm text
    generated always as (public.search_norm(name)) stored,
  -- Null for a fragment that reduces to nothing once the honorifics are
  -- stripped — the same rule 0035 applied per query.
  add column if not exists slug text
    generated always as (public.person_slug(name)) stored;

comment on column public.plays.search_text is
  'Accent-folded title, author, director, genre and stage, " | "-separated. What search_plays() matches against.';
comment on column public.play_cast.slug is
  'person_slug(name), stored. Null when the name is not a person (a bare honorific, a list heading).';

create index if not exists plays_search_text_trgm_idx
  on public.plays using gin (search_text gin_trgm_ops);
create index if not exists play_cast_name_norm_trgm_idx
  on public.play_cast using gin (name_norm gin_trgm_ops);
create index if not exists play_cast_slug_idx
  on public.play_cast (slug);

-- ---------------------------------------------------------------------------
-- 2. The people, indexed
-- ---------------------------------------------------------------------------

-- One row per credit, with the identity work already done. This is what
-- `person_credits()` and `search_people()` each recomputed from `play_cast`
-- and `director_names(plays.director)` on every call.
create table if not exists public.play_people (
  play_id  uuid    not null references public.plays(id) on delete cascade,
  slug     text    not null,
  -- The canonical spelling on this credit. The sources disagree about accents
  -- and capitalisation, and the commonest spelling becomes the display name.
  name     text    not null,
  directed boolean not null default false
);

create index if not exists play_people_slug_idx on public.play_people (slug);
create index if not exists play_people_play_id_idx on public.play_people (play_id);

alter table public.play_people enable row level security;
drop policy if exists "play_people_select_all" on public.play_people;
create policy "play_people_select_all" on public.play_people for select using (true);
grant select on public.play_people to anon, authenticated;

-- One row per person. Everything `search_people()` returns, precomputed.
create table if not exists public.people_index (
  slug           text primary key,
  display_name   text not null,
  name_norm      text not null,
  credit_count   int  not null default 0,
  venue_count    int  not null default 0,
  directed_count int  not null default 0,
  first_year     int,
  last_year      int,
  refreshed_at   timestamptz not null default now()
);

create index if not exists people_index_name_trgm_idx
  on public.people_index using gin (name_norm gin_trgm_ops);
create index if not exists people_index_credit_count_idx
  on public.people_index (credit_count desc);

alter table public.people_index enable row level security;
drop policy if exists "people_index_select_all" on public.people_index;
create policy "people_index_select_all" on public.people_index for select using (true);
grant select on public.people_index to anon, authenticated;

comment on table public.people_index is
  'One row per performer or director in the catalogue, rebuilt by refresh_people_index() after every sync. What search_people() reads.';

-- The rows `people_index` should hold for the given slugs, or for everybody
-- when null. Reused by the full rebuild and by the per-play refresh.
--
-- Display name: the commonest spelling across the person's credits, ties
-- alphabetical — the rule `person_profile()` applies, and it has to be the same
-- rule or search and the page it opens would print different names.
create or replace function public.people_index_rows(only_slugs text[] default null)
returns setof public.people_index
language sql
stable
set search_path = public
as $fn$
  with spellings as (
    select pp.slug, pp.name, count(*) as n
    from public.play_people pp
    where only_slugs is null or pp.slug = any (only_slugs)
    group by pp.slug, pp.name
  ),
  best as (
    select distinct on (slug) slug, name
    from spellings
    order by slug, n desc, name
  ),
  counts as (
    select
      pp.slug,
      count(distinct pp.play_id)::int                              as credit_count,
      count(distinct p.venue_id)::int                              as venue_count,
      count(distinct pp.play_id) filter (where pp.directed)::int   as directed_count,
      min(extract(year from p.premiere_date))::int                 as first_year,
      max(extract(year from p.premiere_date))::int                 as last_year
    from public.play_people pp
    join public.plays p on p.id = pp.play_id
    where only_slugs is null or pp.slug = any (only_slugs)
    group by pp.slug
  )
  select
    c.slug,
    b.name,
    public.search_norm(b.name),
    c.credit_count,
    c.venue_count,
    c.directed_count,
    c.first_year,
    c.last_year,
    now()
  from counts c
  join best b on b.slug = c.slug;
$fn$;

revoke all on function public.people_index_rows(text[]) from public;
grant execute on function public.people_index_rows(text[]) to service_role;

-- The full rebuild. Definer, because the sync is the only caller and the
-- tables are otherwise read-only to everyone; granted to service_role alone
-- so it is not reachable at /rest/v1/rpc with a member's key.
--
-- Deletes rather than truncates: TRUNCATE takes an ACCESS EXCLUSIVE lock, and
-- a search arriving during the rebuild would wait on it. A delete lets the
-- reader see the old rows until the transaction commits.
create or replace function public.refresh_people_index()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int;
begin
  delete from public.play_people;
  insert into public.play_people (play_id, slug, name, directed)
    select pc.play_id, pc.slug, public.person_canonical_name(pc.name), false
    from public.play_cast pc
    where pc.slug is not null
    union all
    select p.id, public.person_slug(dn.name), dn.name, true
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where public.person_slug(dn.name) is not null;

  delete from public.people_index;
  insert into public.people_index
    select * from public.people_index_rows(null);
  get diagnostics n = row_count;
  return n;
end;
$fn$;

revoke all on function public.refresh_people_index() from public, anon, authenticated;
grant execute on function public.refresh_people_index() to service_role;

comment on function public.refresh_people_index() is
  'Rebuilds play_people and people_index from the catalogue. Called by the sync after its recomputes; returns the number of people indexed.';

-- The incremental path, for a production a member adds by hand: their new
-- play's people should be findable before tomorrow's sync. Definer, so an
-- ordinary member can write the two derived tables through it and nothing
-- else; it refuses any play the caller did not create, which bounds what a
-- misuse can cost to re-indexing one's own rows.
--
-- In `private` rather than `public`, the way 0037 placed `blocked_between`:
-- a member needs EXECUTE on it for `create_play_with_cast` to call it, and a
-- definer function in `public` that authenticated can execute is one the
-- linter rightly reports as reachable at /rest/v1/rpc (lint 0029). Out of the
-- exposed schema, it is callable from SQL and from nowhere else.
create or replace function private.index_people_for_play(p_play_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  affected text[];
begin
  if not exists (
    select 1 from public.plays p
    where p.id = p_play_id and p.created_by = auth.uid()
  ) then
    return 0;
  end if;

  delete from public.play_people where play_id = p_play_id;
  insert into public.play_people (play_id, slug, name, directed)
    select pc.play_id, pc.slug, public.person_canonical_name(pc.name), false
    from public.play_cast pc
    where pc.play_id = p_play_id and pc.slug is not null
    union all
    select p.id, public.person_slug(dn.name), dn.name, true
    from public.plays p
    cross join lateral public.director_names(p.director) as dn(name)
    where p.id = p_play_id and public.person_slug(dn.name) is not null;

  select array_agg(distinct slug) into affected
  from public.play_people where play_id = p_play_id;
  if affected is null then
    return 0;
  end if;

  insert into public.people_index
    select * from public.people_index_rows(affected)
  on conflict (slug) do update set
    display_name   = excluded.display_name,
    name_norm      = excluded.name_norm,
    credit_count   = excluded.credit_count,
    venue_count    = excluded.venue_count,
    directed_count = excluded.directed_count,
    first_year     = excluded.first_year,
    last_year      = excluded.last_year,
    refreshed_at   = excluded.refreshed_at;

  return coalesce(array_length(affected, 1), 0);
end;
$fn$;

revoke all on function private.index_people_for_play(uuid) from public, anon;
grant execute on function private.index_people_for_play(uuid) to authenticated, service_role;

-- `create_play_with_cast`, as 0013 and 0044 left it, plus the one call at the
-- end. Still security invoker: it inserts under the member's own RLS.
create or replace function public.create_play_with_cast(play jsonb, cast_members jsonb default '[]'::jsonb)
returns public.plays
language plpgsql
set search_path = public
as $fn$
declare
  new_play public.plays;
  member jsonb;
  idx int := 0;
begin
  insert into public.plays (
    title, author, director, venue_id, genre, runtime_minutes,
    intermissions, premiere_date, synopsis, poster_url,
    poster_path, poster_credit, created_by, source
  ) values (
    play->>'title',
    play->>'author',
    play->>'director',
    (play->>'venueId')::uuid,
    play->>'genre',
    nullif(play->>'runtimeMinutes', '')::int,
    coalesce((play->>'intermissions')::int, 0),
    nullif(play->>'premiereDate', '')::date,
    play->>'synopsis',
    play->>'posterUrl',
    case
      when play->>'posterPath' like 'user/' || auth.uid()::text || '/%'
        then play->>'posterPath'
      else null
    end,
    nullif(play->>'posterCredit', ''),
    auth.uid(),
    'user'
  )
  returning * into new_play;

  for member in select * from jsonb_array_elements(cast_members)
  loop
    insert into public.play_cast (play_id, name, role, sort_order)
    values (new_play.id, member->>'name', member->>'role', idx);
    idx := idx + 1;
  end loop;

  -- So the people on a hand-added production are searchable at once rather
  -- than after the next sync.
  perform private.index_people_for_play(new_play.id);

  return new_play;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. search_plays over the stored text, with a page
-- ---------------------------------------------------------------------------

-- plpgsql rather than sql, and the difference was measured: a set-returning
-- SQL function is re-planned on every call, and planning this query costs
-- about 40ms — more than running it. plpgsql caches the plan per session, and
-- PostgREST keeps its sessions, so after the first search on a connection the
-- planning cost is gone. The folded term and the patterns are computed once
-- into locals for the same reason 0035 read them through scalar subqueries:
-- as plain parameters they reach the index conditions as values.
--
-- The score is inlined. It was a function first — `search_score()`, a
-- `search_rank()` over pre-folded text — and turned out to cost 270µs a call,
-- because a function with `set search_path` cannot be inlined and pays a GUC
-- save and restore every time it is entered. (That same cost is why 0044,
-- which pinned search_path on `search_norm()` and `immutable_unaccent()`, made
-- the per-row folding of 0019 so much slower than 0035 had measured it.) The
-- bands are `search_rank()`'s to the number.
--
-- `not pl.is_event`: search kept talks and workshops out before this migration
-- — the "excluded from browse, programme, search and onboarding" of 0034 — and
-- keeps them out now. The clause was applied to the database alongside 0034 but
-- never made it into a file; this is where the repository catches up.
drop function if exists public.search_plays(text, text, text, boolean, uuid, text, text, text);

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true,
  venue_id_filter uuid default null,
  genre_filter text default null,
  room_filter text default null,
  sort_by text default 'relevance',
  limit_count int default 40,
  offset_count int default 0
)
returns table (play public.plays, total_count int, archived_count int)
language plpgsql
stable
set search_path = public
as $fn$
declare
  v_term  text := public.search_norm(coalesce(search_term, ''));
  v_core  text;
  v_pat   text;
  -- The typo net, on for terms of four characters or more (0019). Null
  -- switches it off: word_similarity against null is null, and the OR falls
  -- through.
  v_fuzzy text;
begin
  if v_term = '' then
    return;
  end if;
  v_core  := public.escape_like(v_term);
  v_pat   := '%' || v_core || '%';
  v_fuzzy := case when length(v_term) >= 4 then v_term end;

  return query
  with hits as (
    select
      pl,
      -- An exact title beats a title that starts with the term, which beats
      -- one that contains it, which beats the people and places attached to
      -- the production. The trigram floor at the bottom catches typos and
      -- cast-only matches, and stays under every literal band.
      case
        when pl.title_norm = v_term                                          then 100
        when pl.title_norm like v_core || '%' escape '\'                     then 90
        when pl.title_norm like v_pat escape '\'                             then 80
        when pl.author_norm like v_pat escape '\'                            then 65
        when pl.director_norm like v_pat escape '\'                          then 60
        when coalesce(v.name_norm, '') like v_pat escape '\'                 then 45
        when pl.room_norm like v_pat escape '\'                              then 40
        when pl.genre_norm like v_pat escape '\'                             then 35
        else greatest(0, least(30, (public.word_similarity(v_term, pl.title_norm) * 30)::int))
      end as score
    from public.plays pl
    left join public.venues v on v.id = pl.venue_id
    where not pl.is_event
      and (venue_type_filter is null or v.type = venue_type_filter)
      and (city_filter       is null or v.city = city_filter)
      and (venue_id_filter   is null or pl.venue_id = venue_id_filter)
      and (genre_filter      is null or pl.genre_normalized = genre_filter)
      and (room_filter       is null or pl.primary_room = room_filter)
      and (include_archived or not pl.is_archived)
      and (
        pl.search_text like v_pat escape '\'
        or v.name_norm like v_pat escape '\'
        -- IN over a hashed subplan: `play_cast_name_norm_trgm_idx` narrows
        -- the cast rows once, and each play is tested against the set.
        or pl.id in (
          select c.play_id from public.play_cast c
          where c.name_norm like v_pat escape '\'
        )
        -- The typo net over the three fields people mistype, at the
        -- threshold 0019 measured.
        or public.word_similarity(v_fuzzy, pl.title_norm) > 0.6
        or public.word_similarity(v_fuzzy, pl.author_norm) > 0.6
        or public.word_similarity(v_fuzzy, coalesce(v.name_norm, '')) > 0.6
      )
  )
  select
    h.pl as play,
    (count(*) over ())::int as total_count,
    -- What the header reports as "már nincs műsoron": the app's definition,
    -- archived or ended, so the count matches the badges under it.
    (count(*) filter (where (h.pl).is_archived or (h.pl).status = 'ended') over ())::int as archived_count
  from hits h
  order by
    -- Only the selected key is non-null, so the others contribute nothing.
    case when sort_by = 'relevance' then h.score               end desc nulls last,
    case when sort_by = 'rating'    then (h.pl).rating_overall end desc nulls last,
    case when sort_by = 'premiere'  then (h.pl).premiere_date  end desc nulls last,
    case when sort_by = 'next'      then (h.pl).next_perf_at   end asc  nulls last,
    case when sort_by = 'title'     then (h.pl).title_norm     end asc  nulls last,
    -- Tiebreaks under every sort, as 0019: a production still running is the
    -- more useful of two equally good matches.
    (h.pl).is_archived asc,
    (h.pl).next_perf_at asc nulls last,
    (h.pl).title_norm asc
  limit greatest(coalesce(limit_count, 40), 1)
  offset greatest(coalesce(offset_count, 0), 0);
end;
$fn$;

grant execute on function public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int)
  to anon, authenticated;

comment on function public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int) is
  'Productions matching a term, best first, one page at a time. total_count and archived_count describe the whole match, not the page.';

-- ---------------------------------------------------------------------------
-- 4. search_people over the index
-- ---------------------------------------------------------------------------

-- Same signature, same columns, same order as 0035 — `person_match_rank()`
-- inlined over the stored `name_norm`, so that no row is folded at query time
-- and no function boundary is crossed per row.
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
language plpgsql
stable
set search_path = public
as $fn$
declare
  v_term  text := public.search_norm(coalesce(search_term, ''));
  v_core  text;
  v_pat   text;
  v_fuzzy text;
begin
  if v_term = '' then
    return;
  end if;
  v_core  := public.escape_like(v_term);
  v_pat   := '%' || v_core || '%';
  v_fuzzy := case when length(v_term) >= 4 then v_term end;

  return query
  select
    pi.slug,
    pi.display_name,
    pi.credit_count,
    pi.venue_count,
    pi.directed_count,
    pi.first_year,
    pi.last_year
  from public.people_index pi
  where
    pi.name_norm like v_pat escape '\'
    -- `%>` is the indexable form of "contains a word close to the term"; the
    -- explicit comparison pins the threshold 0019 measured whatever the
    -- session's pg_trgm setting is (0035).
    or (
      pi.name_norm %> v_fuzzy
      and public.word_similarity(v_fuzzy, pi.name_norm) > 0.6
    )
  order by
    -- Exact, starts the name, starts a word inside it — a given name, since
    -- Hungarian prints the family name first — appears anywhere, then the
    -- fuzzy floor capped at 60. Two names in the same band are separated by
    -- how much the catalogue knows about them.
    case
      when pi.name_norm = v_term                              then 100
      when pi.name_norm like v_core || '%' escape '\'         then 90
      when pi.name_norm like '% ' || v_core || '%' escape '\' then 80
      when pi.name_norm like v_pat escape '\'                 then 70
      else greatest(0, least(60, (public.word_similarity(v_term, pi.name_norm) * 60)::int))
    end desc,
    pi.credit_count desc,
    pi.display_name
  limit greatest(coalesce(limit_count, 8), 0);
end;
$fn$;

grant execute on function public.search_people(text, int) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Member search folds accents too
-- ---------------------------------------------------------------------------

-- 0014's body with 0037's block filter, and `search_norm()` on both sides:
-- "kovacs" now finds a member called Kovács. Six rows; no index warranted.
create or replace function public.search_profiles(search_term text)
returns setof public.profiles
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  with pattern as (
    select '%' || public.escape_like(public.search_norm(coalesce(search_term, ''))) || '%' as p
  )
  select pr.*
  from public.profiles pr
  cross join pattern
  where (
      public.search_norm(pr.name)   like pattern.p escape '\'
      or public.search_norm(pr.handle) like pattern.p escape '\'
    )
    and not private.blocked_between(pr.id)
  order by pr.name
  limit 20;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. First fill
-- ---------------------------------------------------------------------------

select public.refresh_people_index();

commit;

-- rollback:
--   drop function if exists public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int);
--   -- then recreate search_plays(text, text, text, boolean, uuid, text, text, text)
--   -- from 0019_search_ranking.sql lines 117-208, and search_people(text, int)
--   -- from 0035_search_finds_people.sql lines 104-212, and search_profiles(text)
--   -- from 0037_reports_and_blocks.sql lines 339-356, and create_play_with_cast
--   -- from 0013_user_poster_uploads.sql without the `perform` line.
--   drop function if exists private.index_people_for_play(uuid);
--   drop function if exists public.refresh_people_index();
--   drop function if exists public.people_index_rows(text[]);
--   drop table if exists public.people_index;
--   drop table if exists public.play_people;
--   drop index if exists public.play_cast_slug_idx;
--   drop index if exists public.play_cast_name_norm_trgm_idx;
--   drop index if exists public.plays_search_text_trgm_idx;
--   alter table public.play_cast drop column slug, drop column name_norm;
--   alter table public.venues drop column name_norm;
--   alter table public.plays drop column search_text, drop column genre_norm, drop column room_norm,
--     drop column director_norm, drop column author_norm, drop column title_norm;
--   -- Nothing is lost: every column and row this file adds is derived from
--   -- plays and play_cast and comes back on re-apply.
