/**
 * The Radnóti company, with faces.
 *
 * `/tarsulati-nevsor/` splits the company into three pages — the actors, the
 * guest artists, the directors — and, for reasons that are presumably
 * historical, lays out the first differently from the other two. The actors
 * are a grid of picture-and-name boxes; the guests and the directors are a
 * tabbed list, where the names sit in the tab strip and the portraits in the
 * panes behind it. Both shapes are read, and both are anchored on the link to
 * the member's own page, which is the one thing they share.
 *
 * The names on the grid are printed with a line break between the surname and
 * the given name, which is a layout decision and not part of the name: read
 * as text that is "BálintAndrás", and slugged from that it is a person nobody
 * has ever credited. The break is turned back into the space it stands for.
 *
 * The images carry no `alt`, so a name never comes from a picture here.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { stripGuestMarker } from "../lib/performers";
import { normalizeText } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { CompanyAdapter, SyncedPerson } from "../lib/types";

const BASE_URL = "https://radnotiszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/** The three lists, and what the house calls the people on each. */
const SECTIONS: { path: string; role: string }[] = [
  { path: "szineszek", role: "színművész" },
  { path: "vendegmuveszek", role: "vendégművész" },
  { path: "rendezok", role: "rendező" },
];

/**
 * The people on one list page, whichever of the two layouts it uses.
 *
 * `<br>` is replaced before parsing rather than after, because by the time
 * cheerio has the text the break is gone and the two halves of the name have
 * already been glued together.
 */
export function parseCompanyPage(html: string, role: string): SyncedPerson[] {
  const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, " "));
  const people: SyncedPerson[] = [];

  const add = (name: string, href?: string, src?: string) => {
    const cleaned = stripGuestMarker(name);
    if (!cleaned || !href || !src) return;
    people.push({
      name: cleaned,
      role,
      sourceUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      imageUrl: src.startsWith("http") ? src : `${BASE_URL}${src}`,
    });
  };

  // The grid, as the actors' page draws it: the name is the heading under the
  // picture, and the whole box is one member.
  $(".szineszek_kep_box").each((_, box) => {
    const $box = $(box);
    add(normalizeText($box.find("h1").first().text()) ?? "", $box.find("a").first().attr("href"), $box.find("img").first().attr("src"));
  });

  /*
   * The tab strip, as the guests' and directors' pages draw it.
   *
   * The name is in the tab and the portrait is in the pane it opens, joined
   * only by the anchor's fragment — so the name is looked up by that id
   * rather than assumed to be in document order beside its picture.
   */
  $(".tab-pane[id]").each((_, pane) => {
    const $pane = $(pane);
    const id = $pane.attr("id");
    const label = $(`a[href="#${id}"]`).first().text();
    add(normalizeText(label) ?? "", $pane.find("a").first().attr("href"), $pane.find("img").first().attr("src"));
  });

  return people;
}

async function run(): Promise<SyncedPerson[]> {
  const people: SyncedPerson[] = [];
  for (const section of SECTIONS) {
    const html = await fetchText(`${BASE_URL}/tarsulati-nevsor/${section.path}/`, { crawlDelayMs: CRAWL_DELAY_MS });
    people.push(...parseCompanyPage(html, section.role));
  }
  return people;
}

export const radnotiCompanyAdapter: CompanyAdapter = {
  name: "radnoti-company",
  venueId: VENUE_IDS.radnoti,
  run,
};
