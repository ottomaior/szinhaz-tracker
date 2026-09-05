-- Make search find things, and put the best answer first.
--
-- Three things were wrong with it, and all three are the kind you only notice
-- by typing into the box the way a person actually would:
--
-- 1. It ended in `order by pl.title`. Every result was alphabetical, so
--    searching "Chicago" put a production whose *cast* includes someone called
--    Chicagó-something above the musical named Chicago, purely because its
--    title starts with an earlier letter. There was no notion of one result
--    being a better answer than another.
--
-- 2. `ilike` is accent-sensitive, and Hungarian is not a language you can type
--    without accents on every keyboard. "orkeny" found nothing. "szinhaz"
--    found nothing. "Ordogok" found nothing. The catalogue is full of ő and ű,
--    and the search box was effectively demanding them.
--
-- 3. A typo returned an empty screen. "Csokonay", "Katonna", one transposed
--    letter in a long Hungarian title — nothing, and the empty state invites
--    the reader to add the play by hand, so a misspelling led directly to a
--    duplicate row.
--
-- unaccent and pg_trgm were available in the project all along and simply had
-- never been enabled.

begin;

create extension if not exists unaccent with schema public;
create extension if not exists pg_trgm with schema public;

/*
 * unaccent(), but callable from an index and from an IMMUTABLE function.
 *
 * The extension's own unaccent(text) is only STABLE, because it resolves the
 * default dictionary through a search path that could in principle change
 * between calls. Naming the dictionary explicitly removes that freedom, which
 * is what makes this form safe to mark IMMUTABLE — the standard workaround,
 * and the only way to get a trigram index over accent-folded text.
 */
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $fn$
  select public.unaccent('public.unaccent', $1);
$fn$;

/** One text field reduced to what search should compare on. */
create or replace function public.search_norm(text)
returns text
language sql
immutable
strict
parallel safe
as $fn$
  select lower(public.immutable_unaccent($1));
$fn$;

comment on function public.search_norm(text) is
  'Lowercased and accent-folded, so "orkeny" matches "Örkény" and "szinhaz" matches "Színház".';

/*
 * How good a match this row is for the term, 0-100.
 *
 * The bands matter more than the exact numbers: an exact title beats a title
 * that starts with the term, which beats a title that merely contains it,
 * which beats the people and places attached to the production. Someone typing
 * "Chicago" wants the musical, not everything with a Chicago connection.
 *
 * The trigram floor at the bottom is what catches typos. It is scaled to stay
 * under every literal band, so a fuzzy hit can never outrank a real one.
 */
create or replace function public.search_rank(
  p_title text,
  p_author text,
  p_director text,
  p_venue text,
  p_room text,
  p_genre text,
  term text
)
returns int
language sql
immutable
parallel safe
as $fn$
  select case
    when term is null or btrim(term) = '' then 0

    when public.search_norm(coalesce(p_title, '')) = public.search_norm(term)                     then 100
    when public.search_norm(coalesce(p_title, '')) like public.search_norm(term) || '%'           then 90
    when public.search_norm(coalesce(p_title, '')) like '%' || public.search_norm(term) || '%'    then 80

    when public.search_norm(coalesce(p_author, ''))   like '%' || public.search_norm(term) || '%' then 65
    when public.search_norm(coalesce(p_director, '')) like '%' || public.search_norm(term) || '%' then 60
    when public.search_norm(coalesce(p_venue, ''))    like '%' || public.search_norm(term) || '%' then 45
    when public.search_norm(coalesce(p_room, ''))     like '%' || public.search_norm(term) || '%' then 40
    when public.search_norm(coalesce(p_genre, ''))    like '%' || public.search_norm(term) || '%' then 35

    -- Everything left matched on something this function cannot see — the cast
    -- list, checked with an EXISTS in the query rather than joined in — or on
    -- nothing but trigram similarity. Both belong below every literal band.
    else greatest(
      0,
      least(30, (word_similarity(public.search_norm(term), public.search_norm(coalesce(p_title, ''))) * 30)::int)
    )
  end;
$fn$;

-- The old signature has to go rather than sit alongside the new one: PostgREST
-- resolves an RPC by the names of the arguments it is handed, and two overloads
-- sharing a prefix are ambiguous — the call fails with "could not choose the
-- best candidate function" instead of picking either. Same reasoning as 0015.
drop function if exists public.search_plays(text, text, text, boolean, uuid);

create or replace function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true,
  venue_id_filter uuid default null,
  genre_filter text default null,
  room_filter text default null,
  sort_by text default 'relevance'
)
returns setof public.plays
language sql
stable
as $fn$
  with q as (
    select
      coalesce(search_term, '')                                    as term,
      '%' || public.escape_like(public.search_norm(coalesce(search_term, ''))) || '%' as pat
  )
  select pl.*
  from public.plays pl
  cross join q
  left join public.venues v on v.id = pl.venue_id
  where
    (venue_type_filter is null or v.type = venue_type_filter)
    and (city_filter    is null or v.city = city_filter)
    and (venue_id_filter is null or pl.venue_id = venue_id_filter)
    and (genre_filter   is null or pl.genre_normalized = genre_filter)
    and (room_filter    is null or pl.primary_room = room_filter)
    and (include_archived or not pl.is_archived)
    and (
      public.search_norm(pl.title)               like q.pat escape '\'
      or public.search_norm(coalesce(pl.author, ''))            like q.pat escape '\'
      or public.search_norm(coalesce(pl.director, ''))          like q.pat escape '\'
      or public.search_norm(coalesce(pl.genre, ''))             like q.pat escape '\'
      or public.search_norm(coalesce(pl.genre_normalized, ''))  like q.pat escape '\'
      or public.search_norm(coalesce(pl.primary_room, ''))      like q.pat escape '\'
      or public.search_norm(coalesce(v.name, ''))               like q.pat escape '\'
      -- EXISTS rather than a join: joining play_cast multiplied every result by
      -- its cast size, which is why the old query needed DISTINCT — and DISTINCT
      -- over `plays.*` is both slower and incompatible with ranking.
      or exists (
        select 1 from public.play_cast c
        where c.play_id = pl.id
          and public.search_norm(c.name) like q.pat escape '\'
      )
      -- The typo net, over the three fields people actually mistype: the
      -- title, the writer, and the theatre. Held to terms of four characters
      -- or more, because below that trigram matching is noise and would pull
      -- in most of the catalogue.
      --
      -- `word_similarity` rather than `similarity`, and the difference is not
      -- cosmetic. `similarity` compares the term against the *whole* target and
      -- divides by the union of their trigrams, so a short term scores badly
      -- against a long name however well it matches part of it:
      -- similarity('csokonay', 'csokonai nemzeti szinhaz') is 0.26, under any
      -- workable threshold. `word_similarity` scores the term against the best
      -- matching run of words inside the target, giving 0.78 for the same pair
      -- — while unrelated terms still score 0.
      --
      -- Measured, on this catalogue: Csokonay→Csokonai 0.78, Katonna→Katona
      -- 0.67, Verdy→Verdi 0.67, and nonsense 0.00. A 0.6 threshold sits in the
      -- gap. Note the argument order — the term goes first.
      --
      -- A fuzzy hit can never outrank a literal one: search_rank caps it at 30,
      -- below every literal band, so widening the net costs ordering nothing.
      or (
        length(q.term) >= 4
        and (
          word_similarity(public.search_norm(q.term), public.search_norm(pl.title)) > 0.6
          or word_similarity(public.search_norm(q.term), public.search_norm(coalesce(pl.author, ''))) > 0.6
          or word_similarity(public.search_norm(q.term), public.search_norm(coalesce(v.name, ''))) > 0.6
        )
      )
    )
  order by
    -- Only the selected key is non-null, so the others contribute nothing.
    case when sort_by = 'relevance' then
      public.search_rank(pl.title, pl.author, pl.director, v.name, pl.primary_room, pl.genre_normalized, q.term)
    end desc nulls last,
    case when sort_by = 'rating'   then pl.rating_overall end desc nulls last,
    case when sort_by = 'premiere' then pl.premiere_date  end desc nulls last,
    case when sort_by = 'next'     then pl.next_perf_at   end asc  nulls last,
    case when sort_by = 'title'    then public.search_norm(pl.title) end asc nulls last,
    -- Tiebreaks, applied under every sort. A production still running is the
    -- more useful of two equally good matches, and search deliberately reaches
    -- the theatres' archives — that is what makes an old play loggable — so
    -- without this an archived row could sit above the revival of the same work.
    pl.is_archived asc,
    pl.next_perf_at asc nulls last,
    public.search_norm(pl.title) asc;
$fn$;

grant execute on function public.search_plays(text, text, text, boolean, uuid, text, text, text)
  to anon, authenticated;
grant execute on function public.search_rank(text, text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.search_norm(text) to anon, authenticated;
grant execute on function public.immutable_unaccent(text) to anon, authenticated;

-- Trigram indexes over the accent-folded text. These serve both the `like
-- '%term%'` predicates — which no b-tree can help with, since they are not
-- anchored — and the similarity() fallback.
create index if not exists plays_title_trgm_idx
  on public.plays using gin (public.search_norm(title) gin_trgm_ops);
create index if not exists plays_author_trgm_idx
  on public.plays using gin (public.search_norm(coalesce(author, '')) gin_trgm_ops);
create index if not exists play_cast_name_trgm_idx
  on public.play_cast using gin (public.search_norm(name) gin_trgm_ops);

commit;
