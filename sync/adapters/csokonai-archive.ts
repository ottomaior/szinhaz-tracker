/**
 * Csokonai Nemzeti Színház (Debrecen) — the back catalogue at `/archivum/`.
 *
 * The live adapter walks the paginated repertoire index, which lists only what
 * is on now: 56 production pages, about 40 real productions once the talks and
 * building tours are filtered out. `/archivum/` lists roughly 190, and about
 * 175 of those appear nowhere in the index. Those are the productions someone
 * saw in Debrecen three years ago and cannot currently log, which is the whole
 * point of keeping an archive in the catalogue.
 *
 * Split into its own adapter rather than folded into `csokonai.ts` for the
 * reason `reconcile()` cares about: it scopes by source-key prefix, so a
 * `csokonai-archive:` row is only ever claimed or retired by this adapter, and
 * the live pass cannot mistake 175 archived productions for repertoire that
 * has vanished from the index.
 *
 * Two differences from the live pages, both verified against live markup and
 * both the reason this cannot simply reuse `csokonai.ts`'s run():
 *
 *  1. Archived pages carry no genre taxonomy links at all. The live adapter
 *     uses exactly that to tell productions from the theatre's talks and
 *     tours, so applying the same rule here would discard every single one.
 *     The archive listing is itself the filter: the theatre put these on a
 *     page called "archívum", so they are productions.
 *  2. Many carry no "Bemutató" line either, so `premiereDate` is often
 *     undefined. That is honest — the page genuinely does not say — and
 *     recompute_play_status() files archived rows as 'ended' regardless.
 *
 * No showtimes are fetched. These productions are not on, and the calendar
 * only covers the months ahead.
 */
import { fetchText } from "../lib/http";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";
import { fetchProductionIndex, parseProductionDetails, productionLinksIn, slugOf } from "./csokonai";

const BASE_URL = "https://csokonaiszinhaz.hu";
const CRAWL_DELAY_MS = 800; // matches the live adapter; robots.txt sets none
const ARCHIVE_URL = `${BASE_URL}/archivum/`;

/** Productions the archive page links to, as detail URLs. */
export function archiveLinksIn(html: string): string[] {
  // The archive links into the same `/eloadasok/{slug}` space as the index, so
  // the live adapter's extractor already knows how to read them — including
  // skipping `/eloadasok/page/…` and `/eloadasok/mufaj/…`.
  return productionLinksIn(html);
}

async function run(): Promise<SyncedPlay[]> {
  const [archiveHtml, currentUrls] = await Promise.all([
    fetchText(ARCHIVE_URL, { crawlDelayMs: CRAWL_DELAY_MS }),
    // Anything still in the repertoire belongs to the live adapter. Without
    // this subtraction the ~15 productions listed in both places would exist
    // twice over — once under `csokonai:` and once under `csokonai-archive:` —
    // with any review or watchlist entry stranded on whichever copy the user
    // happened to open. That is the duplication 0007_katona_relaunch.sql had
    // to clean up by hand; it is cheaper to not create it.
    fetchProductionIndex(),
  ]);

  const current = new Set(currentUrls.map(slugOf));
  const archived = archiveLinksIn(archiveHtml).filter((url) => !current.has(slugOf(url)));

  const plays: SyncedPlay[] = [];
  for (const detailUrl of archived) {
    const slug = slugOf(detailUrl);
    let details;
    try {
      details = parseProductionDetails(await fetchText(detailUrl, { crawlDelayMs: CRAWL_DELAY_MS }));
    } catch {
      // One dead link in a list of 175 is not a reason to lose the other 174.
      // run.ts counts and reports per-row failures; this one is a fetch that
      // never produced a row at all, so it is skipped quietly.
      continue;
    }
    if (!details.title) continue;

    plays.push({
      sourceKey: slug,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.csokonaiDebrecen,
      // Archived pages carry no taxonomy term, so there is nothing truer to
      // say than that this was theatre.
      genre: "színház",
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      isArchived: true,
      cast: details.cast,
      performances: [],
    });
  }

  return plays;
}

export const csokonaiArchiveAdapter: SyncAdapter = { name: "csokonai-archive", run };
