/**
 * Vígszínház (Budapest) — read from the theatre's own JSON API.
 *
 * The site is a Next.js app whose pages render client-side, which is why an
 * earlier pass filed this source as "structure mapped, adapter not written":
 * fetching `/hu/produkciok/{slug}` gets a navigation shell and a footer. The
 * production data is not in the RSC flight payload either — that carries only
 * the interface's own label dictionary.
 *
 * What the app actually calls is `/api/programme/`, and it is the richest
 * source in the catalogue:
 *
 *  - `/api/programme/productions?limit=N` — 500 productions, each with a
 *    premiere date, a runtime in minutes, an interval count, a director as a
 *    structured person, a genre id and the house it played in. Without a
 *    `limit` the endpoint returns a bare array of the first 100; with one it
 *    returns `{items, count}`, which is the form this uses.
 *  - `/api/programme/events?limit=N` — every performance, past and future,
 *    each carrying its whole production inline.
 *  - `/api/programme/genres` — the id/name map the productions' `genre` field
 *    points into.
 *
 * robots.txt is `User-agent: * / Allow: /`.
 *
 * ## The cast, which used to be missing
 *
 * This adapter shipped without one. The API publishes no cast at any endpoint
 * — there is no per-production route, `?slug=` is accepted and ignored — and
 * the production page was, when this was first written, a navigation shell
 * whose flight payload held the word "Szereposztás" and no names. So 579
 * productions arrived with nobody in them, which is what T-007 in ISSUES.md
 * was about: the largest house in the catalogue, invisible to a search for a
 * performer.
 *
 * Rechecked on 10 September 2026 and no longer true. `/hu/produkciok/{slug}`
 * is server-rendered now, and `section.ProductionCast_block…` carries the
 * whole thing: a `<dt>` per part, a `<dd>` of performer chips under it, the
 * creative team in the same list under their own labels, alternates as
 * several chips beneath one part, and guests marked with an `m.v.` span
 * inside the name. So the cast is read from HTML while everything else stays
 * on the API, which is the one thing this source does better than any other.
 *
 * That page is fetched per production, so a run reads the current repertoire
 * (55 pages) and says nothing about the back catalogue, which is closed
 * productions whose casts will not change again. `--deep` reads all of them;
 * see `DEEP` in sync/lib/options.ts and `cast` in sync/lib/types.ts for why
 * "did not look" has to be distinguishable from "found nobody".
 */
import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "../lib/http";
import { budapestLocalToUtcIso } from "../lib/huDate";
import { normalizeText, stripHtml } from "../lib/normalize";
import { DEEP } from "../lib/options";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const SITE_URL = "https://vigszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/** Generous ceilings; the catalogue is 500 productions and 785 events today. */
const PRODUCTION_LIMIT = 1500;
const EVENT_LIMIT = 3000;

/**
 * The company's own houses.
 *
 * The productions endpoint reaches back decades and includes work the company
 * staged at other people's theatres — the Magyar Néphadsereg Színháza, the
 * Ódry Színpad, the Népopera, a circus tent. Those are real productions but
 * they did not happen here, and importing them would put a century of other
 * venues' programmes inside this one venue's row.
 *
 * "Vígszínház, ideiglenesen a Rádius épületében" is included deliberately: the
 * company played in the Rádius building while its own was unusable, and the
 * name says it is still the Vígszínház.
 */
const OWN_HOUSES = /^(vígszínház|pesti színház|házi színpad|víg szalon)/i;

/**
 * How far back to take the archive.
 *
 * This API goes back to 1890 — 1364 productions at the company's own houses,
 * 70 of them from the 1890s. All of it is real, and none of it is useful here:
 * the app exists so someone can log a play they have seen, and nobody using it
 * saw the 1897 season. Importing the lot would also make one venue four times
 * the size of the rest of the catalogue put together.
 *
 * 1960 is the boundary because it is roughly the earliest a living
 * theatregoer could have been in the audience, and it leaves 579 productions —
 * the same order of magnitude as Csokonai's 211 and Örkény's 197. Change this
 * one number to take more or less.
 */
const EARLIEST_PREMIERE_YEAR = 1960;

type Localized = { hu?: string | null; en?: string | null };

type RawPerson = { full_name?: Localized } | null;

type RawImage = { original?: { url?: string | null } | null } | null;

type RawProduction = {
  id: number;
  title?: Localized;
  authors?: Localized;
  slug?: Localized;
  length?: number | null;
  number_of_intervals?: number | null;
  premiere_date?: string | null;
  genre?: number | null;
  short_description?: Localized;
  list_image?: RawImage;
  location?: { name?: Localized } | null;
  director?: RawPerson;
  director2?: RawPerson;
  is_published?: boolean;
  is_visible?: boolean;
};

type RawEvent = {
  start_date?: string | null;
  start_time?: string | null;
  start_date_and_time?: string | null;
  location?: { name?: Localized } | null;
  production?: RawProduction | null;
  is_visible?: boolean;
};

type RawGenre = { id: number; name?: Localized };

/** The API returns `{items, count}` when given a limit and a bare array without. */
function itemsOf<T>(payload: T[] | { items?: T[] }): T[] {
  return Array.isArray(payload) ? payload : payload.items ?? [];
}

/**
 * The Hungarian text of a localized field.
 *
 * Guarded on the value's type rather than only on its presence. A few fields
 * on this API are a plain string where the schema suggests a `{hu, en}` pair,
 * and a couple are neither; passing one of those on to the text helpers throws
 * `text.replace is not a function` and takes the whole adapter run with it.
 */
function hu(value?: Localized | string | null): string | undefined {
  if (typeof value === "string") return normalizeText(value);
  const text = value?.hu ?? value?.en;
  return typeof text === "string" ? normalizeText(text) : undefined;
}

function personName(person?: RawPerson): string | undefined {
  return hu(person?.full_name);
}

function imageUrl(image?: RawImage): string | undefined {
  const path = image?.original?.url;
  if (typeof path !== "string" || !path) return undefined;
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

/** Same guard, for a field delivered as HTML. */
function huHtml(value?: Localized | string | null): string | undefined {
  if (typeof value === "string") return stripHtml(value);
  const text = value?.hu ?? value?.en;
  return typeof text === "string" ? stripHtml(text) : undefined;
}

export function isOwnHouse(locationName?: string): boolean {
  return !!locationName && OWN_HOUSES.test(locationName);
}

/**
 * The cast and creative team on a production page.
 *
 * The markup is a description list: `<dt>` is the part — "De la Mare,
 * államtitkár" for a character, "Díszlettervező" for a designer, the house
 * making no structural distinction between the two — and the `<dd>` under it
 * holds one `<article class="Chip…">` per person. Several chips under one
 * `<dt>` are alternates, and each gets its own row against the same part,
 * which is what `play_cast`'s (play_id, name, role) key exists for. *A Pál
 * utcai fiúk* is the case worth knowing: three Bokas, three Áts Feris, and a
 * seventeen-strong "Táncosok" line.
 *
 * The name is read from the chip's heading and not from the image's `alt`,
 * because a few chips carry an empty one; the `alt` is the fallback for the
 * reverse case. The guest marker lives in a `<span>` *inside* the heading, so
 * it is removed as an element rather than by matching text — `.text()` would
 * otherwise glue it to the surname and slug "Kovács Olivérm.v.".
 *
 * Undefined when the page carries no cast section at all, which is not the
 * same as a section listing nobody. Two things produce it: a gala or a
 * festival night that genuinely has no cast, and — the reason this
 * distinction is load-bearing — a shell page. Under a run of several hundred
 * requests this site occasionally answers 200 with the navigation and no
 * content, and *Toldi* returning "nobody is in it" would then delete the
 * twenty-two people who are. Undefined leaves the stored rows alone; see
 * `cast` in sync/lib/types.ts.
 */
export function parseProductionCast(html: string): { name: string; role: string }[] | undefined {
  const $ = cheerio.load(html);
  const cast: { name: string; role: string }[] = [];

  if (!$('section[class*="ProductionCast_block"]').length) return undefined;

  $('section[class*="ProductionCast_block"]')
    .find("dt")
    .each((_, dt) => {
      const $dt = $(dt);
      const role = normalizeText($dt.text()) ?? "";
      if (!role) return;

      // The immediate sibling only. A `<dt>` with no `<dd>` of its own would
      // otherwise borrow the next part's performers and credit them twice.
      const $dd = $dt.next("dd");

      $dd
        .find("article")
        .each((__, chip) => {
          const $chip = $(chip);
          const $name = $chip.find('h3[class*="Chip_name"]').first().clone();
          $name.find("span").remove();
          const name = normalizeText($name.text()) ?? normalizeText($chip.find("img").first().attr("alt")) ?? "";
          if (name) cast.push({ name, role });
        });
    });

  return cast;
}

/** A production that has been announced but has not opened yet. */
export function isUpcomingPremiere(premiereDate?: string | null, today = new Date()): boolean {
  if (!premiereDate) return false;
  const parsed = Date.parse(premiereDate);
  return !Number.isNaN(parsed) && parsed > today.getTime();
}

/** Whether the premiere is recent enough to be worth carrying. */
export function isRecentEnough(premiereDate?: string | null): boolean {
  // No date at all is kept: four productions lack one, and dropping a row for
  // a missing field would be a stricter rule than the one intended.
  if (!premiereDate) return true;
  const year = Number(premiereDate.slice(0, 4));
  return !Number.isFinite(year) || year >= EARLIEST_PREMIERE_YEAR;
}

/**
 * The instant a performance starts.
 *
 * `start_date_and_time` is already a real UTC instant on this API — a 19:00
 * curtain in September comes back as 17:00Z — which is unusual enough among
 * these sources to be worth stating. It is used as given, with the naive
 * `start_date` + `start_time` pair as a fallback for any row that lacks it;
 * that pair is Budapest wall-clock and is converted the same way every other
 * adapter here converts one.
 */
export function eventStartsAt(event: RawEvent): string | undefined {
  const absolute = event.start_date_and_time;
  if (absolute) {
    const parsed = Date.parse(absolute);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (event.start_date && event.start_time) {
    return budapestLocalToUtcIso(`${event.start_date}T${event.start_time}`);
  }
  return undefined;
}

export function toSyncedPlay(
  production: RawProduction,
  genreById: Map<number, string>,
  occurrences: { startsAt: string; room?: string }[],
  cast?: { name: string; role: string }[]
): SyncedPlay | undefined {
  const title = hu(production.title);
  const slug = hu(production.slug);
  if (!title || !slug) return undefined;

  const directors = [personName(production.director), personName(production.director2)].filter(Boolean);

  return {
    sourceKey: slug,
    /*
     * The page a person gets, not the one this adapter gets.
     *
     * The header above explains that fetching `/hu/produkciok/{slug}` returns a
     * navigation shell, which is why the data comes from `/api/programme/`
     * instead. That is a fact about a plain HTTP fetch: a browser runs the
     * client-side render and shows the real production page, so this is a
     * perfectly good address to send somebody to — it is only useless to us.
     */
    sourceUrl: `${SITE_URL}/hu/produkciok/${slug}`,
    title,
    author: hu(production.authors) ?? "",
    director: directors.join(" – "),
    venueId: VENUE_IDS.vigszinhaz,
    genre: production.genre != null ? genreById.get(production.genre) : undefined,
    runtimeMinutes: production.length ?? undefined,
    intermissions: production.number_of_intervals ?? undefined,
    premiereDate: production.premiere_date ?? undefined,
    synopsis: huHtml(production.short_description),
    posterUrl: imageUrl(production.list_image),
    /*
     * Whether this is still playable, read from the schedule rather than from
     * a flag.
     *
     * `is_published` looks like the field for this and is not: it is true for
     * 393 of the productions at these houses, where the theatre's own
     * repertoire page lists 57. It appears to mean "has a page on the site",
     * which every revival and every archived production also has.
     *
     * A future performance, or a premiere that has not happened yet, is the
     * signal that holds up. Everything else is the back catalogue, which
     * belongs here the same way Katona's and Csokonai's archives do —
     * searchable and loggable, kept out of the browse rails.
     */
    isArchived: occurrences.length === 0 && !isUpcomingPremiere(production.premiere_date),
    /*
     * Read from the production's own page, and left undefined when this run
     * did not open it — a shallow run's archive, or a page that 404s. The
     * runner leaves the stored rows alone in that case rather than clearing
     * them. See the file header and `cast` in sync/lib/types.ts.
     */
    cast,
    performances: occurrences.map((o) => ({
      sourceKey: `${slug}:${o.startsAt}`,
      startsAt: o.startsAt,
      room: o.room,
    })),
  };
}

/**
 * One production's cast, or undefined if its page did not yield one.
 *
 * A dead or moved page is not a cast of nobody. Returning undefined for it
 * keeps whatever is already stored, so a single 404 in a run of hundreds
 * costs a warning rather than a production's whole credit list.
 *
 * Asked twice when the first answer carries no cast section, because over a
 * run of several hundred requests this site returns the odd shell page — the
 * navigation, the footer, and none of the content, with a 200. Three
 * productions came back that way on the first full run and all three had a
 * full cast on a second ask. The retry costs one request each for the handful
 * of pages that genuinely have no cast, which is a gala or a festival night.
 */
async function fetchCast(slug?: string): Promise<{ name: string; role: string }[] | undefined> {
  if (!slug) return undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const html = await fetchText(`${SITE_URL}/hu/produkciok/${slug}`, { crawlDelayMs: CRAWL_DELAY_MS });
      const cast = parseProductionCast(html);
      if (cast) return cast;
    } catch (e) {
      console.warn(`[vigszinhaz] ${slug}: cast page unreadable (${e instanceof Error ? e.message : String(e)})`);
      return undefined;
    }
  }

  return undefined;
}

async function run(): Promise<SyncedPlay[]> {
  const genres = itemsOf(
    await fetchJson<RawGenre[] | { items?: RawGenre[] }>(`${SITE_URL}/api/programme/genres`, {
      crawlDelayMs: CRAWL_DELAY_MS,
    })
  );
  const genreById = new Map<number, string>();
  for (const genre of genres) {
    const name = hu(genre.name);
    if (name) genreById.set(genre.id, name);
  }

  const productions = itemsOf(
    await fetchJson<RawProduction[] | { items?: RawProduction[] }>(
      `${SITE_URL}/api/programme/productions?limit=${PRODUCTION_LIMIT}`,
      { crawlDelayMs: CRAWL_DELAY_MS }
    )
  );

  const events = itemsOf(
    await fetchJson<RawEvent[] | { items?: RawEvent[] }>(
      `${SITE_URL}/api/programme/events?limit=${EVENT_LIMIT}`,
      { crawlDelayMs: CRAWL_DELAY_MS }
    )
  );

  // Only what is still to come: the events feed carries every performance the
  // theatre has ever given, and `performances` is a table of dates someone
  // could still go to.
  const now = Date.now();
  const occurrencesByProduction = new Map<number, { startsAt: string; room?: string }[]>();
  for (const event of events) {
    const productionId = event.production?.id;
    if (productionId == null) continue;
    const startsAt = eventStartsAt(event);
    if (!startsAt || Date.parse(startsAt) < now) continue;

    const list = occurrencesByProduction.get(productionId) ?? [];
    list.push({ startsAt, room: hu(event.location?.name) });
    occurrencesByProduction.set(productionId, list);
  }

  const plays: SyncedPlay[] = [];
  for (const production of productions) {
    if (production.is_visible === false) continue;
    if (!isOwnHouse(hu(production.location?.name))) continue;
    if (!isRecentEnough(production.premiere_date)) continue;

    const occurrences = occurrencesByProduction.get(production.id) ?? [];
    /*
     * Whose cast page to open.
     *
     * Everything still playing or about to open, always: that is what
     * somebody browsing the app is looking at, and it is 55 pages. The back
     * catalogue only under `--deep`, because it is another 520 requests for
     * casts that closed years ago and cannot change again.
     *
     * The condition matches `isArchived` below rather than restating it, so
     * the two cannot drift into disagreeing about what "current" means.
     */
    const isCurrent = occurrences.length > 0 || isUpcomingPremiere(production.premiere_date);
    const cast = DEEP || isCurrent ? await fetchCast(hu(production.slug)) : undefined;

    const play = toSyncedPlay(production, genreById, occurrences, cast);
    if (play) plays.push(play);
  }

  return plays;
}

export const vigszinhazAdapter: SyncAdapter = { name: "vigszinhaz", run };
