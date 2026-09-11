-- A poster three productions share is not a poster (T-052).
--
-- The theatres' sites show a house image wherever a production has no art
-- yet, and the adapters mirrored it as the poster: Katona's company
-- photograph on nine upcoming premieres, Radnóti's season key visual on
-- three, Csokonai's 2023 logo on 37 archived rows and Vígszínház's "archive
-- base" images on 172. Discover showed the Katona row as five identical
-- photographs with different titles under them.
--
-- The sync now drops a poster URL that arrives for a third production in the
-- same run (sync/lib/placeholders.ts), so none of these come back. This
-- clears the ones already stored, by the same rule applied to what was
-- mirrored: a checksum held by three or more productions of one venue. With
-- the columns null the app draws its own stand-in, the letter tile, which is
-- what those tiles should have been all along.
--
-- Safe because: the poster columns are sync output, rewritten by every run,
-- and nothing a user stored refers to them. The threshold of three keeps a
-- double bill's honestly shared artwork. The files stay in the `posters`
-- bucket, unreferenced; the next mirror of a real poster for any of these
-- productions writes a new content-addressed path beside them. Checked on
-- 11 September 2026: six checksums, 221 rows, every one a house image.

begin;

with shared as (
  select venue_id, poster_checksum
  from public.plays
  where poster_checksum is not null
  group by venue_id, poster_checksum
  having count(*) >= 3
)
update public.plays p
set poster_url = null,
    poster_path = null,
    poster_thumb_path = null,
    poster_source_url = null,
    poster_credit = null,
    poster_checksum = null,
    poster_etag = null,
    poster_fetched_at = null,
    poster_width = null,
    poster_height = null,
    poster_blurhash = null
from shared s
where s.venue_id = p.venue_id
  and s.poster_checksum = p.poster_checksum;

commit;

-- rollback: not from this file — the column values are gone, though the
-- mirrored files are not. Re-running the sync with sync/lib/placeholders.ts
-- removed from sync/run.ts would mirror every house image back into place.
