import { todayInBudapest } from "./datetime";

/**
 * The Hungarian theatre season — the évad — and how a date lands in one.
 *
 * The client half of `public.season_start_year()` in
 * `supabase/migrations/0031_the_evad.sql`, and here for the same reason
 * `profileInitials` is: the database owns the arithmetic behind the numbers,
 * but the app has to name the season in a heading and decide which one to open
 * before any round trip has happened. If the two disagreed, the page would be
 * titled one season and filled with another.
 *
 * A season is named by the year it opens in: 2025 is "a 2025/26-os évad",
 * 1 September 2025 through 31 August 2026.
 *
 * August rather than June as the closing edge, deliberately. `0006_play_status`
 * already records that the kőszínházak go dark from mid-June and that the
 * szabadtéri venues invert that exactly — Nagyerdei, Margitsziget and
 * Városmajor play only in the summer. Ending the évad in June would drop those
 * evenings into a gap between seasons, and a summer at the Margitsziget is the
 * tail of the season that opened the previous September rather than a season of
 * its own. This way every date belongs to exactly one évad, with no gaps.
 */

/** The year a `YYYY-MM-DD` day belongs to the season of. */
export function seasonStartYear(dayKey: string): number {
  const [year, month] = dayKey.split("-").map(Number);
  return month >= 9 ? year : year - 1;
}

/** "2025/26" — how a Hungarian theatre prints its season. */
export function seasonLabel(seasonStart: number): string {
  // Two digits for the closing year, which is how it is written on a bérlet:
  // "2025/26", never "2025/2026".
  const end = String((seasonStart + 1) % 100).padStart(2, "0");
  return `${seasonStart}/${end}`;
}

/** The half-open range the season covers, as day keys. */
export function seasonRange(seasonStart: number): { from: string; to: string } {
  return { from: `${seasonStart}-09-01`, to: `${seasonStart + 1}-08-31` };
}

/** The season we are in now, in Budapest. */
export function currentSeasonStart(today: string = todayInBudapest()): number {
  return seasonStartYear(today);
}

/**
 * Hungarian glues a linking vowel onto a number before a suffix, and which
 * vowel depends on how the number is *spoken*, not on how it is written: 26 is
 * "huszonhat", so "a 2025/26-os évad", but 27 is "huszonhét", so "a 2026/27-es
 * évad". Getting this wrong is the kind of thing that makes an app read as
 * translated rather than written.
 *
 * The suffix is decided by the closing year of the season, since that is the
 * number the reader's eye lands on last.
 */
const SUFFIX_BY_UNIT: Record<number, string> = {
  1: "-es", // egy
  2: "-es", // kettő
  3: "-as", // három
  4: "-es", // négy
  5: "-ös", // öt
  6: "-os", // hat
  7: "-es", // hét
  8: "-as", // nyolc
  9: "-es", // kilenc
};

const SUFFIX_BY_TEN: Record<number, string> = {
  1: "-es", // tíz
  2: "-as", // húsz
  3: "-as", // harminc
  4: "-es", // negyven
  5: "-es", // ötven
  6: "-as", // hatvan
  7: "-es", // hetven
  8: "-as", // nyolcvan
  9: "-es", // kilencven
};

/** The linking suffix for a season label — "-os" for 2025/26, "-es" for 2026/27. */
export function seasonSuffix(seasonStart: number): string {
  const closing = (seasonStart + 1) % 100;
  const unit = closing % 10;
  if (unit !== 0) return SUFFIX_BY_UNIT[unit];
  // A round ten takes the tens word instead: "a 2029/30-as évad" is "harmincas".
  // The "00" case ("nullás", so "-ás") cannot arise before the 2099/00 season
  // and is left with the same answer as the rest rather than special-cased for
  // a heading nobody will read.
  return SUFFIX_BY_TEN[closing / 10] ?? "-as";
}

/** "2025/26-os" — the label with its suffix, ready to sit inside a heading. */
export function seasonLabelWithSuffix(seasonStart: number): string {
  return `${seasonLabel(seasonStart)}${seasonSuffix(seasonStart)}`;
}
