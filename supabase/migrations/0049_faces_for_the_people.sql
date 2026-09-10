-- A face for the people the catalogue credits.
--
-- A person page opens on a circle with two initials. The theatres publish
-- portraits: Csokonai's `/csoport/` pages list the company with a photograph
-- each, and Vojtina's `/tarsulat` does the same for its puppeteers. Both are
-- in Debrecen, which is where this starts. See T-032 in ISSUES.md.
--
-- People are not a table. A person is `person_slug(name)` over `play_cast`
-- and `plays.director` (0024), so the portrait is keyed on that slug and
-- nothing else — the same slug the app builds in `utils/people.ts` to link a
-- cast row to its page. One row per person, whichever house supplied it; the
-- sync writes the row and the app reads it by slug, in bulk, for whatever
-- names are on screen.
--
-- The image columns mirror the poster columns on `plays`, because the same
-- pipeline fills them: `sync/lib/posters.ts` downloads the file once, stores a
-- webp and a thumbnail in the `posters` bucket under `people/<slug>/`, and
-- keeps the checksum and ETag so a nightly re-run costs one conditional
-- request per person. `credit` is the photographer where the source names
-- one — neither Debrecen site does, today, so it is null for all of them and
-- the column exists so that it can stop being null without a migration.
--
-- Public to read, like `plays` and `venues`: it is the theatre's own public
-- company page, mirrored.

begin;

create table public.person_portraits (
  slug              text primary key,
  -- As the company page prints it, guest marker removed. The person page
  -- keeps printing `person_profile()`'s name; this one is for the record.
  name              text not null,
  -- What the house calls them on that page: `színművész`, `bábszínész`,
  -- `igazgató`. Informational; nothing filters on it.
  role              text,
  venue_id          uuid not null references public.venues(id),
  -- The member's own page on the theatre's site.
  source_url        text not null,
  image_source_url  text not null,
  image_path        text not null,
  image_thumb_path  text not null,
  image_checksum    text,
  image_etag        text,
  image_width       int,
  image_height      int,
  image_blurhash    text,
  credit            text,
  fetched_at        timestamptz not null default now(),
  last_synced_at    timestamptz not null default now()
);

comment on table public.person_portraits is
  'A portrait per person slug, mirrored from the theatre''s own company page. Written by sync/run.ts; read by slug from the app.';

create index person_portraits_venue_idx on public.person_portraits (venue_id);

alter table public.person_portraits enable row level security;
create policy "person_portraits_select_all" on public.person_portraits for select using (true);

commit;
