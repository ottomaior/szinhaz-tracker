/**
 * Katona József Színház (Budapest) — ARCHIVE ONLY, read from the theatre's
 * frozen Joomla site at archive.katonajozsefszinhaz.hu.
 *
 * The theatre moved its live site to WordPress (uploads dated 2026-06/07),
 * which broke this adapter outright: on the main domain
 * /eloadasok/{bemutatok,repertoar} now 301 to /eloadasok/, /eloadasok/archivum
 * is a 404, and the `li.field-entry.szinlap-kep` custom-field markup this
 * parser depends on appears nowhere on the new pages. Current productions are
 * handled by sync/adapters/katona-wp.ts instead.
 *
 * The old Joomla install survives verbatim on the archive subdomain, so the
 * original selectors still work there and the theatre's back catalogue stays
 * reachable:
 *   li.field-entry.rendezo            > span.field-value   director
 *   li.field-entry.irta               > span.field-value   author
 *   li.field-entry.bemutato           > span.field-value   premiere date
 *   li.field-entry.az-eloadas-hossza  > span.field-value   runtime
 *   li.field-entry.szinlap-kep img                         poster
 *   div.com-content-article__body                          synopsis
 *
 * Note the poster deliberately comes from the szinlap-kep field rather than
 * og:image: og:image points at a generated thumbnail under
 * /administrator/cache/preview/, while the field holds the full-size artwork.
 *
 * Only /eloadasok/archivum is read. The frozen site's `repertoar` and
 * `bemutatok` sections are a stale snapshot of what was playing when it was
 * retired — anything still running is on the WordPress site and comes from the
 * other adapter, so scraping them here would duplicate every current
 * production under a second source key.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { normalizeText, titleKey } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import { fetchCurrent } from "./katona-wp";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://archive.katonajozsefszinhaz.hu";
const CRAWL_DELAY_MS = 800; // robots.txt sets no Crawl-delay; this is courtesy

const ARCHIVE_PATH = "/eloadasok/archivum";

/** Joomla pages 5 items at a time; this bounds a runaway loop, not the archive. */
const MAX_PAGES = 60;

/*
 * Katona is a prose theatre; the frozen Joomla archive publishes no genre
 * field either. Left undefined for the same reason as the live adapter — see
 * sync/adapters/katona-wp.ts and venues.default_genre.
 */

const PRODUCTION_HREF = /^\/eloadasok\/[a-z]+\/\d+-[^/]+$/;

function fieldValue($: cheerio.CheerioAPI, className: string): string {
  return $(`li.field-entry.${className} span.field-value`).first().text().replace(/\s+/g, " ").trim();
}

function productionLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").split("?")[0];
    if (PRODUCTION_HREF.test(href)) urls.add(href);
  });
  return [...urls];
}

/**
 * Walks Joomla's `?start=` pagination until a page contributes nothing new.
 *
 * The previous version of this read only the first page, because it stripped
 * the query string before matching and never requested page 2 — which silently
 * capped every section at its first few productions.
 */
async function fetchSection(path: string): Promise<string[]> {
  const found = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const suffix = page === 0 ? "" : `?start=${page * 5}`;

    let html: string;
    try {
      html = await fetchText(`${BASE_URL}${path}${suffix}`, { crawlDelayMs: CRAWL_DELAY_MS });
    } catch (e) {
      // Sections differ in whether they page at all: /eloadasok/archivum
      // renders its whole list at once and 404s on ?start=, while
      // /eloadasok/bemutatok really does paginate. A failure past the first
      // page therefore means the list ended, not that the scrape broke — but a
      // failure on page one is a genuine error and still propagates.
      if (page === 0) throw e;
      break;
    }

    const before = found.size;
    for (const href of productionLinks(html)) found.add(href);
    if (found.size === before) break;
  }

  return [...found];
}

async function fetchProduction(path: string): Promise<SyncedPlay | undefined> {
  const html = await fetchText(`${BASE_URL}${path}`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseProductionPage(html, path);
}

/**
 * One production page of the frozen archive.
 *
 * Split out of the fetch so it can be tested against a recorded page, which is
 * how every other adapter here is arranged — and what this one was missing
 * when its cast tables went unread for months.
 */
export function parseProductionPage(html: string, path: string): SyncedPlay | undefined {
  const $ = cheerio.load(html);

  // The <title> is just the production name — no site suffix to strip here,
  // unlike Csokonai's.
  const title = $("title").first().text().trim();
  if (!title) return undefined;

  const director = fieldValue($, "rendezo");
  const author = fieldValue($, "irta");
  const premiereDate = parseHungarianDate(fieldValue($, "bemutato"));
  const { runtimeMinutes, intermissions } = parseDurationHu(fieldValue($, "az-eloadas-hossza"));

  const posterUrl = $("li.field-entry.szinlap-kep img").first().attr("src") || undefined;

  const synopsis =
    $("div.com-content-article__body p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .join("\n\n") || undefined;

  const cast: { name: string; role: string }[] = [];

  /*
   * The cast and the creative team are two-column tables.
   *
   * `szereplok` and `alkotok` are field entries like the rest, but their
   * value is a `<table>` of "role | person" rows rather than a single string:
   * "Othello | Bányai Kelemen Barna". Read by the generic sweep below they
   * arrive as one 900-character blob, which its own length guard then throws
   * away — so this frozen archive held no cast for the productions that use
   * the table form, fourteen of them, while their pages listed a full cast.
   */
  $("li.field-entry.szereplok, li.field-entry.alkotok").each((_, entry) => {
    $(entry)
      .find("tr")
      .each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;
        const role = normalizeText($(cells[0]).text());
        const name = normalizeText($(cells[1]).text());
        // A stray one-column layout row, or a note in the second cell.
        if (role && name && name.length < 120) cast.push({ role, name });
      });
  });

  // Everything else in the same custom-fields structure; entries that carry
  // both a label and a value are role/performer pairs. Anything already
  // consumed above is skipped so the metadata fields don't turn into cast
  // members, and so do the two tables just read.
  //
  // The press blocks are named too, not left to the length guard below.
  // "Sajtó", "Kritikák" and "Műsorfüzet" are lists of links in the same
  // structure, and the guard only stopped the long ones: fifteen productions
  // arrived with a contributor called "Revizoronline.hu - Gabnai Katalin"
  // whose role was Kritikák (T-050).
  const consumed = new Set([
    "rendezo",
    "irta",
    "bemutato",
    "az-eloadas-hossza",
    "szinlap-kep",
    "helyszin",
    "szinlap-hely",
    "szereplok",
    "alkotok",
    "sajto",
    "kritikak",
    "musorfuzet",
    "galeria",
    "videok",
    "sajat-link",
  ]);
  $("li.field-entry").each((_, el) => {
    const classes = ($(el).attr("class") ?? "").split(/\s+/);
    if (classes.some((c) => consumed.has(c))) return;
    const role = $(el).find("span.field-label").first().text().replace(/\s+/g, " ").trim();
    const name = $(el).find("span.field-value").first().text().replace(/\s+/g, " ").trim();
    if (role && name && name.length < 120) cast.push({ role, name });
  });

  // The section pages also carry the occasional season-announcement article
  // ("Határon túli koprodukció, tantermi előadás és kortárs darabok új
  // évadunkban"), which is a news post rather than a production. Every real
  // production fills in at least one of these three fields; news posts fill
  // in none.
  if (!director && !author && !premiereDate) return undefined;

  return {
    sourceKey: path.split("/").pop() ?? path,
    sourceUrl: `${BASE_URL}${path}`,
    title,
    author,
    director,
    venueId: VENUE_IDS.katona,
    genre: undefined,
    runtimeMinutes,
    intermissions,
    premiereDate,
    synopsis,
    posterUrl: posterUrl?.startsWith("http") ? posterUrl : posterUrl ? `${BASE_URL}${posterUrl}` : undefined,
    // Everything this adapter returns is, by definition, the theatre's own archive.
    isArchived: true,
    cast,
    // The frozen site's showtimes are historical and were never parsed; current
    // dates come from the WordPress adapter.
    performances: [],
  };
}

/**
 * Strips Joomla's numeric article id, leaving the slug the WordPress site uses.
 *
 * The two systems agree on slugs — Joomla's "43201-kali-holtak" is WordPress's
 * "kali-holtak" — which is what makes matching a production across the
 * relaunch possible at all, both here and in the source-key migration in
 * supabase/migrations/0007_katona_relaunch.sql.
 */
function slugOf(key: string): string {
  return key.replace(/^\d+-/, "");
}

async function run(): Promise<SyncedPlay[]> {
  const byKey = new Map<string, SyncedPlay>();

  // The frozen site's archive is not purely historical: 15 of its 47 entries
  // are productions still playing on the new WordPress site, Chicago among
  // them. Syncing those here would duplicate every one of them — a second row
  // for the same production, wrongly flagged as archived — so the live
  // repertoire wins and this adapter yields it. Matched by slug where the two
  // sites agree, and by title where the archive still carries the working
  // title in its URL (`43970-hamlet` for *némacsend*), which is only known
  // once the page has been read.
  const current = await fetchCurrent();

  for (const productionPath of await fetchSection(ARCHIVE_PATH)) {
    const key = productionPath.split("/").pop() ?? productionPath;
    if (byKey.has(key) || current.slugs.has(slugOf(key))) continue;
    const play = await fetchProduction(productionPath);
    if (!play || current.titles.has(titleKey(play.title))) continue;
    byKey.set(key, play);
  }

  return [...byKey.values()];
}

export const katonaAdapter: SyncAdapter = { name: "katona-archive", run };
