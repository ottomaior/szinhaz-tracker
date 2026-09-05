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
 * The one field this source does not publish anywhere reachable is the cast.
 * There is no per-production endpoint (`?slug=` is accepted and ignored), the
 * production page makes no further API call, and the flight payload holds only
 * the word "Szereposztás" rather than any names. So these productions arrive
 * without a cast list, and search over performers will not find them. That is
 * a real gap, and better than inventing one.
 */
import { fetchJson } from "../lib/http";
import { budapestLocalToUtcIso } from "../lib/huDate";
import { normalizeText, stripHtml } from "../lib/normalize";
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
  occurrences: { startsAt: string; room?: string }[]
): SyncedPlay | undefined {
  const title = hu(production.title);
  const slug = hu(production.slug);
  if (!title || !slug) return undefined;

  const directors = [personName(production.director), personName(production.director2)].filter(Boolean);

  return {
    sourceKey: slug,
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
    // Not published anywhere reachable on this source. See the file header.
    cast: [],
    performances: occurrences.map((o) => ({
      sourceKey: `${slug}:${o.startsAt}`,
      startsAt: o.startsAt,
      room: o.room,
    })),
  };
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

    const play = toSyncedPlay(production, genreById, occurrencesByProduction.get(production.id) ?? []);
    if (play) plays.push(play);
  }

  return plays;
}

export const vigszinhazAdapter: SyncAdapter = { name: "vigszinhaz", run };
