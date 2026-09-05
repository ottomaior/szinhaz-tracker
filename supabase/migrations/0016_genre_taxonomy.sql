-- Give the catalogue metadata that a filter can honestly stand on.
--
-- Three things were wrong with `plays.genre`, and all three showed up the
-- moment anyone tried to filter by it:
--
-- 1. It was mostly invented by us, not read from a source. 276 of 476 rows
--    said "próza" and 167 said "színház", and every one of those came from a
--    hardcoded DEFAULT_GENRE constant in an adapter — sync/adapters/orkeny.ts,
--    katona-wp.ts, katona.ts and csokonai-archive.ts each carry a comment
--    saying the site publishes no genre field, and then write one anyway.
--    A chip labelled "próza" filtering on that is a filter over our own
--    default, dressed up as data about the production.
--
-- 2. It was not always a genre. Csokonai's genre taxonomy carries festival
--    terms alongside real ones, so twelve rows had the genre "IX. MagdaFeszt"
--    — and several of those are not productions at all but an award ceremony,
--    a literature class and a concert programmed into the same festival.
--
-- 3. Where it *was* real it was too coarse to be useful. Csokonai's "zenés"
--    bucket holds Verdi's Aida, Lehár's A víg özvegy and West Side Story
--    together — opera, operetta and musical under one term, which is the one
--    distinction a Hungarian theatregoer most wants to filter on.
--
-- The fix keeps the raw scraped value in `genre` (now nullable, so an adapter
-- can say "the source told me nothing" instead of guessing) and adds a derived
-- `genre_normalized` beside it, together with `genre_source` recording where
-- that answer came from. Provenance is the point: "Katona stages prose" is a
-- true and useful thing to filter on, but it is an assumption about the
-- theatre rather than a fact scraped about the production, and the app should
-- be able to tell the difference.

begin;

-- ============================================================
-- Columns
-- ============================================================

-- An adapter with nothing to report should be able to say so. This was `not
-- null`, which is precisely why every adapter had to invent a default.
alter table public.plays alter column genre drop not null;

alter table public.plays
  add column if not exists genre_normalized text
    check (genre_normalized in (
      'próza', 'opera', 'operett', 'musical', 'zenés',
      'tánc', 'báb', 'felolvasószínház', 'egyéb'
    )),
  add column if not exists genre_source text
    check (genre_source in ('source', 'inferred', 'venue_default', 'user')),
  add column if not exists is_festival boolean not null default false,
  add column if not exists festival_name text,
  add column if not exists primary_room text;

comment on column public.plays.genre is
  'Whatever the source called it, verbatim and unmapped. Null when the source publishes no genre at all, which is the common case.';
comment on column public.plays.genre_normalized is
  'The genre the app filters and sorts on, mapped onto a fixed vocabulary by public.recompute_play_genre(). Null means genuinely unknown; it is never guessed at from nothing.';
comment on column public.plays.genre_source is
  'Where genre_normalized came from: source = the site own taxonomy term; inferred = derived by us from the author or title; venue_default = assumed from what this theatre stages (see venues.default_genre); user = typed in by whoever added the play.';
comment on column public.plays.is_festival is
  'Programmed as part of a festival rather than the regular repertoire. Set from taxonomy terms that name a festival, which the source files alongside real genre terms.';
comment on column public.plays.primary_room is
  'The stage this production usually plays on, taken as the most frequent room across its performances. Kept on the play so a production can be filtered by stage even in a stretch where it has no dates scheduled.';

-- The assumption that Katona and Örkény stage prose is true, and worth
-- filtering on. It belongs here, attached to the theatre it is true of, rather
-- than copied into three adapters as a constant each of them calls a default.
alter table public.venues
  add column if not exists default_genre text
    check (default_genre in (
      'próza', 'opera', 'operett', 'musical', 'zenés',
      'tánc', 'báb', 'felolvasószínház', 'egyéb'
    ));

comment on column public.venues.default_genre is
  'What this theatre stages when its site says nothing. Applied only as a last resort, and recorded as genre_source = venue_default so the app can tell an assumption from a scraped fact.';

-- Örkény and Katona are prose theatres and publish no genre field. Csokonai is
-- deliberately left null — it is a multi-genre house with opera, ballet and
-- prose companies, and its site does publish taxonomy terms, so there is both
-- nothing to fall back to and no single honest answer to fall back on.
update public.venues set default_genre = 'próza'
  where id in (
    '11111111-1111-1111-1111-111111111101',  -- Örkény István Színház
    '11111111-1111-1111-1111-111111111102'   -- Katona József Színház
  );

-- ============================================================
-- Classification
-- ============================================================

-- Splits Csokonai's "zenés" into opera / operett / musical.
--
-- The theatre files all three under one taxonomy term, and the composer named
-- in `author` is the reliable signal: Verdi and Puccini do not write operettas.
-- Deliberately conservative — anything unrecognised stays 'zenés' rather than
-- being rounded to 'musical', because a wrong genre is worse than a vague one
-- on a screen whose whole complaint was invented metadata.
--
-- The ambiguous name is Strauss (Johann wrote operetta, Richard wrote opera),
-- so a bare "Strauss" matches neither and falls through to 'zenés'.
create or replace function public.classify_music_theatre(author text, title text)
returns text
language sql immutable
as $fn$
  select case
    -- Works whose composer's usual genre is the wrong answer for this
    -- particular piece. Checked before the composer lists, since that is the
    -- whole point of them. Offenbach wrote a hundred operettas and one serious
    -- opera, and Les contes d'Hoffmann is the opera; Rossini's Petite messe
    -- solennelle is a concert mass rather than anything staged.
    when title ~* '(Hoffmann mes(é|e)i|contes d.Hoffmann)'      then 'opera'
    when title ~* '(Kis (ü|u)nnepi mise|Petite messe|Stabat Mater|Requiem)' then 'zenés'

    when coalesce(author, '') = '' then 'zenés'

    when author ~* '(Verdi|Puccini|Csajkovszkij|Mozart|Bizet|Rossini|Donizetti|Erkel|Wagner|Gounod|Leoncavallo|Mascagni|Muszorgszkij|Dvo(ř|r)(á|a)k|Jan(á|a)(č|c)ek|H(ä|a)ndel|Gluck|Massenet|Bart(ó|o)k|Kod(á|a)ly|Richard Strauss|Portman)'
      then 'opera'

    when author ~* '(Leh(á|a)r|K(á|a)lm(á|a)n Imre|Zerkovitz|Huszka|Offenbach|(Á|A)brah(á|a)m P(á|a)l|Jacobi Viktor|Szirmai Albert|Johann Strauss)'
      then 'operett'

    when author ~* '(Bernstein|D(é|e)s L(á|a)szl(ó|o)|Kocs(á|a)k Tibor|Jerry Bock|Lloyd Webber|Kander|Rodgers|Sch(ö|o)nberg|Presgurvic|Menken|Geszti P(é|e)ter|Joseph Stein|Mikl(ó|o)s Tibor|Sondheim)'
      then 'musical'

    else 'zenés'
  end;
$fn$;

-- Recomputes genre_normalized, genre_source, the festival flag and
-- primary_room for every play.
--
-- Written as one pass over the table rather than as a trigger, for the same
-- reason recompute_play_status() is: the sync job rewrites hundreds of rows in
-- a run, and the answer depends on the performances table as well as the play.
-- sync/run.ts calls this after each run.
create or replace function public.recompute_play_genre()
returns void
language plpgsql
as $fn$
begin
  -- The stage a production usually plays on. Mode over its performances, with
  -- the most-used room winning and ties broken by name so the answer is stable
  -- between runs rather than flipping on each recompute.
  with room_counts as (
    select play_id, room, count(*) as n
    from public.performances
    where room is not null and btrim(room) <> ''
    group by play_id, room
  ),
  top_room as (
    select distinct on (play_id) play_id, room
    from room_counts
    order by play_id, n desc, room asc
  )
  update public.plays p
  set primary_room = top_room.room
  from top_room
  where top_room.play_id = p.id
    and p.primary_room is distinct from top_room.room;

  -- A festival term sitting in the genre slot. Csokonai's taxonomy mixes these
  -- in with real genres, and they say something true about the production —
  -- just not its genre.
  update public.plays p
  set
    is_festival   = (p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)'),
    festival_name = case when p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)'
                         then p.genre else null end
  where p.source = 'sync'
    and (
      p.is_festival is distinct from coalesce(p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)', false)
      or p.festival_name is distinct from
         (case when p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)' then p.genre else null end)
    );

  with classified as (
    select
      p.id,
      case
        -- Typed in by a person about a specific production. Their answer, not
        -- ours to re-derive — only folded onto the fixed vocabulary.
        when p.source <> 'sync' then
          case
            when p.genre ~* '^(pr(ó|o)za|dr(á|a)ma|drama|v(í|i)gj(á|a)t(é|e)k|kom(é|e)dia|trag(é|e)dia)' then 'próza'
            when p.genre ~* '^opera$'                    then 'opera'
            when p.genre ~* '^operett'                   then 'operett'
            when p.genre ~* '^musical'                   then 'musical'
            when p.genre ~* '(t(á|a)nc|balett)'          then 'tánc'
            when p.genre ~* 'b(á|a)b'                    then 'báb'
            when p.genre ~* 'felolvas'                   then 'felolvasószínház'
            when coalesce(p.genre, '') <> ''             then 'egyéb'
            else null
          end

        -- A festival name is not a genre. Nothing about "IX. MagdaFeszt" says
        -- what kind of evening it is, and several of the rows carrying it are
        -- an award ceremony and a concert rather than plays at all.
        when p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)' then null

        -- The bare word "theatre" as a genre. This was csokonai-archive's
        -- hardcoded default across 166 rows; it carries no information.
        when p.genre ~* '^\s*sz(í|i)nh(á|a)z\s*$' then v.default_genre

        when p.genre ~* '(t(á|a)nc|balett)'  then 'tánc'
        when p.genre ~* 'b(á|a)b'            then 'báb'
        when p.genre ~* 'felolvas'           then 'felolvasószínház'
        when p.genre ~* '^opera$'            then 'opera'
        when p.genre ~* '^operett'           then 'operett'
        when p.genre ~* '^musical'           then 'musical'
        when p.genre ~* '(zen(é|e)s|dalj(á|a)t(é|e)k)'
          then public.classify_music_theatre(p.author, p.title)
        when p.genre ~* 'pr(ó|o)za'          then 'próza'
        when p.genre ~* 'gyerek|mese|ifj(ú|u)s(á|a)gi' then 'egyéb'

        -- Nothing usable from the source. Two things are still worth trying
        -- before giving up, in order of how much they actually know:
        --
        --   1. The author. Csokonai's 166 archived productions carry no
        --      taxonomy term at all, but a row whose author is Verdi or Lehár
        --      is an opera or an operetta whatever the page failed to say.
        --      Only a confident match counts — classify_music_theatre falls
        --      back to 'zenés', and "this is music theatre of some kind" is
        --      exactly the claim there is no evidence for here.
        --   2. What the theatre stages, if it declares one.
        else coalesce(
          nullif(public.classify_music_theatre(p.author, p.title), 'zenés'),
          v.default_genre
        )
      end as genre_normalized,

      case
        when p.source <> 'sync' and coalesce(p.genre, '') <> '' then 'user'
        when p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)' then null
        when p.genre ~* '^\s*sz(í|i)nh(á|a)z\s*$' then
          case when v.default_genre is not null then 'venue_default' else null end
        when p.genre ~* '(zen(é|e)s|dalj(á|a)t(é|e)k)'
          then case when public.classify_music_theatre(p.author, p.title) = 'zenés'
                    then 'source' else 'inferred' end
        when coalesce(p.genre, '') <> '' then 'source'
        when public.classify_music_theatre(p.author, p.title) <> 'zenés' then 'inferred'
        when v.default_genre is not null then 'venue_default'
        else null
      end as genre_source
    from public.plays p
    left join public.venues v on v.id = p.venue_id
  )
  update public.plays p
  set genre_normalized = classified.genre_normalized,
      genre_source     = classified.genre_source
  from classified
  where classified.id = p.id
    and (p.genre_normalized is distinct from classified.genre_normalized
      or p.genre_source     is distinct from classified.genre_source);
end;
$fn$;

grant execute on function public.recompute_play_genre() to service_role;
grant execute on function public.classify_music_theatre(text, text) to anon, authenticated, service_role;

-- ============================================================
-- Retire the adapters' invented defaults
-- ============================================================

-- These rows never held a scraped genre: each is a constant an adapter wrote
-- because the column was `not null`. Clearing them lets the classifier fall
-- back to venues.default_genre and label the result as the assumption it is.
-- Csokonai's own "próza" term is real taxonomy and is left alone.
update public.plays
set genre = null
where source = 'sync'
  and (
    (genre = 'színház' and source_adapter = 'csokonai-archive')
    or (genre = 'próza' and source_adapter in ('orkeny', 'katona-wp', 'katona-archive'))
  );

select public.recompute_play_genre();

-- Filters read these constantly and both are low-cardinality; partial indexes
-- keep them off the archive bulk, which no browse rail ever looks at.
create index if not exists plays_genre_normalized_idx
  on public.plays (genre_normalized) where not is_archived;
create index if not exists plays_primary_room_idx
  on public.plays (primary_room) where not is_archived;

commit;
