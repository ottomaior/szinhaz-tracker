/**
 * Hungarian date and time formatting, in one place.
 *
 * Four screens had grown their own private `formatDate` — Feed, Watchlist,
 * Profile and the check-in modal — each calling `toLocaleDateString("hu-HU")`
 * with a slightly different options object, so the same performance could read
 * as "okt. 9." on one screen and "2026. október 9." on the next. Worse, none
 * of them formatted a *time*, which is why the showtimes the sync job collects
 * had nowhere to be displayed.
 *
 * Everything here pins the `Europe/Budapest` zone explicitly. Performance rows
 * are `timestamptz` and correct in UTC (sync/lib/huDate.ts resolves each
 * source's naive wall-clock time against the offset that applied on that date),
 * but the device doing the formatting need not be in Hungary — a browser in
 * London would otherwise render a 19:00 Budapest curtain as 18:00, which is
 * precisely the number a listing must never get wrong.
 */

const ZONE = "Europe/Budapest";

/** "2026. október 9." — the long form, for a premiere or a logged date. */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    timeZone: ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "okt. 9." — the compact form, for list rows and cards. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    timeZone: ZONE,
    month: "short",
    day: "numeric",
  });
}

/** "csütörtök" — the weekday alone, spelled out. */
export function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", { timeZone: ZONE, weekday: "long" });
}

/** "19:00" — curtain time, 24-hour, as every Hungarian theatre prints it. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("hu-HU", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "2026. október" — a month heading for a grouped list of dates. */
export function formatMonthHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", { timeZone: ZONE, year: "numeric", month: "long" });
}

/** "okt. 9., csütörtök · 19:00" — one showtime, in full, on one line. */
export function formatShowtime(iso: string): string {
  return `${formatShortDate(iso)}, ${formatWeekday(iso)} · ${formatTime(iso)}`;
}

/** The `YYYY-MM-DD` a timestamp falls on *in Budapest*, for grouping by day. */
export function budapestDayKey(iso: string): string {
  // en-CA renders ISO-shaped dates, which is what makes this sortable and
  // comparable. Doing it by hand off the Date's UTC parts would put a 19:00
  // Budapest performance on the previous day for half the year.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONE });
}

/** The `YYYY-MM` a timestamp falls in, for grouping a list into months. */
export function budapestMonthKey(iso: string): string {
  return budapestDayKey(iso).slice(0, 7);
}

/** Today in Budapest as `YYYY-MM-DD` — the default day for a calendar view. */
export function todayInBudapest(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONE });
}

/** `YYYY-MM-DD` for `offset` days from today, in Budapest. */
export function dayKeyOffset(offset: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA", { timeZone: ZONE });
}

/**
 * "ma" / "holnap" / "csütörtök" / "okt. 9." — how a day chip should read.
 *
 * Hungarian has single words for today and tomorrow and they are what a person
 * actually scans for, so they win over the date. Beyond a week out the weekday
 * stops being useful on its own — "csütörtök" could be any of four — and the
 * date takes over.
 */
export function formatDayLabel(dayKey: string, today: string = todayInBudapest()): string {
  if (dayKey === today) return "ma";
  if (dayKey === dayKeyOffset(1)) return "holnap";

  // Parsed as midday UTC rather than midnight: a bare `YYYY-MM-DD` is midnight
  // UTC, which is still the previous evening in Budapest, so every label would
  // name the wrong day.
  const iso = `${dayKey}T12:00:00Z`;
  const withinAWeek = (Date.parse(iso) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000 < 7;
  return withinAWeek ? formatWeekday(iso) : formatShortDate(iso);
}

/** "2 óra 30 perc" — a runtime, from a count of minutes. */
export function formatRuntimeMinutes(total: number, hoursLabel = "óra", minutesLabel = "perc"): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} ${minutesLabel}`;
  if (minutes === 0) return `${hours} ${hoursLabel}`;
  return `${hours} ${hoursLabel} ${minutes} ${minutesLabel}`;
}
