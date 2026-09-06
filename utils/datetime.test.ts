import { describe, expect, it } from "vitest";
import {
  budapestDayKey,
  elapsedSince,
  budapestMonthKey,
  dayKeyOffset,
  formatDayLabel,
  formatLongDate,
  formatMonthHeading,
  formatRuntimeMinutes,
  formatShortDate,
  formatShortDayForSuffix,
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

describe("formatShortDayForSuffix", () => {
  it("drops the trailing full stop so a case suffix can be glued on", () => {
    // Hungarian abbreviates the date with a closing period, but that period is
    // part of the abbreviation — "okt. 28.-ig" is wrong, "okt. 28-ig" is right.
    expect(formatShortDayForSuffix("2026-10-28")).toBe("okt. 28");
    expect(`${formatShortDayForSuffix("2026-10-28")}-ig`).toBe("okt. 28-ig");
  });

  it("reads a bare day key as that day in Budapest, not the evening before", () => {
    // Midnight UTC on the 1st is still 01:00 on the 1st in Budapest, but the
    // failure this guards against is the reverse case the diary already hit:
    // a date parsed as UTC midnight and formatted in a zone behind it.
    expect(formatShortDayForSuffix("2026-01-01")).toBe("jan. 1");
    expect(formatShortDayForSuffix("2026-06-30")).toBe("jún. 30");
  });
});

describe("elapsedSince", () => {
  const now = new Date("2026-09-06T12:00:00Z");

  it("stays coarse: anything under an hour is just now", () => {
    // A card saying "3 perce" is not more useful than one saying "épp most",
    // and the finer the unit the more often the card is stale by the time
    // somebody reads it.
    expect(elapsedSince("2026-09-06T11:59:00Z", now)).toEqual({ unit: "now" });
    expect(elapsedSince("2026-09-06T11:01:00Z", now)).toEqual({ unit: "now" });
  });

  it("counts hours up to a day, then days", () => {
    expect(elapsedSince("2026-09-06T09:00:00Z", now)).toEqual({ unit: "hours", value: 3 });
    expect(elapsedSince("2026-09-05T13:00:00Z", now)).toEqual({ unit: "hours", value: 23 });
    expect(elapsedSince("2026-09-05T12:00:00Z", now)).toEqual({ unit: "yesterday" });
    expect(elapsedSince("2026-09-01T12:00:00Z", now)).toEqual({ unit: "days", value: 5 });
  });

  it("reads a clock running ahead of the server as just now", () => {
    // Not "-1 órája". The device's clock is not authoritative and a card must
    // not report a negative age when it is a few seconds out.
    expect(elapsedSince("2026-09-06T12:00:30Z", now)).toEqual({ unit: "now" });
  });
});
