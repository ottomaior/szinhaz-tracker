/**
 * Nemzeti Színház (Budapest) — scraped from the theatre's own site.
 *
 * The cleanest of the sources added so far: everything is server-rendered,
 * the markup carries semantic class names, and the theatre publishes the two
 * fields most of the others withhold — a premiere date on every production and
 * the stage each performance plays on, by full name rather than a code.
 *
 * robots.txt disallows only `/admin/` and `/packages/`; nothing here is under
 * either. Pacing below is courtesy, not a stated Crawl-delay.
 *
 * Three passes, checked against live pages:
 *  1. `/repertoar` — every production's detail URL. 56 of them, some linked
 *     twice with an `?open=1` query that has to be stripped or the same
 *     production is fetched and upserted as two.
 *  2. Each `/eloadas/{slug}` page — author, title, runtime, synopsis, premiere
 *     date, poster and the full credits list.
 *  3. `/musor` — showtimes, with the stage.
 *
 * `/musor` is a single request covering everything the theatre has published,
 * which at the time of writing is about five weeks. The `/musor/nyomtatas/
 * YYYYMM` print views for later months return 200 with nothing in them, so
 * there is no month walk worth doing — the horizon is the theatre's, not ours.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { normalizeText, stripHtml } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://nemzetiszinhaz.hu";
const CRAWL_DELAY_MS = 800;

const PRODUCTION_HREF = /\/eloadas\/[^/?#]+$/;

/**
 * Roles that name the director, and the ones that only look like they do.
 *
 * The credits list is a flat sequence of role/person pairs, and this theatre's
 * runs to three entries containing the word "rendező": "Rendező",
 * "Rendezőasszisztens" (assistant director) and "Rendező(asszisztens)". A
 * substring match on "rendez" picks whichever appears first, which on the
 * pages checked is an assistant — so the match has to be exact.
 */
const DIRECTOR_ROLE = /^rendező$/i;

/**
 * Credit roles that are crew rather than cast, kept but not treated as the
 * author or director. Everything else in the list is a character name and the
 * person playing it, which is what `play_cast` is for.
 */
const AUTHOR_ROLE = /^(írta|szerző)$/i;

type ProductionDetails = {
  title: string;
  author: string;
  director: string;
  synopsis?: string;
  runtimeMinutes?: number;
  intermissions?: number;
  premiereDate?: string;
  posterUrl?: string;
  cast: { name: string; role: string }[];
};

export function slugOf(detailUrl: string): string {
  return detailUrl.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

/**
 * Production detail URLs on the repertoire index, deduplicated by slug.
 *
 * The query string is dropped before deduplicating: the index links several
 * productions twice, once plainly and once with `?open=1`, and treating those
 * as two URLs would fetch and upsert each of them twice.
 */
export function productionLinksIn(html: string): string[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, string>();
  $('a[href*="/eloadas/"]').each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    const clean = raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
    if (!PRODUCTION_HREF.test(clean)) return;
    const absolute = clean.startsWith("http") ? clean : `${BASE_URL}${clean}`;
    bySlug.set(slugOf(absolute), absolute);
  });
  return [...bySlug.values()];
}

export function parseProductionDetail(html: string): ProductionDetails | undefined {
  const $ = cheerio.load(html);

  const heading = normalizeText($("h1.title").first().text());
  if (!heading) return undefined;

  /*
   * The `h1` is set in capitals — "CSONGOR ÉS TÜNDE" — which is a styling
   * decision on their side, not how the title is written. Storing it that way
   * would shout in every list in the app and sort oddly against the rest of
   * the catalogue. It cannot simply be lowercased either: Hungarian titles
   * carry proper nouns, and "Csongor és tünde" is wrong in a way the shouting
   * version at least is not.
   *
   * The page does carry the title properly cased, in the captions above the
   * embedded galleries and trailers — but with unpredictable things appended:
   * "Csongor és Tünde (2025)", "Csongor és Tünde új képek", "Csongor és Tünde
   * ajánló - új". Trying to strip those suffixes is guesswork, and guessing
   * wrong truncates a title.
   *
   * So nothing is stripped. A caption is used only when it *begins* with
   * exactly the h1's characters, and then only its first h1-length characters
   * are taken. The result is the same letters the h1 already had, in the
   * casing the theatre uses elsewhere — never a different string.
   */
  const properCase = $("h2")
    .map((_, el) => normalizeText($(el).text()) ?? "")
    .get()
    .find((text) => text.toLowerCase().startsWith(heading.toLowerCase()))
    ?.slice(0, heading.length);
  const title = properCase ?? heading;

  const credits: { name: string; role: string }[] = [];
  $(".pb-line").each((_, el) => {
    const role = normalizeText($(el).find(".role").first().text())?.replace(/:$/, "");
    const name = normalizeText($(el).find(".actor").first().text());
    if (role && name) credits.push({ role, name });
  });

  const director = credits.find((c) => DIRECTOR_ROLE.test(c.role))?.name ?? "";
  const authorFromCredits = credits.find((c) => AUTHOR_ROLE.test(c.role))?.name;
  // The playwright is printed above the title rather than filed as a credit.
  const author = normalizeText($(".artist-title .author").first().text()) ?? authorFromCredits ?? "";

  const { runtimeMinutes, intermissions } = parseDurationHu(
    normalizeText($(".page-body-tiny").first().text())
  );

  // "Bemutató időpontja:" labels a sibling `.date` holding "2026. Március 06."
  // — with the month capitalised, which parseHungarianDate folds.
  let premiereText: string | undefined;
  $(".title").each((_, el) => {
    if (premiereText) return;
    if (/bemutató időpontja/i.test($(el).text())) premiereText = $(el).next(".date").text();
  });
  const premiereDate = parseHungarianDate(premiereText);

  // The synopsis block ends with a "Tovább..." link into a sub-page; it is
  // navigation, not part of the blurb.
  const body = $(".page-body").first().clone();
  body.find("a.more-info-link").remove();
  const synopsis = stripHtml(body.html() ?? undefined);

  const posterUrl = $('meta[name="og:image"], meta[property="og:image"]').first().attr("content");

  return {
    title,
    author,
    director,
    synopsis,
    runtimeMinutes,
    intermissions,
    premiereDate,
    posterUrl: posterUrl || undefined,
    // Only the character/performer pairs, not the production team — the
    // designers and the dramaturg are credits, but `play_cast` is what the app
    // shows as "Szereposztás".
    cast: credits.filter((c) => !DIRECTOR_ROLE.test(c.role) && !AUTHOR_ROLE.test(c.role)),
  };
}

export type ProgramOccurrence = { slug: string; startsAt: string; room?: string };

/**
 * Showtimes off `/musor`.
 *
 * The listing groups performances under a `.date-item` per day, with the year
 * and the day split across two spans ("2026." and "szeptember 24."), and each
 * `.play-line` carrying the hour and minute in separate elements. The stage
 * comes from the badge's `title` attribute, which holds the full name
 * ("Gobbi Hilda Színpad") where the badge text is a two-letter code.
 */
export function parseProgram(html: string): ProgramOccurrence[] {
  const $ = cheerio.load(html);
  const out: ProgramOccurrence[] = [];

  $(".date-item").each((_, dayEl) => {
    const year = normalizeText($(dayEl).find(".date-day .year").first().text()) ?? "";
    const day = normalizeText($(dayEl).find(".date-day .day").first().text()) ?? "";
    const date = parseHungarianDate(`${year} ${day}`);
    if (!date) return;

    $(dayEl)
      .find(".play-line")
      .each((_, playEl) => {
        const href = $(playEl).find(".play-data .title a").first().attr("href") ?? "";
        const clean = href.split("?")[0].replace(/\/+$/, "");
        if (!PRODUCTION_HREF.test(clean)) return;

        const hour = normalizeText($(playEl).find(".time .hour").first().text());
        const minute = normalizeText($(playEl).find(".time .min").first().text());
        if (!hour || !minute) return;

        const room = normalizeText($(playEl).find(".stage").first().attr("title"));

        out.push({
          slug: slugOf(clean),
          startsAt: budapestLocalToUtcIso(
            `${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`
          ),
          room,
        });
      });
  });

  return out;
}

async function run(): Promise<SyncedPlay[]> {
  const indexHtml = await fetchText(`${BASE_URL}/repertoar`, { crawlDelayMs: CRAWL_DELAY_MS });
  const detailUrls = productionLinksIn(indexHtml);

  const programHtml = await fetchText(`${BASE_URL}/musor`, { crawlDelayMs: CRAWL_DELAY_MS });
  const occurrencesBySlug = new Map<string, ProgramOccurrence[]>();
  for (const occ of parseProgram(programHtml)) {
    const list = occurrencesBySlug.get(occ.slug) ?? [];
    list.push(occ);
    occurrencesBySlug.set(occ.slug, list);
  }

  const plays: SyncedPlay[] = [];
  for (const url of detailUrls) {
    const slug = slugOf(url);
    const html = await fetchText(url, { crawlDelayMs: CRAWL_DELAY_MS });
    const details = parseProductionDetail(html);
    if (!details) continue;

    const occurrences = occurrencesBySlug.get(slug) ?? [];

    plays.push({
      sourceKey: slug,
      sourceUrl: url,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.nemzeti,
      // The site publishes no genre field. Left undefined so the classifier
      // can fall back to the venue's own profile and label it as the
      // assumption it is — see supabase/migrations/0016_genre_taxonomy.sql.
      genre: undefined,
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      cast: details.cast,
      performances: occurrences.map((o) => ({
        sourceKey: `${slug}:${o.startsAt}`,
        startsAt: o.startsAt,
        room: o.room,
      })),
    });
  }

  return plays;
}

export const nemzetiAdapter: SyncAdapter = { name: "nemzeti", run };
