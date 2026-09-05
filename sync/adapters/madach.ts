/**
 * Madách Színház (Budapest) — scraped from the theatre's own site.
 *
 * The house that fills the musical-shaped hole in the catalogue. Its site
 * publishes a genre term on every production and it is mostly "musical", which
 * until now existed in the database almost entirely as five titles inferred
 * from their composers.
 *
 * A note on permissions, because this one is not the usual case. The site's
 * robots.txt is Cloudflare's content-signals boilerplate and *nothing else*:
 * the whole file is comments explaining what a content signal means, with no
 * `User-agent` block, no `Disallow`, and no signal values actually set. By the
 * text's own clause (c), an operator who sets no signal "neither grants nor
 * restricts permission" — so there is no expressed restriction here, and no
 * crawl rule to honour either. This is a listings sync reading facts (title,
 * date, stage), not a training crawl. Worth re-reading if that file ever grows
 * a real directive.
 *
 * Two passes:
 *  1. `/repertoar` — the productions.
 *  2. `/musor` — showtimes, with the stage.
 *
 * What this source does not publish, on any page checked: a runtime, an
 * interval count, or a premiere date. Those are left empty rather than guessed
 * at.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianMonthDay, resolveUpcomingYear } from "../lib/huDate";
import { normalizeText, stripHtml } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://madachszinhaz.hu";
const CRAWL_DELAY_MS = 800;

const PRODUCTION_HREF = /^\/szindarab\/[^/?#]+$/;

/**
 * The theatre's own house, as its schedule names it.
 *
 * Madách tours: the current programme includes dates at the Audi Aréna in Győr
 * and the Főnix Aréna in Debrecen. Those are real performances but they do not
 * happen at this venue, and filing them under `venues.id = madach` would put a
 * Debrecen arena date inside a Budapest theatre — visible immediately, since
 * Discover filters by city.
 */
const HOME_VENUE = /^madách színház$/i;

/** Matches the exact credit, not "A rendező munkatársai" beside it. */
const DIRECTOR_ROLE = /^rendező$/i;

/**
 * Genres that mean this is not a performance.
 *
 * "Kulisszajárás" is a guided walk through the building — the theatre sells
 * tickets to it and lists it beside the repertoire, but nobody sees a play.
 * The same problem Vojtina has with its exhibitions, and the theatre's own
 * genre label is the signal in both cases.
 */
const NON_PERFORMANCE_GENRES = /^(kulisszajárás|séta|tárlatvezetés)$/i;

type ProductionDetails = {
  title: string;
  genre?: string;
  director: string;
  author: string;
  synopsis?: string;
  posterUrl?: string;
  cast: { name: string; role: string }[];
};

export function slugOf(detailUrl: string): string {
  return detailUrl.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

/**
 * A person's name, de-shouted.
 *
 * The rights notice sets writers in capitals — "ANDREW LLOYD WEBBER" — and
 * storing that would shout in every list. Unlike a *title*, a person's name
 * can be recased safely: every word in a name is capitalised, so there is no
 * proper-noun judgement to get wrong. Anything not entirely uppercase is left
 * exactly as published, since then the source has already cased it.
 */
export function deShout(name: string): string {
  if (name !== name.toLocaleUpperCase("hu") || !/\p{Lu}/u.test(name)) return name;
  return name
    .toLocaleLowerCase("hu")
    .replace(/(^|[\s\-–'.])(\p{L})/gu, (_, boundary, letter) => boundary + letter.toLocaleUpperCase("hu"));
}

/**
 * The writers named in the rights notice.
 *
 * Reads the labelled parts of "Szöveg: TIM RICE - Zene: ANDREW LLOYD WEBBER",
 * which is where a musical's book and score are credited on this site. Only
 * the authorship labels are taken: the same notice also names the translator,
 * the orchestrator and the licensing agency, none of whom wrote the piece.
 */
const AUTHORSHIP_LABEL = /^(szöveg|zene|írta|szerző|könyv|dalszöveg)$/i;

export function writersIn(creditsText?: string): string[] {
  if (!creditsText) return [];

  /*
   * Every "Label: value" pair in the notice, with each value running until the
   * next label or the end of the string.
   *
   * The separator between pairs is inconsistent — a dash between the first two
   * ("Szöveg: TIM RICE - Zene: ANDREW LLOYD WEBBER") and a line break, so just
   * whitespace, between the rest. Scanning for the labels themselves and
   * treating everything between two of them as one value handles both, where
   * requiring a particular separator stopped after the first pair.
   */
  const out: string[] = [];
  const pattern = /(\p{L}+)\s*:\s*(.+?)(?=(?:\s*[-–]\s*)?\p{Lu}\p{L}*\s*:|$)/gsu;

  for (const match of creditsText.matchAll(pattern)) {
    if (!AUTHORSHIP_LABEL.test(match[1])) continue;
    const value = normalizeText(match[2])?.replace(/[-–\s]+$/, "");
    if (value) out.push(deShout(value));
  }

  return [...new Set(out)];
}

export function productionLinksIn(html: string): string[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, string>();
  $('a[href^="/szindarab/"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").split("?")[0].split("#")[0].replace(/\/+$/, "");
    if (!PRODUCTION_HREF.test(href)) return;
    bySlug.set(slugOf(href), `${BASE_URL}${href}`);
  });
  return [...bySlug.values()];
}

/** Role/name pairs from one of the two credit sections. */
function creditsIn($: cheerio.CheerioAPI, section: string): { role: string; names: string[] }[] {
  const out: { role: string; names: string[] }[] = [];
  $(`${section} li.role`).each((_, el) => {
    const role = normalizeText($(el).find("p.fill").first().text());
    const names = $(el)
      .find("ul.fill li")
      .map((_, n) => normalizeText($(n).text()) ?? "")
      .get()
      .filter(Boolean);
    if (role && names.length) out.push({ role, names });
  });
  return out;
}

export function parseProductionDetail(html: string): ProductionDetails | undefined {
  const $ = cheerio.load(html);

  const title = normalizeText($("h1.headline").first().text());
  if (!title) return undefined;

  const header = $("header.slide--play").first();
  // The genre sits beside a theatre-masks icon in the header strip.
  const genre = normalizeText(header.find("span.fw-b").first().text())?.toLowerCase();
  if (genre && NON_PERFORMANCE_GENRES.test(genre)) return undefined;

  const creators = creditsIn($, "#alkotok");
  const director = creators.find((c) => DIRECTOR_ROLE.test(c.role))?.names[0] ?? "";
  /*
   * Who wrote it, under whichever label this production files that under.
   *
   * Musicals are credited by job rather than by authorship — "Zene",
   * "Szövegkönyv", "Dalszöveg" — and a straight play uses "Írta" or "Szerző".
   * Several productions credit nobody at all in the creators list, and those
   * are left with an empty author rather than having the director promoted
   * into the field, which would be a different and wrong claim.
   */
  const author =
    creators.find((c) => /^(szerző|írta|zeneszerző|zene|szövegkönyv|dalszöveg)$/i.test(c.role))?.names.join(" – ") ??
    "";

  /*
   * The cast is a role with several possible performers — a long-running
   * musical alternates three Evitas — so each name becomes its own row against
   * the same character. `play_cast` is keyed on (play_id, name, role), which
   * is exactly this shape, and the app renders every performer who covers a
   * part rather than an arbitrary one of them.
   */
  const cast: { name: string; role: string }[] = [];
  for (const { role, names } of creditsIn($, "#szereposztas")) {
    for (const name of names) cast.push({ name, role });
  }
  // Designers and conductors are credits worth keeping, under their own roles.
  for (const { role, names } of creators) {
    if (DIRECTOR_ROLE.test(role)) continue;
    for (const name of names) cast.push({ name, role });
  }

  // Lazy-loaded, so the URL is in `data-src` and `src` is empty.
  const img = header.find(".p-img img").first();
  const posterUrl = img.attr("data-src") ?? img.attr("src");

  /*
   * The info section holds two text blocks: a short rights-and-credits notice
   * ("Szöveg: TIM RICE - Zene: ANDREW LLOYD WEBBER ... A Theatrum Mundi
   * közvetítésével") and the plot. They appear in that order, so taking the
   * first gives the licensing boilerplate as the synopsis. The plot is
   * reliably the longer of the two.
   */
  const blocks = $("section.section--info .txt")
    .map((_, el) => ({ html: $(el).html() ?? "", length: normalizeText($(el).text())?.length ?? 0 }))
    .get()
    .sort((a, b) => b.length - a.length);
  const synopsis = stripHtml(blocks[0]?.html || undefined);

  /*
   * That same credits block is where a musical's writers actually are — the
   * creators list beside it credits designers and conductors but often nobody
   * for the book or the score, which is why the author field came back empty
   * for every musical in the repertoire on the first pass.
   */
  const creditsText = blocks[blocks.length - 1]?.html ? stripHtml(blocks[blocks.length - 1].html) : undefined;
  const writers = author ? [author] : writersIn(creditsText);

  return {
    title,
    genre,
    director,
    author: writers.join(" – "),
    synopsis,
    posterUrl: posterUrl || undefined,
    cast,
  };
}

export type ScheduleOccurrence = { slug: string; startsAt: string; room?: string };

/**
 * Showtimes off `/musor`.
 *
 * Each `.row--schedule` names the day without a year ("szeptember 18."), the
 * way Katona's site does, so the year is resolved by assuming a theatre only
 * advertises dates that have not happened yet — see `resolveUpcomingYear`.
 *
 * Rows at other venues are dropped here rather than filtered later, so that a
 * touring date can never reach a `performances` row pointing at this theatre.
 */
export function parseSchedule(html: string, today = new Date()): ScheduleOccurrence[] {
  const $ = cheerio.load(html);
  const out: ScheduleOccurrence[] = [];

  $(".row--schedule").each((_, el) => {
    const href = ($(el).find("a.row-link").first().attr("href") ?? "").split("?")[0].replace(/\/+$/, "");
    if (!PRODUCTION_HREF.test(href)) return;

    const details = $(el).find(".hstk-2xs").first();
    const venue = normalizeText(details.find('a[href^="/helyszin/"]').first().text());
    if (!venue || !HOME_VENUE.test(venue)) return;

    const dayText = normalizeText($(el).find(".m-date").first().text());
    const monthDay = parseHungarianMonthDay(dayText);
    if (!monthDay) return;

    const time = details.text().match(/(\d{1,2}):(\d{2})/);
    if (!time) return;

    const year = resolveUpcomingYear(monthDay.month, monthDay.day, today);
    const date =
      `${year}-${String(monthDay.month).padStart(2, "0")}-${String(monthDay.day).padStart(2, "0")}`;

    // The stage is the last plain span in the detail strip, after the venue
    // link. Some rows carry none, which is why this is optional.
    const room = normalizeText(details.find("span.sec").last().text());

    out.push({
      slug: slugOf(href),
      startsAt: budapestLocalToUtcIso(`${date}T${time[1].padStart(2, "0")}:${time[2]}:00`),
      // The venue's own name turns up in that slot when there is no separate
      // stage; that is not a room.
      room: room && !HOME_VENUE.test(room) ? room : undefined,
    });
  });

  return out;
}

async function run(): Promise<SyncedPlay[]> {
  const indexHtml = await fetchText(`${BASE_URL}/repertoar`, { crawlDelayMs: CRAWL_DELAY_MS });
  const scheduleHtml = await fetchText(`${BASE_URL}/musor`, { crawlDelayMs: CRAWL_DELAY_MS });

  /*
   * Both pages, unioned — because `/repertoar` is not the full catalogue.
   *
   * Evita opens on 18 September, is the first row on the schedule and carries a
   * "Bemutató" badge, and does not appear in the repertoire index at all: that
   * page seems to list established repertoire, and a production joins it some
   * time after opening. Driving from the index alone therefore missed exactly
   * the productions a listings app most needs — the new ones — and left 80
   * showtimes pointing at a play that was not in the catalogue.
   */
  const detailUrls = [
    ...new Map(
      [...productionLinksIn(indexHtml), ...productionLinksIn(scheduleHtml)].map((url) => [slugOf(url), url])
    ).values(),
  ];

  const occurrencesBySlug = new Map<string, ScheduleOccurrence[]>();
  for (const occ of parseSchedule(scheduleHtml)) {
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
      venueId: VENUE_IDS.madach,
      genre: details.genre,
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

export const madachAdapter: SyncAdapter = { name: "madach", run };
