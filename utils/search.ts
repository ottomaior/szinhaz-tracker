/**
 * The plain-TypeScript half of search: folding a term the way the database
 * does, and the two small pieces of bookkeeping a type-ahead needs to stay
 * honest — ignoring answers to questions that have since been retyped, and not
 * asking the same question twice.
 *
 * No React in here on purpose, for the reason `vitest.config.ts` gives: these
 * are exactly the things that fail invisibly on screen. A stale response
 * overwriting a fresh one looks like "the search is a bit off", not like a bug.
 */

/**
 * The accent folding `unaccent` performs, for the characters this catalogue
 * has — the same table `personSlug()` uses, lifted out so a search term and a
 * slug cannot fold differently.
 *
 * `normalize("NFD")` plus a combining-mark strip covers á é í ó ö ú ü and their
 * capitals, and — the part worth checking rather than assuming — **ő and ű**,
 * the two letters Hungarian has that most folding tables miss. Both decompose
 * to a base vowel plus a combining double acute, which the mark strip removes.
 *
 * The map is only for characters NFD leaves alone, which turn up in visiting
 * performers' names; the replacements are unaccent's own.
 */
const EXTRA_FOLDINGS: Record<string, string> = {
  ß: "ss",
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ø: "o",
  Ø: "O",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
};

/**
 * Lowercased and accent-folded — `public.search_norm()` in TypeScript, so
 * "Örkény" becomes "orkeny" here exactly as it does in the `*_norm` columns.
 */
export function foldSearchTerm(raw: string): string {
  return (raw ?? "")
    .replace(/[ßłŁđĐøØæÆœŒ]/g, (c) => EXTRA_FOLDINGS[c] ?? c)
    .normalize("NFD")
    // Combining diacritical marks. This is the step that turns Ő into O.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * A ticket per request, so a response can be checked against the question
 * currently being asked.
 *
 * Type-ahead fires a request per pause in typing, and the network does not
 * promise to answer them in order: the reply to "Nag" can arrive after the
 * reply to "Nagy Zs" and, applied naively, replace it. Every request takes a
 * ticket; only the holder of the latest one is allowed to update the screen.
 */
export function createLatestGuard() {
  let latest = 0;
  return {
    /** Hand out the next ticket, invalidating every earlier one. */
    next(): number {
      latest += 1;
      return latest;
    },
    /** Is this ticket still the one that matters? */
    isLatest(ticket: number): boolean {
      return ticket === latest;
    },
    /** Invalidate everything outstanding without issuing a new ticket. */
    cancel(): void {
      latest += 1;
    },
  };
}

/**
 * A small most-recently-used cache, keyed by string.
 *
 * Backspacing is the common case it serves: "Nagy Zs" → "Nagy Z" → "Nagy" are
 * three keys the reader has already seen answers for, and each is a round trip
 * saved. Capacity is deliberately modest; this holds the last few minutes of
 * one person's typing, not the catalogue.
 */
export function createLruCache<T>(capacity = 50) {
  const entries = new Map<string, T>();
  return {
    get(key: string): T | undefined {
      const value = entries.get(key);
      if (value === undefined) return undefined;
      // Re-insert to mark as most recently used: Map keeps insertion order.
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key: string, value: T): void {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
    has(key: string): boolean {
      return entries.has(key);
    },
    clear(): void {
      entries.clear();
    },
    get size(): number {
      return entries.size;
    },
  };
}
