/**
 * Örkény István Színház — first-party JSON API the theater's own site calls.
 * Confirmed live and unrestricted by robots.txt. Field names below were
 * verified against real responses from `/api/month` and `/api/contributors`
 * (not guessed) — see the implementation notes in the PR/commit that added
 * this file if the shape ever needs re-checking.
 *
 * Two real quirks discovered while verifying, that a first pass at this
 * adapter (based only on a qualitative description) got wrong:
 *  1. `contributors`/`creators` on a performance are a JSON-encoded STRING
 *     of `{role, contributor: "<id>"}` pairs — the id refers to a separate
 *     `/api/contributors` directory, not an inline name. This adapter
 *     fetches that directory once and resolves names locally.
 *  2. There's no dedicated runtime/intermission field — both are embedded
 *     in a free-text Hungarian tag like "Időtartam: 2h 50min egy
 *     szünettel" ("Runtime: 2h 50min with one intermission"), parsed below.
 *
 * Known simplification: `start`/`end` come back as naive local time
 * ("YYYY-MM-DD HH:MM:SS", no offset). This adapter passes them through as
 * if they were UTC, which is off by Budapest's UTC+1/+2 offset — fine for
 * "what's playing this month" but not exact-hour-accurate. Worth fixing
 * with a proper Europe/Budapest conversion before relying on showtimes.
 */
import { fetchJson } from "../lib/http";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const SITE_URL = "https://orkenyszinhaz.hu";

type Localized = { hu?: string | null; en?: string | null };

type RawContributor = { id: number; name: Localized };

type RawPerformance = {
  id: number;
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
  return text
    .replace(/&(#(\d+)|#x([0-9a-fA-F]+)|[a-zA-Z]+);/g, (match, _entity, dec, hex) => {
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

function parseDurationTag(tags?: { text?: string }[]): { runtimeMinutes?: number; intermissions?: number } {
  const tag = tags?.map((t) => t.text ?? "").find((t) => /időtartam/i.test(t));
  if (!tag) return {};

  const hourMatch = tag.match(/(\d+)\s*h/);
  const minMatch = tag.match(/(\d+)\s*min/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minMatch ? Number(minMatch[1]) : 0;
  const runtimeMinutes = hours * 60 + minutes || undefined;

  let intermissions: number | undefined;
  if (/szünet nélkül/i.test(tag)) intermissions = 0;
  else if (/egy szünettel/i.test(tag)) intermissions = 1;
  else {
    const countMatch = tag.match(/(\d+)\s*szünettel/i);
    if (countMatch) intermissions = Number(countMatch[1]);
  }

  return { runtimeMinutes, intermissions };
}

async function run(): Promise<SyncedPlay[]> {
  const contributors = await fetchJson<RawContributor[]>(`${SITE_URL}/api/contributors`);
  const nameById = new Map(contributors.map((c) => [c.id, c.name.hu ?? c.name.en ?? ""]));

  const byId = new Map<string, SyncedPlay>();

  for (const month of monthsAhead(3)) {
    const url = `${SITE_URL}/api/month?lang=hu&limit=99&month=${encodeURIComponent(month)}`;
    const occurrences = await fetchJson<RawOccurrence[]>(url);

    for (const occ of occurrences) {
      const p = occ.performance;
      const sourceKey = String(p.id);

      let play = byId.get(sourceKey);
      if (!play) {
        const { runtimeMinutes, intermissions } = parseDurationTag(p.tags);
        const synopsis = [p.content_one?.hu, p.content_two?.hu, p.content_three?.hu].map(stripHtml).filter(Boolean).join("\n\n");
        const cast = [...parseRoleList(p.contributors), ...parseRoleList(p.creators)]
          .map((c) => ({ name: nameById.get(c.contributorId) ?? "", role: c.role }))
          .filter((c) => c.name);

        play = {
          sourceKey,
          title: p.title.hu ?? p.title.en ?? "Ismeretlen cím",
          author: p.author.hu ?? p.author.en ?? "",
          director: p.director.hu ?? p.director.en ?? "",
          venueId: VENUE_IDS.orkeny,
          genre: "dráma", // Örkény's API doesn't expose a clean genre field
          runtimeMinutes,
          intermissions,
          premiereDate: p.premiere ?? undefined,
          synopsis: synopsis || undefined,
          posterUrl: p.image ? `${SITE_URL}/${p.image}` : undefined,
          cast,
          performances: [],
        };
        byId.set(sourceKey, play);
      }

      play.performances.push({
        sourceKey: `${sourceKey}:${occ.start}`,
        startsAt: occ.start.replace(" ", "T"), // see file header re: timezone
        room: occ.location?.title?.hu ?? undefined,
      });
    }
  }

  return Array.from(byId.values());
}

export const orkenyAdapter: SyncAdapter = { name: "orkeny", run };
