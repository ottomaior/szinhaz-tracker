/**
 * Centrál Színház (Budapest) — scraped from the theatre's own site, with its
 * showtimes taken from an API rather than a page.
 *
 * Two things make this source unusually good. It publishes a real genre term
 * per production — "vígjáték", "dráma" — which almost none of the others do,
 * so these rows reach `genre_normalized` with `genre_source = 'source'` rather
 * than an assumption. And its archive is in the same index as its repertoire,
 * marked by an `-archiv` suffix on the slug, so the back catalogue costs one
 * extra pass over links already fetched instead of a second adapter.
 *
 * robots.txt is `User-agent: * / Disallow:` — an empty disallow, which permits
 * everything. The site occasionally closes a connection with no response at
 * all; `fetchText` retries, which is what that behaviour needs.
 *
 * Three passes:
 *  1. `/eloadasok/` — every production, live and archived.
 *  2. Each `/eloadas/{slug}/` page — the "szinlap" key/value block (author,
 *     director, premiere, stage), genre, synopsis, poster and cast.
 *  3. `/wp-json/tribe/events/v1/events` — showtimes.
 *
 * The site runs The Events Calendar, so its programme is available as JSON and
 * there is no month grid to parse. Its events are matched back to productions
 * by title rather than by slug: an event's slug carries an occurrence counter
 * ("furcsa-par-3", "my-fair-lady-18") and stripping a trailing number would
 * mangle any production whose own slug legitimately ends in one — the
 * repertoire contains "222".
 */
import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { normalizeText, stripHtml, titleKey } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://centralszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/** Bounds the paging loop; the calendar holds roughly 50 events per page. */
const MAX_EVENT_PAGES = 12;
const EVENTS_PER_PAGE = 50;

const PRODUCTION_HREF = /\/eloadas\/[^/?#]+\/?$/;

/**
 * The theatre files its past work in the same index as its repertoire, with
 * "-archiv" appended to the slug. That suffix is the only thing separating
 * "Oleanna" the production from "Oleanna" the archived production, and it is
 * what `is_archived` is set from — see 0005_archive_and_reconcile.sql.
 */
const ARCHIVE_SLUG = /-archiv$/;

type ProductionDetails = {
  title: string;
  author: string;
  director: string;
  genre?: string;
  synopsis?: string;
  runtimeMinutes?: number;
  intermissions?: number;
  premiereDate?: string;
  room?: string;
  posterUrl?: string;
  cast: { name: string; role: string }[];
};

/**
 * Reduces the label above the title to a single genre term.
 *
 * The slot is edited by hand and holds more than one thing on some pages:
 * "Bemutató, Színmű", "bemutató / színmű / vígjáték", "Családi". "Bemutató"
 * means the production is new this season — true, and useful, but a premiere
 * is not a genre and `plays.premiere_date` already records it. Splitting on
 * the separators and discarding that word leaves the real term.
 *
 * Everything is lowercased on the way out. The same word appears both ways
 * across the site ("Vígjáték" and "vígjáték"), and two spellings of one genre
 * would show up as two chips in the filter row.
 */
export function cleanGenre(raw?: string): string | undefined {
  if (!raw) return undefined;
  const terms = raw
    .split(/[,/|]+/)
    .map((t) => normalizeText(t)?.toLowerCase())
    .filter((t): t is string => !!t && !/^bemutató$/.test(t));
  return terms[0];
}

export function slugOf(detailUrl: string): string {
  return detailUrl.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

export function productionLinksIn(html: string): string[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, string>();
  $('a[href*="/eloadas/"]').each((_, el) => {
    const raw = ($(el).attr("href") ?? "").split("?")[0].split("#")[0];
    if (!PRODUCTION_HREF.test(raw)) return;
    const absolute = raw.startsWith("http") ? raw : `${BASE_URL}${raw}`;
    bySlug.set(slugOf(absolute), absolute.replace(/\/+$/, "") + "/");
  });
  return [...bySlug.values()];
}

export function parseProductionDetail(html: string): ProductionDetails | undefined {
  const $ = cheerio.load(html);

  const title = normalizeText($("h1.edgtf-st-title").first().text());
  if (!title) return undefined;

  // The genre sits directly above the title in the same block, as small grey
  // type: "vígjáték", "dráma". A real editorial field, not a layout artefact —
  // and rare enough among these sources to be worth taking care over.
  const genre = cleanGenre(normalizeText($("h6.edgtf-st-text").first().text()));

  // The playbill is a grid of key/value rows rather than a prose credit list,
  // which makes every field here an exact lookup rather than a guess.
  const fields = new Map<string, string>();
  $(".szinlap-row").each((_, el) => {
    const key = normalizeText($(el).find(".szinlap-key").first().text());
    const value = normalizeText($(el).find(".szinlap-value").first().text());
    if (key && value) fields.set(key.toLowerCase(), value);
  });

  const author = fields.get("szerző") ?? "";
  const director = fields.get("rendező") ?? "";
  const premiereDate = parseHungarianDate(fields.get("bemutató"));
  const room = fields.get("helyszín");

  const cast: { name: string; role: string }[] = [];
  $(".artist-card.szinesz").each((_, el) => {
    const name = normalizeText($(el).find(".artist-name").first().text());
    const role = normalizeText($(el).find(".artist-role").first().text());
    if (name) cast.push({ name, role: role ?? "" });
  });

  const synopsis = stripHtml($(".elementor-widget-text-editor").first().html() ?? undefined);

  /*
   * The runtime is a sentence in the body copy — "Az előadást egy szünettel
   * játsszuk, időtartama 2 óra 15 perc." — not a field of its own, and not
   * reliably inside the blurb widget either; on some pages it sits in a block
   * of its own between the synopsis and the content warnings.
   *
   * So the whole page is searched for the sentence containing "időtartam" and
   * only that sentence is parsed. Handing parseDurationHu a larger span is
   * what made this useless on the first pass: it takes the first "N perc" it
   * finds anywhere, and these pages also carry audience quotes, press extracts
   * and a note about the auditorium being kept at 20-21 °C.
   */
  const pageText = normalizeText($("body").text()) ?? "";
  const runtimeSentence =
    pageText.match(/[^.!?]*időtartam[^.!?]*[.!?]/i)?.[0] ?? pageText.match(/[^.!?]*szünet[^.!?]*[.!?]/i)?.[0];
  const { runtimeMinutes, intermissions } = parseDurationHu(runtimeSentence);

  const posterUrl = $('meta[property="og:image"], meta[name="og:image"]').first().attr("content");

  return {
    title,
    author,
    director,
    genre,
    synopsis,
    runtimeMinutes,
    intermissions,
    premiereDate,
    room,
    posterUrl: posterUrl || undefined,
    cast,
  };
}

type RawEvent = { title?: string; start_date?: string; url?: string };

export type EventOccurrence = { titleKey: string; startsAt: string };

/**
 * Turns the calendar's events into showtimes keyed by title.
 *
 * `start_date` is Budapest wall-clock time. The API also returns a
 * `utc_start_date`, and on this installation it is byte-identical to
 * `start_date` — the site's WordPress timezone is misconfigured, so trusting
 * the field named "utc" would put every performance two hours early. The local
 * value is converted properly instead, the same way every other adapter here
 * handles a naive timestamp.
 */
export function parseEvents(events: RawEvent[]): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  for (const event of events) {
    const title = normalizeText(event.title);
    const start = event.start_date;
    if (!title || !start) continue;
    out.push({ titleKey: titleKey(title), startsAt: budapestLocalToUtcIso(start) });
  }
  return out;
}

async function fetchAllEvents(): Promise<EventOccurrence[]> {
  const today = new Date().toISOString().slice(0, 10);
  const out: EventOccurrence[] = [];

  for (let page = 1; page <= MAX_EVENT_PAGES; page++) {
    const url =
      `${BASE_URL}/wp-json/tribe/events/v1/events` +
      `?per_page=${EVENTS_PER_PAGE}&page=${page}&start_date=${today}`;
    let payload: { events?: RawEvent[] };
    try {
      payload = await fetchJson<{ events?: RawEvent[] }>(url, { crawlDelayMs: CRAWL_DELAY_MS });
    } catch {
      // Past the last page the endpoint 404s rather than returning an empty
      // list, which is a normal end condition and not a failure.
      break;
    }
    const events = payload.events ?? [];
    if (events.length === 0) break;
    out.push(...parseEvents(events));
    if (events.length < EVENTS_PER_PAGE) break;
  }

  return out;
}

async function run(): Promise<SyncedPlay[]> {
  const indexHtml = await fetchText(`${BASE_URL}/eloadasok/`, { crawlDelayMs: CRAWL_DELAY_MS });
  const detailUrls = productionLinksIn(indexHtml);

  const occurrencesByTitle = new Map<string, EventOccurrence[]>();
  for (const occ of await fetchAllEvents()) {
    const list = occurrencesByTitle.get(occ.titleKey) ?? [];
    list.push(occ);
    occurrencesByTitle.set(occ.titleKey, list);
  }

  const plays: SyncedPlay[] = [];
  for (const url of detailUrls) {
    const slug = slugOf(url);
    const html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
    const details = parseProductionDetail(html);
    if (!details) continue;

    const isArchived = ARCHIVE_SLUG.test(slug);
    // An archived production has no upcoming dates by definition, and matching
    // by title would otherwise hand a revival's showtimes to the archived row
    // for the same play.
    const occurrences = isArchived ? [] : occurrencesByTitle.get(titleKey(details.title)) ?? [];

    plays.push({
      sourceKey: slug,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.central,
      genre: details.genre,
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      isArchived,
      cast: details.cast,
      performances: occurrences.map((o) => ({
        sourceKey: `${slug}:${o.startsAt}`,
        startsAt: o.startsAt,
        room: details.room,
      })),
    });
  }

  return plays;
}

export const centralAdapter: SyncAdapter = { name: "central", run };
