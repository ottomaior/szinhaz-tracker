import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionDetail, parseProgram, productionLinksIn, slugOf } from "./nemzeti";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

describe("productionLinksIn", () => {
  const html = fixture("nemzeti-repertoar.html");

  it("finds the repertoire", () => {
    expect(productionLinksIn(html).length).toBeGreaterThan(30);
  });

  it("collapses the duplicate links the index publishes", () => {
    // Several productions are linked twice, once plainly and once with
    // `?open=1`. Left alone that fetches and upserts each of them twice.
    const links = productionLinksIn(html);
    expect(new Set(links.map(slugOf)).size).toBe(links.length);
    expect(links.every((l) => !l.includes("?"))).toBe(true);
  });

  it("returns absolute urls", () => {
    expect(productionLinksIn(html).every((l) => l.startsWith("https://nemzetiszinhaz.hu/eloadas/"))).toBe(true);
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(fixture("nemzeti-mi-kis-varosunk.html"));

  it("reads the production", () => {
    expect(details?.title).toBe("A mi kis városunk");
  });

  it("takes the playwright from above the title, not from the credits", () => {
    expect(details?.author).toBe("Thornton Wilder");
  });

  it("picks the director and not an assistant director", () => {
    /*
     * This page carries three credits containing the word "rendező":
     * "Rendező", "Rendezőasszisztens", and "Rendező(asszisztens)". A substring
     * match takes whichever comes first in the markup, which here is an
     * assistant — so the role has to match exactly.
     */
    expect(details?.director).toBe("Ilja Bocsarnikovsz");
    expect(details?.director).not.toBe("Berettyán Nándor");
  });

  it("reads the runtime and that there is no interval", () => {
    expect(details?.runtimeMinutes).toBe(120);
    expect(details?.intermissions).toBe(0);
  });

  it("reads the premiere date, whose month is capitalised", () => {
    expect(details?.premiereDate).toBe("2026-03-06");
  });

  it("keeps the read-more link out of the synopsis", () => {
    expect(details?.synopsis).toBeTruthy();
    expect(details?.synopsis).not.toContain("Tovább...");
  });

  it("keeps the cast but not the author or director rows", () => {
    const cast = details?.cast ?? [];
    expect(cast.length).toBeGreaterThan(5);
    expect(cast.some((c) => /^rendező$/i.test(c.role))).toBe(false);
    expect(cast.some((c) => c.role === "Dr. Gibbs" && c.name === "Schnell Ádám")).toBe(true);
  });
});

describe("title casing", () => {
  it("recovers the theatre's own casing without inventing any", () => {
    /*
     * The h1 is styled in capitals: "CSONGOR ÉS TÜNDE". Lowercasing it would
     * produce "Csongor és tünde" and lose a proper noun, so the casing is
     * taken from a gallery caption that begins with the same characters —
     * "Csongor és Tünde új képek" — and only its first h1-length characters
     * are used, so the result can never be a different string.
     */
    const details = parseProductionDetail(fixture("nemzeti-csongor.html"));
    expect(details?.title).toBe("Csongor és Tünde");
  });
});

describe("parseProgram", () => {
  const occurrences = parseProgram(fixture("nemzeti-musor.html"));

  it("finds the published showtimes", () => {
    expect(occurrences.length).toBeGreaterThan(20);
  });

  it("joins the year and the day, which the page splits into two spans", () => {
    for (const o of occurrences) {
      expect(o.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("reads the stage from the badge's title, not its two-letter code", () => {
    const rooms = new Set(occurrences.map((o) => o.room).filter(Boolean));
    expect(rooms.size).toBeGreaterThan(0);
    // "GH" is the badge text; "Gobbi Hilda Színpad" is what it means.
    for (const room of rooms) {
      expect(room!.length).toBeGreaterThan(3);
    }
  });

  it("stores the curtain as a real UTC instant", () => {
    for (const o of occurrences) {
      const hour = Number(
        new Date(o.startsAt).toLocaleTimeString("hu-HU", {
          timeZone: "Europe/Budapest",
          hour: "2-digit",
          hour12: false,
        }).slice(0, 2)
      );
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });
});
