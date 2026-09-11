import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIndex, parseProduction } from "./katona-wp";

/**
 * A real production page, captured from the live site.
 *
 * The point of holding a copy is that Katona has already replaced its entire
 * website once — the previous Joomla scrape kept "succeeding" against pages
 * that had 301'd away, and the catalogue quietly froze. If the theatre changes
 * its markup again, these assertions fail loudly instead.
 */
const chicago = readFileSync(join(__dirname, "../__fixtures__/katona-wp-chicago.html"), "utf8");

/**
 * The other way this theatre credits a cast: seventeen actors and not one
 * character name. Recorded on 10 September 2026, when requiring the
 * character threw all seventeen away and left the production with its nine
 * creators and nobody on stage.
 */
const peerGynt = readFileSync(join(__dirname, "../__fixtures__/katona-wp-peer-gynt.html"), "utf8");

describe("katona-wp parseProduction", () => {
  const play = parseProduction(chicago, "chicago");

  it("parses the page at all", () => {
    expect(play).toBeDefined();
  });

  it("reads the headline metadata out of the overlay block", () => {
    expect(play?.title).toBe("Chicago");
    expect(play?.director).toBe("Székely Kriszta");
    expect(play?.author).toBe("John Kander - Fred Ebb - Bob Fosse");
    expect(play?.premiereDate).toBe("2025-12-12");
  });

  it("parses the runtime prose into numbers", () => {
    expect(play?.runtimeMinutes).toBe(135);
    expect(play?.intermissions).toBe(1);
  });

  it("prefers the desktop hero image over the mobile crop", () => {
    // Both are in the markup, distinguished only by Bootstrap display classes;
    // the mobile one is a tighter crop of a production still.
    expect(play?.posterUrl).toContain("web");
    expect(play?.posterUrl).toMatch(/^https:\/\/katonajozsefszinhaz\.hu\/wp-content\/uploads\//);
  });

  it("captures the cast with roles", () => {
    expect(play?.cast).toContainEqual({ role: "Roxie Hart", name: "Mentes Júlia" });
    expect(play?.cast).toContainEqual({ role: "Velma Kelly", name: "Rezes Judit" });
  });

  it("keeps a performer the production credits without a part", () => {
    const gynt = parseProduction(peerGynt, "peer-gynt");
    const performers = gynt?.cast?.filter((c) => c.role === "Szereplő").map((c) => c.name) ?? [];

    expect(performers.length).toBe(17);
    expect(performers).toContain("Fekete Ernő");
    // A guest and a student keep the markers the house prints.
    expect(performers).toContain("Bangó Erneszt m.v.");

    // The creative team on the same page keeps its own labels, so the
    // fallback cannot be swallowing rows that do carry one.
    expect(gynt?.cast).toContainEqual({ role: "Rendező", name: "Fehér Balázs Benő" });
  });

  it("includes the creative team alongside the performers", () => {
    expect(play?.cast).toContainEqual({ role: "Rendező", name: "Székely Kriszta" });
    expect(play?.cast).toContainEqual({ role: "Koreográfus", name: "Gergye Krisztián" });
  });

  it("records the stage as the performance room", () => {
    expect(play?.performances.every((p) => p.room === "Kamra")).toBe(true);
  });

  it("pairs each date with the time that follows it", () => {
    expect(play?.performances.length).toBeGreaterThan(0);

    for (const performance of play?.performances ?? []) {
      // Stored as a real UTC instant, not a naive local string.
      expect(performance.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(performance.sourceKey).toMatch(/^chicago:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);
    }
  });

  it("marks the production as current, not archived", () => {
    expect(play?.isArchived).toBe(false);
  });

  it("returns undefined for a page that is not a production", () => {
    expect(parseProduction("<html><body><p>Hírek</p></body></html>", "hirek")).toBeUndefined();
  });
});

describe("katona-wp parseIndex", () => {
  const index = parseIndex(readFileSync(join(__dirname, "..", "__fixtures__", "katona-wp-eloadasok.html"), "utf8"));

  it("lists the live productions by slug", () => {
    expect(index.slugs.has("nemacsend")).toBe(true);
    expect(index.slugs.has("chicago")).toBe(true);
  });

  it("lists them by title too, since the archive keys by working title", () => {
    // 43970-hamlet on the archive is némacsend here; only the title matches.
    expect(index.titles.has("nemacsend")).toBe(true);
    expect(index.titles.has("megrag kikop")).toBe(true);
  });
});
