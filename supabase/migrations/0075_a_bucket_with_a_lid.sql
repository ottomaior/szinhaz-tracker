-- A lid on the two public buckets.
--
-- `avatars` and `posters` are both public and both had `file_size_limit` and
-- `allowed_mime_types` set to null, which is Supabase's way of saying "no
-- limit, any type". The client picks the type itself — `services/profileService.ts`
-- and `services/playsService.ts` both pass `blob.type` straight through as the
-- Content-Type — so any signed-in account could store arbitrary bytes, served
-- under an arbitrary type, from a *.supabase.co URL. That is a free file host
-- for whatever somebody wants to point at, and a storage bill with no ceiling.
--
-- The row-level policies already confine a person to their own folder, so this
-- was never a way to overwrite somebody else's picture. It was a way to put
-- anything at all in your own.
--
-- Nothing stored is touched. This constrains writes from here on:
--
--   avatars  1 object,    image/png,  largest 8 bytes
--   posters  3748 objects, image/webp, largest 815 kB, average 56 kB
--
-- so no existing object would have been refused by these limits.
--
-- The numbers are wider than the first proposal (2 MB / 5 MB, jpeg+png+webp)
-- for one reason found while checking: `expo-image-picker` on the web does not
-- re-encode. Its `quality` option applies on iOS and Android only — on the web
-- it returns the file exactly as the person chose it, original type and
-- original size (`ExponentImagePicker.web.ts:216`, which reads `targetFile.type`
-- and hands the File back untouched). A photo straight off an iPhone is
-- therefore HEIC, and one off any recent phone is several megabytes, and the
-- web app is the client most people use. A three-type list and a 2 MB ceiling
-- would have turned a security fix into an upload that fails for ordinary
-- people with ordinary photographs.
--
-- Every type on the list is still an image. Nothing here can be a page, a
-- script or a download, which is the part that mattered.

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'image/gif', 'image/avif', 'image/heic', 'image/heif'
       ]
 where id = 'avatars';

update storage.buckets
   set file_size_limit = 8 * 1024 * 1024,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'image/gif', 'image/avif', 'image/heic', 'image/heif'
       ]
 where id = 'posters';

-- The sync job writes posters as image/webp and nothing else
-- (`sync/lib/posters.ts:172`), so the nightly run is unaffected.

-- rollback:
--   update storage.buckets
--      set file_size_limit = null, allowed_mime_types = null
--    where id in ('avatars', 'posters');
--
-- Fully reversible: these are two columns on two rows and no object is read,
-- moved or deleted by either direction.
