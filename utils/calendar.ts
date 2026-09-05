/**
 * Month-grid arithmetic for the check-in date picker.
 *
 * Split out of `components/ui/DateField.tsx` for the reason `vitest.config.ts`
 * gives for `utils/datetime.ts`: this has no React dependency, and it is a
 * class of bug that is invisible on screen. A grid offset by one renders as a
 * perfectly plausible calendar — every date is simply under the wrong weekday,
 * and nobody checks a calendar against another calendar.
 *
 * Everything here works in UTC and on `YYYY-MM-DD` strings rather than local
 * `Date` values. A bare date string parsed as a `Date` is midnight UTC, which
 * is still the previous evening in Budapest, so date maths done through the
 * local calendar drifts by a day for anyone east of Greenwich.
 */

/** Weeks start on Monday, as every Hungarian calendar prints them. */
export const WEEKDAY_LABELS = ["H", "K", "Sz", "Cs", "P", "Sz", "V"];

export type DateParts = { year: number; month: number; day: number };

/** `YYYY-MM-DD` → its parts, without going through a Date or a timezone. */
export function parseDayKey(dayKey: string): DateParts {
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

export function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The cells for one month: leading `null`s for the blanks before the 1st, then
 * the day numbers.
 *
 * `getUTCDay()` counts from Sunday and this grid starts on Monday, hence the
 * `+ 6) % 7` shift — the single most likely place for this file to be wrong,
 * and the reason it has tests.
 */
export function monthGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  // Day 0 of the next month is the last day of this one, which is also how
  // February gets its leap years right without a rule of its own.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

/** The month `by` months away from this one, without rolling a day over. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const next = new Date(Date.UTC(year, month - 1 + by, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
}

/** "2026. szeptember" — the heading over a month grid. */
export function monthHeading(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("hu-HU", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  });
}
