import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionDetail, parseSchedule, productionLinksIn, slugOf } from "./madach";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

describe("productionLinksIn", () => {
  it("finds the repertoire", () => {
    const links = productionLinksIn(fixture("madach-repertoar.html"));
    expect(links.length).toBeGreaterThan(15);
    expect(links.every((l) => l.startsWith("https://madachszinhaz.hu/szindarab/"))).toBe(true);
  });

  it("deduplicates by slug", () => {
    const links = productionLinksIn(fixture("madach-repertoar.html"));
    expect(new Set(links.map(slugOf)).size).toBe(links.length);
  });
});

describe("the schedule as a second source of productions", () => {
  it("lists productions the repertoire index does not", () => {
    /*
     * `/repertoar` is not the full catalogue. Evita opens on 18 September, is
     * the first row on the schedule and carries a "Bemutató" badge, and is
     * absent from the repertoire index — that page appears to list established
     * repertoire, which a production joins some time after opening.
     *
     * Driving from the index alone therefore missed exactly the productions a
     * listings app most needs, and left 36 showtimes pointing at a play that
     * was not in the catalogue at all.
     */
    const fromIndex = new Set(productionLinksIn(fixture("madach-repertoar.html")).map(slugOf));
    const fromSchedule = new Set(productionLinksIn(fixture("madach-musor.html")).map(slugOf));

    const onlyScheduled = [...fromSchedule].filter((slug) => !fromIndex.has(slug));
    expect(onlyScheduled.length).toBeGreaterThan(0);
    expect(onlyScheduled).toContain("evita");
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(fixture("madach-evita.html"));

  it("reads the production and its genre", () => {
    expect(details?.title).toBe("Evita");
    // Madách is where the catalogue's musicals actually come from; before this
    // adapter the genre existed almost entirely as titles inferred from their
    // composers.
    expect(details?.genre).toBe("musical");
  });

  it("picks the director and not the people credited beside them", () => {
    // The creators list also contains "A rendező munkatársai", which a
    // substring match on "rendező" would take instead.
    expect(details?.director).toBe("Szirtes Tamás");
  });

  it("gives every performer who covers a part their own credit", () => {
    /*
     * A long-running musical alternates its leads — three Evitas, three Ches.
     * `play_cast` is keyed on (play_id, name, role), which is exactly that
     * shape, so each performer becomes a row against the same character
     * rather than one of them being picked arbitrarily.
     */
    const evitas = (details?.cast ?? []).filter((c) => c.role === "Evita");
    expect(evitas.length).toBeGreaterThan(1);
    expect(evitas.map((c) => c.name)).toContain("Gadó Anita");
  });

  it("reads the plot, not the licensing notice printed above it", () => {
    // The info section holds two text blocks and the rights notice comes
    // first, so taking the first one gave every production the same paragraph
    // about Theatrum Mundi as its synopsis.
    expect(details?.synopsis).toBeTruthy();
    expect(details?.synopsis).toContain("Eva Perón");
    expect(details?.synopsis).not.toContain("Theatrum Mundi");
  });

  it("recovers the writers from the rights notice", () => {
    // A musical credits its book and score there rather than in the creators
    // list, which is why every musical came back with no author at all until
    // this block was read.
    expect(details?.author).toBe("Tim Rice – Andrew Lloyd Webber");
  });

  it("takes the poster from the lazy-loaded attribute", () => {
    // `src` is empty on this theme; the URL lives in `data-src`.
    expect(details?.posterUrl).toMatch(/^https:\/\/i\.madachszinhaz\.hu\//);
  });
});

describe("parseSchedule", () => {
  // The page writes days without a year, so the result depends on when it is
  // read. Pinned here so the assertions do not drift with the calendar.
  const today = new Date("2026-09-05T12:00:00Z");
  const occurrences = parseSchedule(fixture("madach-musor.html"), today);

  it("finds the showtimes", () => {
    expect(occurrences.length).toBeGreaterThan(50);
  });

  it("resolves the year the page leaves implicit", () => {
    for (const o of occurrences) {
      expect(o.startsAt).toMatch(/^20\d{2}-\d{2}-\d{2}T/);
    }
  });

  it("drops the touring dates at other venues", () => {
    /*
     * The programme includes performances at the Audi Aréna in Győr and the
     * Főnix Aréna in Debrecen. They are real, but they do not happen at this
     * theatre, and a Debrecen arena date filed under a Budapest venue would
     * show up the moment anyone filtered Discover by city.
     */
    const rooms = occurrences.map((o) => o.room ?? "");
    expect(rooms.some((r) => /aréna/i.test(r))).toBe(false);
    expect(occurrences.length).toBeLessThan(134);
  });

  it("keeps the stage but never the theatre's own name as one", () => {
    const rooms = new Set(occurrences.map((o) => o.room).filter(Boolean));
    expect(rooms.size).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room).not.toMatch(/^madách színház$/i);
    }
  });

  it("stores the curtain as a real UTC instant", () => {
    for (const o of occurrences.slice(0, 20)) {
      const hour = Number(
        new Date(o.startsAt)
          .toLocaleTimeString("hu-HU", { timeZone: "Europe/Budapest", hour: "2-digit", hour12: false })
          .slice(0, 2)
      );
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThanOrEqual(22);
    }
  });
});

describe("non-performances", () => {
  it("is documented as excluded by genre", () => {
    // "Kulisszájárás" is a guided walk through the building, sold and listed
    // beside the repertoire. The theatre's own genre label is what identifies
    // it, the same way Vojtina's exhibitions are identified by "Kiállítás".
    const links = productionLinksIn(fixture("madach-repertoar.html"));
    expect(links.some((l) => /seta|kulissza/i.test(l))).toBe(true);
  });
});
