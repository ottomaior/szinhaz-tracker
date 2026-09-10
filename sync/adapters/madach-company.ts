/**
 * The Madách company, with faces.
 *
 * `/tarsulat` is one page divided into eleven `<section>`s with an id apiece —
 * the management, the actors, the opera singers, the dancers, the conductor,
 * the répétiteur, the sound engineer, and so on. This is a musical house, so
 * the performing sections are more numerous and more varied than anywhere
 * else in the catalogue, and all of them appear in cast lists.
 *
 * The portraits are lazy-loaded: the real address is in `data-srcset` and the
 * `src` attribute is empty until the browser reaches the card. The 2x entry
 * is a 412px square, which is the largest the site offers here.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://madachszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/**
 * The sections whose people perform.
 *
 * Named rather than excluded, because the ones left out are specific and few:
 * `igazgatosag` is the directorate, `muveszeti-ugykezeles` the stage managers
 * and prompters, `hangmernok` the sound engineers, `tarvezetok` the department
 * heads. Everyone else here sings, dances, plays or conducts, and the
 * programme credits them for it.
 */
const PERFORMER_SECTIONS = new Set([
  "szinmuveszek",
  "operaenekesek",
  "szinpadon---szinmuveszek",
  "enekesnok",
  "tancmuveszek",
  "karmester",
  "korrepetitor",
  "korus---ensemble",
]);

/**
 * The largest image a lazy-loaded card offers.
 *
 * `data-srcset` is "…206x206.jpg 1x, …412x412.jpg 2x"; the 2x entry is what
 * is wanted. `data-src` is the 1x fallback for a card that has no srcset.
 */
export function largestImageIn(srcset?: string, fallback?: string): string | undefined {
  const candidates = (srcset ?? "")
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .filter(([url]) => !!url);
  const twoX = candidates.find(([, density]) => density === "2x");
  return twoX?.[0] ?? candidates[0]?.[0] ?? fallback;
}

/** The company, section by section. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $("section[id]").each((_, section) => {
    const $section = $(section);
    if (!PERFORMER_SECTIONS.has($section.attr("id") ?? "")) return;

    $section.find("a.card--company").each((__, card) => {
      const $card = $(card);
      const name = stripGuestMarker(normalizeText($card.find(".ttl").first().text()) ?? "");
      const href = $card.attr("href");
      const $img = $card.find("img").first();
      const imageUrl = largestImageIn($img.attr("data-srcset"), $img.attr("data-src") ?? $img.attr("src"));
      if (!name || !href || !imageUrl) return;

      people.push({
        name,
        role: normalizeText($card.find(".sec").first().text()) || undefined,
        sourceUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        imageUrl: imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`,
      });
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${BASE_URL}/tarsulat`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const madachCompanyAdapter: CompanyAdapter = {
  name: "madach-company",
  venueId: VENUE_IDS.madach,
  run,
};
