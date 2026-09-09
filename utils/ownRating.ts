/**
 * Which of your own evenings a production page should quote back at you.
 *
 * The play page used to open with the public average of everyone's ratings.
 * At this size that number is two people wide — it has the authority of a
 * figure and none of the evidence — so what stands there now is what *you*
 * gave the production, which is the question a diary exists to answer six
 * months later. See the README section on the average that came off.
 *
 * Picking the entry is the only part of that which can be wrong silently, so
 * it lives here as a pure function rather than inline in the screen, and has a
 * test.
 *
 * Three facts about the diary make it less obvious than "find my review":
 *
 *  - A production can hold **several** entries for one person. A rewatch is a
 *    separate evening, deliberately, since 0022.
 *  - An entry can be **seen and unrated** — `ratingOverall` undefined, a real
 *    answer since 0026, and what onboarding writes for a ticked archive title.
 *    Those are skipped: the page is answering "what did I give it", and an
 *    unrated tick has no answer to give.
 *  - An entry can be seen with **no date at all**, for the same reason. Those
 *    still count; they just sort last.
 *
 * No averaging, even across your own evenings. Averaging a handful of ratings
 * into a verdict is precisely what came off this screen, and doing it to one
 * person's two visits would be the same mistake at a smaller scale — if you
 * gave it a 5 in March and a 3 in September, the honest thing to print is the
 * 3, dated.
 */

/** The fields this needs from a `Review`, so the helper stays free of the app's types. */
type Entry = {
  userId: string;
  createdAt: string;
  seenAt?: string;
  ratingOverall?: number;
};

export type OwnRating<T> = {
  /** The most recent rated evening — what the block shows. */
  entry: T;
  /**
   * That evening's overall score.
   *
   * Carried out separately even though it is `entry.ratingOverall`, because
   * on the entry it is optional and here it cannot be: an entry with no
   * rating never becomes an `OwnRating` in the first place. Without this the
   * screen would need a non-null assertion to print the one number the whole
   * block exists for.
   */
  rating: number;
  /**
   * How many evenings this person has logged for the production, rated or not.
   *
   * The caption says so when it is more than one: a single figure standing
   * over three visits would quietly claim to be all of them.
   */
  entries: number;
};

/**
 * The viewer's most recent rated entry for a production, and how many they
 * have, or undefined when there is nothing to show.
 *
 * Ordering matches `friends_ratings` in 0033 — `seen_at desc nulls last,
 * created_at desc` — so the same person's evening is chosen the same way
 * whether the page is quoting them to themselves or to somebody who follows
 * them. Two screens disagreeing about which night they meant would be a bug
 * nobody could explain.
 */
export function pickOwnRating<T extends Entry>(reviews: T[], viewerId: string | undefined): OwnRating<T> | undefined {
  if (!viewerId) return undefined;

  const mine = reviews.filter((r) => r.userId === viewerId);
  if (mine.length === 0) return undefined;

  const rated = mine.filter((r) => r.ratingOverall !== undefined);
  if (rated.length === 0) return undefined;

  const entry = rated.slice().sort(byMostRecentEvening)[0];
  return { entry, rating: entry.ratingOverall as number, entries: mine.length };
}

/** `seen_at desc nulls last, created_at desc`, in TypeScript. */
function byMostRecentEvening(a: Entry, b: Entry): number {
  if (a.seenAt !== b.seenAt) {
    // An evening with no date is not "the oldest" — it is unplaced, and the
    // dated ones are the better answer, so it goes to the back either way.
    if (a.seenAt === undefined) return 1;
    if (b.seenAt === undefined) return -1;
    return a.seenAt < b.seenAt ? 1 : -1;
  }
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}
