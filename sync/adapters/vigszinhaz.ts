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
 * Everyone the theatre has ever credited: 3,120 people, returned in one
 * request. The cast on a production page names them by id and nothing else,
 * so this directory is what turns those ids back into names.
 */
const PERSON_LIMIT = 4000;

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

/** One person as `/api/programme/persons` returns them. */
type RawPersonRecord = { id: number; full_name?: Localized };

/**
 * The cast as the production page's data payload carries it.
 *
 * A group is a block on the page — the performers, a chorus, the band, the
 * creative team, the director — and each of its `members` is one credit: a
 * role and the people covering it, by id. Two or more ids under one role are
 * alternates.
 */
type RawCastGroup = {
  value?: {
    group_name_hu?: string | null;
    group_tye?: string | null; // the source's own spelling
    members?: { role_name_hu?: string | null; members?: number[] }[] | null;
  } | null;
};

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
 * The page's data payload, reassembled.
 *
 * Next.js streams a page as a series of `self.__next_f.push([1,"…"])` calls,
 * each carrying a JSON-escaped slice of one long string. Concatenating them in
 * document order gives that string back, and the production's own data —
 * including its cast — is in there whichever way the page happened to render.
 */
export function flightPayload(html: string): string {
  const chunk = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = chunk.exec(html))) {
    try {
      parts.push(JSON.parse(match[1]) as string);
    } catch {
      // One unparseable slice is not worth losing the rest of the page over.
    }
  }
  return parts.join("");
}

/**
 * The balanced JSON value beginning at `start`, which must be a `[` or a `{`.
 *
 * The payload is one long string with JSON embedded in it rather than a JSON
 * document, so the end of a value has to be found by counting brackets.
 * Quotes and their escapes are tracked because a `]` inside a role name — and
 * Hungarian titles do contain brackets — would otherwise end the scan early.
 */
function balancedValue(text: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return undefined;
}

/**
 * The cast, read from the page's data rather than from its markup.
 *
 * This exists because the markup cannot be relied on. The site renders a
 * production page two ways and which one a request gets varies: sometimes the
 * cast section is finished HTML, and sometimes it is a `<template>`
 * placeholder whose contents the browser assembles from the streamed payload.
 * The HTML parser below reads the first and sees nothing in the second, which
 * is why *„Ha majd egyszer mindenki visszajön…"* showed no cast in the app
 * while showing fifty-seven names on the theatre's own site — and why *Toldi*
 * and *A padlás* appeared to lose and regain their casts between runs. That
 * was diagnosed as a flaky server; it was two rendering modes.
 *
 * The payload is present in both modes, so this is deterministic. It is also
 * better structured than the markup: a role can name several people, which is
 * how alternates arrive, and the groups distinguish the company from a chorus,
 * a band and the creative team.
 *
 * People arrive as ids and are resolved against `/api/programme/persons`,
 * fetched once per run. An id that resolves to nobody is dropped rather than
 * stored as a number.
 */
export function parseCastPayload(html: string, nameById: Map<number, string>): { name: string; role: string }[] | undefined {
  const payload = flightPayload(html);
  const key = '"cast":[';
  const at = payload.indexOf(key);
  if (at < 0) return undefined;

  const json = balancedValue(payload, at + key.length - 1);
  if (!json) return undefined;

  let groups: RawCastGroup[];
  try {
    groups = JSON.parse(json) as RawCastGroup[];
  } catch {
    return undefined;
  }

  const cast: { name: string; role: string }[] = [];
  for (const group of groups) {
    const value = group?.value;
    if (!value) continue;
    const groupName = normalizeText(value.group_name_hu) ?? "";

    for (const credit of value.members ?? []) {
      const printedRole = normalizeText(credit.role_name_hu) ?? "";
      /*
       * A production that credits its company without naming parts repeats
       * the group's own heading on every row, so the role arrives as
       * "Szereplők" eighteen times. Stored per person that plural reads
       * wrongly, and "Szereplő" is what csokonai.ts, katona-wp.ts and
       * vojtina.ts already call exactly this. Only the performers' group is
       * treated this way: "Kórus" and "Zenekar" are right as they are.
       */
      const isEnsembleLabel = !printedRole || (value.group_tye === "actors" && printedRole === groupName);
      const role = isEnsembleLabel ? (value.group_tye === "actors" ? "Szereplő" : groupName) : printedRole;
      if (!role) continue;

      for (const id of credit.members ?? []) {
        const name = nameById.get(id);
        if (name) cast.push({ name, role });
      }
    }
  }

  return cast.length ? cast : undefined;
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
 * Undefined whenever the page yields nobody, which on this source is never a
 * statement that nobody is in it.
 *
 * Under a run of several hundred requests this site returns partial pages,
 * and it does so in two shapes: sometimes the whole cast section is missing,
 * sometimes the section is there with no names inside it. Both were seen in
 * one afternoon — *Toldi* came back sectionless three times, and *Sommerreise*
 * and *A csárdáskirálynő* came back with an empty section on a later run,
 * which cost them their stored credits before this said so. Neither shape can
 * be told apart from a genuinely uncredited production, and the productions
 * that genuinely credit nobody are galas and festival nights that carry no
 * section either.
 *
 * So the honest reading is that this source can add a cast and never remove
 * one: an empty answer means "ask again", not "there is nobody". Undefined
 * leaves the stored rows alone — see `cast` in sync/lib/types.ts — and a
 * production whose cast really is withdrawn keeps a stale one until somebody
 * notices, which is much the smaller failure.
 */
export function parseProductionCast(html: string): { name: string; role: string }[] | undefined {
  const $ = cheerio.load(html);
  const cast: { name: string; role: string }[] = [];

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

  return cast.length ? cast : undefined;
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

/** The id-to-name directory the cast payload is written against. */
async function fetchPersonNames(): Promise<Map<number, string>> {
  const people = itemsOf(
    await fetchJson<RawPersonRecord[] | { items?: RawPersonRecord[] }>(`${SITE_URL}/api/programme/persons?limit=${PERSON_LIMIT}`, {
      crawlDelayMs: CRAWL_DELAY_MS,
    })
  );

  const byId = new Map<number, string>();
  for (const person of people) {
    const name = hu(person.full_name);
    if (person.id != null && name) byId.set(person.id, name);
  }
  return byId;
}

/**
 * One production's cast, or undefined if its page did not yield one.
 *
 * The payload is read first and the markup only as a fallback, because the
 * payload is there however the page rendered while the markup is there only
 * sometimes — see `parseCastPayload`. Keeping the markup path costs nothing
 * and covers the case where the page's shape changes but its HTML does not.
 *
 * A dead or moved page is not a cast of nobody. Returning undefined for it
 * keeps whatever is already stored, so a single 404 in a run of hundreds
 * costs a warning rather than a production's whole credit list.
 */
async function fetchCast(slug: string | undefined, nameById: Map<number, string>): Promise<{ name: string; role: string }[] | undefined> {
  if (!slug) return undefined;

  try {
    const html = await fetchText(`${SITE_URL}/hu/produkciok/${slug}`, { crawlDelayMs: CRAWL_DELAY_MS });
    return parseCastPayload(html, nameById) ?? parseProductionCast(html);
  } catch (e) {
    console.warn(`[vigszinhaz] ${slug}: cast page unreadable (${e instanceof Error ? e.message : String(e)})`);
    return undefined;
  }
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

  // One request for the whole person directory, because every cast page names
  // its people by id and nothing else.
  const nameById = await fetchPersonNames();

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
    const cast = DEEP || isCurrent ? await fetchCast(hu(production.slug), nameById) : undefined;

    const play = toSyncedPlay(production, genreById, occurrences, cast);
    if (play) plays.push(play);
  }

  return plays;
}

export const vigszinhazAdapter: SyncAdapter = { name: "vigszinhaz", run };
