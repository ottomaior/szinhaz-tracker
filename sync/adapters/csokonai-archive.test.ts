import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archiveLinksIn, maskedSlugs, preferLatestRevival } from "./csokonai-archive";
import { parseProductionDetails } from "./csokonai";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

/**
 * These run against recorded pages rather than the live site. Csokonai runs
 * WordPress and its theme has already changed once under this project; a
 * fixture is what turns "the adapter silently returns 0 plays" into a failing
 * test.
 */
describe("archiveLinksIn", () => {
  const html = fixture("csokonai-archivum.html");

  it("finds the archived productions", () => {
    const links = archiveLinksIn(html);
    expect(links.length).toBeGreaterThan(15);
    expect(links.every((u) => u.startsWith("https://csokonaiszinhaz.hu/eloadasok/"))).toBe(true);
  });

  it("ignores pagination, taxonomy and the old archive subdomain", () => {
    const links = archiveLinksIn(html);
    expect(links.some((u) => u.includes("/page/"))).toBe(false);
    expect(links.some((u) => u.includes("/mufaj/"))).toBe(false);
    // archiv.csokonaiszinhaz.hu is a different, older site; only the main
    // domain's production pages parse with these selectors.
    expect(links.some((u) => u.includes("archiv.csokonaiszinhaz.hu"))).toBe(false);
  });

  it("returns each production once", () => {
    const links = archiveLinksIn(html);
    expect(new Set(links).size).toBe(links.length);
  });
});

describe("revivals", () => {
  it("masks the page a revival was derived from", () => {
    // Debrecen revived Tündér Lala: the repertoire holds `…-tunder-lala-2`
    // while the archive still lists `…-tunder-lala`. Both pages name Halasi
    // Dániel and the same premiere date, so they are one production.
    const masked = maskedSlugs(["szabo-magda-tunder-lala-2", "lehar-ferenc-a-vig-ozvegy-2"]);
    expect(masked.has("szabo-magda-tunder-lala")).toBe(true);
    expect(masked.has("lehar-ferenc-a-vig-ozvegy")).toBe(true);
  });

  it("does not treat a title ending in a number as a revival", () => {
    // The counter is at most two digits. A year in the title is not one.
    const masked = maskedSlugs(["orwell-1984", "katona-2031"]);
    expect(masked.has("orwell")).toBe(false);
    expect(masked.has("katona")).toBe(false);
  });

  it("only masks a base that the source actually publishes", () => {
    // `-2` alone proves nothing; the plain page has to exist for the pair to
    // be a revival rather than just a slug that happens to end in a digit.
    expect(maskedSlugs(["a-kis-herceg-2"]).has("a-kis-herceg")).toBe(true);
    expect(maskedSlugs(["valami-mas"]).size).toBe(1);
  });

  it("keeps the later page when both are archived", () => {
    const kept = preferLatestRevival([
      "https://csokonaiszinhaz.hu/eloadasok/presser-a-padlas",
      "https://csokonaiszinhaz.hu/eloadasok/presser-a-padlas-3",
    ]);
    expect(kept).toEqual(["https://csokonaiszinhaz.hu/eloadasok/presser-a-padlas-3"]);
  });

  it("leaves genuinely different works alone", () => {
    // Two "A kis herceg" pages exist: Saint-Exupéry's play and the
    // Portman/Wright opera. Different stems, so both survive.
    const kept = preferLatestRevival([
      "https://csokonaiszinhaz.hu/eloadasok/antoine-de-saint-exupery-a-kis-herceg",
      "https://csokonaiszinhaz.hu/eloadasok/rachel-portman-nicholas-wright-a-kis-herceg",
    ]);
    expect(kept).toHaveLength(2);
  });
});

describe("an archived production page", () => {
  const details = parseProductionDetails(fixture("csokonai-archive-detail.html"));

  it("reads the title and author out of the page title", () => {
    expect(details.title).toBe("A három testőr – avagy a királyné nyakéke");
    expect(details.author).toBe("Pécsi Balett");
  });

  it("still finds the poster", () => {
    expect(details.posterUrl).toMatch(/^https:\/\/csokonaiszinhaz\.hu\/wp-content\/uploads\//);
  });

  it("has no premiere date, which is what the page says", () => {
    // Archived pages routinely drop the "Bemutató" line. Asserting the absence
    // keeps the adapter honest: the answer is "unknown", not a guessed date.
    expect(details.premiereDate).toBeUndefined();
  });
});
