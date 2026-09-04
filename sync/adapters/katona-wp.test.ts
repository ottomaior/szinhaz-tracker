import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProduction } from "./katona-wp";

/**
 * A real production page, captured from the live site.
 *
 * The point of holding a copy is that Katona has already replaced its entire
 * website once — the previous Joomla scrape kept "succeeding" against pages
 * that had 301'd away, and the catalogue quietly froze. If the theatre changes
 * its markup again, these assertions fail loudly instead.
 */
const chicago = readFileSync(join(__dirname, "../__fixtures__/katona-wp-chicago.html"), "utf8");

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
