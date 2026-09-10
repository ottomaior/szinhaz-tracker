import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  eventStartsAt,
  isOwnHouse,
  isRecentEnough,
  isUpcomingPremiere,
  parseCastPayload,
  parseProductionCast,
  toSyncedPlay,
} from "./vigszinhaz";

/**
 * Two kinds of test here, because this source is two sources.
 *
 * The catalogue comes from a JSON API with named fields, so there is no
 * markup to drift and what can go wrong is the reasoning applied to those
 * fields — which house counts as ours, how far back to read, whether a
 * production is still playable, whether a timestamp is an instant or a wall
 * clock. Those are tested against literals.
 *
 * The cast comes from the production page, which is markup and can drift, so
 * it gets recorded fixtures like every other scraped source.
 */

/** Production pages, recorded from the live site on 10 September 2026. */
const allamtitkar = readFileSync(join(__dirname, "../__fixtures__/vigszinhaz-az-allamtitkar-ur.html"), "utf8");
const palUtcaiFiuk = readFileSync(join(__dirname, "../__fixtures__/vigszinhaz-a-pal-utcai-fiuk.html"), "utf8");
/**
 * The third rendering mode, and the reason `parseCastPayload` exists: this
 * page's cast section is an empty placeholder, and its fifty-five names only
 * exist in the streamed data.
 */
const haMajd = readFileSync(join(__dirname, "../__fixtures__/vigszinhaz-ha-majd-egyszer.html"), "utf8");

/**
 * The person directory, trimmed to the 142 people these three pages credit.
 *
 * The live endpoint returns 3,120; the cast payload names people by id and
 * nothing else, so the test needs the lookup but not all of it.
 */
const persons = JSON.parse(readFileSync(join(__dirname, "../__fixtures__/vigszinhaz-persons.json"), "utf8")) as {
  items: { id: number; full_name: { hu: string } }[];
};
const nameById = new Map(persons.items.map((p) => [p.id, p.full_name.hu]));

const CSERESZNYESKERT = {
  id: 812,
  title: { hu: "Cseresznyéskert", en: "The Cherry Orchard" },
  authors: { hu: "Anton Pavlovics Csehov" },
  slug: { hu: "cseresznyeskert", en: "cseresznyeskert" },
  length: 165,
  number_of_intervals: 1,
  premiere_date: "2024-02-17",
  genre: 41,
  short_description: { hu: "<p>A cseresznyéskert – vagyis eredetileg meggyes – nemcsak egy gyümölcsliget.</p>" },
  list_image: { original: { url: "/media/images/cseresznyeskert.original.jpg" } },
  location: { name: { hu: "Vígszínház" } },
  director: { full_name: { hu: "Eszenyi Enikő", en: "Enikő Eszenyi" } },
  is_published: true,
  is_visible: true,
};

const GENRES = new Map([[41, "színmű két részben"]]);

describe("isOwnHouse", () => {
  it("accepts the company's own stages", () => {
    for (const house of ["Vígszínház", "Pesti Színház", "Házi Színpad", "Víg Szalon"]) {
      expect(isOwnHouse(house)).toBe(true);
    }
  });

  it("accepts the years the company spent in the Rádius building", () => {
    // The name still says Vígszínház, because it still was.
    expect(isOwnHouse("Vígszínház, ideiglenesen a Rádius épületében")).toBe(true);
  });

  it("rejects the theatres the company merely appeared at", () => {
    /*
     * The productions feed reaches back to 1890 and includes work staged at
     * other people's venues. Those are real productions that did not happen
     * here, and importing them would put a century of other theatres'
     * programmes inside this one venue's row.
     */
    for (const other of ["Magyar Néphadsereg Színháza", "Ódry Színpad", "Népopera", "Cirkusz", "József Attila Színház"]) {
      expect(isOwnHouse(other)).toBe(false);
    }
  });

  it("rejects a missing location rather than assuming ours", () => {
    expect(isOwnHouse(undefined)).toBe(false);
  });
});

describe("isRecentEnough", () => {
  it("keeps work someone using the app could have seen", () => {
    expect(isRecentEnough("2024-02-17")).toBe(true);
    expect(isRecentEnough("1961-09-01")).toBe(true);
  });

  it("drops the nineteenth century", () => {
    // 70 productions from the 1890s are in this feed. All real; none loggable
    // by anyone alive.
    expect(isRecentEnough("1897-03-14")).toBe(false);
    expect(isRecentEnough("1959-12-31")).toBe(false);
  });

  it("keeps a production with no premiere date rather than dropping it", () => {
    expect(isRecentEnough(null)).toBe(true);
    expect(isRecentEnough(undefined)).toBe(true);
  });
});

describe("eventStartsAt", () => {
  it("uses the absolute timestamp the API provides", () => {
    /*
     * Unusually among these sources, this API returns a real UTC instant: a
     * 19:00 curtain in September comes back as 17:00Z. Recomputing it from the
     * local pair would be harmless here but pointless, and trusting the wrong
     * one of the two is how a listing ends up two hours out.
     */
    expect(eventStartsAt({ start_date_and_time: "2026-09-06T17:00:00Z" })).toBe("2026-09-06T17:00:00.000Z");
  });

  it("falls back to the local date and time, converted properly", () => {
    // 19:00 Budapest in September is 17:00Z.
    expect(eventStartsAt({ start_date: "2026-09-06", start_time: "19:00:00" })).toBe("2026-09-06T17:00:00.000Z");
  });

  it("converts a winter date with the offset that applied then", () => {
    // 19:00 Budapest in January is 18:00Z — one hour, not two.
    expect(eventStartsAt({ start_date: "2026-01-15", start_time: "19:00:00" })).toBe("2026-01-15T18:00:00.000Z");
  });

  it("returns nothing when there is no usable time", () => {
    expect(eventStartsAt({})).toBeUndefined();
    expect(eventStartsAt({ start_date: "2026-09-06" })).toBeUndefined();
  });
});

describe("toSyncedPlay", () => {
  it("maps the fields the API does publish", () => {
    const play = toSyncedPlay(CSERESZNYESKERT, GENRES, [{ startsAt: "2026-10-01T17:00:00.000Z", room: "Vígszínház" }]);
    expect(play?.title).toBe("Cseresznyéskert");
    expect(play?.author).toBe("Anton Pavlovics Csehov");
    expect(play?.director).toBe("Eszenyi Enikő");
    expect(play?.runtimeMinutes).toBe(165);
    expect(play?.intermissions).toBe(1);
    expect(play?.premiereDate).toBe("2024-02-17");
    expect(play?.genre).toBe("színmű két részben");
    expect(play?.posterUrl).toBe("https://vigszinhaz.hu/media/images/cseresznyeskert.original.jpg");
    expect(play?.synopsis).toContain("gyümölcsliget");
  });

  it("carries the cast it was handed", () => {
    const cast = [{ name: "Wunderlich József", role: "De la Mare" }];
    expect(toSyncedPlay(CSERESZNYESKERT, GENRES, [], cast)?.cast).toEqual(cast);
  });

  it("says nothing about the cast when the page was not read", () => {
    /*
     * Not the same as an empty cast, and the difference is 500 productions'
     * worth of credits: the runner clears the stored rows for `[]` and leaves
     * them alone for `undefined`. A shallow run's archive is the latter.
     */
    expect(toSyncedPlay(CSERESZNYESKERT, GENRES, [])?.cast).toBeUndefined();
  });

  it("counts a production with a future date as current", () => {
    const play = toSyncedPlay(CSERESZNYESKERT, GENRES, [{ startsAt: "2099-10-01T17:00:00.000Z" }]);
    expect(play?.isArchived).toBe(false);
  });

  it("archives a production with nothing scheduled", () => {
    /*
     * Read from the schedule rather than from `is_published`, which is true
     * for 393 productions at these houses where the theatre's own repertoire
     * page lists 57 — it means "has a page", not "is on".
     */
    expect(toSyncedPlay(CSERESZNYESKERT, GENRES, [])?.isArchived).toBe(true);
  });

  it("keeps an announced production out of the archive before it opens", () => {
    const announced = { ...CSERESZNYESKERT, premiere_date: "2099-01-01" };
    expect(toSyncedPlay(announced, GENRES, [])?.isArchived).toBe(false);
  });

  it("survives a field arriving as a bare string instead of a localized pair", () => {
    // A few fields on this API are a plain string where the rest are {hu, en},
    // and handing one of those to the text helpers threw and took the whole
    // adapter run down with it.
    const odd = { ...CSERESZNYESKERT, authors: "Csehov" as unknown as { hu: string } };
    expect(toSyncedPlay(odd, GENRES, [])?.author).toBe("Csehov");
  });

  it("skips a row with no title or slug", () => {
    expect(toSyncedPlay({ id: 1 }, GENRES, [])).toBeUndefined();
  });
});

describe("parseCastPayload", () => {
  it("reads a cast the markup does not contain at all", () => {
    /*
     * The page that started this: its cast section is an empty placeholder
     * and the browser fills it in from the streamed data, so the markup
     * parser sees nothing while the theatre's own site shows 55 names. It
     * showed as a production with no cast in the app.
     */
    expect(parseProductionCast(haMajd)).toBeUndefined();
    expect(parseCastPayload(haMajd, nameById)?.length).toBe(55);
  });

  it("agrees with the markup when the markup is there", () => {
    // Same page, both ways, same answer — which is what makes it safe to
    // prefer the payload everywhere rather than only where markup is missing.
    const payload = parseCastPayload(allamtitkar, nameById);
    const markup = parseProductionCast(allamtitkar);
    expect(payload).toEqual(markup);
  });

  it("reads the parts, the creative team and the alternates", () => {
    const cast = parseCastPayload(allamtitkar, nameById)!;
    expect(cast).toContainEqual({ name: "Wunderlich József", role: "De la Mare, államtitkár" });
    expect(cast).toContainEqual({ name: "Máté Gábor", role: "Rendező" });

    const bokas = parseCastPayload(palUtcaiFiuk, nameById)!.filter((c) => c.role === "Boka").map((c) => c.name);
    expect(bokas).toEqual(["Wunderlich József", "Medveczky Balázs", "Ertl Zsombor"]);
  });

  it("calls a performer with no part a Szereplő", () => {
    /*
     * An ensemble production repeats the group's own heading on every row, so
     * the role arrives as the plural "Szereplők" fifty-five times. Stored per
     * person that reads wrongly, and "Szereplő" is what the Csokonai, Katona
     * and Vojtina adapters already call the same thing.
     */
    const cast = parseCastPayload(haMajd, nameById)!;
    expect(cast.filter((c) => c.role === "Szereplő").length).toBe(18);
    expect(cast.some((c) => c.role === "Szereplők")).toBe(false);
  });

  it("keeps a chorus and a band under the names the house gives them", () => {
    // Those group headings are already singular enough to read well, unlike
    // "Szereplők", so they are stored as printed.
    const cast = parseCastPayload(haMajd, nameById)!;
    expect(cast.some((c) => c.role === "Kórus")).toBe(true);
    expect(cast.some((c) => c.role === "Zenekar")).toBe(true);
  });

  it("drops a person the directory cannot name rather than storing an id", () => {
    expect(parseCastPayload(allamtitkar, new Map())).toBeUndefined();
  });

  it("returns nothing for a page with no cast data", () => {
    expect(parseCastPayload("<html><body>semmi</body></html>", nameById)).toBeUndefined();
  });
});

describe("parseProductionCast", () => {
  const allamtitkarCast = parseProductionCast(allamtitkar)!;
  const palCast = parseProductionCast(palUtcaiFiuk)!;

  it("reads a part and the performer playing it", () => {
    // The `<dt>` carries the character and their description together, which
    // is how the house prints it and what the app shows beside the name.
    expect(allamtitkarCast).toContainEqual({ name: "Wunderlich József", role: "De la Mare, államtitkár" });
  });

  it("reads the creative team from the same list", () => {
    // The markup makes no structural distinction between a part and a job, so
    // neither does this — the same way katona-wp keeps its creators.
    expect(allamtitkarCast).toContainEqual({ name: "Máté Gábor", role: "Rendező" });
    expect(allamtitkarCast).toContainEqual({ name: "Khell Zsolt", role: "Díszlettervező" });
  });

  it("strips the guest marker from the name", () => {
    /*
     * `m.v.` sits in a span inside the heading, so reading the heading's text
     * would produce "Kovács Olivérm.v." — a name nobody has, on a person page
     * nothing else links to.
     */
    const gentil = allamtitkarCast.find((c) => c.role.startsWith("Gentil"));
    expect(gentil?.name).toBe("Kovács Olivér");
  });

  it("gives each alternate their own row against the same part", () => {
    // Three Bokas, and `play_cast` is keyed on (play_id, name, role) exactly
    // so all three can hold the part. Dropping the second and third is how an
    // alternate becomes uncreditable.
    const bokas = palCast.filter((c) => c.role === "Boka").map((c) => c.name);
    expect(bokas).toEqual(["Wunderlich József", "Medveczky Balázs", "Ertl Zsombor"]);
  });

  it("keeps a chorus line whole", () => {
    // Seventeen dancers under one heading, none of them named in an `alt`.
    expect(palCast.filter((c) => c.role === "Táncosok").length).toBe(17);
  });

  it("falls back to the image caption when a chip has no heading text", () => {
    // A few chips render an empty `alt`; a few others render an empty name.
    // Between the two there is always something, and neither is reliable
    // enough on its own.
    expect(palCast).toContainEqual({ name: "Nádas Gábor Dávid", role: "A fiatalabb Pásztor" });
  });

  it("says it does not know when the page names nobody", () => {
    /*
     * A partial page — this site answers with one regularly under a long run —
     * must not read as "nobody is in it". That would be believed, and the
     * production's stored credits deleted. Both shapes of partial page are
     * pinned here because both were seen: the section missing entirely, which
     * cost *Toldi* three attempts, and the section present but empty, which
     * cost *Sommerreise* and *A csárdáskirálynő* their credits before this
     * case was handled.
     */
    expect(parseProductionCast("<html><body><h1>Semmi</h1></body></html>")).toBeUndefined();
    expect(parseProductionCast('<html><body><section class="ProductionCast_block__x"></section></body></html>')).toBeUndefined();
  });
});

describe("isUpcomingPremiere", () => {
  const today = new Date("2026-09-05T12:00:00Z");

  it("is true only for a premiere still to come", () => {
    expect(isUpcomingPremiere("2026-12-01", today)).toBe(true);
    expect(isUpcomingPremiere("2024-02-17", today)).toBe(false);
    expect(isUpcomingPremiere(null, today)).toBe(false);
  });
});
