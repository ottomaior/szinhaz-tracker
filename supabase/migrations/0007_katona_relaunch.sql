-- Katona József Színház relaunched on WordPress (uploads dated 2026-06/07).
-- The old Joomla site is frozen at archive.katonajozsefszinhaz.hu and now
-- serves only the back catalogue, so one adapter became two:
--
--   katona-site:<joomla-id>-<slug>  ->  katona-wp:<slug>        still playing
--                                   ->  katona-archive:<key>    no longer playing
--
-- This migration renames the existing keys to match, and MUST run before the
-- first sync with the new adapters. Without it nothing is destroyed, but
-- reconcile() scopes by source-key prefix — so no adapter would ever claim the
-- old 'katona-site:' rows again. They would sit there forever while the new
-- adapters inserted fresh rows for the same productions, leaving every current
-- Katona production listed twice and any review or watchlist entry stranded on
-- the copy that is no longer updated.
--
-- Matching is by slug, which survived the relaunch intact: Joomla's
-- '43201-kali-holtak' is WordPress's 'kali-holtak'. The list below is the
-- repertoire as published at the time of writing; it only has to be right for
-- this one-time rename, since from here on the adapters own their own keys.
--
-- The slug list is inlined into each statement as a CTE rather than held in a
-- temporary table. A temp table does not reliably survive from one statement
-- to the next in the Supabase SQL editor, which is how this migration is meant
-- to be run — it fails with 'relation "katona_current" does not exist'.

begin;

-- 1. Productions still in the repertoire move to the WordPress adapter, keeping
--    their id — and with it their reviews, watchlist entries and rating.
with katona_current (slug) as (
  values
      ('2031'),
      ('a-halal-kilovagolt-perzsiabol'),
      ('a-merenylok-fenykora'),
      ('az-uveghaz'),
      ('changes'),
      ('chicago'),
      ('dante-pokol'),
      ('dante-purgatorium-paradicsom'),
      ('egy-komcsi-nyanya-vagyok'),
      ('embtrag'),
      ('extazis'),
      ('freud-elete-boswelltol'),
      ('gepnarancs'),
      ('hotel-casanova'),
      ('isten-haza-csalad'),
      ('kali-holtak'),
      ('kasimir-es-karoline'),
      ('kiegya%d0%b7es-kiegyezes'),
      ('komolyan-rohejes-vagyok'),
      ('maganyos-emberek'),
      ('megrag-kikop'),
      ('mester-es-margarita'),
      ('nemacsend'),
      ('nyilt-targyalas'),
      ('octogon'),
      ('oz'),
      ('parallax'),
      ('peer-gynt'),
      ('pekingi-osz'),
      ('queenland'),
      ('rekviem'),
      ('sajat-szoba'),
      ('sarszeg'),
      ('sorstalansag'),
      ('status-quo')
)
update public.plays p
set source_key = 'katona-wp:' || kc.slug,
    is_archived = false
from katona_current kc
where p.source = 'sync'
  and p.source_key like 'katona-site:%'
  and regexp_replace(p.source_key, '^katona-site:[0-9]+-', '') = kc.slug
  -- Never collide with a row the new adapter has already created.
  and not exists (
    select 1 from public.plays existing
    where existing.source = 'sync'
      and existing.source_key = 'katona-wp:' || kc.slug
      and existing.id <> p.id
  );

-- 2. Everything else Katona was ever synced from is back catalogue.
update public.plays p
set source_key = 'katona-archive:' || substring(p.source_key from length('katona-site:') + 1),
    is_archived = true
where p.source = 'sync'
  and p.source_key like 'katona-site:%'
  and not exists (
    select 1 from public.plays existing
    where existing.source = 'sync'
      and existing.source_key = 'katona-archive:' || substring(p.source_key from length('katona-site:') + 1)
      and existing.id <> p.id
  );

-- Anything still on the old prefix here collided with a row the new adapters
-- had already written, which means the catalogue holds two rows for one
-- production. Left in place deliberately rather than deleted: the duplicate may
-- carry someone's review, and merging is a judgement call, not a migration.
--
-- Reported as a result row rather than a RAISE WARNING, for two reasons: the
-- SQL editor shows results and tends to bury warnings, and a plain SELECT
-- keeps this file free of dollar-quoted blocks — which is what makes it
-- survive being pasted into an editor in one piece.
--
-- Expect 0 rows here. Any row returned names a production to merge by hand.
select
  id,
  title,
  source_key as still_on_old_key
from public.plays
where source = 'sync'
  and source_key like 'katona-site:%';

commit;
