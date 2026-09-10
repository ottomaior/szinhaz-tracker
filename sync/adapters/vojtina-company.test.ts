import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCompanyPage } from "./vojtina-company";

/** The company page, recorded from the live site on 10 September 2026. */
const page = readFileSync(join(__dirname, "../__fixtures__/vojtina-tarsulat.html"), "utf8");

describe("vojtina parseCompanyPage", () => {
  const people = parseCompanyPage(page);

  it("finds the whole company", () => {
    expect(people.length).toBe(13);
  });

  it("reads a puppeteer's card", () => {
    const baditz = people.find((p) => p.name === "Baditz Dávid");
    expect(baditz?.role).toBe("bábszínész");
    expect(baditz?.sourceUrl).toBe("https://www.vojtinababszinhaz.hu/tarsulat/4-baditz-david");
    expect(baditz?.imageUrl).toMatch(/^https:\/\/www\.vojtinababszinhaz\.hu\/uploads\/actors\/[0-9a-f]{32}$/);
  });

  it("includes the office, with their titles", () => {
    expect(people.find((p) => p.name === "Láposi Terka")?.role).toBe("igazgató, művészeti vezető");
  });
});
