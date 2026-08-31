-- One-time cleanup: removes the 7 fabricated demo plays that were
-- originally seeded by 0002_seed.sql (before it was trimmed to venues
-- only). Those rows used real play titles, venues, and directors, but in
-- combinations that were never fact-checked and mostly don't match any
-- real production (see 0002_seed.sql's header for specifics) — safer to
-- remove than to leave looking like real data, now that sync/ supplies
-- real current listings instead.
--
-- Cascades automatically remove each play's cast rows, and any
-- reviews/watchlist entries/performances that happened to reference them
-- (none expected in a normal setup, since these rows are immutable via RLS
-- — created_by is null — but the cascade is there for safety regardless).
--
-- Safe to run more than once: deletes by source = 'seed', which is empty
-- after the first run.

delete from public.plays where source = 'seed';
