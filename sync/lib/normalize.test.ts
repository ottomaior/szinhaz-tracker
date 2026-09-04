import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, normalizeText, normalizeTitle, stripHtml, titleKey } from "./normalize";

describe("decodeHtmlEntities", () => {
  it("decodes the Hungarian double-acute vowels", () => {
    // Örkény's API sends these as plain UTF-8 and never encodes them, but the
    // scraped WordPress and Joomla pages are hand-edited and may.
    expect(decodeHtmlEntities("Rendez&odblac;")).toBe("Rendező");
    expect(decodeHtmlEntities("t&udblac;z")).toBe("tűz");
  });

  it("decodes numeric and hex references", () => {
    expect(decodeHtmlEntities("&#337;")).toBe("ő");
    expect(decodeHtmlEntities("&#x151;")).toBe("ő");
  });

  it("decodes typographic punctuation", () => {
    expect(decodeHtmlEntities("Sz&eacute;kely&hellip;")).toBe("Székely…");
    expect(decodeHtmlEntities("&ldquo;Chicago&rdquo;")).toBe("“Chicago”");
  });

  it("leaves unknown entities alone rather than dropping them", () => {
    expect(decodeHtmlEntities("&notarealentity;")).toBe("&notarealentity;");
  });
});

describe("normalizeText", () => {
  it("collapses runs of whitespace", () => {
    expect(normalizeText("  János   vitéz \n ")).toBe("János vitéz");
  });

  it("folds non-breaking spaces into ordinary ones", () => {
    // Invisible in the app, but it makes two identical titles compare unequal.
    expect(normalizeText("János vitéz")).toBe("János vitéz");
    expect(normalizeText("János&nbsp;vitéz")).toBe("János vitéz");
  });

  it("returns undefined for empty or whitespace-only input", () => {
    expect(normalizeText("   ")).toBeUndefined();
    expect(normalizeText(null)).toBeUndefined();
  });
});

describe("stripHtml", () => {
  it("removes markup and normalizes what is left", () => {
    expect(stripHtml("<p>Sz&eacute;kely  <em>Kriszta</em></p>")).toBe("Székely Kriszta");
  });
});

describe("normalizeTitle", () => {
  it("trims a site suffix when the source built the title from a page title", () => {
    expect(normalizeTitle("Chicago - Katona József Színhaz", /\s*[–-]\s*Katona József Színhaz\s*$/)).toBe("Chicago");
  });

  it("leaves the title alone when no suffix is given", () => {
    expect(normalizeTitle("Chicago")).toBe("Chicago");
  });
});

describe("titleKey", () => {
  it("matches the same production across differing punctuation", () => {
    expect(titleKey("Dante: Pokol")).toBe(titleKey("Dante – Pokol"));
  });

  it("folds accents and case", () => {
    expect(titleKey("János vitéz")).toBe(titleKey("JANOS VITEZ"));
  });

  it("keeps genuinely different titles apart", () => {
    expect(titleKey("Dante: Pokol")).not.toBe(titleKey("Dante: Purgatórium"));
  });

  it("survives entity-encoded input", () => {
    expect(titleKey("Rendez&odblac;")).toBe(titleKey("Rendező"));
  });
});
