/**
 * Hungarian date parsing, shared by the adapters that read dates out of
 * human-facing copy rather than a structured field.
 *
 * Both live sources need this and neither returns ISO:
 *  - Csokonai's production pages: "Bemutató: 2026. május 22." (and the
 *    "tervezett időpontja" — planned date — variant for unopened shows)
 *  - Örkény's /api/performances: "2020. szeptember 18." (note that
 *    /api/month returns the same field as ISO, so this only matters on the
 *    repertoire endpoint)
 */

const MONTHS: Record<string, number> = {
  január: 1,
  február: 2,
  március: 3,
  április: 4,
  május: 5,
  június: 6,
  július: 7,
  augusztus: 8,
  szeptember: 9,
  október: 10,
  november: 11,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");
const HU_DATE = new RegExp(String.raw`(\d{1,4})\.\s*(${MONTH_PATTERN})\s*(\d{1,2})\.`, "i");
const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parses the first Hungarian (or ISO) date found in `text` into `YYYY-MM-DD`,
 * or returns undefined when there isn't a usable one.
 *
 * Implausible years are rejected rather than passed through: Örkény's
 * repertoire really does contain `"0002. december 06."` for A nagy füzet,
 * which Postgres would happily store as a year-2 date and which would then
 * sort ahead of everything else forever.
 */
export function parseHungarianDate(text?: string | null): string | undefined {
  if (!text) return undefined;

  const iso = text.match(ISO_DATE);
  if (iso) return plausible(Number(iso[1])) ? `${iso[1]}-${iso[2]}-${iso[3]}` : undefined;

  const match = text.match(HU_DATE);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const day = Number(match[3]);
  if (!plausible(year) || !month || !day || day > 31) return undefined;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function plausible(year: number): boolean {
  return year >= 1900 && year <= 2100;
}

/**
 * Converts a naive Budapest wall-clock timestamp — "YYYY-MM-DD HH:MM:SS" or
 * "YYYY-MM-DDTHH:MM:SS", with no offset — into a real UTC instant.
 *
 * Both live sources hand us local time with no zone attached: Örkény's
 * `/api/month` occurrences, and the date+time pair Csokonai's calendar renders.
 * Storing those as if they were already UTC shifts every showtime by one or two
 * hours depending on daylight saving, which is exactly wrong for a listing whose
 * whole purpose is telling someone when to turn up.
 *
 * The offset is resolved per instant rather than hardcoded, because the
 * catalogue spans both sides of every DST boundary: formatting the timestamp in
 * Europe/Budapest and re-reading the parts as if they were UTC yields the offset
 * that applied on that date, which is then subtracted.
 */
export function budapestLocalToUtcIso(naive: string): string {
  const normalized = naive.replace(" ", "T");
  const pretendUtc = new Date(`${normalized}Z`);
  if (Number.isNaN(pretendUtc.getTime())) return naive;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Budapest",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(pretendUtc).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMs = asIfUtc - pretendUtc.getTime();
  return new Date(pretendUtc.getTime() - offsetMs).toISOString();
}

/**
 * Parses a year-less Hungarian day like "szeptember 6" into month/day numbers.
 *
 * Katona's WordPress site labels each upcoming showtime this way, with the year
 * left implicit. Callers pair this with `resolveUpcomingYear` to recover the
 * full date.
 */
export function parseHungarianMonthDay(text?: string | null): { month: number; day: number } | undefined {
  if (!text) return undefined;
  const match = text.match(new RegExp(String.raw`(${MONTH_PATTERN})\s*(\d{1,2})`, "i"));
  if (!match) return undefined;

  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  if (!month || !day || day > 31) return undefined;

  return { month, day };
}

/**
 * Picks the year that makes a month/day fall in the coming twelve months.
 *
 * A theatre only advertises dates that have not happened yet, so a month/day
 * earlier in the calendar than today belongs to next year. Without this, every
 * January show published in autumn would be dated ten months in the past and
 * read as an ended production.
 */
export function resolveUpcomingYear(month: number, day: number, today = new Date()): number {
  const year = today.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  // A day of slack, so a show later today is not pushed a year out.
  const cutoff = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 24 * 60 * 60 * 1000;
  return candidate < cutoff ? year + 1 : year;
}
