-- Whose production it is, and what the house calls it.
--
-- A theatre files a visiting company's evening among its own productions, and
-- so did this catalogue: `Abigél` is the Kolozsvári Állami Magyar Színház's
-- staging directed by Eszenyi Enikő, held here as a Csokonai production, and
-- `Az a szép, fényes nap` handed twelve performers a Csokonai credit on their
-- person pages for an evening Csokonai did not stage. See T-025 in ISSUES.md.
--
-- The venue is not the thing that was wrong. The evening really is at Csokonai
-- and belongs in its listings; what was missing was any way to say that
-- somebody else made it. So this adds a column beside `venue_id` rather than
-- changing it.
--
-- Two columns rather than one, on purpose. `subtitle` is the line the house
-- prints under the title, verbatim — one slot that carries the classic
-- Hungarian genre subtitle (`daljáték`, `tragikomédia`), a descriptive one
-- (`énekkari próba`), or the provenance this is about. `produced_by` is what
-- reading that line yields, and reading it is a heuristic over Hungarian
-- phrasing. T-008 is the standing lesson that a heuristic does not know when it
-- has stopped being right; keeping the raw line means a better reading can be
-- applied later with an UPDATE rather than a re-scrape of 1,200 pages.
--
-- Nothing is backfilled here. Both columns arrive null and the sync fills them
-- from the source on its next run, which is the only place the answer exists.

alter table public.plays
  add column if not exists subtitle text,
  add column if not exists produced_by text;

comment on column public.plays.subtitle is
  'The line the house prints under the title, verbatim: a genre subtitle, a descriptive one, or a provenance line. Kept raw so produced_by can be re-derived without re-scraping.';

comment on column public.plays.produced_by is
  'The company that made this production, when it is not the house hosting it. Null is the ordinary case: whoever venue_id names made it.';

-- Partial, because the column is null for the overwhelming majority of rows and
-- the only question ever asked of it is "which of these are guests".
create index if not exists plays_produced_by_idx
  on public.plays (produced_by)
  where produced_by is not null;
