-- The vocabulary catches up with the festival, and the programme catches up
-- with the vocabulary (T-008).
--
-- 0034 separates talks, tours and workshops from productions by title, and
-- said in its own header that the list would stop being right the moment a
-- new source arrived with its own words for the same things. It did. On 11
-- September the IX. MagdaFeszt programme is fourteen rows at the Csokonai,
-- and nine of them are not productions: three workshops, a literary walk, a
-- chamber concert, a film block, an exhibition tour, a literature class, a
-- workshop named after its leader. All nine were in Discover as plays. None
-- uses a word 0034 looked for — the festival says "workshopja",
-- "tárlatvezetés", "kamarakoncert", "irodalmi séta" — and most of them say it
-- in the *subtitle*, the line the theatre prints under the title, which 0034
-- never read.
--
-- Ottó's decision, 11 September: rows like these are hidden from browse and
-- kept loggable — `is_event` — with the theatre's own words shown for what
-- they are. Not dropped: somebody who went to the literary walk had an
-- evening, and the diary is for evenings.
--
-- Three things change.
--
-- 1. `is_ancillary_event()` takes the subtitle too, and its vocabulary grows.
--    The subtitle is read *anchored*: a subtitle that *is* an event kind —
--    "workshop", "KözTér workshop", "páros tárlatvezetés …", "kamarakoncert
--    …", "válogatás a … filmjeiből", "… vezetésével" — marks an event; a
--    subtitle that merely mentions one does not. That is the whole difference
--    from the version 0034's T-008 note tried and rejected: *A kaméliás
--    hölgy*'s subtitle is "kiállítás egy kurtizán életéről és haláláról három
--    felvonásban", an exhibition in three acts, which is a production. It
--    does not start with an event word, and to be safe nothing that counts
--    its acts ("felvonás") is ever an event, whatever else it says.
--
--    Titles gain: workshop anywhere in the title (0034 only took it at the
--    start or after a dash — "Öregembert játszani - irodalomterápiás
--    workshop" slipped through), "irodalmi séta", "irodalomóra", "díj
--    átadása", "filmklub", "filmfesztivál", "beszélgetés", and concerts —
--    "koncert", "koncertje", "koncertturné" as whole words, so
--    "koncertszínház" (a staged form, with a cast of ten) stays a production
--    and "szcenírozott koncert", which puts the word second, stays too.
--
--    Checked against every title and subtitle in the catalogue (1,235 rows)
--    before writing. Newly flagged, seventeen rows, so the list can be argued
--    with: the nine MagdaFeszt rows above; "HOFI85 - Beszélgetés egy
--    legendáról" (Örkény, a talk); "Szalon Filmklub" (Vígszínház); and four
--    concerts — "Filmzene koncert" (Iventer, at the Csokonai), "Irigy
--    Hónaljmirigy 35. Jubileumi koncert", "T'N'D - Takács Nóradia koncertje"
--    (Örkény), "HELLO ERKEL! – dobbanaszív KONCERTTURNÉ", and "Csokonai
--    Opera – Az új generáció" / "Női sorstragédiák" whose subtitle is the one
--    word "koncert". Left alone, deliberately: the actors' solo evenings
--    ("Bálint András estje", "Cserhalmi György estje"), the staged readings
--    ("felolvasás", "Felolvasószínház"), the Márai-maraton readings, and
--    "Ezüstbojtár" (szcenírozott koncert). Those are performances.
--
-- 2. The programme finally hides them. 0034 said events were "excluded from
--    browse, programme, search and onboarding"; the programme half was never
--    true — `program_in_range()` and `program_days()` carry no `is_event`
--    test, so a flagged workshop with a date still sat in the Műsor tab.
--    Both are re-created with the clause. Their signatures do not change.
--
-- 3. Search can be asked for them. Hidden from browse but loggable means the
--    check-in picker has to find them, and `search_plays()` has excluded
--    `is_event` rows since 0034 (written down in 0056). A new trailing
--    argument, `include_events`, default false, keeps Discover's search as it
--    is and lets the picker opt in. The old signature is dropped first, as
--    every change to this function has had to: PostgREST resolves an RPC by
--    argument names, and two overloads sharing a prefix are ambiguous.
--
-- Nothing here changes anything a user stored. `recompute_play_events()`
-- still refuses to reclassify a production somebody has logged.

begin;

-- ---------------------------------------------------------------------------
-- 1. The vocabulary, over the title and the subtitle
-- ---------------------------------------------------------------------------

create or replace function public.is_ancillary_event(title text, subtitle text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    -- A production that counts its acts is a production, whatever it calls
    -- itself. "kiállítás … három felvonásban" is the case this guards.
    lower(public.immutable_unaccent(coalesce(subtitle, ''))) !~ '\mfelvonas'
    and (
      lower(public.immutable_unaccent(coalesce(title, ''))) ~ (
        -- 0034's list, with workshop widened to anywhere in the title.
        '\mworkshop(ja)?\M'
        || '|\mtarsalgo\M'
        || '|\mszinhazbejaras\M'
        || '|\mkozter\M'
        || '|\mpedagoguster\M'
        || '|\mmuhelylatogatas\M'
        || '|\mtarlatvezetes\M'
        || '|\mnyilt nap\M'
        || '|\mkonyvbemutato\M'
        || '|kiallitas\M'
        || '|\msajtotajekoztato\M'
        || '|\mkozonsegtalalkozo\M'
        -- The festival's words, and the concert hall's.
        || '|\mirodalmi seta\M'
        || '|\mirodalomora\M'
        || '|\mdij atadas'
        || '|\mfilmklub\M'
        || '|\mfilmfesztival\M'
        || '|\mbeszelgetes\M'
        || '|\mkoncert(je|jet)?\M'
        || '|\mkoncertturne'
      )
      or lower(public.immutable_unaccent(coalesce(subtitle, ''))) ~ (
        -- Anchored: the subtitle *is* the kind of evening, not a sentence
        -- that happens to contain the word.
        '^(kozter )?workshop\M'
        || '|\mworkshopja$'
        || '|^(paros )?tarlatvezetes\M'
        || '|^(kamara)?koncert\M'
        || '|^valogatas a .*film'
        || '|\mvezetesevel\M'
      )
    );
$$;

grant execute on function public.is_ancillary_event(text, text) to anon, authenticated;

comment on function public.is_ancillary_event(text, text) is
  'Whether a title and the line under it describe a talk, tour, workshop, concert or screening rather than a production. The subtitle is read anchored, so a production that calls itself an exhibition in three acts is not caught.';

create or replace function public.recompute_play_events()
returns int
language plpgsql
set search_path = public
as $function$
declare
  changed int;
begin
  update public.plays p
  set is_event = should_be
  from (
    select
      pl.id,
      public.is_ancillary_event(pl.title, pl.subtitle)
        and not exists (select 1 from public.reviews r where r.play_id = pl.id) as should_be
    from public.plays pl
  ) calc
  where p.id = calc.id and p.is_event is distinct from calc.should_be;
  get diagnostics changed = row_count;
  return changed;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. The programme
-- ---------------------------------------------------------------------------

create or replace function public.program_in_range(
  range_start timestamptz,
  range_end timestamptz,
  city_filter text default null,
  venue_id_filter uuid default null,
  genre_filter text default null
)
returns table (
  performance_id uuid,
  starts_at timestamptz,
  room text,
  play_id uuid,
  title text,
  author text,
  director text,
  genre_normalized text,
  subtitle text,
  produced_by text,
  runtime_minutes int,
  status text,
  is_archived boolean,
  poster_url text,
  poster_path text,
  poster_thumb_path text,
  poster_blurhash text,
  poster_width int,
  poster_height int,
  poster_credit text,
  venue_id uuid,
  venue_name text,
  venue_city text
)
language sql
stable
set search_path = public
as $fn$
  select
    pf.id,
    pf.starts_at,
    pf.room,
    p.id,
    p.title,
    p.author,
    p.director,
    p.genre_normalized,
    p.subtitle,
    p.produced_by,
    p.runtime_minutes,
    p.status,
    p.is_archived,
    p.poster_url,
    p.poster_path,
    p.poster_thumb_path,
    p.poster_blurhash,
    p.poster_width,
    p.poster_height,
    p.poster_credit,
    v.id,
    v.name,
    v.city
  from public.performances pf
  join public.plays  p on p.id = pf.play_id
  join public.venues v on v.id = pf.venue_id
  where pf.starts_at >= range_start
    and pf.starts_at <  range_end
    -- The half of 0034 that was never true until now.
    and not p.is_event
    and (city_filter     is null or v.city = city_filter)
    and (venue_id_filter is null or pf.venue_id = venue_id_filter)
    -- As in 0017: a play with no genre is neither hidden nor claimed by a
    -- genre chip. The filter matches only what is actually classified.
    and (genre_filter    is null or p.genre_normalized = genre_filter)
  order by pf.starts_at asc, v.name asc, p.title asc;
$fn$;

create or replace function public.program_days(
  range_start timestamptz,
  range_end timestamptz,
  city_filter text default null,
  venue_id_filter uuid default null,
  genre_filter text default null
)
returns table (day date, performance_count int)
language sql
stable
set search_path = public
as $fn$
  select
    (pf.starts_at at time zone 'Europe/Budapest')::date as day,
    count(*)::int
  from public.performances pf
  join public.plays  p on p.id = pf.play_id
  join public.venues v on v.id = pf.venue_id
  where pf.starts_at >= range_start
    and pf.starts_at <  range_end
    and not p.is_event
    and (city_filter     is null or v.city = city_filter)
    and (venue_id_filter is null or pf.venue_id = venue_id_filter)
    and (genre_filter    is null or p.genre_normalized = genre_filter)
  group by 1
  order by 1;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Search, on request
-- ---------------------------------------------------------------------------

drop function if exists public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int);

create function public.search_plays(
  search_term text,
  venue_type_filter text default null,
  city_filter text default null,
  include_archived boolean default true,
  venue_id_filter uuid default null,
  genre_filter text default null,
  room_filter text default null,
  sort_by text default 'relevance',
  limit_count int default 40,
  offset_count int default 0,
  include_events boolean default false
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
    where (include_events or not pl.is_event)
      and (venue_type_filter is null or v.type = venue_type_filter)
      and (city_filter       is null or v.city = city_filter)
      and (venue_id_filter   is null or pl.venue_id = venue_id_filter)
      and (genre_filter      is null or pl.genre_normalized = genre_filter)
      and (room_filter       is null or pl.primary_room = room_filter)
      and (include_archived or not pl.is_archived)
      and (
        pl.search_text like v_pat escape '\'
        or v.name_norm like v_pat escape '\'
        or pl.id in (
          select c.play_id from public.play_cast c
          where c.name_norm like v_pat escape '\'
        )
        or public.word_similarity(v_fuzzy, pl.title_norm) > 0.6
        or public.word_similarity(v_fuzzy, pl.author_norm) > 0.6
        or public.word_similarity(v_fuzzy, coalesce(v.name_norm, '')) > 0.6
      )
  )
  select
    h.pl as play,
    (count(*) over ())::int as total_count,
    (count(*) filter (where (h.pl).is_archived or (h.pl).status = 'ended') over ())::int as archived_count
  from hits h
  order by
    case when sort_by = 'relevance' then h.score               end desc nulls last,
    case when sort_by = 'rating'    then (h.pl).rating_overall end desc nulls last,
    case when sort_by = 'premiere'  then (h.pl).premiere_date  end desc nulls last,
    case when sort_by = 'next'      then (h.pl).next_perf_at   end asc  nulls last,
    case when sort_by = 'title'     then (h.pl).title_norm     end asc  nulls last,
    (h.pl).is_archived asc,
    (h.pl).next_perf_at asc nulls last,
    (h.pl).title_norm asc
  limit greatest(coalesce(limit_count, 40), 1)
  offset greatest(coalesce(offset_count, 0), 0);
end;
$fn$;

grant execute on function public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int, boolean)
  to anon, authenticated;

comment on function public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int, boolean) is
  'Productions matching a term, best first, one page at a time. total_count and archived_count describe the whole match, not the page. include_events admits talks, workshops and concerts, for the check-in picker.';

-- ---------------------------------------------------------------------------
-- The pass
-- ---------------------------------------------------------------------------

select public.recompute_play_events();

commit;

-- The one-argument is_ancillary_event(text) from 0034 is left in place: it
-- has no caller now, and dropping it belongs to a later, destructive
-- migration once this one has run under the app (T-068's pattern).

-- rollback:
--   create or replace function public.recompute_play_events() … with
--     public.is_ancillary_event(pl.title) — the 0034 body, lines 92-113 there;
--   create or replace function public.program_in_range(…) and program_days(…)
--     without the `and not p.is_event` line — 0048 lines 26-101 and 0017;
--   drop function public.search_plays(text, text, text, boolean, uuid, text, text, text, int, int, boolean);
--   create function public.search_plays(…) as in 0056 lines 425-524;
--   drop function public.is_ancillary_event(text, text);
--   select public.recompute_play_events();
-- The rows flagged by this pass unflag themselves on that last call; no data
-- is lost either way.
