-- Four theatres added to the catalogue, and the profile that lets the genre
-- classifier reason about two of them.
--
-- Three are Budapest houses; the one that matters most is the Debrecen one.
-- Debrecen had exactly one venue in the catalogue — Csokonai — which is why
-- Discover's theatre chips hide themselves when you pick Debrecen: a filter row
-- offering one option cannot change what you are looking at. Vojtina is the
-- second, and it is also the catalogue's first puppet theatre, which gives
-- `genre_normalized` its first real `báb` values rather than another few dozen
-- rows of prose.
--
-- The ids continue the seeded block from 0002_seed.sql, which is a fixed,
-- hand-maintained list mirrored in sync/venueMap.ts — the two have to agree,
-- and matching venue names across sources automatically was rejected as
-- riskier than maintaining a short mapping by hand.

begin;

insert into public.venues (id, name, type, city, default_genre) values
  ('11111111-1111-1111-1111-111111111108', 'Vojtina Bábszínház', 'kőszínház', 'Debrecen', 'báb'),
  ('11111111-1111-1111-1111-111111111109', 'Centrál Színház',    'kőszínház', 'Budapest', null),
  ('11111111-1111-1111-1111-11111111110a', 'Madách Színház',     'kőszínház', 'Budapest', null)
on conflict (id) do update
  set name          = excluded.name,
      type          = excluded.type,
      city          = excluded.city,
      default_genre = excluded.default_genre;

-- Vígszínház, Nemzeti, Radnóti and Trafó were seeded in 0002 and already exist.
-- Nemzeti gains a profile here for the same reason Katona and Örkény have one:
-- it stages prose and publishes no genre field, so `venues.default_genre` is
-- what lets 0016_genre_taxonomy.sql answer the question — labelled
-- `genre_source = 'venue_default'`, an assumption marked as one.
update public.venues set default_genre = 'próza'
  where id = '11111111-1111-1111-1111-111111111105';

-- Centrál, Madách and Vígszínház are deliberately left without one. All three
-- publish a real genre term per production, so there is nothing to fall back
-- to and no reason to: their rows reach genre_normalized with
-- `genre_source = 'source'`, which is a stronger claim than any default.

select public.recompute_play_genre();

commit;
