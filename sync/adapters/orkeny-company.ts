/**
 * The Örkény company, with faces.
 *
 * The odd one out among the company sources: everywhere else reads a page,
 * and this reads `/api/contributors`, the same directory the listings adapter
 * already uses to turn a production's contributor ids into names. The site's
 * own `/tarsulat` is client-rendered and would need a headless browser to
 * produce what the API hands over directly.
 *
 * That directory is everyone the theatre has ever credited — 1,166 people,
 * mostly guests on a single production, and only 32 of them with a
 * photograph. The photographs belong to the company: 27 of the 32 are
 * `Színész`, and the rest are the leadership and the artistic staff. So the
 * ones with a picture are the ones taken, which is the same rule the Csokonai
 * adapter follows for cards that carry no image.
 */
import { fetchJson } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const SITE_URL = "https://orkenyszinhaz.hu";
const CRAWL_DELAY_MS = 800;

type Localized = { hu?: string | null; en?: string | null };

export type RawContributor = {
  name?: Localized | string | null;
  slug?: Localized | string | null;
  role?: Localized | string | null;
  category?: string | null;
  image?: string | null;
};

/**
 * The Hungarian text of a field that is sometimes a localized pair and
 * sometimes a bare string — the same guard the listings adapter carries, for
 * the same API.
 */
function hu(value?: Localized | string | null): string | undefined {
  if (typeof value === "string") return normalizeText(value);
  const text = value?.hu ?? value?.en;
  return typeof text === "string" ? normalizeText(text) : undefined;
}

/**
 * The company members the directory has a photograph of.
 *
 * `role` is a person's job on one production ("zenész", "zeneszerző") and is
 * null for almost everybody; `category` is what the theatre files them as,
 * which is the standing description a portrait wants beside it.
 */
export function parseContributors(payload: RawContributor[] | { data?: RawContributor[] }): SyncedPerson[] {
  const contributors = Array.isArray(payload) ? payload : payload.data ?? [];
  const people: SyncedPerson[] = [];

  for (const contributor of contributors) {
    const printed = hu(contributor.name);
    const slug = hu(contributor.slug);
    if (!printed || !slug || !contributor.image) continue;

    people.push({
      name: stripGuestMarker(printed),
      role: normalizeText(contributor.category) || hu(contributor.role),
      sourceUrl: `${SITE_URL}/tarsulat/${slug}`,
      imageUrl: `${SITE_URL}/${contributor.image.replace(/^\//, "")}`,
    });
  }

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const payload = await fetchJson<RawContributor[] | { data?: RawContributor[] }>(`${SITE_URL}/api/contributors`, {
    crawlDelayMs: CRAWL_DELAY_MS,
  });
  return parseContributors(payload);
}

export const orkenyCompanyAdapter: CompanyAdapter = {
  name: "orkeny-company",
  venueId: VENUE_IDS.orkeny,
  run,
};
