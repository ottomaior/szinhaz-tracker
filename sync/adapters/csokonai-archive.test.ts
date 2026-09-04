import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archiveLinksIn } from "./csokonai-archive";
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
