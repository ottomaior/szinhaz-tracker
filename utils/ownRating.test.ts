import { describe, expect, it } from "vitest";
import { pickOwnRating } from "./ownRating";

const ME = "me";
const SOMEBODY_ELSE = "them";

/** A diary entry, with only the fields the picker reads. */
const entry = (over: Partial<Parameters<typeof pickOwnRating>[0][number]> & { id?: string } = {}) => ({
  id: "e1",
  userId: ME,
  createdAt: "2026-03-01T20:00:00Z",
  seenAt: "2026-03-01",
  ratingOverall: 4,
  ...over,
});

describe("pickOwnRating", () => {
  it("finds the viewer's own entry among everyone else's", () => {
    // The play page loads every review for the production, so the list this
    // reads is mostly other people.
    const mine = entry({ id: "mine", ratingOverall: 3 });
    const result = pickOwnRating(
      [entry({ id: "a", userId: SOMEBODY_ELSE, ratingOverall: 5 }), mine, entry({ id: "b", userId: SOMEBODY_ELSE })],
      ME
    );
    expect(result?.entry.id).toBe("mine");
    expect(result?.entries).toBe(1);
  });

  it("has nothing to show a signed-out reader", () => {
    expect(pickOwnRating([entry()], undefined)).toBeUndefined();
  });

  it("has nothing to show when the viewer has not been", () => {
    expect(pickOwnRating([entry({ userId: SOMEBODY_ELSE })], ME)).toBeUndefined();
  });

  it("says nothing for an evening that was seen and deliberately unrated", () => {
    // Since 0026 an undefined rating is a real answer — a ticked archive title
    // from onboarding — and the page is answering "what did you give it".
    expect(pickOwnRating([entry({ ratingOverall: undefined })], ME)).toBeUndefined();
  });

  it("takes the most recent evening when the production was seen twice", () => {
    // A rewatch is a separate entry, and the honest figure is the later one:
    // averaging your own two visits would be the verdict this screen just
    // stopped printing, at a smaller scale.
    const result = pickOwnRating(
      [
        entry({ id: "march", seenAt: "2026-03-01", ratingOverall: 5 }),
        entry({ id: "september", seenAt: "2026-09-04", ratingOverall: 3 }),
      ],
      ME
    );
    expect(result?.entry.id).toBe("september");
    expect(result?.entry.ratingOverall).toBe(3);
    expect(result?.entries).toBe(2);
  });

  it("counts unrated evenings in the total even though it never shows one", () => {
    // Three visits, one of them a tick with no opinion: the caption still has
    // to say three, or a single figure would claim to speak for all of them.
    const result = pickOwnRating(
      [
        entry({ id: "rated-early", seenAt: "2026-01-05", ratingOverall: 4 }),
        entry({ id: "ticked", seenAt: undefined, ratingOverall: undefined }),
        entry({ id: "rated-late", seenAt: "2026-05-05", ratingOverall: 2 }),
      ],
      ME
    );
    expect(result?.entry.id).toBe("rated-late");
    expect(result?.entries).toBe(3);
  });

  it("sorts a dateless evening last, not first", () => {
    // An entry with no seen_at is unplaced rather than ancient. Sorting it as
    // the empty string would make it the oldest; sorting it as undefined in a
    // naive comparison can make it the newest. It goes to the back.
    const result = pickOwnRating(
      [
        entry({ id: "no-date", seenAt: undefined, createdAt: "2026-09-09T10:00:00Z", ratingOverall: 5 }),
        entry({ id: "dated", seenAt: "2026-02-02", createdAt: "2026-02-02T22:00:00Z", ratingOverall: 1 }),
      ],
      ME
    );
    expect(result?.entry.id).toBe("dated");
  });

  it("falls back to when the row was written when two evenings share a date", () => {
    // Two entries for the same night — a correction, or a double log. The
    // later row is the later thought.
    const result = pickOwnRating(
      [
        entry({ id: "first", seenAt: "2026-04-04", createdAt: "2026-04-04T21:00:00Z", ratingOverall: 2 }),
        entry({ id: "second", seenAt: "2026-04-04", createdAt: "2026-04-05T09:00:00Z", ratingOverall: 4 }),
      ],
      ME
    );
    expect(result?.entry.id).toBe("second");
  });

  it("picks the same evening whichever order the rows arrive in", () => {
    // The screen gets them newest-created first; nothing should depend on that.
    const rows = [
      entry({ id: "a", seenAt: "2026-01-01", ratingOverall: 1 }),
      entry({ id: "b", seenAt: "2026-06-01", ratingOverall: 2 }),
      entry({ id: "c", seenAt: "2026-03-01", ratingOverall: 3 }),
    ];
    expect(pickOwnRating(rows, ME)?.entry.id).toBe("b");
    expect(pickOwnRating(rows.slice().reverse(), ME)?.entry.id).toBe("b");
  });

  it("does not reorder the caller's array", () => {
    const rows = [entry({ id: "a", seenAt: "2026-01-01" }), entry({ id: "b", seenAt: "2026-06-01" })];
    pickOwnRating(rows, ME);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
