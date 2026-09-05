import { describe, expect, it } from "vitest";
import { eventStartsAt, isOwnHouse, isRecentEnough, isUpcomingPremiere, toSyncedPlay } from "./vigszinhaz";

/**
 * No recorded page here, unlike the other adapters.
 *
 * Those fixtures exist to catch a theatre changing its markup, which is the
 * failure that has actually happened on this project. This source is a JSON
 * API with named fields, so there is no markup to drift; what can go wrong is
 * the reasoning applied to those fields — which house counts as ours, how far
 * back to read, whether a production is still playable, and whether a
 * timestamp is an instant or a wall clock. Those are what is tested.
 */

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

  it("reports no cast rather than inventing one", () => {
    // The one field this source does not publish anywhere reachable.
    expect(toSyncedPlay(CSERESZNYESKERT, GENRES, [])?.cast).toEqual([]);
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

describe("isUpcomingPremiere", () => {
  const today = new Date("2026-09-05T12:00:00Z");

  it("is true only for a premiere still to come", () => {
    expect(isUpcomingPremiere("2026-12-01", today)).toBe(true);
    expect(isUpcomingPremiere("2024-02-17", today)).toBe(false);
    expect(isUpcomingPremiere(null, today)).toBe(false);
  });
});
