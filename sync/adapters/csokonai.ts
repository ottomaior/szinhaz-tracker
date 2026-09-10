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
import { titleKey } from "../lib/normalize";
import { parseDurationHu } from "../lib/huDuration";
import { splitPerformers } from "../lib/performers";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://csokonaiszinhaz.hu";
const CRAWL_DELAY_MS = 800; // polite pacing; robots.txt sets no explicit Crawl-delay
const MAX_INDEX_PAGES = 25; // generous ceiling; the index is 4 pages today
/**
 * How far ahead to walk the calendar for showtimes.
 *
 * Six months rather than three. A theatre publishes its next season in one
 * go, months before it starts, and a three-month window meant that
 * announcement was invisible until it had almost arrived — the catalogue held
 * dates two months out at most, so half the productions listed as "Műsoron"
 * had nothing to show when asked when they play. Months with nothing in them
 * cost one request each and return an empty page, which is a cheap way to be
 * ready the day the rest of the season goes up.
 */
const PERFORMANCE_MONTHS = 6;

/**
 * Taxonomy terms that describe *where* a show plays rather than what kind of
 * show it is. "Nagyerdei Szabadtéri Színpad" is the theater's outdoor stage;
 * it sits in the same taxonomy as próza/zenés/tánc and also turns up in the
 * calendar's genre slot, so it must not be stored as a play's genre.
 */
const VENUE_TERM_SLUGS = new Set(["nagyerdei-szabadteri-szinpad"]);

/*
 * There is deliberately no fallback genre.
 *
 * This used to be `const FALLBACK_GENRE = "színház"` — the bare word
 * "theatre", written onto any production whose only taxonomy term was a venue
 * term. It is true of everything in the catalogue and so distinguishes
 * nothing, and because it looked exactly like a real taxonomy term it could
 * not be told apart from one downstream. Reporting undefined lets
 * 0016_genre_taxonomy.sql record an honest "unknown" instead.
 *
 * Note that the *presence* of a slug in genreBySlug still matters and is
 * unchanged: carrying no term at all is what separates real productions from
 * the theatre's talks and building tours. Only the stored value goes away.
 */

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
  /**
   * The line the house prints under the title, verbatim.
   *
   * One slot carrying several kinds of thing: the classic Hungarian genre
   * subtitle (`daljáték`, `operett`, `tragikomédia`), a descriptive one
   * (`énekkari próba`), or — the case this was captured for — whose production
   * it is (`a Kolozsvári Állami Magyar Színház előadása`).
   *
   * Stored raw as well as interpreted, deliberately. `guestCompany()` below is
   * a heuristic over Hungarian phrasing, and T-008 in ISSUES.md is the standing
   * lesson that a heuristic does not know when it has stopped being right.
   * Keeping the line itself means a better reading of it can be applied later
   * without re-scraping 1,200 pages.
   */
  subtitle?: string;
  cast: { name: string; role: string }[];
};

/**
 * The company that made this production, when the subtitle says it is not the
 * house whose page this is.
 *
 * Csokonai hosts other companies — the MagdaFeszt programme, touring shows on
 * the Nagyerdei open-air stage — and files them among its own productions.
 * Until this existed the catalogue did too: `Abigél` is the Kolozsvári Állami
 * Magyar Színház's staging directed by Eszenyi Enikő, and the app credited it
 * to Csokonai, which also handed twelve of `Az a szép, fényes nap`'s performers
 * a Csokonai credit on their person pages.
 *
 * The tell is the possessive: *"a X előadása"* — X's performance — as against
 * *"közösségi színházi előadás"*, a description of a kind of evening, which
 * ends in the bare noun and is deliberately not matched. Checked against the
 * September and October calendars (32 productions, 2 matches: the Kolozsvári
 * and Szigligeti guests) and against the four recorded fixtures, where the
 * Pécsi Balett's archived guest run matches and `daljáték` and `operett` do
 * not. That is the whole evidence base; a Hungarian theatre will eventually
 * phrase this some other way, and nothing here will notice.
 */
export function guestCompany(subtitle?: string): string | undefined {
  if (!subtitle) return undefined;
  const match = subtitle.trim().match(/^(?:(?:a|az)\s+)?(.+?)\s+előadása$/i);
  if (!match) return undefined;
  const company = match[1].trim();
  // A one- or two-letter capture is a parse accident rather than a company.
  return company.length >= 3 ? company : undefined;
}

/**
 * `guestCompany()`, minus the house itself.
 *
 * A page may say *"a Csokonai Nemzeti Színház előadása"* about its own
 * production — a statement of authorship, not of visiting. The parser cannot
 * make that distinction because it does not know whose site it is reading;
 * both adapters here do, because both are Csokonai's.
 */
export function visitingCompany(subtitle?: string): string | undefined {
  const company = guestCompany(subtitle);
  if (!company) return undefined;
  return /csokonai/i.test(company) ? undefined : company;
}

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

export function slugOf(detailUrl: string): string {
  return detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

/** Every production detail URL on the paginated repertoire index. */
export async function fetchProductionIndex(): Promise<string[]> {
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
          // Empty string, not a placeholder word: the slug being *present* is
          // what marks this as a real production, and the value is the genre
          // only when the term actually carried a readable label.
          genreBySlug.set(slug, VENUE_TERM_SLUGS.has(termSlug) ? "" : label || "");
        }
      }
      if (!added) break;
    }
  }

  return genreBySlug;
}

export function productionLinksIn(html: string): string[] {
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
  return parseProductionDetails(html);
}

/**
 * Turns one production page into its details.
 *
 * Separated from fetching so it can be run against a recorded page in
 * sync/adapters/csokonai.test.ts — the selectors here were derived from live
 * markup, and a fixture is what will catch the site changing under them.
 */
export function parseProductionDetails(html: string): ProductionDetails {
  const $ = cheerio.load(html);

  const rawTitle = $("title").first().text().replace(/\s*[–-]\s*Csokonai Nemzeti Színház Debrecen\s*$/i, "").trim();
  const colonIndex = rawTitle.indexOf(": ");
  const author = colonIndex > -1 ? rawTitle.slice(0, colonIndex).trim() : "";
  const title = colonIndex > -1 ? rawTitle.slice(colonIndex + 2).trim() : rawTitle;

  /*
   * The line under the title.
   *
   * Anchored on being the first `<p>` after the `<h1>` rather than on a class,
   * because the class is not stable: the same line is `uk-margin-remove` in the
   * calendar and `uk-margin-remove uk-light` on a production page. It sits
   * outside `<article>`, so it has never been part of the synopsis and reading
   * it does not change that field.
   *
   * The length guard is for pages that do not carry a subtitle at all, where
   * the first paragraph after the heading is the opening of the prose.
   */
  const subtitleText = $("h1").first().nextAll("p").first().text().trim().replace(/\s+/g, " ");
  const subtitle = subtitleText && subtitleText.length <= 120 ? subtitleText : undefined;

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
    /*
     * Every performer covering the part, not just the first of them.
     *
     * This used to be `nameField.split("/")[0]`, so everyone else who covers
     * a role was parsed and then thrown away: Gianni Schicchi lost Beeri
     * Benjámin, Faluvégi Fanni and Donkó Imre, none of whom then appeared
     * anywhere in the catalogue. `splitPerformers` decides where the
     * boundaries are, and each name gets a row of its own against the same
     * character.
     *
     * The guest marker is trimmed per performer rather than per field,
     * because it is printed after each of them ("Körmendy Flórián m.v./
     * Beeri Benjámin m.v."). Doing it at all is this source's own habit and
     * not the catalogue's convention — Katona, Nemzeti and Örkény all store
     * "m.v." as printed — but it is what these 2000 rows already look like,
     * and unifying the two is a decision about display, not about parsing.
     */
    /*
     * Every name element in the row, not just the first.
     *
     * The page prints a role's performers two different ways, and the two
     * used to be handled differently. Guests are one string in one element —
     * "Körmendy Flórián m.v./ Beeri Benjámin m.v." — which `splitPerformers`
     * divides. Company members are one element *each*, every one linked to
     * their page under /tarsulat/, so Pünkösdi Kató in Csókos asszony is two
     * `<p>`s: Berkó Boglárka, then Faluvégi Fanni. `.first()` read the first
     * and threw the rest away, on every Csokonai production, current and
     * archived, which is 203 roles in the catalogue at the time of writing.
     */
    const nameFields = $row
      .find("p.uk-text-secondary")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    if (!role || nameFields.length === 0) return;
    for (const nameField of nameFields) {
      for (const performer of splitPerformers(nameField)) {
        const name = performer.replace(/\bm\.\s*v\.\s*$/, "").trim();
        if (name) cast.push({ role, name });
      }
    }
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
    subtitle,
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
export function mergeDuplicateTitles(plays: SyncedPlay[]): SyncedPlay[] {
  const byTitle = new Map<string, SyncedPlay>();

  for (const play of plays) {
    // titleKey folds case, accents and punctuation, so "Dante: Pokol" and
    // "Dante – Pokol" are recognised as one production. The previous key was a
    // plain lowercase trim, which treated them as two.
    const key = titleKey(play.title);
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, play);
      continue;
    }

    const score = (p: SyncedPlay) => (p.director ? 2 : 0) + (p.premiereDate ? 1 : 0) + (p.cast?.length ? 1 : 0);
    const keepNew = score(play) > score(existing);
    const primary = keepNew ? play : existing;
    const secondary = keepNew ? existing : play;

    byTitle.set(key, {
      ...primary,
      // Identity is deliberately NOT the winner's key. Scores are computed
      // from scraped metadata, so a director appearing on one of the two pages
      // one day was enough to flip the winner — and with it the source key.
      // The old row then looked stale to reconcile() and was deleted or
      // archived while a fresh one appeared under a new id, stranding any
      // review on the discarded copy. Taking the lexicographically smaller key
      // makes identity depend only on which pages exist, not on how complete
      // they happen to be today.
      sourceKey: primary.sourceKey < secondary.sourceKey ? primary.sourceKey : secondary.sourceKey,
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
    const genre = genreBySlug.get(slug) || occurrences.find((o) => o.genre)?.genre || undefined;

    plays.push({
      sourceKey: slug,
      sourceUrl: detailUrl,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.csokonaiDebrecen,
      genre,
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      subtitle: details.subtitle,
      producedBy: visitingCompany(details.subtitle),
      posterUrl: details.posterUrl,
      // Everything this adapter returns is current repertoire. The claim that
      // used to stand here — that Csokonai has no archive to mirror — was
      // wrong: /archivum/ lists roughly 190 past productions, and
      // sync/adapters/csokonai-archive.ts now mirrors them.
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
