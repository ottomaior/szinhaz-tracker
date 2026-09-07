-- ============================================================
-- Nine more editorial lists
--
-- 0025 built the tables and said why: ten hand-made lists over this catalogue
-- is a better first screen than a rating average computed from four reviews.
-- It shipped with one — "Bodó Viktor Budapesten". This is the other nine.
--
-- Every entry is a row that already exists in `plays`, resolved to its id here
-- rather than matched on title at run time: several titles repeat across the
-- catalogue (two Mester és Margaritas, four Lear királys, a Szentivánéji álom
-- from 1983 and another from 2017), and a title match would pick whichever
-- came back first.
--
-- The lists are all `is_ranked = false`. None of them is a ranking, and 0025's
-- own comment is the reason: numbering an unranked list asserts a judgement its
-- author never made. Order still matters, though — an unranked list is read in
-- `added_at` order — so the timestamps are explicit and a minute apart instead
-- of a single `now()` that would leave the order to chance.
--
-- Sources for the claims in the notes: the season data already in this
-- database (runtimes, directors, premiere dates, rooms), and for the award
-- nominations the Színházi Kritikusok Céhe shortlist for the 2025/26 season,
-- announced in August 2026 and decided on 20 September 2026.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A kritikusok idei jelöltjei — Budapest
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000001-0000-4000-8000-000000000001',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'A kritikusok idei jelöltjei',
  'A Színházi Kritikusok Céhe 2025/26-os jelölései, ahogy Budapesten láthatók: kilenc előadás három színházból.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000001-0000-4000-8000-000000000001', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:00:00+02' + x.pos * interval '1 minute'
from (values
  (0, '7aba671f-a7ae-4efe-b43d-c736862b5310', 'Jelölt a legjobb szórakoztató előadás kategóriában, Gergye Krisztián koreográfiája pedig évadbeli különdíjra.'),
  (1, 'b74d8c02-4999-4151-8ad7-1e9c7bc44937', 'A legtöbbször jelölt előadás: rendezés (ifj. Vidnyánszky Attila), díszlet (Schnábel Zita) és Lengyel Benjámin férfi mellékszereplőként. Hamletből indul.'),
  (2, '9a6fcdce-ba55-4954-aa6b-80ddf133b614', 'Bencsik Levente és Hunyadi Máté zenéje jelölt a legjobb színpadi zenéért. Három és fél óra.'),
  (3, '2b555560-f47b-4f9f-9e2d-d3df53e63ad8', 'Kókai Tünde jelölése a legjobb női főszereplőért. Kassai Margit 1944-45-ös ostromnaplójából, Bíró Kriszta írásában és rendezésében.'),
  (4, '6e9b1c39-a0da-4402-9769-e7b00a2383da', 'Gálffi László jelölése a legjobb férfi főszereplőért. Darvas Iván Lábjegyzetek című kötetéből, kilencven perc.'),
  (5, '20f28df0-6240-472b-9ad9-94648f6a8d03', 'Csontos Balázs világítása kapott évadbeli különdíj-jelölést. Büchner Leonce és Lénája nyomán.'),
  (6, '9fad8253-6349-41e3-80f8-04af271ae92c', 'Tihanyi Ildi jelmezei jelöltek. Ayckbourn-komédia, Szabó Máté rendezésében.'),
  (7, 'ec7dfa5f-de54-4f00-a6ef-4c3fc0ec87a9', 'Kerekes Éva jelölése a legjobb női mellékszereplőért. Kemény Lili regényéből, Dohy Balázs rendezésében.'),
  (8, 'b20dc3f7-55a8-4bfa-bafa-eba2d89c5567', 'Fekete Anna díszlete jelölt. Hegymegi Máté rendezése, 175 perc.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 2. Shakespeare Budapesten
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000002-0000-4000-8000-000000000002',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Shakespeare Budapesten',
  'Ami most megy belőle, és ami nemrég ment: a Nemzeti Lear-showjától a Kertész utcai mosodáig, négy színházból.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000002-0000-4000-8000-000000000002', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:10:00+02' + x.pos * interval '1 minute'
from (values
  (0, '44a3d6e3-f67f-4fcf-bdd4-42b56f1d8a8c', 'A ritkán játszott korai vígjáték, Rudolf Péter rendezésében, 2017 óta a Vígszínházban.'),
  (1, 'b74d8c02-4999-4151-8ad7-1e9c7bc44937', 'Hamlet nyomán, de a saját útján: ifj. Vidnyánszky Attila rendezése a Katonában.'),
  (2, 'c4f2a5ff-110a-4e1f-a09b-45af50213893', 'Závada Péter és a társulat szövege Shakespeare köré, Bodó Viktor rendezésében.'),
  (3, 'ae19db11-3f9e-4fa3-8d57-63fff5f912dd', 'Lear valóságshow-ként, egy részben, Valerij Fokin rendezésében.'),
  (4, 'fccb720f-2cb4-4d47-a457-1e85e38c54c6', 'Bodó Viktor mosodába vitte Shakespeare-t; ott futnak össze a darabok.'),
  (5, '08a84232-8777-47ea-ab04-7e47cea4187e', 'Zsámbéki Gábor Learje a Katonában, 160 perc.'),
  (6, 'c377b537-a264-47d6-9567-6eb52b19f087', 'Székely Kriszta rendezése, 110 percbe sűrítve.'),
  (7, 'd896ca31-fedb-4608-b610-4d0e9d6ccbc2', 'Gáspár Ildikó rendezése az Örkényben, 2019-ből.'),
  (8, '5afb7461-219d-4d52-95bb-7816b25b7b4d', 'Bagossy László Hamletje, 2014-ből.'),
  (9, 'fe814b17-9265-4610-abf1-8873557177af', 'Kovács D. Dániel rendezése a Vígszínházban, 2017-ből.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 3. Gyerekkel is — Budapest
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000003-0000-4000-8000-000000000003',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Gyerekkel is',
  'Amit Budapesten a gyerekekkel is meg lehet nézni: mesétől a nagyszínpadi musicalig, négy színházból.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000003-0000-4000-8000-000000000003', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:20:00+02' + x.pos * interval '1 minute'
from (values
  (0, '784e5882-6d25-4345-9ef6-e18db59ebf45', 'Dés-Geszti-Grecsó musicalje a Vígszínházban, 2016 óta.'),
  (1, 'ab32c9dd-ccbc-44b9-a2bb-d39f24f12bd4', '1996 óta megy. Aki gyerekként látta, most a saját gyerekét viszi.'),
  (2, '1e4b432d-fdc8-4861-8dfb-3a8f3ba26bdd', '1988 óta játsszák; a Presser-dalokat a nézőtér fele kívülről tudja.'),
  (3, 'f001b672-0fbf-46fb-882f-83ade0e2c7a5', 'Arany egy szuszra, kilencven percben, Paczolay Béla rendezésében.'),
  (4, 'dd243f59-8a3c-4148-ac2b-c37dab9bf4ce', 'Michael Ende regénye az időtolvajokról, Polgár Csaba rendezésében.'),
  (5, 'f277154a-2460-4b09-90c5-37eeb03ffa57', 'Aesopus nyomán, Parti Nagy Lajos szövegével.'),
  (6, 'fa7ecac3-f6b4-4285-a98d-ae8b1538fec7', 'A kis róka a Madách nagyszínpadán.'),
  (7, '738fe8c3-8c64-4b40-ac55-a82e2fc4b469', 'Fazekas Mihály históriája zenés változatban.'),
  (8, '5cd9f1b4-5cba-4142-925a-0040d86ed111', 'A nagyszínpadi Jégvarázs, Szirtes Tamás rendezésében.'),
  (9, '42fb77f4-04bc-4294-8ef7-19c4f17605a5', 'Petőfi a Nemzetiben, Vidnyánszky Attila rendezésében, 150 perc.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 4. Kilencven perc, és hazaérsz — Budapest
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000004-0000-4000-8000-000000000004',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Kilencven perc, és hazaérsz',
  'Rövid budapesti esték, a hatvanperces Saját [?] szobától felfelé. Hossz szerint sorolva, nem érték szerint.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000004-0000-4000-8000-000000000004', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:30:00+02' + x.pos * interval '1 minute'
from (values
  (0, 'cb6f08e2-fac0-4f48-95cd-df64ea700091', '60 perc. Fodor Orsolya és Vass Szandi szövege, Fodor Orsolya rendezésében.'),
  (1, '2c693ca7-0850-4915-96cc-5691981e4bb1', '70 perc Danténak. A Purgatórium-Paradicsom külön estére megy.'),
  (2, 'da661bc8-3ab0-43df-86c2-6db62867418c', '70 perc. Dan Lungu monológja, 2013 óta a Katonában.'),
  (3, '56d9f48b-6e19-429c-8e6d-9d7fadee5e3f', '75 perc. Kertész Imre regénye, Bagossy Júlia rendezésében.'),
  (4, '4648b755-2226-4fdd-a792-ebeea897dd02', '75 perc Woody Allen a Centrálban.'),
  (5, '5b0c6e9b-70e4-418e-9732-cfae971a0df7', '80 perc. Bíró Zsombor Aurél szövege, Kizlinger Lilla rendezésében.'),
  (6, 'd54e8506-8130-4adc-8c22-fa7069d4fbdd', '80 perc. Reisz Gábor írása és rendezése.'),
  (7, 'a68b5282-d1b4-4018-b3c1-daa181a7410b', '80 perc. Vinnai András darabja, szeptemberi bemutató a Centrálban.'),
  (8, '6e9b1c39-a0da-4402-9769-e7b00a2383da', '90 perc. Darvas Iván Lábjegyzetek című kötetéből, Mácsai Pál rendezésében.'),
  (9, '712521a3-7069-4457-9c87-ee1d7b3c3418', '90 perc. Göndör László írása és rendezése.'),
  (10, 'a7c670f2-928a-4cd0-af6b-193ed0eb6e9a', '90 perc. Jászberényi Sándor szövegeiből, Polgár Csaba rendezésében.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 5. Az orosz klasszikusok Budapesten
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000005-0000-4000-8000-000000000005',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Az orosz klasszikusok Budapesten',
  'Bulgakovtól Csehovig, négy színházban. Két Mester és Margarita megy egyszerre a városban.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000005-0000-4000-8000-000000000005', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:45:00+02' + x.pos * interval '1 minute'
from (values
  (0, '43598e08-118e-45b6-8dd1-2bad56965bbd', 'Az egyik: Bodó Viktor átirata és rendezése a Katonában, 160 perc.'),
  (1, '7df717b0-882b-4c8e-a84f-5fdc06968626', 'A másik: Aleksandar Popovski rendezése a Nemzetiben, 2021 óta, 180 perc.'),
  (2, 'd21d2af6-c15d-4dba-bb88-01acb35babc6', 'Dosztojevszkij az Örkényben, Gáspár Ildikó rendezésében. 225 perc, szánj rá egy egész estét.'),
  (3, '7b49724a-3f19-4e8e-be49-e8814270e670', 'Puskin verses regénye, Dohy Balázs rendezésében.'),
  (4, '3c4b8d38-5550-42e3-8ef1-931f42b604c2', 'Csehov a Vígszínházban, 2021 óta.'),
  (5, '7e912326-82d2-46b6-ba2c-cd793a79dc87', 'A másik Csehov: decemberi bemutató a Vígszínházban.'),
  (6, '85148b75-087e-4bd1-834d-29f16364af6c', 'Gogol a Nemzetiben, ifj. Vidnyánszky Attila rendezésében.'),
  (7, '81075fca-055f-4254-b669-e2bfa0acdb8a', 'Nyikolaj Erdman abszurd komédiája a szovjet húszas évekből.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 6. Magyar klasszikusok Budapesten
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000006-0000-4000-8000-000000000006',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Magyar klasszikusok Budapesten',
  'Kosztolányitól Kertész Imréig: tíz előadás négy színházban, mind magyar szerzőé.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000006-0000-4000-8000-000000000006', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 10:55:00+02' + x.pos * interval '1 minute'
from (values
  (0, '7e1f69f6-7d4f-4381-b270-46109a6fc678', 'Kosztolányi regénye az Örkényben, Szenteczki Zita rendezésében.'),
  (1, '63147eeb-6ecd-4cf7-ba21-efd800cf77c1', 'Szabó Magda regénye, Gáspár Ildikó rendezésében.'),
  (2, '56d9f48b-6e19-429c-8e6d-9d7fadee5e3f', 'Kertész Imre regénye 75 percben, a Katonában.'),
  (3, '3dfa1424-b10a-4e7b-a8a0-8db4c013f915', 'Hajnóczy Péter kisregénye, Bagossy Júlia rendezésében.'),
  (4, 'c9a91348-a683-45b0-9be7-06807f23acda', 'Az ember tragédiája Székely Kriszta olvasatában, 170 perc.'),
  (5, '55ddc512-5178-4b02-a7d3-ecb3e39d0485', 'Örkény István a Nemzetiben, Szász János rendezésében.'),
  (6, 'd84e3db6-7048-4cb6-be84-4b19c2e63e76', 'Katona József drámája a Nemzetiben, Vidnyánszky Attila rendezésében.'),
  (7, 'ba76974d-cc41-438d-87fd-bb001b6b1a68', 'Esterházy Péter szövege, Zsótér Sándor rendezésében.'),
  (8, '7b8a605a-751f-4c1a-a60c-dab600af2a48', 'Szigligeti Ede vígjátéka, ifj. Vidnyánszky Attila rendezésében.'),
  (9, '43968021-cfd1-478c-be4e-2d6d79cf39d6', 'Füst Milán drámája, Bodó Viktor rendezésében, száz percben.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 7. A Csokonai új évada — Debrecen
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000007-0000-4000-8000-000000000007',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'A Csokonai új évada',
  'A Csokonai Nemzeti Színház 2026/27-es bemutatói, a szeptemberi nyitástól a májusi Jeremiásig.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000007-0000-4000-8000-000000000007', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 11:10:00+02' + x.pos * interval '1 minute'
from (values
  (0, 'c9151803-5865-4638-88c3-ec625a0c9869', 'Az évadnyitó, szeptember 11-én a Csokonai Teátrumban, ifj. Vidnyánszky Attila rendezésében.'),
  (1, '3dbca9db-75fd-4fee-a707-9246b9025c36', 'Lorca a Csokonai Fórum Latinovits-termében, Keresztes Attila rendezésében.'),
  (2, '86cdcf86-e888-46f2-bc63-678ebdee8cd4', 'Zerkovitz-operett Novák Eszter rendezésében, október 16-tól.'),
  (3, '8a847970-2017-4a57-bdcf-cb8aa7cdd8ee', 'Bernstein musicalje Juronics Tamás rendezésében.'),
  (4, '267d96fc-c140-40f8-beb1-2b1f36db9613', 'Az évad Shakespeare-je, Ilja Bocsarnikovsz rendezésében.'),
  (5, 'abe56539-edf0-4da9-b0a0-75d0ec484352', 'A Gradient Kortárs Balett Debrecen egyik idei bemutatója.'),
  (6, 'ffdde451-ad81-4cac-b78f-202e3bed6c42', 'Verdi karácsony előtt, Bakos-Kiss Gábor rendezésében.'),
  (7, '26a5f45f-2fb9-44b1-8f36-7d107dbc3074', 'Barta Lajos ritkán játszott darabja, Bocsarnikovsz rendezésében.'),
  (8, '9ab93251-391f-40fd-b927-638bb4a741fd', 'Brecht, Tompa Gábor rendezésében.'),
  (9, '109edc19-f6ba-43e1-9c60-08adbde13181', 'A Gradient másik bemutatója, tavasszal.'),
  (10, 'eb7514a4-a6c6-4d76-bc22-a2e8ff3304fa', 'Tom Schulman színpadi változata, Bocsarnikovsz rendezésében.'),
  (11, '3ff98e97-34ad-4b08-8b8d-f36aa8e74efb', 'Rachel Portman operája Saint-Exupéry meséjéből.'),
  (12, 'a91e9813-d175-4f41-a74e-d73c1fb510ff', 'Térey János misztériuma zárja az évadot, Kukovecz Ákos rendezésében.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 8. Szabó Magda színpadon — Debrecen és Budapest
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000008-0000-4000-8000-000000000008',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'Szabó Magda színpadon',
  'A debreceni MagdaFeszt köré: az írónő regényei és emléke színpadon, Debrecenben és Budapesten.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000008-0000-4000-8000-000000000008', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 11:30:00+02' + x.pos * interval '1 minute'
from (values
  (0, 'b4d2b08b-d3c2-4a1b-a4c3-7716444a34c6', 'Szabó Magda drámája a Csokonai Teátrumban, Kukovecz Ákos rendezésében, száz percben.'),
  (1, 'a3d604af-704d-4fa8-8bc6-d63a7b4c7390', 'Az Abigél zenés változata Debrecenben, Eszenyi Enikő rendezésében.'),
  (2, '63147eeb-6ecd-4cf7-ba21-efd800cf77c1', 'A regény Budapesten, az Örkényben, Gáspár Ildikó rendezésében.'),
  (3, 'ae9bd19f-f088-4ce4-9de3-00d2ba611739', 'Ugyanaz a regény a Csokonai saját archívumából.'),
  (4, 'dbbf1ea7-6288-4f39-82cf-c74ffe183086', 'A meseregény zenés változata, Egressy Zoltán és Kardos Tünde átiratában.'),
  (5, '4326dd01-0230-4846-95af-e108a0a958c4', 'Szabó Magda és az emlékezet, a Debreceni Irodalom Házában.'),
  (6, 'b5c6313b-c7e1-494c-91b7-4b27d86ad978', 'Séta a debreceni belvárosban az írónő helyszínein.'),
  (7, 'e17c81f2-3fa8-45a4-801c-29b338e3018a', 'A MagdaFeszt záró gálája; a díjat idén Ráckevei Anna és Rakovszky Zsuzsa kapja.')
) as x(pos, play_id, note)
on conflict do nothing;

-- ------------------------------------------------------------
-- 9. A Vojtina műsorán — Debrecen
-- ------------------------------------------------------------
insert into public.lists (id, owner_id, title, description, is_ranked, is_public, is_featured)
values (
  'f0000009-0000-4000-8000-000000000009',
  '30ef9b77-1fc1-4c82-b634-c61098efd677',
  'A Vojtina műsorán',
  'A debreceni bábszínház repertoárja, az őszi bemutatóktól az ölbeli korosztályig. Harmincöt perctől kilencvenig.',
  false, true, true
) on conflict (id) do nothing;

insert into public.list_items (list_id, play_id, position, note, added_at)
select 'f0000009-0000-4000-8000-000000000009', x.play_id::uuid, x.pos, x.note,
       timestamptz '2026-09-07 11:45:00+02' + x.pos * interval '1 minute'
from (values
  (0, '5ea4c67d-54dd-4657-8c12-f68dc64f93cb', 'Az évad első bemutatója, szeptember 13-án, Markó-Valentyik Anna rendezésében. 45 perc.'),
  (1, '7c985ca0-7520-48e4-99af-74c783ff7506', 'Benedek Elek meséje a Kálvin téri Színházteremben, szeptember 20-tól. 60 perc.'),
  (2, '43cb273d-ec88-448c-a054-fb401e75393c', 'Micimackó a Játszószínházban, Végh Ildikó átiratában. 50 perc.'),
  (3, '283c8556-916c-47d3-876e-81b410247a8d', 'Rómeó és Júlia a nagyobbaknak, Kovács Géza írásában és rendezésében. 90 perc.'),
  (4, 'e911e523-0161-4077-83ef-b7a4e6ad381e', 'Tavaszi bemutató, Halász Glória rendezésében. 70 perc.'),
  (5, 'd740499e-091d-415c-8e5b-db6e9918ba9f', 'Gimesi Dóra írása és rendezése arról, ha valaki elhallgat. 60 perc.'),
  (6, '1f3c02f5-7729-469b-9336-2337270715ec', 'Nagy Orsolya darabja, Kovács Domokos rendezésében. 75 perc.'),
  (7, '61b94133-115f-40a7-b797-d323eec0f0ef', 'A vásári bábjáték klasszikus figurája, Schneider Jankó rendezésében. 50 perc.'),
  (8, '6ce82628-bfba-4024-b199-42e00ffec9fe', 'Benedek Elek nyomán, Láposi Terka rendezésében. 45 perc.'),
  (9, '3efd3059-4d0e-4726-a30f-28666df4c06a', 'Móricz versei bábra, Upor László átiratában. 55 perc.'),
  (10, '0fe4a47f-761d-4665-9c11-cae7587fab07', 'Axel Hacke meséje Gimesi Dóra átiratában. 55 perc.'),
  (11, '37794500-77ba-465f-8e5e-fad054cf6237', 'A legkisebbeknek, ölbeli korosztálynak, Láposi Terka rendezésében. 60 perc.')
) as x(pos, play_id, note)
on conflict do nothing;
