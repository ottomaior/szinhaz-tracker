/**
 * The Csokonai company, with faces.
 *
 * csokonaiszinhaz.hu lists its people under `/csoport/<group>/` — the
 * leadership, the actors, the singers, the dance company, the youth
 * programme, the guest artists — and every member is a card: a portrait, the
 * name, and what the house calls them. Each card links to the member's own
 * page under `/tarsulat/`, which serves the same portrait as its `og:image`
 * at a larger size; the card's 600×900 crop is what a 64pt avatar needs, so
 * the member pages are not fetched.
 *
 * This produces portraits, not productions. The runner keys each one on
 * `personSlug(name)` — the same slug the cast rows on a production page
 * resolve to — and files the image through the poster pipeline. Checked
 * against the catalogue on 10 September 2026: 89 members across the groups
 * carry a photograph, and 86 of them already have a person page.
 *
 * Some groups list people without a photograph (the honorary members, all
 * sixty of them) and some list nobody at all in this markup (the chorus, the
 * artistic council). Both are simply empty here.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://csokonaiszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/**
 * Every group page the site links from its company menu, as of September
 * 2026. A group that stops existing returns a 404 and is skipped with a
 * warning rather than failing the run; a new one has to be added here.
 */
const GROUPS = [
  "vezetoseg-hu",
  "muveszeti-tanacs",
  "szinmuveszek-hu",
  "maganenekesek",
  "enekkar",
  "tanctagozat",
  "csip",
  "orokos-tagok-es-cimzetes-orokos-tagok-hu",
  "vendegmuveszek",
];

/**
 * The guest marker the guest-artists page prints after every name.
 *
 * Stripped here rather than left to `personCanonicalName()`, because the page
 * prints it both as `m.v.` and as `m.v` — and the canonicaliser only knows
 * the dotted form, so the undotted one would slug to `…-m-v` and miss the
 * person's page. Four cast rows in the catalogue have the same problem and
 * are a separate matter (see T-033).
 */
const GUEST_MARKER = /\s*\bm\.\s*v\.?\s*$/i;

/**
 * The people on one group page.
 *
 * Anchored on the link into `/tarsulat/`, since that is what makes a card a
 * person rather than decoration. A card with no image is a member the site
 * has no portrait for, and is left out: there is nothing to mirror, and the
 * app's initials are the right fallback for them.
 */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $('a[href*="/tarsulat/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    const printed = $a.find("p.uk-text-secondary").first().text().replace(/\s+/g, " ").trim();
    const name = printed.replace(GUEST_MARKER, "").trim();
    const role = $a.find("h4").first().text().replace(/\s+/g, " ").trim();
    const imageUrl = $a.find("img").first().attr("src");
    if (!href || !name || !imageUrl) return;

    people.push({
      name,
      role: role || undefined,
      sourceUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      imageUrl: imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`,
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const people: SyncedPerson[] = [];
  for (const group of GROUPS) {
    let html: string;
    try {
      html = await fetchText(`${BASE_URL}/csoport/${group}/`, { crawlDelayMs: CRAWL_DELAY_MS });
    } catch (e) {
      console.warn(`[csokonai-company] ${group}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    people.push(...parseCompanyPage(html));
  }
  return people;
}

export const csokonaiCompanyAdapter: CompanyAdapter = {
  name: "csokonai-company",
  venueId: VENUE_IDS.csokonaiDebrecen,
  run,
};
