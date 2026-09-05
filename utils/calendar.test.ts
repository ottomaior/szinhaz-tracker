import { describe, expect, it } from "vitest";
import { monthGrid, monthHeading, parseDayKey, shiftMonth, toDayKey, WEEKDAY_LABELS } from "./calendar";

describe("monthGrid", () => {
  it("starts the week on Monday", () => {
    // 1 September 2026 is a Tuesday, so one blank sits before it.
    const cells = monthGrid(2026, 9);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe(1);
  });

  it("puts a Monday 1st in the first cell with no blanks", () => {
    // 1 June 2026 is a Monday. This is the case an off-by-one Sunday-first
    // grid gets wrong in the most visible way: a whole empty week at the top.
    const cells = monthGrid(2026, 6);
    expect(cells[0]).toBe(1);
  });

  it("puts a Sunday 1st at the end of the first row", () => {
    // 1 November 2026 is a Sunday — the far edge of the Monday-first shift,
    // and where a naive `getUTCDay()` would place it first instead of last.
    const cells = monthGrid(2026, 11);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe(1);
  });

  it("counts the days in each month", () => {
    expect(monthGrid(2026, 1).filter((d) => d !== null)).toHaveLength(31);
    expect(monthGrid(2026, 4).filter((d) => d !== null)).toHaveLength(30);
    expect(monthGrid(2026, 2).filter((d) => d !== null)).toHaveLength(28);
  });

  it("gives February 29 days in a leap year", () => {
    expect(monthGrid(2024, 2).filter((d) => d !== null)).toHaveLength(29);
    // 2100 is divisible by 4 and is not a leap year.
    expect(monthGrid(2100, 2).filter((d) => d !== null)).toHaveLength(28);
  });

  it("has a label for every column", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });

  it("never drops or repeats a day", () => {
    const days = monthGrid(2026, 3).filter((d): d is number => d !== null);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });
});

describe("shiftMonth", () => {
  it("steps back across a year boundary", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("steps forward across a year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("stays put at zero", () => {
    expect(shiftMonth(2026, 9, 0)).toEqual({ year: 2026, month: 9 });
  });

  it("does not roll over from a long month to a short one", () => {
    // Stepping from 31 January into February is where date arithmetic that
    // keeps the day-of-month lands on 3 March. Anchoring to the 1st avoids it.
    expect(shiftMonth(2026, 1, 1)).toEqual({ year: 2026, month: 2 });
  });
});

describe("day keys", () => {
  it("round-trips", () => {
    const { year, month, day } = parseDayKey("2026-03-07");
    expect({ year, month, day }).toEqual({ year: 2026, month: 3, day: 7 });
    expect(toDayKey(year, month, day)).toBe("2026-03-07");
  });

  it("pads single digits, so keys sort lexicographically", () => {
    expect(toDayKey(2026, 3, 7)).toBe("2026-03-07");
    // The picker compares dates as strings to reject the future; that is only
    // correct while every key is the same width.
    expect(toDayKey(2026, 9, 9) < toDayKey(2026, 10, 1)).toBe(true);
    expect(toDayKey(2026, 12, 31) < toDayKey(2027, 1, 1)).toBe(true);
  });
});

describe("monthHeading", () => {
  it("names the month in Hungarian", () => {
    expect(monthHeading(2026, 9)).toContain("szeptember");
    expect(monthHeading(2026, 9)).toContain("2026");
  });

  it("names the right month at both ends of the year", () => {
    // Anchored at the 15th rather than the 1st: a January heading built from
    // midnight on the 1st renders as the previous December anywhere behind UTC.
    expect(monthHeading(2026, 1)).toContain("január");
    expect(monthHeading(2026, 12)).toContain("december");
  });
});
