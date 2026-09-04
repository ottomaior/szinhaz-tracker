-- Cover art the app actually owns a copy of.
--
-- Until now `plays.poster_url` pointed straight at a theatre's own server.
-- That works right up until it doesn't: the URL is outside our control, so a
-- site reorganisation silently empties the catalogue's artwork (Katona's
-- relaunch moved every image path at once), the files are full-resolution —
-- Örkény's are around 200 KB each, so forty of them in a scrolling rail is
-- 8 MB — and nothing records who took the photograph.
--
-- The sync job now downloads each poster once, stores it here under a
-- content-addressed path, and records the source and credit alongside it.
--
-- Note there is no server-side resizing to lean on: Supabase's image
-- transformation endpoint is Pro-plan-only, so the sync job pre-generates a
-- thumbnail with sharp and stores both renditions.

begin;

-- Public read: posters are shown to signed-out visitors browsing Discover.
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do update set public = true;

-- Writes are service-role (the sync job) or a signed-in user uploading art for
-- a play they are adding by hand. The service role bypasses RLS, so the only
-- policy that has to exist is the user one — scoped to their own folder so a
-- user cannot overwrite a mirrored theatre poster.
drop policy if exists "posters are publicly readable" on storage.objects;
create policy "posters are publicly readable"
  on storage.objects for select
  using (bucket_id = 'posters');

drop policy if exists "users upload posters to their own folder" on storage.objects;
create policy "users upload posters to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "users replace their own posters" on storage.objects;
create policy "users replace their own posters"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

alter table public.plays
  -- Path inside the bucket. Content-addressed, so the CDN can treat it as
  -- immutable and a re-run that produces identical bytes is a no-op.
  add column if not exists poster_path text,
  add column if not exists poster_thumb_path text,

  -- Where it came from, and who took it. Displayed on the play detail screen —
  -- these are working photographers' production stills, not stock imagery.
  add column if not exists poster_source_url text,
  add column if not exists poster_credit text,

  -- Change detection, so a nightly run re-downloads nothing it already has.
  add column if not exists poster_checksum text,
  add column if not exists poster_etag text,
  add column if not exists poster_fetched_at timestamptz,

  -- Intrinsic size, so the UI can pick a treatment instead of forcing every
  -- image into a 2:3 poster slot. The sources return landscape production
  -- photography far more often than portrait artwork, and cropping it to 2:3
  -- cuts the faces out of the middle of the frame.
  add column if not exists poster_width int,
  add column if not exists poster_height int,

  -- Tiny blur placeholder, rendered by expo-image while the real file loads.
  add column if not exists poster_blurhash text;

comment on column public.plays.poster_url is
  'Legacy/source pointer: the poster URL on the theatre''s own server. Kept as '
  'provenance and as the fallback when poster_path has not been populated yet. '
  'Prefer poster_path.';

alter table public.sync_runs
  add column if not exists posters_mirrored int not null default 0;

-- Finding what still needs mirroring is the sync job's hot path.
create index if not exists plays_poster_pending_idx
  on public.plays (id)
  where poster_url is not null and poster_path is null;

commit;
