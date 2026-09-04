/**
 * Csokonai Nemzeti Színház (Debrecen) — scraped from the theater's own
 * WordPress site, not Jegymester. Their Jegymester-hosted ticketing site
 * (jegy.csokonaiszinhaz.hu) has the same "requires access token" wall as
 * Katona's (see sync/adapters/jegymester.ts) — this adapter avoids that
 * entirely by reading pages Csokonai's own site already renders as plain
 * server-side HTML. robots.txt for csokonaiszinhaz.hu is fully permissive.
 * The site's sitemap.xml is not usable: it was generated once in 2025 and
 * lists two URLs.
 *
 * Driven by the *repertoire index*, not the calendar. An earlier version
 * walked `/naptar/?month=` and treated whatever had a performance in the
 * next three months as the catalog, which found 11 of the theater's 37
 * productions and gave every one of them a null premiere date. The index at
 * `/eloadasok/` is the full list, and each production's own page carries the
 * metadata worth having.
 *
 * Three passes, all verified against live pages:
 *  1. `/eloadasok/` + `/eloadasok/page/N/` — every production's detail URL.
 *  2. `/eloadasok/mufaj/{term}/` — the genre taxonomy. Doubles as the
 *     ancillary filter: all 33 real productions carry at least one genre
 *     term and the 4 non-productions ("Csokonai Társalgó", "Színházbejárás",
 *     "Csokonai közTér", which are talks and building tours) carry none.
 *     That replaces the title-prefix guesswork this file used to do.
 *  3. Each `/eloadasok/{slug}` page — synopsis, director, runtime,
 *     intermissions, poster, cast, and the premiere date.
 * Then `/naptar/?month=` for showtimes only.
 *
 * WordPress themes do change markup. If this starts returning 0 plays, the
 * selectors below are the first thing to check.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://csokonaiszinhaz.hu";
const CRAWL_DELAY_MS = 800; // polite pacing; robots.txt sets no explicit Crawl-delay
const MAX_INDEX_PAGES = 25; // generous ceiling; the index is 4 pages today
const PERFORMANCE_MONTHS = 3;

/**
 * Taxonomy terms that describe *where* a show plays rather than what kind of
 * show it is. "Nagyerdei Szabadtéri Színpad" is the theater's outdoor stage;
 * it sits in the same taxonomy as próza/zenés/tánc and also turns up in the
 * calendar's genre slot, so it must not be stored as a play's genre.
 */
const VENUE_TERM_SLUGS = new Set(["nagyerdei-szabadteri-szinpad"]);

/** Used when a production carries no usable genre term at all. */
const FALLBACK_GENRE = "színház";

type CalendarOccurrence = {
  detailUrl: string;
  year: number;
  month: number;
  day: number;
  time: string; // "HH:MM"
  room?: string;
  genre?: string;
};

type ProductionDetails = {
  title: string;
  author: string;
  synopsis?: string;
  director: string;
  runtimeMinutes?: number;
  intermissions?: number;
  posterUrl?: string;
  premiereDate?: string;
  cast: { name: string; role: string }[];
};

function monthsAhead(count: number): { yyyymm: string; year: number; month: number }[] {
  const out: { yyyymm: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    out.push({ yyyymm: `${year}${String(month).padStart(2, "0")}`, year, month });
  }
  return out;
}

function slugOf(detailUrl: string): string {
  return detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

/** Every production detail URL on the paginated repertoire index. */
async function fetchProductionIndex(): Promise<string[]> {
  const urls = new Set<string>();

  for (let page = 1; page <= MAX_INDEX_PAGES; page++) {
    const url = page === 1 ? `${BASE_URL}/eloadasok/` : `${BASE_URL}/eloadasok/page/${page}/`;
    let html: string;
    try {
      html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
    } catch {
      break; // past the last page the site 404s, which fetchText throws on
    }

    const before = urls.size;
    for (const href of productionLinksIn(html)) urls.add(href);
    if (urls.size === before) break; // no new productions: end of the list
  }

  return [...urls];
}

/**
 * Genre label per production slug, read off the taxonomy pages. The term
 * list is discovered from the index rather than hardcoded, so a new genre
 * added by the theater is picked up without a code change; the label comes
 * from the term page's own <title>.
 */
async function fetchGenreBySlug(): Promise<Map<string, string>> {
  const indexHtml = await fetchText(`${BASE_URL}/eloadasok/`, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(indexHtml);

  const termUrls = new Set<string>();
  $('a[href*="/eloadasok/mufaj/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) termUrls.add(href.split("?")[0].replace(/\/+$/, "") + "/");
  });

  const genreBySlug = new Map<string, string>();

  for (const termUrl of termUrls) {
    const termSlug = termUrl.replace(/\/+$/, "").split("/").pop() ?? "";
    let label = "";

    for (let page = 1; page <= MAX_INDEX_PAGES; page++) {
      const url = page === 1 ? termUrl : `${termUrl}page/${page}/`;
      let html: string;
      try {
        html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
      } catch {
        break;
      }

      if (!label) {
        const title = cheerio.load(html)("title").first().text();
        label = title.split(/[–-]\s*Csokonai/i)[0].trim();
      }

      const links = productionLinksIn(html);
      if (!links.length) break;

      let added = false;
      for (const href of links) {
        const slug = slugOf(href);
        // A production can carry several terms; the venue-ish one only wins
        // if nothing better is available, so never let it overwrite a genre.
        if (VENUE_TERM_SLUGS.has(termSlug) && genreBySlug.has(slug)) continue;
        if (!genreBySlug.has(slug) || !VENUE_TERM_SLUGS.has(termSlug)) {
          if (!genreBySlug.has(slug)) added = true;
          genreBySlug.set(slug, VENUE_TERM_SLUGS.has(termSlug) ? "" : label || FALLBACK_GENRE);
        }
      }
      if (!added) break;
    }
  }

  return genreBySlug;
}

function productionLinksIn(html: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href*="/eloadasok/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
    // Keep only production pages: `/eloadasok/{slug}` with nothing after it.
    const match = absolute.match(/^https:\/\/csokonaiszinhaz\.hu\/eloadasok\/([^/?#]+)\/?$/);
    if (!match) return;
    if (match[1] === "page" || match[1] === "feed" || match[1] === "mufaj") return;
    out.add(`${BASE_URL}/eloadasok/${match[1]}`);
  });
  return [...out];
}

async function fetchProductionDetails(url: string): Promise<ProductionDetails> {
  const html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(html);

  const rawTitle = $("title").first().text().replace(/\s*[–-]\s*Csokonai Nemzeti Színház Debrecen\s*$/i, "").trim();
  const colonIndex = rawTitle.indexOf(": ");
  const author = colonIndex > -1 ? rawTitle.slice(0, colonIndex).trim() : "";
  const title = colonIndex > -1 ? rawTitle.slice(colonIndex + 2).trim() : rawTitle;

  // Matches "Rendező:" and variants like "Rendező-koreográfus:" (seen on
  // dance-program pages) — anything starting with "Rendező" up to the colon.
  let director = "";
  let premiereText = "";
  $("strong").each((_, el) => {
    const t = $(el).text();
    const m = t.match(/^Rendező[^:]*:\s*(.+)$/);
    if (m) director = m[1].trim();
    // "Bemutató: 2026. május 22." for shows that have opened, "Bemutató
    // tervezett időpontja: 2027. április 17." for ones that haven't.
    if (/^Bemutató/.test(t)) premiereText = t;
  });

  let durationText = "";
  $("h4").each((_, el) => {
    const t = $(el).text();
    if (t.includes("Időtartam:")) durationText = t;
  });
  const { runtimeMinutes, intermissions } = parseDurationHu(durationText);

  const synopsis = $("article p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t && !/^Rendező[^:]*:/.test(t) && !/^Bemutató/.test(t) && !t.includes("kettőzött szerepek"))
    .join("\n\n");

  const posterUrl = $('meta[property="og:image"]').attr("content") || undefined;

  const cast: { name: string; role: string }[] = [];
  $('[id^="actors-container-"] > div > div').each((_, row) => {
    const $row = $(row);
    const role = $row.find("p.uk-text-muted").first().text().trim();
    const nameField = $row.find("p.uk-text-secondary").first().text().trim();
    const firstAlternate = nameField.split("/")[0]?.replace(/\bm\.v\.\s*$/, "").trim();
    if (role && firstAlternate) cast.push({ role, name: firstAlternate });
  });

  return {
    title,
    author,
    synopsis: synopsis || undefined,
    director,
    runtimeMinutes,
    intermissions,
    posterUrl,
    premiereDate: parseHungarianDate(premiereText),
    cast,
  };
}

async function fetchCalendarMonth(yyyymm: string, year: number, month: number): Promise<CalendarOccurrence[]> {
  const html = await fetchText(`${BASE_URL}/naptar/?month=${yyyymm}`, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(html);
  const occurrences: CalendarOccurrence[] = [];

  $(".calendar-item").each((_, el) => {
    const $el = $(el);
    const dayText = $el.find(".uk-h1.uk-text-secondary").first().text().trim();
    const day = Number(dayText);
    const time = $el.find(".uk-h6.uk-margin-remove.uk-text-muted").first().text().trim();
    const titleP = $el.find("p.uk-text-large").first();
    const detailUrl = titleP.closest("a").attr("href");
    if (!day || !time || !detailUrl) return;

    let room: string | undefined;
    $el.find("p").each((_, p) => {
      const t = $(p).text();
      if (t.startsWith("Játszóhely:")) room = t.replace("Játszóhely:", "").trim();
    });
    // For some guest/touring shows the site puts the venue name in this slot
    // instead of a real genre (confirmed live on outdoor-stage guest
    // performances) — discard it rather than storing a venue name as a genre.
    const rawGenre = $el.find("span.uk-text-bold.uk-text-uppercase.uk-text-muted").first().text().trim();
    const genre = rawGenre && rawGenre !== room ? rawGenre : undefined;

    occurrences.push({ detailUrl: normalizeDetailUrl(detailUrl), year, month, day, time, room, genre });
  });

  return occurrences;
}

function normalizeDetailUrl(href: string): string {
  const absolute = href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
  return absolute.split("?")[0].replace(/\/+$/, "");
}

/**
 * Drops poster URLs that are really the theater's generic branding graphic.
 *
 * Productions without production photos yet fall back to a house image in
 * `og:image` (today `csokonai-2023.jpeg`, shared by Aida, Trója and III.
 * Richárd). Left in place, three unrelated plays would each show the same
 * picture as if it were their poster, which reads as real artwork rather
 * than as "no image". Any URL claimed by more than one production is treated
 * as a placeholder, so this keeps working if the house image is ever swapped.
 */
function dropSharedPosters(plays: SyncedPlay[]): void {
  const useCount = new Map<string, number>();
  for (const play of plays) {
    if (play.posterUrl) useCount.set(play.posterUrl, (useCount.get(play.posterUrl) ?? 0) + 1);
  }
  for (const play of plays) {
    if (play.posterUrl && (useCount.get(play.posterUrl) ?? 0) > 1) play.posterUrl = undefined;
  }
}

/**
 * The site sometimes lists one production under two detail pages (confirmed
 * live: "A Pál utcai fiúk" had an older page with no "Rendező:" line and a
 * newer, fuller one). Merged by normalized title, keeping the richer record
 * and combining both sets of performances.
 */
function mergeDuplicateTitles(plays: SyncedPlay[]): SyncedPlay[] {
  const byTitle = new Map<string, SyncedPlay>();
  for (const play of plays) {
    const key = play.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, play);
      continue;
    }
    const score = (p: SyncedPlay) => (p.director ? 2 : 0) + (p.premiereDate ? 1 : 0) + (p.cast.length ? 1 : 0);
    const keepNew = score(play) > score(existing);
    const primary = keepNew ? play : existing;
    const secondary = keepNew ? existing : play;
    byTitle.set(key, {
      ...primary,
      posterUrl: primary.posterUrl ?? secondary.posterUrl,
      premiereDate: primary.premiereDate ?? secondary.premiereDate,
      performances: [...primary.performances, ...secondary.performances],
    });
  }
  return [...byTitle.values()];
}

async function run(): Promise<SyncedPlay[]> {
  const [detailUrls, genreBySlug] = await Promise.all([fetchProductionIndex(), fetchGenreBySlug()]);

  const occurrencesByUrl = new Map<string, CalendarOccurrence[]>();
  for (const { yyyymm, year, month } of monthsAhead(PERFORMANCE_MONTHS)) {
    for (const occ of await fetchCalendarMonth(yyyymm, year, month)) {
      if (!occurrencesByUrl.has(occ.detailUrl)) occurrencesByUrl.set(occ.detailUrl, []);
      occurrencesByUrl.get(occ.detailUrl)!.push(occ);
    }
  }

  const plays: SyncedPlay[] = [];
  for (const detailUrl of detailUrls) {
    const slug = slugOf(detailUrl);
    // Carrying no genre term at all is what separates real productions from
    // the theater's talks and building tours — see the file header.
    if (!genreBySlug.has(slug)) continue;

    const details = await fetchProductionDetails(detailUrl);
    const occurrences = occurrencesByUrl.get(detailUrl) ?? [];
    const genre = genreBySlug.get(slug) || occurrences.find((o) => o.genre)?.genre || FALLBACK_GENRE;

    plays.push({
      sourceKey: slug,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.csokonaiDebrecen,
      genre,
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      // Csokonai's site publishes only the current repertoire — there is no
      // archive section to mirror, unlike Örkény's.
      isArchived: false,
      cast: details.cast,
      performances: occurrences.map((occ) => {
        // The calendar renders Budapest wall-clock time with no offset. The
        // source key stays on that local string — it is stable across DST and
        // keeps matching rows written before this was converted, so those get
        // their time corrected in place rather than orphaned under a new key.
        const local = `${occ.year}-${String(occ.month).padStart(2, "0")}-${String(occ.day).padStart(2, "0")}T${occ.time}:00`;
        return { sourceKey: `${slug}:${local}`, startsAt: budapestLocalToUtcIso(local), room: occ.room };
      }),
    });
  }

  const merged = mergeDuplicateTitles(plays);
  dropSharedPosters(merged);
  return merged;
}

export const csokonaiAdapter: SyncAdapter = { name: "csokonai", run };
