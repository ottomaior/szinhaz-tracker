import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionPage } from "./katona";

/**
 * A page of the frozen Joomla archive, recorded on 10 September 2026.
 *
 * This adapter had no test at all, which is how it went months holding no
 * cast for the productions whose pages use a table: the generic field sweep
 * read the whole table as one 900-character value and its own length guard
 * threw it away, so the failure looked exactly like a page that publishes no
 * cast.
 */
const othello = readFileSync(join(__dirname, "../__fixtures__/katona-archive-othello.html"), "utf8");

describe("katona-archive parseProductionPage", () => {
  const play = parseProductionPage(othello, "/eloadasok/bemutatok/43342-othello");

  it("reads the production", () => {
    expect(play?.title).toBe("William Shakespeare: Othello");
    expect(play?.director).toBe("Székely Kriszta");
    expect(play?.premiereDate).toBeTruthy();
  });

  it("reads the cast table as parts and performers", () => {
    expect(play?.cast).toContainEqual({ role: "Othello", name: "Bányai Kelemen Barna" });
    expect(play?.cast).toContainEqual({ role: "Desdemona", name: "Rujder Vivien" });
  });

  it("keeps the guest marker the archive prints", () => {
    // This source stores "m.v." as published, unlike Csokonai's, and
    // `personCanonicalName()` folds it at identity time.
    expect(play?.cast).toContainEqual({ role: "Jago", name: "Kovács Lehel m.v." });
  });

  it("reads the creative team's table too", () => {
    expect(play?.cast).toContainEqual({ role: "Jelmez", name: "Szlávik Juli" });
    expect(play?.cast).toContainEqual({ role: "Ügyelő", name: "Valovics István" });
  });

  it("does not turn the page's other fields into cast members", () => {
    // "Kritikák", "Sajtó" and "Műsorfüzet" are long blocks of links in the
    // same structure; a review is not a person.
    const roles = (play?.cast ?? []).map((c) => c.role.toLowerCase());
    for (const field of ["kritikák", "sajtó", "műsorfüzet"]) expect(roles).not.toContain(field);
    // And not because the block happened to be long: a short one, a single
    // review, used to slip under the length guard as a person.
    for (const c of play?.cast ?? []) expect(c.name).not.toMatch(/.(hu|com|net|pl)/i);
  });

  it("files everything here as archived", () => {
    // The whole domain is the theatre's frozen pre-relaunch site.
    expect(play?.isArchived).toBe(true);
    expect(play?.performances).toEqual([]);
  });
});
