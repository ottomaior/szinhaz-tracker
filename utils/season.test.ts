import { describe, expect, it } from "vitest";
import {
  currentSeasonStart,
  seasonLabel,
  seasonLabelWithSuffix,
  seasonRange,
  seasonStartYear,
} from "./season";

/**
 * The boundary cases are the whole test. Every one of these was also run
 * through `public.season_start_year()` in the database, so the heading the app
 * prints and the rows the RPC counts cannot disagree about which évad a night
 * belongs to.
 */
export const SEASON_CASES: [dayKey: string, seasonStart: number][] = [
  // The day before a season opens, and the day it opens.
  ["2025-08-31", 2024],
  ["2025-09-01", 2025],
  // Across the new year, which is the split a calendar-year stat gets wrong.
  ["2025-12-31", 2025],
  ["2026-01-01", 2025],
  // The kőszínházak go dark in June, but the open-air venues do not — so the
  // summer still belongs to the season that opened the previous September.
  ["2026-06-30", 2025],
  ["2026-07-15", 2025],
  ["2026-08-31", 2025],
  ["2026-09-01", 2026],
];

describe("seasonStartYear", () => {
  it.each(SEASON_CASES)("puts %s in the %i season", (dayKey, start) => {
    expect(seasonStartYear(dayKey)).toBe(start);
  });

  it("leaves no gap between one season and the next", () => {
    // The property that matters more than any single case: consecutive days
    // never skip a season, so no evening falls between two of them.
    const day = new Date(Date.UTC(2025, 7, 25));
    let previous = seasonStartYear(day.toISOString().slice(0, 10));
    for (let i = 0; i < 400; i++) {
      day.setUTCDate(day.getUTCDate() + 1);
      const current = seasonStartYear(day.toISOString().slice(0, 10));
      expect(current - previous).toBeLessThanOrEqual(1);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("seasonLabel", () => {
  it("writes the season the way a bérlet does", () => {
    expect(seasonLabel(2025)).toBe("2025/26");
    expect(seasonLabel(2026)).toBe("2026/27");
  });

  it("pads the turn of a century rather than printing 2099/0", () => {
    expect(seasonLabel(2099)).toBe("2099/00");
  });
});

describe("seasonRange", () => {
  it("runs September to August", () => {
    expect(seasonRange(2025)).toEqual({ from: "2025-09-01", to: "2026-08-31" });
  });
});

describe("currentSeasonStart", () => {
  it("reads today the same way as any other date", () => {
    expect(currentSeasonStart("2026-09-06")).toBe(2026);
    expect(currentSeasonStart("2026-06-06")).toBe(2025);
  });
});

describe("seasonSuffix", () => {
  it("follows how the closing year is spoken, not how it is spelled", () => {
    // "huszonhat" takes -os; "huszonhét" takes -es. Printing one suffix for
    // both is the tell of an app that was translated rather than written.
    expect(seasonLabelWithSuffix(2025)).toBe("2025/26-os");
    expect(seasonLabelWithSuffix(2026)).toBe("2026/27-es");
    expect(seasonLabelWithSuffix(2027)).toBe("2027/28-as");
    expect(seasonLabelWithSuffix(2024)).toBe("2024/25-ös");
  });

  it("takes the tens word when the year ends in a zero", () => {
    // 2029/30 is "harmincas", not something derived from the final digit.
    expect(seasonLabelWithSuffix(2029)).toBe("2029/30-as");
    expect(seasonLabelWithSuffix(2039)).toBe("2039/40-es");
  });
});
