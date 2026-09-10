/**
 * The Vojtina company, with faces.
 *
 * vojtinababszinhaz.hu keeps its whole company on one page, `/tarsulat`: the
 * puppeteers first, then the director and the office, each a card with a
 * portrait, the name and a title, linking to a member page under
 * `/tarsulat/<id>-<slug>`. Thirteen people in September 2026, every one with
 * a photograph.
 *
 * The images are served from `/uploads/actors/<hash>` with no extension and
 * no hint of format in the URL. The poster pipeline decodes from the bytes,
 * not the name, so that costs nothing here.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://www.vojtinababszinhaz.hu";
const CRAWL_DELAY_MS = 800;

function absolute(href: string): string {
  return href.startsWith("http") ? href : `${BASE_URL}${href}`;
}

/** The people on the company page. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $('a[href^="/tarsulat/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    const name = $a.find(".personName").first().text().replace(/\s+/g, " ").trim();
    const role = $a.find("p").first().text().replace(/\s+/g, " ").trim();
    const imageUrl = $a.find("img.personImg").first().attr("src");
    if (!href || !name || !imageUrl) return;

    people.push({
      name,
      role: role || undefined,
      sourceUrl: absolute(href),
      imageUrl: absolute(imageUrl),
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${BASE_URL}/tarsulat`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const vojtinaCompanyAdapter: CompanyAdapter = {
  name: "vojtina-company",
  venueId: VENUE_IDS.vojtinaDebrecen,
  run,
};
