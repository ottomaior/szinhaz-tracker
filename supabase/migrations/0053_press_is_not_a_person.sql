-- Fifteen contributors who were lists of press links (T-050).
--
-- The Katona archive adapter read every custom field on a production page as
-- a "role | person" pair unless it was on a short list of known metadata
-- fields, and trusted a 120-character length guard to keep the press blocks
-- out. The short ones got through: `play_cast` holds rows like
--
--     name: "Revizoronline.hu - Gabnai Katalin"     role: "Kritikák"
--     name: "Interjú Kocsis Gergellyel a 24.hu-n"   role: "Sajtó"
--
-- on fourteen archived Katona productions, each rendered on the play page as
-- a contributor with a monogram and a person page of its own. The adapter
-- now names those fields as consumed (sync/adapters/katona.ts), so the next
-- sync will not write them again; this removes the ones already written.
--
-- Safe because: these rows are sync output, not anything a user stored —
-- `play_cast` is rebuilt from the theatres' pages, and `review_cast`
-- references people by name, never by `play_cast.id`, so nothing points at
-- these rows. Scoped to the archive source and the three press labels, so a
-- real person cannot match: no theatre credits anybody with the role
-- "Sajtó". Checked on 11 September 2026: exactly 15 rows, all
-- `katona-archive:`.

begin;

delete from public.play_cast pc
using public.plays p
where p.id = pc.play_id
  and p.source_key like 'katona-archive:%'
  and pc.role in ('Sajtó', 'Kritikák', 'Műsorfüzet');

commit;

-- rollback: not possible from this file — the rows are gone — but not needed
-- either: running `npm run sync` with the adapter as it was before this
-- change would recreate them, and with the adapter as it is now they stay
-- gone, which is the point.
