/**
 * Katona József Színház (Budapest) — scraped from the theater's own Joomla
 * site.
 *
 * This replaces the blocked Jegymester route for Katona (see
 * sync/adapters/jegymester.ts: that platform's endpoint returns 403
 * "requires access token"). No token, no reverse engineering, no Jegy.hu
 * fallback needed — katonajozsefszinhaz.hu renders everything server-side and
 * its robots.txt disallows only Joomla's own admin directories.
 *
 * The site splits its work into exactly the sections this app wants:
 *   /eloadasok/bemutatok   upcoming premieres
 *   /eloadasok/repertoar   currently playing
 *   /eloadasok/archivum    past productions -> isArchived
 *   /eloadasok/online      stream recordings -> skipped, not stage work
 *
 * Detail pages expose metadata as a Joomla custom-fields list, which is far
 * more reliable to parse than prose:
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
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://katonajozsefszinhaz.hu";
const CRAWL_DELAY_MS = 800; // robots.txt sets no Crawl-delay; this is courtesy

const SECTIONS: { path: string; archived: boolean }[] = [
  { path: "/eloadasok/bemutatok", archived: false },
  { path: "/eloadasok/repertoar", archived: false },
  { path: "/eloadasok/archivum", archived: true },
];

/** Katona is a prose theater; the site publishes no genre field. */
const DEFAULT_GENRE = "próza";

const PRODUCTION_HREF = /^\/eloadasok\/[a-z]+\/\d+-[^/]+$/;

function fieldValue($: cheerio.CheerioAPI, className: string): string {
  return $(`li.field-entry.${className} span.field-value`).first().text().replace(/\s+/g, " ").trim();
}

async function fetchSection(path: string): Promise<string[]> {
  const html = await fetchText(`${BASE_URL}${path}`, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").split("?")[0];
    if (PRODUCTION_HREF.test(href)) urls.add(href);
  });
  return [...urls];
}

async function fetchProduction(path: string, archived: boolean): Promise<SyncedPlay | undefined> {
  const html = await fetchText(`${BASE_URL}${path}`, { crawlDelayMs: CRAWL_DELAY_MS });
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
  // Cast lives in the same custom-fields structure; entries that carry both a
  // label and a value are role/performer pairs. Anything already consumed
  // above is skipped so the metadata fields don't turn into cast members.
  const consumed = new Set(["rendezo", "irta", "bemutato", "az-eloadas-hossza", "szinlap-kep", "helyszin", "szinlap-hely"]);
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
    title,
    author,
    director,
    venueId: VENUE_IDS.katona,
    genre: DEFAULT_GENRE,
    runtimeMinutes,
    intermissions,
    premiereDate,
    synopsis,
    posterUrl: posterUrl?.startsWith("http") ? posterUrl : posterUrl ? `${BASE_URL}${posterUrl}` : undefined,
    isArchived: archived,
    cast,
    // The site's showtimes live on a separate /musor calendar that is not
    // parsed yet; plays sync without performances rather than with wrong ones.
    performances: [],
  };
}

async function run(): Promise<SyncedPlay[]> {
  const byKey = new Map<string, SyncedPlay>();

  for (const { path, archived } of SECTIONS) {
    for (const productionPath of await fetchSection(path)) {
      const key = productionPath.split("/").pop() ?? productionPath;
      // A production listed in both bemutatok and repertoar is current: the
      // first (non-archived) section to claim it wins.
      if (byKey.has(key)) continue;
      const play = await fetchProduction(productionPath, archived);
      if (play) byKey.set(key, play);
    }
  }

  return [...byKey.values()];
}

export const katonaAdapter: SyncAdapter = { name: "katona-site", run };
