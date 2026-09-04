import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeDuplicateTitles, parseProductionDetails } from "./csokonai";
import type { SyncedPlay } from "../lib/types";

/** A real production page from the live WordPress site. */
const janosVitez = readFileSync(join(__dirname, "../__fixtures__/csokonai-janos-vitez.html"), "utf8");

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
