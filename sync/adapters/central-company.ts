/**
 * The Centrál company, with faces.
 *
 * `/tarsulat/` is one page holding all three of the theatre's groupings at
 * once, sorted by a client-side control: `artist-card szinesz` for the
 * performers, `alkoto` for the directors and designers, `hatter` for the
 * office. Each card carries the portrait, a printed role and the name, and
 * links to the member's page at the site root.
 *
 * The performers and the creative team are read; the office is not, for the
 * same reason Katona's is not — a portrait is here to sit beside a credit,
 * and nothing credits a box-office manager.
 *
 * Nearly every name on the creative list carries `m.v.`, this being a theatre
 * that engages its directors production by production.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://centralszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/** The company: the performers and the creative team, not the office. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $(".artist-card.szinesz, .artist-card.alkoto").each((_, card) => {
    const $card = $(card);
    const name = stripGuestMarker(normalizeText($card.find(".artist-name a").first().text()) ?? "");
    const href = $card.find(".artist-name a").first().attr("href") ?? $card.find(".artist-image a").first().attr("href");
    const src = $card.find(".artist-image img").first().attr("src");
    if (!name || !href || !src) return;

    people.push({
      name,
      role: normalizeText($card.find(".artist-role").first().text()) || undefined,
      sourceUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      imageUrl: src.startsWith("http") ? src : `${BASE_URL}${src}`,
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${BASE_URL}/tarsulat/`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const centralCompanyAdapter: CompanyAdapter = {
  name: "central-company",
  venueId: VENUE_IDS.central,
  run,
};
