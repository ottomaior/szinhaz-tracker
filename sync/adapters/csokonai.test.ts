import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  guestCompany,
  mergeDuplicateTitles,
  parseProductionDetails,
  posterUrlOf,
  stripWordPressSize,
  visitingCompany,
} from "./csokonai";
import * as cheerio from "cheerio";
import type { SyncedPlay } from "../lib/types";

/** A real production page from the live WordPress site. */
const janosVitez = readFileSync(join(__dirname, "../__fixtures__/csokonai-janos-vitez.html"), "utf8");

/** A guest run: another company’s production, hosted by Csokonai. */
const abigel = readFileSync(join(__dirname, "../__fixtures__/csokonai-abigel-guest.html"), "utf8");

/** An archived guest run — same shape, reached through the archive adapter. */
const pecsiBalett = readFileSync(join(__dirname, "../__fixtures__/csokonai-archive-detail.html"), "utf8");

/**
 * A production with a flyer but no featured image, recorded on 21 September
 * 2026: `og:image` is the house picture, and the poster is only in the flyer
 * block. This is the page the app showed a letter tile for.
 */
const galagonya = readFileSync(join(__dirname, "../__fixtures__/csokonai-izzik-a-galagonya.html"), "utf8");

describe("csokonai parseProductionDetails", () => {
  const details = parseProductionDetails(janosVitez);

  it("splits the author off the front of the page title", () => {
    expect(details.author).toBe("Kacsóh Pongrác");
    expect(details.title).toBe("János vitéz");
  });

  it("reads the director out of the prose", () => {
    expect(details.director).toBe("Fejes Szabolcs");
  });

  it("parses runtime and intermissions", () => {
    expect(details.runtimeMinutes).toBe(180);
    expect(details.intermissions).toBe(2);
  });

  it("finds the premiere date", () => {
    expect(details.premiereDate).toBe("2026-01-16");
  });

  it("keeps og:image as the poster when it is the same picture as the flyer", () => {
    // The flyer is the 600x857 resize of this same upload; og:image is the
    // full-size URL already mirrored, so it must stay to avoid a re-fetch.
    expect(details.posterUrl).toBe(
      "https://csokonaiszinhaz.hu/wp-content/uploads/2025/06/janos-vitez-plakat-final-alapterv-web-2400px-ok-jav-daljatek-scaled.jpg"
    );
  });

  it("captures the full cast with roles", () => {
    expect(details.cast.length).toBeGreaterThan(20);
    expect(details.cast).toContainEqual({ role: "JÁNOS VITÉZ", name: "Boncsér Gergely" });
    expect(details.cast).toContainEqual({ role: "ILUSKA", name: "Faluvégi Fanni" });
  });

  /*
   * The markup a role with alternates renders, reproduced from the live
   * Gianni Schicchi / Scævola page. The fixture above is a production cast
   * without alternates, which is exactly why the bug this pins survived: the
   * adapter took `split("/")[0]` and every performer after the first was
   * parsed and discarded, unnoticed by any test.
   */
  const alternates = `<div id="actors-container-1"><div>
      <div>
        <p class="uk-text-muted">PLAMEN</p>
        <p class="uk-text-secondary">Körmendy Flórián m.v./ Beeri Benjámin m.v.</p>
      </div>
      <div>
        <p class="uk-text-muted">SLAVA</p>
        <p class="uk-text-secondary">Molnár Levente - Liszt-díjas, érdemes művész m.v. / Donkó Imre</p>
      </div>
    </div></div>`;

  it("keeps every performer who covers a role, not just the first", () => {
    const cast = parseProductionDetails(alternates).cast;
    expect(cast).toEqual([
      { role: "PLAMEN", name: "Körmendy Flórián" },
      { role: "PLAMEN", name: "Beeri Benjámin" },
      // The award stays in the name as the theatre prints it; only the guest
      // marker is trimmed, which is this source's long-standing habit.
      { role: "SLAVA", name: "Molnár Levente - Liszt-díjas, érdemes művész" },
      { role: "SLAVA", name: "Donkó Imre" },
    ]);
  });

  /**
   * Csókos asszony, where the alternates are company members. The theatre
   * prints those as one linked element *per performer* rather than as a
   * slash-joined string, and the adapter read only the first element of each
   * row — so Faluvégi Fanni was missing from Pünkösdi Kató on the live site
   * even after the slash splitting landed.
   */
  it("keeps every performer when each has an element of their own", () => {
    const csokos = readFileSync(join(__dirname, "../__fixtures__/csokonai-csokos-asszony.html"), "utf8");
    const { cast } = parseProductionDetails(csokos);
    const kato = cast.filter((c) => c.role === "Pünkösdi Kató").map((c) => c.name);
    expect(kato).toEqual(["Berkó Boglárka", "Faluvégi Fanni"]);
    // The same shape on another role, and a genuinely single-performer row.
    expect(cast.filter((c) => c.role === "Báró Tarpataky").map((c) => c.name)).toEqual(["Kaszás Mihály", "Vranyecz Artúr"]);
    expect(cast.filter((c) => c.role === "Ügyelő").map((c) => c.name)).toEqual(["Nagy Fruzsina"]);
  });

  /**
   * A debreceni lunátikus, an ensemble piece that credits sixteen actors and
   * gives none of them a character name — the role cell on those rows is
   * simply empty, which is the production's own way of crediting rather than
   * a gap in the page.
   *
   * Requiring a role dropped every one of them and kept the eleven crew rows,
   * so the app showed a play with a dramaturg, a prompter and nobody on
   * stage. Ottó found it on the live site.
   */
  it("keeps a performer the production credits without a part", () => {
    const lunatikus = readFileSync(join(__dirname, "../__fixtures__/csokonai-debreceni-lunatikus.html"), "utf8");
    const { cast } = parseProductionDetails(lunatikus);

    const performers = cast.filter((c) => c.role === "Szereplő").map((c) => c.name);
    expect(performers.length).toBe(16);
    expect(performers).toContain("Ráckevei Anna");
    expect(performers).toContain("Vranyecz Artúr");

    // The crew on the same page keep the roles the page gives them, so the
    // fallback cannot be swallowing labelled rows.
    expect(cast).toContainEqual({ name: "Fábián Péter", role: "Rendező" });
    expect(cast).toContainEqual({ name: "Kukk Zsófia", role: "Dramaturg" });
  });

  it("carries a synopsis", () => {
    expect(details.synopsis).toBeTruthy();
    expect(details.synopsis?.length).toBeGreaterThan(50);
  });

  it("degrades to empty fields rather than throwing on unrelated markup", () => {
    const empty = parseProductionDetails("<html><head><title>Csokonai</title></head><body></body></html>");
    expect(empty.title).toBe("Csokonai");
    expect(empty.director).toBe("");
    expect(empty.cast).toEqual([]);
  });
});

function play(overrides: Partial<SyncedPlay> & { sourceKey: string; title: string }): SyncedPlay {
  return {
    author: "",
    director: "",
    venueId: "venue",
    genre: "próza",
    cast: [],
    performances: [],
    ...overrides,
  };
}

describe("csokonai posterUrlOf", () => {
  it("takes the flyer when og:image is only the house picture", () => {
    const details = parseProductionDetails(galagonya);
    // The flyer is served as a 600x845 resize; the poster is the original
    // upload at the same path without the size suffix.
    expect(details.posterUrl).toBe(
      "https://csokonaiszinhaz.hu/wp-content/uploads/2026/06/csokonai-izzik-a-galagonya-b2-2-page-0001.jpg"
    );
  });

  it("prefers the flyer when it is a different picture from og:image", () => {
    // The archived A három testőr page: featured image and flyer are two
    // different posters, and the flyer is the one the page shows.
    const details = parseProductionDetails(pecsiBalett);
    expect(details.posterUrl).toBe(
      "https://csokonaiszinhaz.hu/wp-content/uploads/2025/03/2024-08-22-pecsi-balett-a-harom-testor-poster-900px-1.jpg"
    );
  });

  it("falls back to og:image on a page without a flyer", () => {
    const $ = cheerio.load('<meta property="og:image" content="https://csokonaiszinhaz.hu/wp-content/uploads/x/p.jpg">');
    expect(posterUrlOf($)).toBe("https://csokonaiszinhaz.hu/wp-content/uploads/x/p.jpg");
  });

  it("reads the flyer off the img when the background style is missing", () => {
    const $ = cheerio.load(
      '<div class="flyer-blur"></div><img src="https://csokonaiszinhaz.hu/wp-content/uploads/x/p-600x845.jpg">'
    );
    expect(posterUrlOf($)).toBe("https://csokonaiszinhaz.hu/wp-content/uploads/x/p.jpg");
  });

  it("returns nothing when the page has neither", () => {
    expect(posterUrlOf(cheerio.load("<p>hi</p>"))).toBeUndefined();
  });
});

describe("stripWordPressSize", () => {
  it("removes a size suffix", () => {
    expect(stripWordPressSize("https://x/y/name-600x845.jpg")).toBe("https://x/y/name.jpg");
  });
  it("removes the -scaled suffix", () => {
    expect(stripWordPressSize("https://x/y/name-scaled.jpeg")).toBe("https://x/y/name.jpeg");
  });
  it("leaves an original alone", () => {
    expect(stripWordPressSize("https://x/y/name-2400px-ok.jpg")).toBe("https://x/y/name-2400px-ok.jpg");
  });
});

describe("mergeDuplicateTitles", () => {
  it("keeps the richer metadata when two pages describe one production", () => {
    const merged = mergeDuplicateTitles([
      play({ sourceKey: "a-lear", title: "Lear király" }),
      play({ sourceKey: "b-lear", title: "Lear király", director: "Zsámbéki Gábor", premiereDate: "2021-05-29" }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].director).toBe("Zsámbéki Gábor");
    expect(merged[0].premiereDate).toBe("2021-05-29");
  });

  it("keeps the source key stable even when the richer page changes", () => {
    // The bug this guards: identity used to follow whichever page scored
    // higher, so a director appearing on the other page one day changed the
    // source key. reconcile() then treated the old row as stale and deleted or
    // archived it, while a new row appeared under a fresh id — stranding any
    // review on the copy that no longer updates.
    const richerIsB = mergeDuplicateTitles([
      play({ sourceKey: "a-lear", title: "Lear király" }),
      play({ sourceKey: "b-lear", title: "Lear király", director: "Zsámbéki Gábor" }),
    ]);
    const richerIsA = mergeDuplicateTitles([
      play({ sourceKey: "a-lear", title: "Lear király", director: "Zsámbéki Gábor" }),
      play({ sourceKey: "b-lear", title: "Lear király" }),
    ]);

    expect(richerIsB[0].sourceKey).toBe(richerIsA[0].sourceKey);
  });

  it("does not depend on the order the pages were scraped in", () => {
    const forwards = mergeDuplicateTitles([
      play({ sourceKey: "a-lear", title: "Lear király", director: "Zsámbéki Gábor" }),
      play({ sourceKey: "b-lear", title: "Lear király" }),
    ]);
    const backwards = mergeDuplicateTitles([
      play({ sourceKey: "b-lear", title: "Lear király" }),
      play({ sourceKey: "a-lear", title: "Lear király", director: "Zsámbéki Gábor" }),
    ]);

    expect(forwards[0].sourceKey).toBe(backwards[0].sourceKey);
    expect(forwards[0].director).toBe(backwards[0].director);
  });

  it("recognises one production across differing punctuation", () => {
    const merged = mergeDuplicateTitles([
      play({ sourceKey: "a", title: "Dante: Pokol" }),
      play({ sourceKey: "b", title: "Dante – Pokol" }),
    ]);
    expect(merged).toHaveLength(1);
  });

  it("keeps genuinely different productions apart", () => {
    const merged = mergeDuplicateTitles([
      play({ sourceKey: "a", title: "Dante: Pokol" }),
      play({ sourceKey: "b", title: "Dante: Purgatórium" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("pools the showtimes from both pages", () => {
    const merged = mergeDuplicateTitles([
      play({
        sourceKey: "a",
        title: "Aida",
        performances: [{ sourceKey: "a:1", startsAt: "2026-10-01T17:00:00.000Z" }],
      }),
      play({
        sourceKey: "b",
        title: "Aida",
        director: "Valaki",
        performances: [{ sourceKey: "b:1", startsAt: "2026-10-02T17:00:00.000Z" }],
      }),
    ]);

    expect(merged[0].performances).toHaveLength(2);
  });
});


/*
 * T-025. The house prints one line under the title and uses it for several
 * different things; the only one that changes what the catalogue means is the
 * provenance case, and it was being dropped along with the rest.
 */
describe("the line under the title", () => {
  it("reads a genre subtitle without mistaking it for a company", () => {
    const details = parseProductionDetails(janosVitez);
    expect(details.subtitle).toBe("daljáték");
    expect(visitingCompany(details.subtitle)).toBeUndefined();
  });

  it("names the visiting company on a hosted production", () => {
    const details = parseProductionDetails(abigel);
    expect(details.title).toBe("Abigél");
    expect(details.subtitle).toBe("a Kolozsvári Állami Magyar Színház előadása");
    expect(visitingCompany(details.subtitle)).toBe("Kolozsvári Állami Magyar Színház");
  });

  it("finds guests in the archive too", () => {
    const details = parseProductionDetails(pecsiBalett);
    expect(visitingCompany(details.subtitle)).toBe("Pécsi Balett");
  });

  /*
   * The possessive is the whole tell. “előadása” is X’s performance;
   * “előadás” is a kind of evening, and matching it would turn every
   * community-theatre listing into a company nobody has heard of.
   */
  it("does not read a bare noun as a company", () => {
    expect(guestCompany("közösségi színházi előadás")).toBeUndefined();
    expect(guestCompany("tragőkomedia")).toBeUndefined();
    expect(guestCompany("énekkari próba")).toBeUndefined();
    expect(guestCompany(undefined)).toBeUndefined();
  });

  it("does not call the host a guest in its own house", () => {
    expect(guestCompany("a Csokonai Nemzeti Színház előadása")).toBe("Csokonai Nemzeti Színház");
    expect(visitingCompany("a Csokonai Nemzeti Színház előadása")).toBeUndefined();
  });
});