-- Teach the classifier the genre terms the theatres actually publish.
--
-- 0016_genre_taxonomy.sql was written against a catalogue where almost nothing
-- carried a real genre: 443 of 476 rows held a value an adapter had invented,
-- and the handful of genuine terms came from one source, Csokonai, whose
-- vocabulary is próza / zenés / tánc / felolvasószínház.
--
-- Three more theatres have been added since, and between them they publish a
-- much wider vocabulary — the spoken-drama family as Hungarian actually writes
-- it ("vígjáték", "színmű", "tragikomédia két részben"), and a music-theatre
-- family that includes forms the original rules missed. The productions
-- carrying those terms were falling through every branch and coming out
-- unclassified, which is the exact failure 0016 existed to fix, just moved.
--
-- What changes, all in the `source = 'sync'` branch:
--
--  * The spoken-drama family is recognised. Centrál files its work as
--    "vígjáték" and "színmű"; Vígszínház writes phrases like "színmű két
--    felvonásban" and "tragédia öt felvonásban", which is why these are
--    substring tests rather than anchored ones.
--  * "musical" is no longer anchored to the start, so Madách's
--    "koncertmusical" counts, and "rockopera" is mapped alongside it — in
--    Hungarian that names a sung-through rock musical (István, a király), not
--    an opera.
--  * A term the source published that still matches nothing becomes 'egyéb'
--    rather than null. These are curated editorial labels, so "some other kind
--    of theatre" is the honest reading; null stays reserved for the case where
--    the source said nothing at all.

begin;

create or replace function public.recompute_play_genre()
returns void
language plpgsql
as $fn$
begin
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

  update public.plays p
  set
    is_festival   = coalesce(p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)', false),
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
        when p.source <> 'sync' then
          case
            when p.genre ~* '^(pr(ó|o)za|dr(á|a)ma|drama|v(í|i)gj(á|a)t(é|e)k|kom(é|e)dia|trag(é|e)dia|sz(í|i)nm(ű|u))' then 'próza'
            when p.genre ~* '^opera$'                    then 'opera'
            when p.genre ~* '^operett'                   then 'operett'
            when p.genre ~* 'musical'                    then 'musical'
            when p.genre ~* '(t(á|a)nc|balett)'          then 'tánc'
            when p.genre ~* 'b(á|a)b'                    then 'báb'
            when p.genre ~* 'felolvas'                   then 'felolvasószínház'
            when coalesce(p.genre, '') <> ''             then 'egyéb'
            else null
          end

        when p.genre ~* '(feszt|fesztiv(á|a)l|napok|bienn(á|a)l)' then null

        when p.genre ~* '^\s*sz(í|i)nh(á|a)z\s*$' then v.default_genre

        when p.genre ~* '(t(á|a)nc|balett)'  then 'tánc'
        when p.genre ~* 'b(á|a)b'            then 'báb'
        when p.genre ~* 'felolvas'           then 'felolvasószínház'
        when p.genre ~* '^opera$'            then 'opera'
        when p.genre ~* '^operett'           then 'operett'
        -- Unanchored, so "koncertmusical" counts. "Rockopera" is Hungarian for
        -- a sung-through rock musical and is not opera, so it is mapped here
        -- rather than by the ^opera$ test above.
        when p.genre ~* '(musical|rockopera)' then 'musical'
        when p.genre ~* '(zen(é|e)s|dalj(á|a)t(é|e)k)'
          then public.classify_music_theatre(p.author, p.title)
        -- The spoken-drama family, as the theatres that publish a genre write
        -- it. Substring rather than anchored: Vígszínház publishes whole
        -- phrases, "színmű két felvonásban" and "tragédia öt felvonásban".
        when p.genre ~* '(pr(ó|o)za|dr(á|a)ma|drama|v(í|i)gj(á|a)t(é|e)k|kom(é|e)dia|trag(é|e)dia|sz(í|i)nm(ű|u)|monodr(á|a)ma)'
          then 'próza'
        when p.genre ~* 'gyerek|mese|ifj(ú|u)s(á|a)gi|csal(á|a)di' then 'egyéb'
        when p.genre ~* 'online|koncert|est$' then 'egyéb'

        when coalesce(p.genre, '') <> '' then 'egyéb'

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

select public.recompute_play_genre();

commit;
