/**
 * The Nemzeti company, with faces.
 *
 * `/muveszek` — not `/tarsulat`, which 404s while still being the word in the
 * site's own navigation — lists the season's company as a grid of cards, each
 * a portrait and a link to `/muvesz/{slug}`. Forty-seven in September 2026.
 *
 * The portraits are served through the site's own resizer,
 * `/image?src=uploads/…&w=400&h=600&zc=1`, which crops to fill. `zc=1` is
 * that crop; asking for the source path directly returns the uncropped
 * original, and the poster pipeline does its own resizing, so the request is
 * made without the resizer's parameters.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://nemzetiszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/**
 * The file behind a resizer URL.
 *
 * `/image?src=uploads/images_2/Portre_2025/net_Portre2du-969.jpg&w=400&h=600`
 * is a 400×600 centre crop of the file named in `src`. The full picture is
 * the better thing to mirror: a face cropped twice, once by the theatre's
 * resizer and once by ours, loses more of itself each time.
 */
export function originalImageUrl(src: string): string {
  const absolute = src.startsWith("http") ? src : `${BASE_URL}${src}`;
  const url = new URL(absolute);
  const path = url.searchParams.get("src");
  return path ? `${BASE_URL}/${path.replace(/^\//, "")}` : absolute;
}

/** The company. */
export function parseCompanyPage(html: string): SyncedPerson[] {
  const $ = cheerio.load(html);
  const people: SyncedPerson[] = [];

  $(".artist-item").each((_, card) => {
    const $card = $(card);
    const name = stripGuestMarker(normalizeText($card.find(".artist-data h2 a").first().text()) ?? "");
    const href = $card.find("a").first().attr("href");
    const src = $card.find("img.artist-image").first().attr("src");
    if (!name || !href || !src) return;

    people.push({
      name,
      // The page groups everyone under one heading and prints no title per
      // card, so this is what the grid it sits in says they are.
      role: "színművész",
      sourceUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      imageUrl: originalImageUrl(src),
    });
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const html = await fetchText(`${BASE_URL}/muveszek`, { crawlDelayMs: CRAWL_DELAY_MS });
  return parseCompanyPage(html);
}

export const nemzetiCompanyAdapter: CompanyAdapter = {
  name: "nemzeti-company",
  venueId: VENUE_IDS.nemzeti,
  run,
};
