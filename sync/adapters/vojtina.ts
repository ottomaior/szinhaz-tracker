/**
 * Vojtina Bábszínház (Debrecen) — scraped from the theatre's own site.
 *
 * The reason this one is worth having is not just "another theatre". Debrecen
 * had exactly one venue in the catalogue, Csokonai, which is why Discover's
 * theatre chips hide themselves when you pick Debrecen: a filter row with one
 * option in it cannot change anything. This is the second, and it is also the
 * catalogue's first puppet theatre, so it gives `genre_normalized` its first
 * real `báb` values rather than another few dozen rows of prose.
 *
 * robots.txt is not a constraint here — the host serves an HTML 404 for it
 * rather than a robots file at all, so nothing is disallowed. Pacing is
 * courtesy, as with the other own-site scrapes.
 *
 * Two passes, both checked against live pages:
 *  1. `/eloadasok` — every production's detail URL, as `/eloadasok/{id}-{slug}`.
 *     One page, no pagination; 37 productions at the time of writing.
 *  2. Each detail page — title, form, runtime, stage, director, author,
 *     designer, synopsis, premiere date, cast and creators.
 * Then `/musor` for showtimes.
 *
 * `/musor` is a single request for the theatre's entire published programme.
 * The page offers month links (`?month=YYYY-MM`) but the unfiltered view is
 * the "összes" tab and already contains everything, so unlike Csokonai and
 * Örkény there is no month walk to do here.
 *
 * The markup is Bootstrap with semantic class names (`.viewPageTitle`,
 * `.showInformationItem`, `.creditsBox`, `.programColumn`), which is what the
 * selectors below hang off. If this starts returning 0 plays, those are the
 * first thing to check.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../lib/http";
import { budapestLocalToUtcIso, parseHungarianDate } from "../lib/huDate";
import { parseDurationHu } from "../lib/huDuration";
import { normalizeText, stripHtml } from "../lib/normalize";
import { VENUE_IDS } from "../venueMap";
import type { SyncAdapter, SyncedPlay } from "../lib/types";

const BASE_URL = "https://www.vojtinababszinhaz.hu";
const CRAWL_DELAY_MS = 800;

/**
 * Vojtina is a puppet theatre and every production it stages is puppetry, but
 * the site publishes no genre field — the slot in its own header holds the
 * theatrical *form* ("Kamarajáték", "Vásári komédia"), which is a different
 * thing. Rather than write that into `genre` where it would be mistaken for a
 * taxonomy term, this adapter reports nothing and the venue's own
 * `default_genre` of `báb` supplies the answer, labelled `venue_default`.
 * See supabase/migrations/0016_genre_taxonomy.sql.
 */
const PRODUCTION_HREF = /^\/eloadasok\/\d+-[^/]+$/;

/**
 * Forms that are not a performance.
 *
 * The theatre lists its exhibitions in the same index as its productions —
 * "Világközép" and "Vitéz László Látvány-Tár" are permanent displays of the
 * Kemény family's puppets, with no director, no cast and no runtime, and they
 * would otherwise sit in the catalogue as loggable plays nobody can have seen
 * performed. This is Vojtina's version of the talks-and-building-tours problem
 * the Csokonai adapter solves with taxonomy terms.
 *
 * Only "Kiállítás" is excluded, and only because an exhibition is
 * unambiguously not a performance. "Egyéb" ("other") is deliberately kept
 * despite also covering an open day: it is too broad a bucket to discard on
 * the strength of its name, and a production wrongly dropped is invisible in a
 * way a wrongly kept one is not.
 */
const NON_PERFORMANCE_FORMS = /^kiállítás$/i;

type ProductionDetails = {
  title: string;
  author: string;
  director: string;
  synopsis?: string;
  runtimeMinutes?: number;
  intermissions?: number;
  premiereDate?: string;
  posterUrl?: string;
  room?: string;
  cast: { name: string; role: string }[];
};

export function slugOf(detailUrl: string): string {
  return detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;
}

function absolute(href: string): string {
  return href.startsWith("http") ? href : `${BASE_URL}${href}`;
}

/** Every production detail path on the repertoire index. */
export function productionLinksIn(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href^="/eloadasok/"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").split("?")[0].replace(/\/+$/, "");
    if (PRODUCTION_HREF.test(href)) urls.add(href);
  });
  return [...urls];
}

/**
 * The label/value pairs in the credits column.
 *
 * Each `li.creditsBox` holds a role in a `<p>` and the person either as a link
 * into the company directory or as a plain span. The two columns are headed
 * "Szereplők" (performers) and "Alkotók" (creators); performers carry no role
 * text of their own, so they are labelled from the column heading instead of
 * being stored with an empty role.
 */
function parseCredits($: cheerio.CheerioAPI): { name: string; role: string }[] {
  const out: { name: string; role: string }[] = [];

  $(".creditsContainer .col-12").each((_, column) => {
    const heading = normalizeText($(column).find("p[style*='bold']").first().text()) ?? "";
    const isPerformer = /szereplő/i.test(heading);

    $(column)
      .find("li.creditsBox")
      .each((_, box) => {
        const name = normalizeText($(box).find("a.hasLink, span.noLink").first().text());
        if (!name) return;
        const ownRole = normalizeText($(box).find("p").first().text());
        const role = ownRole || (isPerformer ? "Szereplő" : heading || "Alkotó");
        out.push({ name, role });
      });
  });

  return out;
}

export function parseProductionDetail(html: string): ProductionDetails | undefined {
  const $ = cheerio.load(html);

  const title = normalizeText($(".viewPageTitle").first().text());
  if (!title) return undefined;

  // The header strip carries the age rating, the form, the runtime and the
  // stage, in that order but not always all four — an empty span is normal.
  // Read by shape rather than by position: the runtime is the one that
  // mentions minutes, and the stage is the one naming a room.
  const chips = $(".showInformationColumn .showInformationItem")
    .map((_, el) => normalizeText($(el).text()) ?? "")
    .get()
    .filter(Boolean);

  const runtimeChip = chips.find((c) => /\d+\s*(perc|óra)/i.test(c));
  const { runtimeMinutes, intermissions } = parseDurationHu(runtimeChip);

  // "Fényes terem - Kossuth u. 1.", "Vitéz László BábTér - Kossuth u. 1." —
  // the stage is always written as a name followed by the building's street
  // address. Matching that shape rather than a list of room words is what
  // catches "BábTér", which no list of terem/stúdió/színpad would have.
  const roomChip = chips.find((c) => /\s-\s/.test(c) && /(u\.|utca|tér|krt\.|körút)/i.test(c));

  // Age ratings share the strip: "3+", "5+", "3m", and sometimes a whole
  // phrase ("3 hónapos kortól 3 éves korig"). Recognised here so that they
  // cannot be mistaken for the theatrical form below.
  const isAgeChip = (c: string) => /^\d+\s*[+m]$/i.test(c) || /kortól|éves korig|hónapos/i.test(c);

  // Whatever is left is the form — "Kamarajáték", "Rítusjáték", "Kiállítás".
  const form = chips.find((c) => c !== runtimeChip && c !== roomChip && !isAgeChip(c));
  if (form && NON_PERFORMANCE_FORMS.test(form)) return undefined;

  const room = roomChip;

  const fieldValue = (label: RegExp): string | undefined => {
    let value: string | undefined;
    $("p.fw-bold").each((_, el) => {
      if (value) return;
      if (label.test($(el).text())) value = normalizeText($(el).next("p").text());
    });
    return value;
  };

  const director = fieldValue(/rendezte/i) ?? "";
  const author = fieldValue(/^\s*írta/i) ?? "";

  // The premiere sits inside the synopsis column as its own span, so it has to
  // come out before the synopsis text is read or it lands in the blurb.
  const column = $(".textEditorColumn").first();
  const premiereText = column.find(".showInformationItem").first().text();
  const premiereDate = parseHungarianDate(premiereText);
  column.find(".showInformationItem").remove();
  const synopsis = stripHtml(column.html() ?? undefined);

  const posterPath = $(".showViewPageImage").first().attr("src");

  return {
    title,
    author,
    director,
    synopsis,
    runtimeMinutes,
    intermissions,
    premiereDate,
    posterUrl: posterPath ? absolute(posterPath) : undefined,
    room,
    cast: parseCredits($),
  };
}

export type ProgramOccurrence = { slug: string; startsAt: string };

/**
 * Showtimes off `/musor`.
 *
 * Each `.programColumn` links to the production and carries the date as
 * "2026.09.13." with the weekday and time in the following span. The date and
 * the time are rendered as Budapest wall-clock with no zone, so they go
 * through budapestLocalToUtcIso rather than being treated as UTC — the
 * difference is one or two hours, which is exactly wrong for a listing whose
 * whole purpose is saying when to turn up.
 */
export function parseProgram(html: string): ProgramOccurrence[] {
  const $ = cheerio.load(html);
  const out: ProgramOccurrence[] = [];

  $(".programColumn").each((_, el) => {
    const href = ($(el).find("a.programTitle").first().attr("href") ?? "").split("?")[0].replace(/\/+$/, "");
    if (!PRODUCTION_HREF.test(href)) return;

    const dateText = normalizeText($(el).find(".programDateTop").first().text());
    const date = parseHungarianDate(dateText);
    if (!date) return;

    // The weekday and the time share one span: "vasárnap 10:00".
    const timeText = normalizeText($(el).find(".programDate span").last().text()) ?? "";
    const time = timeText.match(/(\d{1,2}):(\d{2})/);
    if (!time) return;

    out.push({
      slug: slugOf(href),
      startsAt: budapestLocalToUtcIso(`${date}T${time[1].padStart(2, "0")}:${time[2]}:00`),
    });
  });

  return out;
}

async function run(): Promise<SyncedPlay[]> {
  const indexHtml = await fetchText(`${BASE_URL}/eloadasok`, { crawlDelayMs: CRAWL_DELAY_MS });
  const detailPaths = productionLinksIn(indexHtml);

  // One request for the whole published programme, grouped by production.
  const programHtml = await fetchText(`${BASE_URL}/musor`, { crawlDelayMs: CRAWL_DELAY_MS });
  const occurrencesBySlug = new Map<string, ProgramOccurrence[]>();
  for (const occ of parseProgram(programHtml)) {
    const list = occurrencesBySlug.get(occ.slug) ?? [];
    list.push(occ);
    occurrencesBySlug.set(occ.slug, list);
  }

  const plays: SyncedPlay[] = [];
  for (const path of detailPaths) {
    const slug = slugOf(path);
    const html = await fetchText(absolute(path), { crawlDelayMs: CRAWL_DELAY_MS });
    const details = parseProductionDetail(html);
    if (!details) continue;

    const occurrences = occurrencesBySlug.get(slug) ?? [];

    plays.push({
      sourceKey: slug,
      title: details.title,
      author: details.author,
      director: details.director,
      venueId: VENUE_IDS.vojtinaDebrecen,
      // Nothing here: the site publishes a theatrical form, not a genre. See
      // the note at the top of this file.
      genre: undefined,
      runtimeMinutes: details.runtimeMinutes,
      intermissions: details.intermissions,
      premiereDate: details.premiereDate,
      synopsis: details.synopsis,
      posterUrl: details.posterUrl,
      cast: details.cast,
      performances: occurrences.map((o) => ({
        // The source publishes no per-showtime id, so the production and the
        // instant together are the stable key — the same pair that identifies
        // the performance to a person holding a ticket.
        sourceKey: `${slug}:${o.startsAt}`,
        startsAt: o.startsAt,
        room: details.room,
      })),
    });
  }

  return plays;
}

export const vojtinaAdapter: SyncAdapter = { name: "vojtina", run };
