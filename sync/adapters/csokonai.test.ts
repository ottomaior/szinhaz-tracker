import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guestCompany, mergeDuplicateTitles, parseProductionDetails, visitingCompany } from "./csokonai";
import type { SyncedPlay } from "../lib/types";

/** A real production page from the live WordPress site. */
const janosVitez = readFileSync(join(__dirname, "../__fixtures__/csokonai-janos-vitez.html"), "utf8");

/** A guest run: another company’s production, hosted by Csokonai. */
const abigel = readFileSync(join(__dirname, "../__fixtures__/csokonai-abigel-guest.html"), "utf8");

/** An archived guest run — same shape, reached through the archive adapter. */
const pecsiBalett = readFileSync(join(__dirname, "../__fixtures__/csokonai-archive-detail.html"), "utf8");

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

  it("takes the poster from og:image", () => {
    expect(details.posterUrl).toMatch(/^https:\/\/csokonaiszinhaz\.hu\/wp-content\/uploads\//);
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