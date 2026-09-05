import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanGenre, parseEvents, parseProductionDetail, productionLinksIn, slugOf } from "./central";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

describe("productionLinksIn", () => {
  const html = fixture("central-eloadasok.html");

  it("finds the repertoire and the archive in one index", () => {
    expect(productionLinksIn(html).length).toBeGreaterThan(40);
  });

  it("carries the archived productions, which are the -archiv slugs", () => {
    const archived = productionLinksIn(html).filter((l) => /-archiv\/$/.test(l));
    expect(archived.length).toBeGreaterThan(20);
  });

  it("deduplicates by slug", () => {
    const links = productionLinksIn(html);
    expect(new Set(links.map(slugOf)).size).toBe(links.length);
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(fixture("central-a-kripli.html"));

  it("reads the production", () => {
    expect(details?.title).toBe("A kripli");
  });

  it("reads the playbill's key/value rows", () => {
    expect(details?.author).toBe("Martin McDonagh");
    expect(details?.director).toBe("Puskás Dávid");
    expect(details?.premiereDate).toBe("2025-03-29");
    expect(details?.room).toBe("Nagyszínpad");
  });

  it("reads the genre the theatre itself publishes", () => {
    // Rare among these sources, and the reason this one reaches
    // genre_normalized with genre_source = 'source' rather than an assumption.
    expect(details?.genre).toBe("vígjáték");
  });

  it("reads the runtime out of the one sentence that states it", () => {
    /*
     * "Az előadást egy szünettel játsszuk, időtartama 2 óra 15 perc."
     *
     * The page also says the auditorium is kept at 20-21 °C, quotes audience
     * reviews and carries press extracts. Handing all of that to the duration
     * parser is what made the first version of this read a runtime off the
     * wrong sentence for all but three productions.
     */
    expect(details?.runtimeMinutes).toBe(135);
    expect(details?.intermissions).toBe(1);
  });

  it("reads the cast with their characters", () => {
    const cast = details?.cast ?? [];
    expect(cast.length).toBeGreaterThan(5);
    expect(cast.some((c) => c.name === "Básti Juli" && c.role === "Eileen")).toBe(true);
  });
});

describe("cleanGenre", () => {
  it("keeps a single term as it is, lowercased", () => {
    expect(cleanGenre("Vígjáték")).toBe("vígjáték");
  });

  it("drops the premiere marker, which is not a genre", () => {
    // "Bemutató" says the production is new this season. True, useful, and
    // already recorded in premiere_date — but not what kind of evening it is.
    expect(cleanGenre("Bemutató, Színmű")).toBe("színmű");
  });

  it("takes the first real term out of a slash-separated list", () => {
    expect(cleanGenre("bemutató / színmű / vígjáték")).toBe("színmű");
  });

  it("returns nothing when there is nothing left", () => {
    expect(cleanGenre("Bemutató")).toBeUndefined();
    expect(cleanGenre(undefined)).toBeUndefined();
    expect(cleanGenre("   ")).toBeUndefined();
  });
});

describe("parseEvents", () => {
  it("converts the calendar's local time into a real UTC instant", () => {
    /*
     * The API returns a `utc_start_date` that is byte-identical to
     * `start_date` on this installation — the WordPress timezone is
     * misconfigured — so trusting the field named "utc" would put every
     * performance two hours early. 19:00 Budapest in September is 17:00Z.
     */
    const [occurrence] = parseEvents([{ title: "Furcsa pár", start_date: "2026-09-18 19:00:00" }]);
    expect(occurrence.startsAt).toBe("2026-09-18T17:00:00.000Z");
  });

  it("keys an occurrence by its title so it can be matched to a production", () => {
    // The event slug carries an occurrence counter ("furcsa-par-3"), and the
    // repertoire contains a production actually called "222", so stripping a
    // trailing number to match slugs would mangle it.
    const [occurrence] = parseEvents([{ title: "Furcsa pár", start_date: "2026-09-18 19:00:00" }]);
    expect(occurrence.titleKey).toBe("furcsa par");
  });

  it("skips an event with nothing usable on it", () => {
    expect(parseEvents([{ title: "Furcsa pár" }, { start_date: "2026-09-18 19:00:00" }, {}])).toHaveLength(0);
  });
});
