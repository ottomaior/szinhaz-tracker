import { describe, expect, it } from "vitest";
import { budapestLocalToUtcIso, parseHungarianDate, parseHungarianMonthDay, resolveUpcomingYear } from "./huDate";

describe("parseHungarianDate", () => {
  it("parses the prose form Örkény's repertoire endpoint returns", () => {
    expect(parseHungarianDate("2020. szeptember 18.")).toBe("2020-09-18");
  });

  it("parses the label Csokonai's production pages use", () => {
    expect(parseHungarianDate("Bemutató: 2026. május 22.")).toBe("2026-05-22");
  });

  it("passes ISO through, since /api/month returns the same field that way", () => {
    expect(parseHungarianDate("2026-05-22T19:00:00")).toBe("2026-05-22");
  });

  it("rejects implausible years rather than storing them", () => {
    // Örkény's archive really does carry this for A nagy füzet. Stored as a
    // year-2 date it would sort ahead of the entire catalogue forever.
    expect(parseHungarianDate("0002. december 06.")).toBeUndefined();
  });

  it("returns undefined for text with no date in it", () => {
    expect(parseHungarianDate("Nincs meghirdetett időpont")).toBeUndefined();
    expect(parseHungarianDate(undefined)).toBeUndefined();
  });

  // Vojtina Bábszínház writes every date all-numerically, where the other
  // sources spell the month out.
  it("reads the all-numeric Hungarian form", () => {
    expect(parseHungarianDate("Bemutató: 2023.01.17.")).toBe("2023-01-17");
    expect(parseHungarianDate("2026.09.13.")).toBe("2026-09-13");
  });

  it("does not mistake a numbered list for a date", () => {
    // The four-digit year requirement is what rules this out. Without it the
    // pattern would fire on ordinary body copy.
    expect(parseHungarianDate("1. 2. 3.")).toBeUndefined();
  });

  it("rejects an impossible all-numeric date rather than storing it", () => {
    expect(parseHungarianDate("2023.13.45.")).toBeUndefined();
  });
});

describe("budapestLocalToUtcIso", () => {
  it("applies the winter offset (CET, +01:00)", () => {
    expect(budapestLocalToUtcIso("2026-01-15 19:00:00")).toBe("2026-01-15T18:00:00.000Z");
  });

  it("applies the summer offset (CEST, +02:00)", () => {
    expect(budapestLocalToUtcIso("2026-07-15 19:00:00")).toBe("2026-07-15T17:00:00.000Z");
  });

  it("accepts the T-separated form as well as the space-separated one", () => {
    expect(budapestLocalToUtcIso("2026-07-15T19:00:00")).toBe(budapestLocalToUtcIso("2026-07-15 19:00:00"));
  });

  it("resolves the offset per date rather than using a fixed one", () => {
    // The whole point of the Intl round-trip: a single hardcoded offset would
    // put one of these two an hour out.
    const winter = new Date(budapestLocalToUtcIso("2026-02-01 20:00:00")).getUTCHours();
    const summer = new Date(budapestLocalToUtcIso("2026-08-01 20:00:00")).getUTCHours();
    expect(winter).toBe(19);
    expect(summer).toBe(18);
  });

  it("returns unparseable input untouched instead of mangling it", () => {
    expect(budapestLocalToUtcIso("not a date")).toBe("not a date");
  });
});

describe("parseHungarianMonthDay", () => {
  it("reads the year-less form Katona's site prints", () => {
    expect(parseHungarianMonthDay("szeptember 6")).toEqual({ month: 9, day: 6 });
  });

  it("ignores a leading weekday", () => {
    expect(parseHungarianMonthDay("vasárnap 19:00")).toBeUndefined();
  });

  it("returns undefined when there is no month name", () => {
    expect(parseHungarianMonthDay("Jegyek")).toBeUndefined();
  });
});

describe("resolveUpcomingYear", () => {
  const october = new Date("2026-10-15T12:00:00Z");

  it("keeps a later month in the current year", () => {
    expect(resolveUpcomingYear(12, 1, october)).toBe(2026);
  });

  it("rolls an earlier month into next year", () => {
    // A January date advertised in October is next January, not ten months ago.
    expect(resolveUpcomingYear(1, 20, october)).toBe(2027);
  });

  it("treats today as current", () => {
    expect(resolveUpcomingYear(10, 15, october)).toBe(2026);
  });
});
