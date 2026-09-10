-- Radnóti stages prose, and its site says so nowhere.
--
-- The venue has been in `venues` since the first seed with no adapter behind
-- it, because the theatre's site could not be read; it can be now, and
-- sync/adapters/radnoti.ts brings in twenty-three productions. Not one of
-- them carries a genre, because no page on that site classifies anything —
-- the same situation as Örkény and Katona, which 0016_genre_taxonomy.sql gave
-- a `default_genre` for exactly this reason.
--
-- Without it those twenty-three rows hold `genre_normalized = null` and fall
-- out of every genre filter in Discover: present in the catalogue, absent
-- from the one control most likely to be reached for. With it they read
-- `próza`, labelled `venue_default` so the app still knows the difference
-- between what a theatre published and what we assumed on its behalf.
--
-- Deliberately not extended to the other null houses. Centrál, Madách and
-- Vígszínház publish a real genre per production, and Csokonai is a
-- multi-genre house whose opera and ballet would be mislabelled by any single
-- answer. Trafó has no productions at all yet.

begin;

update public.venues set default_genre = 'próza'
  where id = '11111111-1111-1111-1111-111111111104';  -- Radnóti Színház

-- Reclassify with the new default in place. The function only ever writes
-- `venue_default` where the source itself said nothing, so no scraped genre
-- is overwritten by this.
select public.recompute_play_genre();

commit;
