-- Real venues, seeded so add-play/sync have somewhere to point venue_id at
-- from the start. Safe to re-run: `on conflict do nothing` keyed by id.
--
-- This file used to also seed 7 sample plays (A padlás, Csongor és Tünde,
-- etc.) as placeholder demo content, transcribed from data/mockData.ts.
-- That content was invented for the mock-data phase of the project — real
-- titles/venues/directors, but combinations that were never fact-checked
-- against actual productions, and several turned out not to match any real
-- staging (e.g. "Csongor és Tünde" at Vígszínház directed by Zsótér Sándor —
-- his real production of it was at Katona József Színház's Kamra, not
-- Vígszínház). Attaching real production photos to that fabricated data
-- would have made it look more authoritative, not fixed it — so the play
-- rows were dropped instead, once sync/ started supplying real current
-- listings (see 0003_drop_fabricated_seed_plays.sql for the one-time
-- cleanup run against the already-seeded production database).

insert into public.venues (id, name, type, city) values
  ('11111111-1111-1111-1111-111111111101', 'Örkény István Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111102', 'Katona József Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111103', 'Vígszínház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111104', 'Radnóti Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111105', 'Nemzeti Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111106', 'Trafó', 'befogadó tér', 'Budapest'),
  ('11111111-1111-1111-1111-111111111107', 'Csokonai Nemzeti Színház', 'kőszínház', 'Debrecen')
on conflict (id) do nothing;
