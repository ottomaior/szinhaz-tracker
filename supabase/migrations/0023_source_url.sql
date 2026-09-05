-- ============================================================
-- Keep the address the listing was read from
--
-- `plays` has carried `source` and `source_key` since 0001 — enough to upsert
-- against, and not enough to link to. Every adapter fetches a detail page,
-- parses the title, cast and showtimes out of it, and throws the URL away.
--
-- The cost of that shows up at the end of the funnel. Somebody browses the
-- Műsor calendar, finds an evening they want, opens the production, reads the
-- synopsis, decides to go — and the app has nowhere to send them. A listings
-- app with no exit to a box office stops precisely at the moment of intent.
--
-- Nullable, and it stays nullable: rows added by hand through add-play have no
-- source page, and neither does anything the sync job has not revisited since
-- this column existed.
-- ============================================================

alter table public.plays
  add column if not exists source_url text;

comment on column public.plays.source_url is
  'The theatre''s own page for this production, as read by the sync adapter. '
  'Null for user-added plays and for rows not yet re-synced since 0023.';
