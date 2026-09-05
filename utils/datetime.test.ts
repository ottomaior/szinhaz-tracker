import { describe, expect, it } from "vitest";
import {
  budapestDayKey,
  budapestMonthKey,
  dayKeyOffset,
  formatDayLabel,
  formatLongDate,
  formatMonthHeading,
  formatRuntimeMinutes,
  formatShortDate,
  formatShowtime,
  formatTime,
  formatWeekday,
} from "./datetime";

/**
 * These assertions are all about one thing: a performance stored as a UTC
 * instant has to come back out as the wall-clock time printed on the theatre's
 * own poster, no matter where the device running the app happens to be.
 *
 * The interesting cases are the ones that cross a day boundary. A 19:00
 * Budapest curtain in summer is 17:00 UTC, so anything that reads the UTC
 * parts directly still lands on the right day — but a late show is not, and
 * the bare date strings the calendar groups on are midnight UTC, which is the
 * previous evening in Budapest.
 */

// 2026-10-09 19:00 Budapest, in October, so CEST (+02:00).
const AUTUMN_EVENING = "2026-10-09T17:00:00Z";
// 2026-01-15 19:00 Budapest, in January, so CET (+01:00). Same wall clock, a
// different offset — this is the pair that catches a hardcoded offset.
const WINTER_EVENING = "2026-01-15T18:00:00Z";
// 2026-10-09 23:30 Budapest. In UTC this is already the 9th at 21:30, but a
// naive local read on a machine west of Hungary would call it the 8th.
const LATE_NIGHT = "2026-10-09T21:30:00Z";

describe("formatTime", () => {
  it("renders a summer-time curtain as the theatre prints it", () => {
    expect(formatTime(AUTUMN_EVENING)).toBe("19:00");
  });

  it("renders a winter-time curtain as the theatre prints it", () => {
    // Same 19:00, one hour's difference in the stored instant. A fixed +02:00
    // would render this as 20:00.
    expect(formatTime(WINTER_EVENING)).toBe("19:00");
  });

  it("uses a 24-hour clock", () => {
    expect(formatTime(LATE_NIGHT)).toBe("23:30");
  });
});

describe("date formatting", () => {
  it("spells a long date out in Hungarian", () => {
    expect(formatLongDate(AUTUMN_EVENING)).toContain("október");
    expect(formatLongDate(AUTUMN_EVENING)).toContain("2026");
    expect(formatLongDate(AUTUMN_EVENING)).toContain("9");
  });

  it("abbreviates a short date", () => {
    const short = formatShortDate(AUTUMN_EVENING);
    expect(short).toContain("9");
    expect(short).not.toContain("2026");
  });

  it("names the weekday", () => {
    // 2026-10-09 is a Friday.
    expect(formatWeekday(AUTUMN_EVENING)).toBe("péntek");
  });

  it("heads a month with the year", () => {
    expect(formatMonthHeading(AUTUMN_EVENING)).toContain("október");
    expect(formatMonthHeading(AUTUMN_EVENING)).toContain("2026");
  });

  it("puts date, weekday and time in one showtime line", () => {
    const line = formatShowtime(AUTUMN_EVENING);
    expect(line).toContain("péntek");
    expect(line).toContain("19:00");
  });
});

describe("grouping keys", () => {
  it("keys a day by the Budapest date, not the UTC one", () => {
    expect(budapestDayKey(AUTUMN_EVENING)).toBe("2026-10-09");
  });

  it("keeps a late-evening show on its own day", () => {
    // 21:30 UTC is still the 9th in Budapest (23:30). The failure this guards
    // against is a show sliding into the next day's group.
    expect(budapestDayKey(LATE_NIGHT)).toBe("2026-10-09");
  });

  it("keeps a show that has already tipped over midnight UTC on the right day", () => {
    // 2026-10-09 23:30 UTC is 2026-10-10 01:30 in Budapest — genuinely the
    // next day there, and grouped as such.
    expect(budapestDayKey("2026-10-09T23:30:00Z")).toBe("2026-10-10");
  });

  it("keys a month off the same date", () => {
    expect(budapestMonthKey(AUTUMN_EVENING)).toBe("2026-10");
    expect(budapestMonthKey(WINTER_EVENING)).toBe("2026-01");
  });

  it("offsets a day without falling off the end of a month", () => {
    const from = new Date("2026-10-31T12:00:00Z");
    expect(dayKeyOffset(1, from)).toBe("2026-11-01");
  });
});

describe("formatDayLabel", () => {
  const today = "2026-10-09";

  it("says ma for today", () => {
    expect(formatDayLabel(today, today)).toBe("ma");
  });

  it("names a weekday for a day inside the coming week", () => {
    // Three days on from a Friday is a Monday.
    expect(formatDayLabel("2026-10-12", today)).toBe("hétfő");
  });

  it("falls back to a date once the weekday stops being unambiguous", () => {
    // A month out, "péntek" would name any of four days, so the date wins.
    const label = formatDayLabel("2026-11-09", today);
    expect(label).not.toBe("hétfő");
    expect(label).toContain("9");
  });
});

describe("formatRuntimeMinutes", () => {
  it("renders hours and minutes", () => {
    expect(formatRuntimeMinutes(150)).toBe("2 óra 30 perc");
  });

  it("drops the hours when there are none", () => {
    expect(formatRuntimeMinutes(45)).toBe("45 perc");
  });

  it("drops the minutes when the runtime is a whole number of hours", () => {
    expect(formatRuntimeMinutes(120)).toBe("2 óra");
  });
});
