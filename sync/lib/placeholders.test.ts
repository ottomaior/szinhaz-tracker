import { describe, expect, it } from "vitest";
import { dropSharedPosters } from "./placeholders";
import type { SyncedPlay } from "./types";

const play = (title: string, posterUrl?: string): SyncedPlay =>
  ({ sourceKey: title, title, venueId: "v", performances: [], posterUrl }) as unknown as SyncedPlay;

describe("dropSharedPosters", () => {
  it("drops an image three productions arrive with", () => {
    const house = "https://example.test/kezdokep.jpg";
    const out = dropSharedPosters([play("A", house), play("B", house), play("C", house), play("D", "https://example.test/d.jpg")]);
    expect(out.map((p) => p.posterUrl)).toEqual([undefined, undefined, undefined, "https://example.test/d.jpg"]);
  });

  it("leaves a pair alone", () => {
    // A double bill shares its artwork honestly.
    const shared = "https://example.test/double-bill.jpg";
    const out = dropSharedPosters([play("A", shared), play("B", shared)]);
    expect(out.map((p) => p.posterUrl)).toEqual([shared, shared]);
  });

  it("does not touch anything else on the play", () => {
    const house = "https://example.test/kezdokep.jpg";
    const [a] = dropSharedPosters([play("A", house), play("B", house), play("C", house)]);
    expect(a.title).toBe("A");
    expect(a.sourceKey).toBe("A");
  });
});
