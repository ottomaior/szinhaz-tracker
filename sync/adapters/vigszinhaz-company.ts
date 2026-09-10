/**
 * The Vígszínház company, with faces.
 *
 * `/hu/tarsulat` is one page, grouped into sections that each carry a heading
 * and a grid of cards: the management, the actors, the students, the guests.
 * Fifty cards in September 2026, every one of them with a photograph.
 *
 * Unlike the productions, this page is server-rendered, so it is read as HTML
 * rather than through `/api/programme/` — which does have a `persons`
 * endpoint, and is the wrong source anyway: it holds 3,120 people going back
 * a century, 319 of them with a photograph, most long dead. The company page
 * is the house's own answer to "who is in the company now", which is the
 * question a portrait is for.
 *
 * The images come through Next.js's resizer, `/_next/image?url=…&w=384`, so
 * the original is recovered from the query string rather than mirroring a
 * 384px crop of it.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const SITE_URL = "https://vigszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/**
 * The sections worth a portrait.
 *
 * "Vezetőség" is the theatre's management — an economic director and a
 * production director are not performers, and nothing in the catalogue will
 * ever credit them. The two of them who also act appear again under
 * Színművészek, which is where they belong.
 */
const PERFORMER_SECTIONS = /színművész|egyetemi hallgató|vendégművész|rendező|dramaturg/i;

/**
 * The original behind a Next.js image URL.
 *
 * `/_next/image?url=https%3A%2F%2F…original.jpg&w=384&q=75` is a resized
 * derivative; the `url` parameter is the file itself. Falls back to the
 * resizer URL when the parameter is missing, since a small portrait beats no
 * portrait.
 */
export function originalImageUrl(src: string): string {
  const absolute = src.startsWith("http") ? src : `${SITE_URL}${src}`;
  const url = new URL(absolute);
  const original = url.searchParams.get("url");
  return original ?? absolute;
}

/**
 * Singular of a section heading, for the role a card does not carry itself.
 *
 * Hungarian's plural `-k` takes a linking vowel after a consonant
 * (színművész→színművészek) but not after an accented one
 * (hallgató→hallgatók), so the class strips the first and leaves the second.
 */
function roleFromSection(heading: string): string {
  return heading.replace(/[eoöa]?k$/i, "").toLowerCase();
}

/** The company, section by section. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $("section").each((_, section) => {
    const $section = $(section);
    const heading = normalizeText($section.find('h3[class*="PageSubtitle_title"]').first().text()) ?? "";
    if (!PERFORMER_SECTIONS.test(heading)) return;

    $section.find('article[class*="PersonCard_card"]').each((__, card) => {
      const $card = $(card);
      const name = stripGuestMarker(normalizeText($card.find('h3[class*="PersonCard_name"]').first().text()) ?? "");
      const href = $card.find('a[class*="PersonCard_cardLink"]').first().attr("href");
      const src = $card.find("img").first().attr("src");
      if (!name || !href || !src) return;

      // The card's own title when it has one ("színművész – művészeti
      // tanácsadó"); most carry none, and then the section is what the house
      // is calling this group of people.
      const printedRole = normalizeText($card.find('div[class*="PersonCard_title"]').first().text());

      people.push({
        name,
        role: printedRole || roleFromSection(heading),
        sourceUrl: href.startsWith("http") ? href : `${SITE_URL}${href}`,
        imageUrl: originalImageUrl(src),
      });
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${SITE_URL}/hu/tarsulat`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const vigszinhazCompanyAdapter: CompanyAdapter = {
  name: "vigszinhaz-company",
  venueId: VENUE_IDS.vigszinhaz,
  run,
};
