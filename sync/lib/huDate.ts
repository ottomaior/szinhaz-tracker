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
