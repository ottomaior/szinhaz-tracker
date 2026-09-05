import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionDetail, parseProgram, productionLinksIn, slugOf } from "./vojtina";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

/**
 * Run against recorded pages rather than the live site, for the reason every
 * adapter here has a fixture: a theatre changing its markup should fail a test
 * rather than quietly empty a section of the catalogue.
 */
describe("productionLinksIn", () => {
  const html = fixture("vojtina-eloadasok.html");

  it("finds the productions on the index", () => {
    expect(productionLinksIn(html).length).toBeGreaterThan(25);
  });

  it("returns id-prefixed detail paths and nothing else", () => {
    for (const href of productionLinksIn(html)) {
      expect(href).toMatch(/^\/eloadasok\/\d+-[^/]+$/);
    }
  });

  it("does not pick up the section landing pages", () => {
    // `/eloadasok/bemutatok`, `/eloadasok/repertoar` and `/eloadasok/archiv`
    // sit in the same nav as the productions and are not productions.
    const links = productionLinksIn(html);
    expect(links).not.toContain("/eloadasok/repertoar");
    expect(links).not.toContain("/eloadasok/archiv");
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(fixture("vojtina-csudakard.html"));

  it("reads the production", () => {
    expect(details).toBeDefined();
    expect(details?.title).toBe("A csudakard története");
  });

  it("reads the credits from their labels rather than by position", () => {
    expect(details?.director).toBe("Láposi Terka");
    expect(details?.author).toBe("Benedek Elek, Láposi Terka");
  });

  it("reads the runtime out of the header strip", () => {
    expect(details?.runtimeMinutes).toBe(45);
  });

  it("reads the stage, which is written as a name and a street address", () => {
    // The point of the address-shaped match: no list of room words contains
    // "BábTér", and this theatre uses it as a stage name.
    expect(details?.room).toContain("Fényes terem");
  });

  it("reads the all-numeric premiere date", () => {
    expect(details?.premiereDate).toBe("2023-01-17");
  });

  it("keeps the premiere out of the synopsis", () => {
    // The premiere sits inside the synopsis column as its own span, so it has
    // to be removed before the blurb is read or it lands at the end of it.
    expect(details?.synopsis).toBeTruthy();
    expect(details?.synopsis).not.toContain("Bemutató");
    expect(details?.synopsis).toContain("Csudálatos álmot");
  });

  it("reads the cast, labelling performers from their column heading", () => {
    expect(details?.cast.length).toBeGreaterThan(0);
    const performer = details?.cast.find((c) => c.name === "Magi Krisztina");
    expect(performer).toBeDefined();
    expect(performer?.role).toBeTruthy();
  });

  it("takes the poster off the page and makes it absolute", () => {
    expect(details?.posterUrl).toMatch(/^https:\/\/www\.vojtinababszinhaz\.hu\/uploads\//);
  });
});

describe("parseProductionDetail on an exhibition", () => {
  it("rejects it rather than filing a display case as a play", () => {
    // "Világközép" is a permanent exhibition of the Kemény family's puppets,
    // listed in the same index as the productions. It has no director, no cast
    // and no runtime, and nobody can have seen it performed.
    expect(parseProductionDetail(fixture("vojtina-kiallitas.html"))).toBeUndefined();
  });
});

describe("parseProgram", () => {
  const occurrences = parseProgram(fixture("vojtina-musor.html"));

  it("finds the published showtimes", () => {
    expect(occurrences.length).toBeGreaterThan(5);
  });

  it("points each showtime at a production slug", () => {
    for (const o of occurrences) {
      expect(o.slug).toMatch(/^\d+-/);
    }
  });

  it("stores the curtain as a real UTC instant, not the wall clock", () => {
    // The page renders Budapest local time with no offset. A 10:00 show in
    // September is 08:00Z; storing "10:00Z" would tell a reader to arrive two
    // hours late.
    for (const o of occurrences) {
      expect(o.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
    const first = occurrences[0];
    const budapest = new Date(first.startsAt).toLocaleTimeString("hu-HU", {
      timeZone: "Europe/Budapest",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // Theatres do not raise the curtain in the small hours; a timezone slip
    // large enough to matter would show up here.
    const hour = Number(budapest.slice(0, 2));
    expect(hour).toBeGreaterThanOrEqual(8);
    expect(hour).toBeLessThanOrEqual(22);
  });

  it("sorts nothing it cannot date", () => {
    expect(occurrences.every((o) => !Number.isNaN(Date.parse(o.startsAt)))).toBe(true);
  });
});

describe("slugOf", () => {
  it("takes the last path segment", () => {
    expect(slugOf("/eloadasok/19-a-csudakard-tortenete")).toBe("19-a-csudakard-tortenete");
    expect(slugOf("/eloadasok/19-a-csudakard-tortenete/")).toBe("19-a-csudakard-tortenete");
  });
});
