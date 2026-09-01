/**
 * Runtime/intermission parsing out of Hungarian free text, shared by the
 * adapters whose sources publish it as prose rather than as numbers.
 *
 * Real strings this has to handle, all seen live:
 *   "Időtartam: 2h 50min egy szünettel"        (Örkény, API tag)
 *   "Időtartam: 125 perc, egy szünettel"       (Csokonai)
 *   "Időtartam: 90 perc"                       (Csokonai, no intermission info)
 *   "3 óra 30 perc, két szünettel"             (Katona)
 *   "1 óra 40 perc, szünet nélkül"             (Katona)
 */

/**
 * Hungarian spells small counts as words, so "két szünettel" (two
 * intermissions) has to be understood as well as "2 szünettel" — a
 * digits-only pattern silently read that as "no intermission data".
 */
const NUMBER_WORDS: Record<string, number> = {
  egy: 1,
  két: 2,
  kettő: 2,
  három: 3,
  négy: 4,
};

const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS).join("|");

export function parseDurationHu(text?: string | null): { runtimeMinutes?: number; intermissions?: number } {
  if (!text) return {};

  // "2h 50min" (Örkény) and "3 óra 30 perc" (everyone else).
  const hourMatch = text.match(/(\d+)\s*(?:h\b|óra)/i);
  const minMatch = text.match(/(\d+)\s*(?:min\b|perc)/i);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minMatch ? Number(minMatch[1]) : 0;
  const runtimeMinutes = hours * 60 + minutes || undefined;

  let intermissions: number | undefined;
  if (/szünet nélkül/i.test(text)) {
    intermissions = 0;
  } else {
    const digits = text.match(/(\d+)\s*szünet/i);
    if (digits) {
      intermissions = Number(digits[1]);
    } else {
      const word = text.match(new RegExp(String.raw`(${NUMBER_WORD_PATTERN})\s*szünet`, "i"));
      if (word) intermissions = NUMBER_WORDS[word[1].toLowerCase()];
    }
  }

  return { runtimeMinutes, intermissions };
}
