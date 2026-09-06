import { describe, expect, it } from "vitest";
import { strings } from "./hu";

/**
 * The sentence under the greeting on Felfedezés.
 *
 * Worth a test rather than a glance, because three of its four branches are
 * unreachable from the live catalogue: Budapest and Debrecen both have
 * something on every week, so a browser check only ever exercises the first
 * one. The other three are exactly the cases that would ship broken.
 */
describe("discover.weekSentence", () => {
  it("counts the week when there is a choice to make", () => {
    expect(strings.discover.weekSentence(7, true)).toBe(
      "Ezen a héten 7 előadás közül választhatsz."
    );
    expect(strings.discover.weekSentence(2, true)).toBe(
      "Ezen a héten 2 előadás közül választhatsz."
    );
  });

  it("does not offer a choice between one thing", () => {
    expect(strings.discover.weekSentence(1, true)).toBe(
      "Ezen a héten egyetlen előadást játszanak."
    );
  });

  /**
   * The distinction the fourth branch exists for. An empty week with dates
   * beyond it is a different fact from a catalogue with nothing scheduled at
   * all, and the timeline directly below the sentence shows the difference —
   * so a single "nincs előadás" would contradict what is on screen.
   */
  it("separates an exhausted week from an empty catalogue", () => {
    expect(strings.discover.weekSentence(0, true)).toBe("Ezen a héten már nincs több előadás.");
    expect(strings.discover.weekSentence(0, false)).toBe("Jelenleg nincs meghirdetett előadás.");
  });

  /** The city is deliberately absent — Hungarian place-name suffixes are irregular. */
  it("never names the city, whatever the count", () => {
    for (const count of [0, 1, 2, 9]) {
      for (const hasUpcoming of [true, false]) {
        const sentence = strings.discover.weekSentence(count, hasUpcoming);
        expect(sentence).not.toMatch(/Budapest|Debrecen/);
      }
    }
  });
});
