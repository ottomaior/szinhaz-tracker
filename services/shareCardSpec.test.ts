import { describe, expect, it } from "vitest";
import {
  SHARE_CARD,
  SHARE_CARD_FORMATS,
  formatReviewText,
  showsPoster,
  withAlpha,
  type ShareCardFormat,
} from "./shareCardSpec";

/**
 * The card is laid out from the bottom up, so the one thing that can go
 * wrong is the top: a title at its longest, a rating, a review at its
 * longest, the tags and the cast, stacked on the wordmark, must still start
 * below the format's top inset. Both renderers trust the spec for this — the
 * canvas would draw the title above the edge, the native view would clip it —
 * so it is asserted here, on the numbers, rather than found on a phone.
 */
function tallestStack(format: ShareCardFormat, withOpinion: boolean): number {
  const f = SHARE_CARD_FORMATS[format];
  const { gap } = SHARE_CARD;
  let h = SHARE_CARD.wordmark.lineHeight + gap.opinionToWordmark;
  if (withOpinion) {
    h += SHARE_CARD.cast.lines * SHARE_CARD.cast.lineHeight + gap.tagsToCast;
    h += SHARE_CARD.tags.lineHeight + gap.reviewToTags;
    h += f.reviewLines * SHARE_CARD.review.lineHeight + gap.masksToOpinion;
  }
  h += SHARE_CARD.mask.size + gap.subtitleToMasks;
  h += SHARE_CARD.subtitle.lineHeight + gap.titleToSubtitle;
  h += f.titleLines * SHARE_CARD.title.lineHeight;
  return h;
}

describe("share card spec", () => {
  for (const format of Object.keys(SHARE_CARD_FORMATS) as ShareCardFormat[]) {
    const f = SHARE_CARD_FORMATS[format];

    // The type keeps out of the top inset; the poster starts there on a
    // square and at the edge on a story, so that is where its room begins.
    const posterTop = f.posterBleed ? 0 : f.top;

    it(`${format}: the fullest card without the opinion leaves room for a poster`, () => {
      const room = f.height - posterTop - f.bottom - tallestStack(format, false);
      // The poster is hidden below 160 card pixels; anything less than that
      // would mean a long title can only ever produce a card with no picture.
      expect(room).toBeGreaterThanOrEqual(160 + SHARE_CARD.gap.posterToTitle);
    });

    it(`${format}: the fullest card with the opinion stays inside the safe area`, () => {
      expect(f.height - f.top - f.bottom - tallestStack(format, true)).toBeGreaterThanOrEqual(0);
      if (f.posterWithOpinion) {
        const room = f.height - posterTop - f.bottom - tallestStack(format, true);
        expect(room).toBeGreaterThanOrEqual(160 + SHARE_CARD.gap.posterToTitle);
      }
    });
  }

  it("a square with the opinion on is a quote card, a story keeps its poster", () => {
    const opinion = { text: "Remek." };
    expect(showsPoster({ format: "square", title: "x", posterUrl: "p" })).toBe(true);
    expect(showsPoster({ format: "square", title: "x", posterUrl: "p", opinion })).toBe(false);
    expect(showsPoster({ format: "story", title: "x", posterUrl: "p", opinion })).toBe(true);
    // An opinion with nothing in it is no opinion.
    expect(showsPoster({ format: "square", title: "x", posterUrl: "p", opinion: { text: "  ", tags: [] } })).toBe(true);
    expect(showsPoster({ format: "story", title: "x", opinion })).toBe(false);
  });

  it("prints the review as one quoted paragraph", () => {
    expect(formatReviewText("  Első sor.\n\nMásodik   sor. ")).toBe("„Első sor. Második sor.”");
  });

  it("turns a hex colour into the same colour at an opacity", () => {
    expect(withAlpha("#1c0d13", 0)).toBe("rgba(28,13,19,0)");
    expect(withAlpha("#e4bf72", 0.5)).toBe("rgba(228,191,114,0.5)");
  });
});
