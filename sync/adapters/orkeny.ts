/**
 * Örkény István Színház — first-party JSON API the theater's own site calls.
 * Confirmed live and unrestricted by robots.txt.
 *
 * Driven by `/api/performances?lang=hu&limit=500`, which returns the whole
 * repertoire — 216 productions, including the theater's own archive going
 * back to 2002. An earlier version of this adapter walked `/api/month` and
 * treated whatever happened to be scheduled in the next three months as the
 * catalog, which found roughly a dozen. `/api/month` is still used, but only
 * for showtimes.
 *
 * `category_id` is what separates current work from history (labels read off
 * the `category` object on live rows):
 *   1 Bemutatók (8)          upcoming premieres
 *   2 Repertoár (39)         currently playing
 *   3 Kategorizálatlan (42)  uncategorised, treated as current
 *   4 Stream (6)             recordings, not stage productions — skipped
 *   5 Archívum (121)         past productions — synced with isArchived
 *
 * Three quirks verified against real responses, each of which a naive read
 * of the API gets wrong:
 *  1. `contributors`/`creators` are a JSON-encoded STRING of
 *     `{role, contributor: "<id>"}` pairs — the id refers to the separate
 *     `/api/contributors` directory, not an inline name.
 *  2. There is no runtime/intermission field; both are embedded in a
 *     free-text Hungarian tag ("Időtartam: 2h 50min egy szünettel").
 *  3. `premiere` is ISO on `/api/month` but Hungarian prose
 *     ("2020. szeptember 18.") on `/api/performances`. Switching endpoints
 *     without parsing that would null out every premiere date — and the
 *     archive contains at least one corrupt value ("0002. december 06." for
 *     A nagy füzet) that must not reach a date column.
 */
import { fetchJson } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { normalizeText, stripHtml } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const SITE_URL = "https://orkenyszinhaz.hu";
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
const REPERTOIRE_LIMIT = 500; // comfortably above the 216 that exist today

// Örkény publishes no Crawl-delay and this adapter makes only a handful of
// calls, but pacing them costs nothing and keeps every source treated alike.
const CRAWL_DELAY_MS = 300;

const CATEGORY_STREAM = 4;
const CATEGORY_ARCHIVE = 5;

/*
 * Örkény is a prose theatre, and nothing in the API carries a genre field.
 *
 * That second fact is the one this adapter reports. The theatre's profile is
 * recorded once, on the venue row (`venues.default_genre`), where the
 * classifier in 0016_genre_taxonomy.sql applies it and marks the result
 * `genre_source = 'venue_default'` — an assumption, labelled as one. Writing
 * "próza" here instead made the same assumption look like scraped metadata on
 * 194 productions.
 */

type Localized = { hu?: string | null; en?: string | null };

type RawContributor = { id: number; name: Localized };

type RawPerformance = {
  id: number;
  category_id?: number | null;
  title: Localized;
  author: Localized;
  director: Localized;
  premiere?: string | null;
  content_one?: Localized;
  content_two?: Localized;
  content_three?: Localized;
  image?: string | null;
  contributors?: Localized; // JSON-encoded string: [{role, contributor: "<id>"}]
  creators?: Localized; // same shape
  tags?: { text?: string }[];
};

type RawOccurrence = {
  performance_id: number;
  start: string;
  location?: { title?: Localized };
  performance: RawPerformance;
};

function monthsAhead(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. 01.`);
  }
  return out;
}

function parseRoleList(field?: Localized): { role: string; contributorId: number }[] {
  const raw = field?.hu;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { role?: string; contributor?: string }[];
    return parsed
      .map((p) => ({ role: p.role ?? "", contributorId: Number(p.contributor) }))
      .filter((p) => Number.isFinite(p.contributorId));
  } catch {
    return [];
  }
}

function tagTexts(tags?: { text?: string }[]): string[] {
  return (tags ?? []).map((t) => t.text ?? "").filter(Boolean);
}

function parseDurationTag(tags?: { text?: string }[]) {
  return parseDurationHu(tagTexts(tags).find((t) => /időtartam/i.test(t)));
}

/**
 * Entries that aren't stage productions and shouldn't become plays:
 *  - "Művészetközvetítő program" — open rehearsals and pre-show intro talks
 *    tied to a real production ("Nyílt próba: X" / "Intró: X"). They always
 *    have null author/director and share one branding graphic.
 *  - "Várostörténeti séta" — guided city-history walks.
 *  - Stream recordings, which carry category 4 but also announce themselves
 *    in the title ("- stream", "(bármikor elérhető)").
 *
 * The tag alone is not enough. Archived intro talks and open rehearsals
 * ("Intró: Országkórus", "Nyílt próba: Trójában nem lesz háború") predate the
 * "Művészetközvetítő program" tag and carry no tags at all, so five of them
 * survived a tag-only filter — hence the title pattern as well.
 */
const ANCILLARY_TITLE = /^(Intró:|Nyílt próba)|-\s*stream\s*$|\(bármikor elérhető\)/i;

function isNotAProduction(p: RawPerformance): boolean {
  if (p.category_id === CATEGORY_STREAM) return true;
  const tags = tagTexts(p.tags);
  if (tags.some((t) => t.includes("Művészetközvetítő program") || t.includes("Várostörténeti séta"))) return true;
  return ANCILLARY_TITLE.test(p.title.hu ?? p.title.en ?? "");
}

function genreOf(p: RawPerformance): string | undefined {
  const tags = tagTexts(p.tags);
  if (tags.some((t) => /felolvasószínház/i.test(t))) return "felolvasószínház";
  return undefined;
}

async function run(): Promise<SyncedPlay[]> {
  const contributors = await fetchJson<RawContributor[]>(`${SITE_URL}/api/contributors`, { crawlDelayMs: CRAWL_DELAY_MS });
  const nameById = new Map(contributors.map((c) => [c.id, c.name.hu ?? c.name.en ?? ""]));

  const repertoire = await fetchJson<RawPerformance[]>(`${SITE_URL}/api/performances?lang=hu&limit=${REPERTOIRE_LIMIT}`, {
    crawlDelayMs: CRAWL_DELAY_MS,
  });

  const byId = new Map<string, SyncedPlay>();
  for (const p of repertoire) {
    if (isNotAProduction(p)) continue;

    const { runtimeMinutes, intermissions } = parseDurationTag(p.tags);
    const synopsis = [p.content_one?.hu, p.content_two?.hu, p.content_three?.hu].map(stripHtml).filter(Boolean).join("\n\n");
    const cast = [...parseRoleList(p.contributors), ...parseRoleList(p.creators)]
      .map((c) => ({ name: nameById.get(c.contributorId) ?? "", role: c.role }))
      .filter((c) => c.name);

    byId.set(String(p.id), {
      sourceKey: String(p.id),
      // Normalized like every other text field. This was the one field
      // that skipped it, so entity-encoded titles reached the database.
      title: normalizeText(p.title.hu ?? p.title.en) ?? "Ismeretlen cím",
      author: stripHtml(p.author.hu ?? p.author.en) ?? "",
      director: stripHtml(p.director.hu ?? p.director.en) ?? "",
      venueId: VENUE_IDS.orkeny,
      genre: genreOf(p),
      runtimeMinutes,
      intermissions,
      premiereDate: parseHungarianDate(p.premiere),
      synopsis: synopsis || undefined,
      posterUrl: p.image ? `${SITE_URL}/${p.image}` : undefined,
      isArchived: p.category_id === CATEGORY_ARCHIVE,
      cast,
      performances: [],
    });
  }

  // Showtimes for whatever is actually scheduled. A production playing this
  // month is by definition not archived, whatever the API's category says.
  for (const month of monthsAhead(PERFORMANCE_MONTHS)) {
    const url = `${SITE_URL}/api/month?lang=hu&limit=99&month=${encodeURIComponent(month)}`;
    const occurrences = await fetchJson<RawOccurrence[]>(url, { crawlDelayMs: CRAWL_DELAY_MS });

    for (const occ of occurrences) {
      const play = byId.get(String(occ.performance_id));
      if (!play) continue; // filtered out above (stream, intro talk, walk)
      play.isArchived = false;
      play.performances.push({
        sourceKey: `${occ.performance_id}:${occ.start}`,
        startsAt: budapestLocalToUtcIso(occ.start),
        room: occ.location?.title?.hu ?? undefined,
      });
    }
  }

  return [...byId.values()];
}

export const orkenyAdapter: SyncAdapter = { name: "orkeny", run };
