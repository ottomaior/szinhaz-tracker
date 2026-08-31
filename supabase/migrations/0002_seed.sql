-- Seed data transcribed from data/mockData.ts, so the app has content on
-- first launch before the sync job (sync/) or real users add anything.
-- source = 'seed' + created_by = null makes these rows immutable through
-- the app's normal RLS policies (nobody can claim ownership of them).
-- Safe to re-run: every insert is `on conflict do nothing` keyed by the
-- fixed ids below.

insert into public.venues (id, name, type, city) values
  ('11111111-1111-1111-1111-111111111101', 'Örkény István Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111102', 'Katona József Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111103', 'Vígszínház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111104', 'Radnóti Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111105', 'Nemzeti Színház', 'kőszínház', 'Budapest'),
  ('11111111-1111-1111-1111-111111111106', 'Trafó', 'befogadó tér', 'Budapest'),
  ('11111111-1111-1111-1111-111111111107', 'Csokonai Nemzeti Színház', 'kőszínház', 'Debrecen')
on conflict (id) do nothing;

insert into public.plays (
  id, title, author, director, venue_id, genre, runtime_minutes, intermissions,
  premiere_date, rating_overall, rating_acting, rating_directing, rating_set_design,
  rating_count, source
) values
  ('22222222-2222-2222-2222-222222222201', 'A padlás', 'Presser Gábor / Sztevanovity Dusán', 'Novák Eszter',
    '11111111-1111-1111-1111-111111111101', 'musical', 140, 1, '2025-09-05', 4.6, 4.7, 4.3, 3.9, 312, 'seed'),
  ('22222222-2222-2222-2222-222222222202', 'Csongor és Tünde', 'Vörösmarty Mihály', 'Zsótér Sándor',
    '11111111-1111-1111-1111-111111111103', 'drama', 165, 1, '2026-09-12', 4.3, 4.2, 4.4, 4.0, 98, 'seed'),
  ('22222222-2222-2222-2222-222222222203', 'Az ember tragédiája', 'Madách Imre', 'Vidnyánszky Attila',
    '11111111-1111-1111-1111-111111111105', 'drama', 195, 1, '2026-09-04', 4.1, 4.0, 4.1, 4.5, 61, 'seed'),
  ('22222222-2222-2222-2222-222222222204', 'János vitéz', 'Petőfi Sándor', 'Szikora János',
    '11111111-1111-1111-1111-111111111102', 'musical', 130, 1, '2026-09-01', 4.4, 4.5, 4.2, 4.1, 40, 'seed'),
  ('22222222-2222-2222-2222-222222222205', 'Liliom', 'Molnár Ferenc', 'Réczei Tamás',
    '11111111-1111-1111-1111-111111111104', 'drama', 150, 1, '2026-09-18', 4.0, 3.9, 4.0, 3.8, 22, 'seed'),
  ('22222222-2222-2222-2222-222222222206', 'Sirály', 'Anton Csehov', 'Máté Gábor',
    '11111111-1111-1111-1111-111111111102', 'drama', 170, 1, '2025-11-20', 4.8, 4.9, 4.7, 4.4, 205, 'seed'),
  ('22222222-2222-2222-2222-222222222207', 'Marat/Sade', 'Peter Weiss', 'Panov Bertalan',
    '11111111-1111-1111-1111-111111111106', 'physical theatre', 110, 0, '2026-03-14', 4.1, 4.0, 4.3, 4.2, 33, 'seed')
on conflict (id) do nothing;

insert into public.play_cast (play_id, name, role, sort_order) values
  ('22222222-2222-2222-2222-222222222201', 'Pogány Judit', 'Nagymama', 0),
  ('22222222-2222-2222-2222-222222222201', 'Csuja Imre', 'Nagypapa', 1),
  ('22222222-2222-2222-2222-222222222201', 'Für Anikó', 'Anya', 2),
  ('22222222-2222-2222-2222-222222222202', 'Szávai Viktória', 'Tünde', 0),
  ('22222222-2222-2222-2222-222222222203', 'Ivo Elek Menyhért', 'Ádám', 0),
  ('22222222-2222-2222-2222-222222222204', 'Szabó P. Szilveszter', 'János', 0),
  ('22222222-2222-2222-2222-222222222205', 'Mészáros Béla', 'Liliom', 0),
  ('22222222-2222-2222-2222-222222222206', 'Bodrogi Gyula', 'Szorin', 0),
  ('22222222-2222-2222-2222-222222222207', 'Terhes Sándor', 'Marat', 0)
on conflict (play_id, name, role) do nothing;
