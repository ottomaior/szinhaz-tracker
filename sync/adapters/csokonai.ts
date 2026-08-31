/**
 * Csokonai Nemzeti Színház (Debrecen) — scraped from the theater's own
 * WordPress site, not Jegymester. Their Jegymester-hosted ticketing site
 * (jegy.csokonaiszinhaz.hu) has the same "requires access token" wall as
 * Katona's (see sync/adapters/jegymester.ts) — this adapter avoids that
 * entirely by reading the calendar and per-show pages Csokonai's own site
 * already renders as plain server-side HTML. robots.txt for
 * csokonaiszinhaz.hu is fully permissive.
 *
 * Two-step scrape, both verified against live pages before writing this:
 *  1. `/naptar/?month=YYYYMM` — a calendar of performances (date, time,
 *     room, genre, and a link to the production's own page). Grouped by
 *     that link to get one play per unique production.
 *  2. Each production's own `/eloadasok/{slug}` page — much richer than
 *     the calendar: full synopsis, director, runtime/intermissions, a
 *     real poster (`og:image`), and a structured cast list.
 *
 * Field locations (title/author split, director, runtime, cast) were read
 * off actual page HTML, not guessed — see the selectors below. WordPress
 * themes do sometimes change markup, so if this silently starts returning
 * 0 plays, that's the first thing to check.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://csokonaiszinhaz.hu";
const CRAWL_DELAY_MS = 800; // polite pacing; robots.txt sets no explicit Crawl-delay

// These titles are "SeriesName: Real Title" — a talk/tour/participatory
// series built around a production, not the production itself (the same
// pattern as Örkény's "Nyílt próba:"/"Intró:" ancillary events, confirmed
// live: they have no author/director and duplicate a real production's
// listing under a different name). Filtered by title prefix since Csokonai's
// calendar doesn't expose a tag/category field the way Örkény's API does.
const ANCILLARY_TITLE_PREFIXES = ["Csokonai Társalgó", "Színházbejárás", "Csokonai közTér"];

function isAncillaryTitle(title: string): boolean {
  return ANCILLARY_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix));
}

type CalendarOccurrence = {
  detailUrl: string;
  title: string;
  year: number;
  month: number;
  day: number;
  time: string; // "HH:MM"
  room?: string;
  genre?: string;
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

function parseDurationHu(text: string): { runtimeMinutes?: number; intermissions?: number } {
  const hourMatch = text.match(/(\d+)\s*óra/);
  const minMatch = text.match(/(\d+)\s*perc/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minMatch ? Number(minMatch[1]) : 0;
  const runtimeMinutes = hours * 60 + minutes || undefined;

  let intermissions: number | undefined;
  if (/szünet nélkül/i.test(text)) intermissions = 0;
  else if (/egy szünettel/i.test(text)) intermissions = 1;
  else {
    const countMatch = text.match(/(\d+)\s*szünettel/i);
    if (countMatch) intermissions = Number(countMatch[1]);
  }
  return { runtimeMinutes, intermissions };
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
    const title = titleP.text().trim();
    const detailUrl = titleP.closest("a").attr("href");
    if (!day || !time || !title || !detailUrl || isAncillaryTitle(title)) return;

    let room: string | undefined;
    $el.find("p").each((_, p) => {
      const t = $(p).text();
      if (t.startsWith("Játszóhely:")) room = t.replace("Játszóhely:", "").trim();
    });
    // For some guest/touring shows the site puts the venue name in this
    // slot instead of a real genre (confirmed live on outdoor-stage guest
    // performances) — discard it in that case rather than storing a venue
    // name as a play's genre.
    const rawGenre = $el.find("span.uk-text-bold.uk-text-uppercase.uk-text-muted").first().text().trim();
    const genre = rawGenre && rawGenre !== room ? rawGenre : undefined;

    occurrences.push({ detailUrl, title, year, month, day, time, room, genre });
  });

  return occurrences;
}

async function fetchProductionDetails(url: string): Promise<{
  title: string;
  author: string;
  synopsis?: string;
  director: string;
  runtimeMinutes?: number;
  intermissions?: number;
  posterUrl?: string;
  cast: { name: string; role: string }[];
}> {
  const html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
  const $ = cheerio.load(html);

  const rawTitle = $("title").first().text().replace(/\s*[–-]\s*Csokonai Nemzeti Színház Debrecen\s*$/i, "").trim();
  const colonIndex = rawTitle.indexOf(": ");
  const author = colonIndex > -1 ? rawTitle.slice(0, colonIndex).trim() : "";
  const title = colonIndex > -1 ? rawTitle.slice(colonIndex + 2).trim() : rawTitle;

  // Matches "Rendező:" and variants like "Rendező-koreográfus:" (seen on
  // dance-program pages) — anything starting with "Rendező" up to the colon.
  let director = "";
  $("strong").each((_, el) => {
    const t = $(el).text();
    const m = t.match(/^Rendező[^:]*:\s*(.+)$/);
    if (m) director = m[1].trim();
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
    .filter((t) => t && !/^Rendező[^:]*:/.test(t) && !t.includes("kettőzött szerepek"))
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

  return { title, author, synopsis: synopsis || undefined, director, runtimeMinutes, intermissions, posterUrl, cast };
}

async function run(): Promise<SyncedPlay[]> {
  const occurrencesByDetailUrl = new Map<string, CalendarOccurrence[]>();

  for (const { yyyymm, year, month } of monthsAhead(3)) {
    const occurrences = await fetchCalendarMonth(yyyymm, year, month);
    for (const occ of occurrences) {
      if (!occurrencesByDetailUrl.has(occ.detailUrl)) occurrencesByDetailUrl.set(occ.detailUrl, []);
      occurrencesByDetailUrl.get(occ.detailUrl)!.push(occ);
    }
  }

  const plays: SyncedPlay[] = [];
  for (const [detailUrl, occurrences] of occurrencesByDetailUrl) {
    const slug = detailUrl.replace(/\/+$/, "").split("/").pop() || detailUrl;
    const details = await fetchProductionDetails(detailUrl);

    plays.push({
      sourceKey: slug,
      title: details.title || occurrences[0].title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.csokonaiDebrecen,
      genre: occurrences[0].genre || "dráma",
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      cast: details.cast,
      performances: occurrences.map((occ) => {
        const startsAt = `${occ.year}-${String(occ.month).padStart(2, "0")}-${String(occ.day).padStart(2, "0")}T${occ.time}:00`;
        return { sourceKey: `${slug}:${startsAt}`, startsAt, room: occ.room };
      }),
    });
  }

  return mergeDuplicateTitles(plays);
}

// The calendar sometimes links the same production from two different
// detail pages (confirmed live: "A Pál utcai fiúk" had both an older page
// with no "Rendező:" line and a newer, fuller one) — same show, two
// listings. Merged here by normalized title rather than left as separate
// plays, keeping whichever version has a director filled in and combining
// both sets of performances.
function mergeDuplicateTitles(plays: SyncedPlay[]): SyncedPlay[] {
  const byTitle = new Map<string, SyncedPlay>();
  for (const play of plays) {
    const key = play.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, play);
      continue;
    }
    const keepNew = !existing.director && !!play.director;
    const primary = keepNew ? play : existing;
    const secondary = keepNew ? existing : play;
    byTitle.set(key, { ...primary, performances: [...primary.performances, ...secondary.performances] });
  }
  return Array.from(byTitle.values());
}

export const csokonaiAdapter: SyncAdapter = { name: "csokonai", run };
