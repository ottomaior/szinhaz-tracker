/**
 * The Katona company, with faces.
 *
 * `/tarsulat/` is one WordPress page in four labelled blocks — Színészek,
 * Rendezők, Dramaturgok, További munkatársak — each a grid of cards carrying
 * a portrait, the name in the image's `alt`, and an overlay linking to the
 * member's own page.
 *
 * The last block is the office: an operative director, a financial director,
 * a press officer. They are the theatre rather than its work, nothing in the
 * catalogue credits them, and a portrait exists here to sit beside a credit —
 * so the three artistic blocks are read and the fourth is not.
 *
 * The card links live in an `onclick` rather than an `href`, which is the
 * site's own choice and not something to work around: the member's page URL
 * is in there as a string literal and is read out of it.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://katonajozsefszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/** The blocks whose people appear in a cast list. */
const ARTISTIC_SECTIONS = /színész|rendező|dramaturg/i;

/**
 * Singular of a block heading: "Színészek" is what one of them does.
 *
 * Hungarian forms a plural with `-k` and inserts a linking vowel when the
 * stem ends in a consonant — színész→színészek, dramaturg→dramaturgok — so
 * both the vowel and the `k` have to come off. An *accented* final vowel
 * belongs to the stem and must not (rendező→rendezők, hallgató→hallgatók),
 * which is exactly the distinction the character class draws.
 */
function roleFromSection(heading: string): string {
  return heading.replace(/[eoöa]?k$/i, "").toLowerCase();
}

/** The member page a card's overlay navigates to. */
export function memberUrlIn(onclick?: string): string | undefined {
  const match = onclick?.match(/window\.location\.href=['"]([^'"]+)['"]/);
  return match?.[1];
}

/** The company, block by block. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $("h2.contributors-title").each((_, title) => {
    const heading = normalizeText($(title).text()) ?? "";
    if (!ARTISTIC_SECTIONS.test(heading)) return;

    /*
     * The cards belong to the row after the heading's own row, and the two
     * are siblings rather than nested — so the grid is found by walking
     * forward to the next `.contributors-row` and stopping there, which is
     * what keeps the actors out of the directors' block.
     */
    const $grid = $(title).closest(".row").nextAll(".contributors-row").first();

    $grid.find(".contributors-item").each((__, card) => {
      const $card = $(card);
      const $img = $card.find("img.contributors-img").first();
      const printed = normalizeText($img.attr("alt")) ?? normalizeText($card.find(".contributors-overlay-title").first().text()) ?? "";
      const name = stripGuestMarker(printed);
      const imageUrl = $img.attr("src");
      const sourceUrl = memberUrlIn($card.find(".contributors-overlay").first().attr("onclick"));
      if (!name || !imageUrl || !sourceUrl) return;

      people.push({
        name,
        role: roleFromSection(heading),
        sourceUrl,
        imageUrl: imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`,
      });
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${BASE_URL}/tarsulat/`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const katonaCompanyAdapter: CompanyAdapter = {
  name: "katona-company",
  venueId: VENUE_IDS.katona,
  run,
};
