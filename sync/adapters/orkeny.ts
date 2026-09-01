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
import { parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const SITE_URL = "https://orkenyszinhaz.hu";
const PERFORMANCE_MONTHS = 3;
const REPERTOIRE_LIMIT = 500; // comfortably above the 216 that exist today

const CATEGORY_STREAM = 4;
const CATEGORY_ARCHIVE = 5;

/** Örkény is a prose theater; nothing in the API carries a genre field. */
const DEFAULT_GENRE = "próza";

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

// Node has no built-in HTML entity decoder; the site's content fields come
// back as HTML-encoded Hungarian text (e.g. "&eacute;" for "é"), so this
// covers what actually shows up rather than pulling in a full HTML parser
// dependency for one field.
// ő/ű (Hungarian double-acute vowels) aren't in this table on purpose —
// they're outside Latin-1 so the source doesn't HTML-entity-encode them;
// they come through as plain UTF-8 already.
const HTML_ENTITIES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", ouml: "ö", uacute: "ú", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Ouml: "Ö", Uacute: "Ú", Uuml: "Ü",
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#(\d+)|#x([0-9a-fA-F]+)|[a-zA-Z]+);/g, (match, _entity, dec, hex) => {
    if (dec) return String.fromCharCode(Number(dec));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    const name = match.slice(1, -1);
    return HTML_ENTITIES[name] ?? match;
  });
}

function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || undefined;
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

function genreOf(p: RawPerformance): string {
  const tags = tagTexts(p.tags);
  if (tags.some((t) => /felolvasószínház/i.test(t))) return "felolvasószínház";
  return DEFAULT_GENRE;
}

/**
 * `start`/`end` come back as naive Budapest local time ("YYYY-MM-DD
 * HH:MM:SS", no offset). Passing them through as if they were UTC — which
 * this adapter used to do — shifts every showtime by one or two hours
 * depending on daylight saving. This resolves the real offset for that
 * instant and emits a proper UTC instant.
 */
function budapestLocalToUtcIso(naive: string): string {
  const normalized = naive.replace(" ", "T");
  const pretendUtc = new Date(`${normalized}Z`);
  if (Number.isNaN(pretendUtc.getTime())) return normalized;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Budapest",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(pretendUtc).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMs = asIfUtc - pretendUtc.getTime();
  return new Date(pretendUtc.getTime() - offsetMs).toISOString();
}

async function run(): Promise<SyncedPlay[]> {
  const contributors = await fetchJson<RawContributor[]>(`${SITE_URL}/api/contributors`);
  const nameById = new Map(contributors.map((c) => [c.id, c.name.hu ?? c.name.en ?? ""]));

  const repertoire = await fetchJson<RawPerformance[]>(`${SITE_URL}/api/performances?lang=hu&limit=${REPERTOIRE_LIMIT}`);

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
      title: p.title.hu ?? p.title.en ?? "Ismeretlen cím",
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
    const occurrences = await fetchJson<RawOccurrence[]>(url);

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
