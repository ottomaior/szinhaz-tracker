/**
 * ⚠️ CURRENTLY NON-FUNCTIONAL — verified broken, not just unverified.
 *
 * Jegymester.hu-powered theaters (e.g. katona.jegymester.hu,
 * jegy.csokonaiszinhaz.hu) all share the same JSON REST shape:
 * `/rest/search/events` + `/rest/production/{id}`. robots.txt doesn't
 * disallow these paths, which the original research took as "this is an
 * open API" — but a live check found otherwise:
 *
 *   curl https://katona.jegymester.hu/rest/search/events?eventHostId=4100
 *   -> 403 {"error":"Forbidden","message":"The access to this resource
 *      requires access token"}
 *
 * The site is an Angular SPA that presumably fetches a token at bootstrap
 * before calling this endpoint. Getting that token means reverse-engineering
 * the SPA's auth flow, which is a meaningfully bigger (and murkier —
 * "not disallowed by robots.txt" isn't the same as "intended for
 * unauthenticated programmatic access" when the endpoint itself gates on a
 * token) undertaking than the rest of this sync job. Left unresolved
 * deliberately rather than working around the access gate.
 *
 * Both adapters below are excluded from the default scheduled run (see
 * sync/run.ts) until this is sorted out. If you want to pursue it: open
 * this site in a real browser, watch the Network tab for the token-issuing
 * request, and see whether it's obtainable without a logged-in session.
 * Otherwise, Katona/Csokonai listings will need to come from Jegy.hu
 * (Phase 3, HTML parsing) instead — the same fallback source already
 * planned for Nemzeti/Vígszínház/Madách/Centrál/Vojtina.
 */
import { fetchJson } from "../lib/http";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

type RawEvent = {
  id: number | string;
  productionId: number | string;
  startDate?: string; // ISO datetime
  venue?: string;
  status?: string;
};

type RawProduction = {
  id: number | string;
  title?: string;
  author?: string;
  director?: string;
  category?: string; // genre
  ageLimit?: string;
  description?: string; // synopsis HTML
  imageUrl?: string;
  cast?: { name?: string; role?: string }[];
  crew?: { name?: string; role?: string }[];
  durationMinutes?: number;
};

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

export function createJegymesterAdapter(config: { name: string; baseUrl: string; eventHostId: string; venueId: string }): SyncAdapter {
  async function run(): Promise<SyncedPlay[]> {
    const events = await fetchJson<RawEvent[]>(`${config.baseUrl}/rest/search/events?eventHostId=${config.eventHostId}`);

    const performancesByProduction = new Map<string, RawEvent[]>();
    for (const ev of events) {
      const key = String(ev.productionId);
      if (!performancesByProduction.has(key)) performancesByProduction.set(key, []);
      performancesByProduction.get(key)!.push(ev);
    }

    const plays: SyncedPlay[] = [];
    for (const [productionId, occurrences] of performancesByProduction) {
      const production = await fetchJson<RawProduction>(`${config.baseUrl}/rest/production/${productionId}`);

      plays.push({
        sourceKey: productionId,
        title: production.title ?? "Ismeretlen cím",
        author: production.author ?? "",
        director: production.director ?? "",
        venueId: config.venueId,
        genre: production.category ?? "dráma",
        runtimeMinutes: production.durationMinutes,
        synopsis: stripHtml(production.description),
        posterUrl: production.imageUrl,
        cast: [...(production.cast ?? []), ...(production.crew ?? [])]
          .map((c) => ({ name: c.name ?? "", role: c.role ?? "" }))
          .filter((c) => c.name),
        performances: occurrences
          .filter((ev) => ev.startDate)
          .map((ev) => ({ sourceKey: String(ev.id), startsAt: ev.startDate! })),
      });
    }

    return plays;
  }

  return { name: config.name, run };
}

// Confirmed during research: Katona József Színház's Jegymester event-host id.
export const katonaAdapter = createJegymesterAdapter({
  name: "jegymester:katona",
  baseUrl: "https://katona.jegymester.hu",
  eventHostId: "4100",
  venueId: "11111111-1111-1111-1111-111111111102",
});

// Csokonai Nemzeti Színház (Debrecen) — same platform, confirmed reachable
// at jegy.csokonaiszinhaz.hu during research, but its eventHostId was not
// captured — look it up (e.g. via the site's own API calls in devtools)
// before enabling this adapter in the scheduled workflow.
export const csokonaiAdapter = createJegymesterAdapter({
  name: "jegymester:csokonai",
  baseUrl: "https://jegy.csokonaiszinhaz.hu",
  eventHostId: "REPLACE_ME",
  venueId: "11111111-1111-1111-1111-111111111107",
});
