/**
 * Katona József Színház (Budapest) — current repertoire, from the theatre's own
 * WordPress site.
 *
 * Replaces the Joomla scrape in sync/adapters/katona.ts, which broke when the
 * theatre relaunched (uploads dated 2026-06/07): the old section paths now 301
 * to /eloadasok/ and the custom-field markup is gone. That adapter still reads
 * the frozen Joomla install at archive.katonajozsefszinhaz.hu for the back
 * catalogue; this one covers everything currently on.
 *
 * The new site is markedly richer than what it replaced, and gives this app
 * three things the Joomla scrape never had:
 *   - showtimes, inline on each production page (Katona previously synced none,
 *     which is why 0006_play_status.sql has a special case for a source that
 *     publishes no dates at all)
 *   - the stage a production plays on (Nagyszínpad vs Kamra), as `room`
 *   - production photography with a named photographer credit
 *
 * Index: /eloadasok/ server-renders every production as /eloadasok/<slug>/.
 * The theme emits a /eloadasok/page/2/ link, but those pages repeat page one
 * verbatim — the listing is not actually paginated, so it is read in one go.
 *
 * Detail page selectors, all verified against live markup:
 *   h3.performance-title                       title
 *   div.performance-location                   stage ("Kamra")
 *   p.highlighted-item-overlay-next-text       "Írta ← …", "Rendező ← …",
 *                                              "Bemutató ← 2025-12-12",
 *                                              "Játékidő ← 2 óra 15 perc, egy szünettel"
 *   div.performance-synopsis-content           synopsis
 *   section.performance-hero img               cover artwork (see note below)
 *   div.performance-cast-member                "Szerep: Színész"
 *   div.performance-creators-item              "Szerepkör: Alkotó"
 *   p.performance-datetime                     showtimes, in date/time pairs
 *
 * Two parsing notes:
 *  1. The hero carries two images — a desktop "…–web–cover.jpg" and a cropped
 *     mobile variant, distinguished only by Bootstrap display classes. The
 *     desktop one is the real artwork, so d-md-block is preferred over
 *     document order.
 *  2. Showtimes render as alternating "szeptember 6" / "vasárnap 19:00"
 *     paragraphs with no year, so the year is inferred as the next occurrence
 *     (see resolveUpcomingYear) and the result converted from Budapest local
 *     time to UTC.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianMonthDay, resolveUpcomingYear } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://katonajozsefszinhaz.hu";
const INDEX_PATH = "/eloadasok/";
const CRAWL_DELAY_MS = 800; // robots.txt sets no Crawl-delay; this is courtesy

/*
 * Katona is a prose theatre; the site publishes no genre field.
 *
 * Reported as "nothing here" rather than as "próza" — the theatre's profile
 * lives on `venues.default_genre` and is applied by the classifier in
 * 0016_genre_taxonomy.sql, which labels it `genre_source = 'venue_default'`.
 * Leaving it undefined is also what lets a musical in the repertoire be
 * recognised as one: Chicago is now classified from its authors rather than
 * buried under this adapter's default.
 */

/** Endpoints living under the same path that are not productions. */
const NOT_PRODUCTIONS = new Set(["feed", "page"]);

const PRODUCTION_HREF = /^https:\/\/katonajozsefszinhaz\.hu\/eloadasok\/([^/]+)\/$/;

const TIME = /(\d{1,2}):(\d{2})/;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Splits "Rendező ← Székely Kriszta" into its label and value. */
function overlayFields($: cheerio.CheerioAPI): Map<string, string> {
  const fields = new Map<string, string>();

  $("p.highlighted-item-overlay-next-text").each((_, el) => {
    const [label, ...rest] = clean($(el).text()).split("←");
    const value = clean(rest.join("←"));
    if (label && value) fields.set(clean(label).toLowerCase(), value);
  });

  return fields;
}

/**
 * Splits "Roxie Hart: Mentes Júlia" into a role/name pair.
 *
 * `fallbackRole` decides what happens to an entry with no colon in it. For the
 * creative team there is no such thing — every line is "Dramaturg: X" — and a
 * line without one is markup this does not understand, so it is skipped. The
 * cast list is different: some productions name a character for every
 * performer and some name none. *Peer Gynt* lists seventeen actors and not one
 * character, and requiring the colon threw all seventeen away and kept the
 * nine creators, so the app showed a play with a dramaturg, a prompter and
 * nobody on stage. It is the same shape of bug as the empty role cell in
 * `csokonai.ts`, found the same day and on a different theatre's markup.
 */
function labelledPairs(
  $: cheerio.CheerioAPI,
  selector: string,
  fallbackRole?: string
): { role: string; name: string }[] {
  const pairs: { role: string; name: string }[] = [];

  $(selector).each((_, el) => {
    const text = clean($(el).text());
    const separator = text.indexOf(":");
    if (separator < 1) {
      if (fallbackRole && text && text.length < 200) pairs.push({ role: fallbackRole, name: text });
      return;
    }

    const role = clean(text.slice(0, separator));
    const name = clean(text.slice(separator + 1));
    if (role && name && name.length < 200) pairs.push({ role, name });
  });

  return pairs;
}

/**
 * Reads the "Legközelebb" block, whose date and time render as separate
 * paragraphs. Rather than assuming a strict two-per-showtime order, a date is
 * held until the time that follows it arrives, so a stray extra paragraph
 * shifts nothing.
 */
function showtimes(
  $: cheerio.CheerioAPI,
  slug: string,
  room?: string
): { sourceKey: string; startsAt: string; room?: string }[] {
  const performances: { sourceKey: string; startsAt: string; room?: string }[] = [];
  let pending: { month: number; day: number } | undefined;

  $("p.performance-datetime").each((_, el) => {
    const text = clean($(el).text());

    const monthDay = parseHungarianMonthDay(text);
    if (monthDay) {
      pending = monthDay;
      return;
    }

    const time = text.match(TIME);
    if (!time || !pending) return;

    const { month, day } = pending;
    pending = undefined;

    const year = resolveUpcomingYear(month, day);
    const local =
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` +
      `T${time[1].padStart(2, "0")}:${time[2]}:00`;

    // Keyed on local wall-clock time: stable across daylight saving, and
    // readable in the database when something needs checking by hand.
    performances.push({ sourceKey: `${slug}:${local}`, startsAt: budapestLocalToUtcIso(local), room });
  });

  return performances;
}

/**
 * The photographer credit printed above the gallery ("Fotók © Wertán Botond").
 *
 * Katona is the only one of the four sources that names its photographers, and
 * a production still is someone's work — worth carrying through to the app
 * rather than dropping on the floor.
 */
function photoCredit($: cheerio.CheerioAPI): string | undefined {
  let credit: string | undefined;

  $("div.performance-gallery, section.performance-gallery, div.gallery")
    .find("*")
    .each((_, el) => {
      if (credit) return;
      const text = clean($(el).text());
      if (/^Fot[óo]k?\s*©/i.test(text) && text.length < 120) credit = text;
    });

  return credit;
}

function heroPoster($: cheerio.CheerioAPI): string | undefined {
  const hero = $("section.performance-hero img");
  // The desktop variant is the full artwork; the mobile one is a crop.
  const desktop = hero.filter((_, el) => ($(el).attr("class") ?? "").includes("d-md-block")).first();
  const chosen = desktop.length ? desktop : hero.first();

  const src = chosen.attr("src");
  if (!src) return undefined;
  return src.startsWith("http") ? src : `${BASE_URL}${src}`;
}

/**
 * The slugs of everything currently in the repertoire.
 *
 * Exported because the archive adapter needs it too: the frozen Joomla site
 * files 15 productions under /eloadasok/archivum that are still playing here
 * (Chicago among them), so without this list the same production would sync
 * twice — once as current, once wrongly marked archived. See
 * sync/adapters/katona.ts.
 */
export async function fetchCurrentSlugs(): Promise<Set<string>> {
  const html = await fetchText(`${BASE_URL}${INDEX_PATH}`, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(html);

  const slugs = new Set<string>();
  $("a[href]").each((_, el) => {
    const match = ($(el).attr("href") ?? "").split("?")[0].match(PRODUCTION_HREF);
    if (match && !NOT_PRODUCTIONS.has(match[1])) slugs.add(match[1]);
  });

  return slugs;
}

/**
 * Turns one production page into a SyncedPlay.
 *
 * Kept separate from fetching so it can be exercised against a recorded page
 * in sync/adapters/katona-wp.test.ts — this theatre silently replaced its
 * whole website once already, and a fixture test is what turns that from a
 * quiet catalogue freeze into a failing build.
 */
export function parseProduction(html: string, slug: string): SyncedPlay | undefined {
  const $ = cheerio.load(html);

  const title = clean($("h3.performance-title").first().text());
  if (!title) return undefined;

  const fields = overlayFields($);
  const author = fields.get("írta") ?? "";
  const director = fields.get("rendező") ?? "";
  const premiereDate = fields.get("bemutató")?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const { runtimeMinutes, intermissions } = parseDurationHu(fields.get("játékidő") ?? "");

  const room = clean($("div.performance-location").first().text()) || undefined;

  const synopsis =
    $("div.performance-synopsis-content p")
      .map((_, el) => clean($(el).text()))
      .get()
      .filter(Boolean)
      .join("\n\n") || undefined;

  // Performers first, then the creative team, so the cast list reads the way a
  // printed programme does.
  const cast = [
    // "Szereplő" for a performer this production credits without a part —
    // the same word vojtina.ts and csokonai.ts use for the same thing.
    ...labelledPairs($, "div.performance-cast-member", "Szereplő"),
    ...labelledPairs($, "div.performance-creators-item"),
  ];

  // The listing mixes in the occasional non-production page. A real production
  // always names at least one of these; a news post names none.
  if (!director && !author && !premiereDate) return undefined;

  return {
    sourceKey: slug,
    sourceUrl: `${BASE_URL}/eloadasok/${slug}/`,
    title,
    author,
    director,
    venueId: VENUE_IDS.katona,
    genre: undefined,
    runtimeMinutes,
    intermissions,
    premiereDate,
    synopsis,
    posterUrl: heroPoster($),
    posterCredit: photoCredit($),
    isArchived: false,
    cast,
    performances: showtimes($, slug, room),
  };
}

async function run(): Promise<SyncedPlay[]> {
  const plays: SyncedPlay[] = [];

  for (const slug of await fetchCurrentSlugs()) {
    const html = await fetchText(`${BASE_URL}/eloadasok/${slug}/`, { crawlDelayMs: CRAWL_DELAY_MS });
    const play = parseProduction(html, slug);
    if (play) plays.push(play);
  }

  return plays;
}

export const katonaWpAdapter: SyncAdapter = { name: "katona-wp", run };
