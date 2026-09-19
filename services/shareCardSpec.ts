import { themes } from "@/theme/themes";

/**
 * The share card, as numbers.
 *
 * The card is drawn twice: `shareCardService.ts` paints it onto a canvas on
 * the web, and `components/share/ShareCardView.tsx` lays it out as native
 * views for `react-native-view-shot` on a phone. Two renderers, because the
 * web one cannot use a native module and the native one has no canvas — but
 * one card. Every dimension, face size and gap both of them use lives here,
 * so that a change to the card is a change to one file and the two outputs
 * cannot quietly drift apart. What the two files keep to themselves is only
 * the mechanics of drawing: measuring text on a canvas, `numberOfLines` on a
 * `Text`.
 *
 * Everything is in the card's own pixels — a square is 1080 wide, a story
 * 1080 × 1920 — and the native view multiplies by a scale to fit a phone's
 * memory. Pinned to the Velvet Curtain palette whatever the reader's theme:
 * this is the artefact that leaves the app, and it should look like the app
 * rather than like one reader's display preference.
 */

/** Pinned, not the reader's chosen theme — see above. */
export const cardPalette = themes.velvetDark;

export type ShareCardFormat = "square" | "story";

export type ShareCardOpinion = {
  /** The review text, when the author chose to put it on the card. */
  text?: string;
  tags?: string[];
  /** Names as printed in the diary, in the order they were recorded. */
  cast?: string[];
};

export type ShareCardInput = {
  format: ShareCardFormat;
  title: string;
  venue?: string;
  /** `YYYY-MM-DD`, already formatted for display by the caller. */
  dateLabel?: string;
  /** 0–5. Omitted for a "seen it, not rating it" entry. */
  rating?: number;
  /** The production's cover art, when there is one and it is ours to draw. */
  posterUrl?: string;
  /**
   * Off by default and on only for one share at a time. The entry's
   * attendance is public; the opinion is the author's, and a story travels
   * further than the feed does — so the review, the tags and the cast go on
   * the card only when the person posting it is the person who wrote it and
   * switched them on for this one image (T-108).
   */
  opinion?: ShareCardOpinion;
};

export type ShareCardFormatSpec = {
  width: number;
  height: number;
  /**
   * Where the text may not go. A square has the same margin on every side; a
   * story keeps clear of the band Instagram draws over the top (the account
   * name and the progress bar) and the taller one over the bottom (the reply
   * field), so nothing the card says is hidden under either.
   */
  top: number;
  bottom: number;
  /**
   * A story's poster runs edge to edge and fades into the velvet, the way a
   * full-screen image is expected to; a square keeps it inside the margin as
   * a picture on a card. The safe zone above applies to the type, not to the
   * photograph — imagery under Instagram's chrome is fine, words are not.
   */
  posterBleed: boolean;
  /**
   * Whether the photograph stays when the opinion is on the card. A square
   * has room for a picture or for words, not both: a two-line title, a
   * rating, three lines of review, the tags and the cast leave a band too
   * thin to show anything. So a square with the opinion on is a quote card,
   * set on velvet; a story has the height for both.
   */
  posterWithOpinion: boolean;
  /** How many lines the title and the review may take before they are cut. */
  titleLines: number;
  reviewLines: number;
  /** The file name the share sheet and the download see. */
  fileName: string;
};

export const SHARE_CARD_FORMATS: Record<ShareCardFormat, ShareCardFormatSpec> = {
  square: {
    width: 1080,
    height: 1080,
    top: 84,
    bottom: 84,
    posterBleed: false,
    posterWithOpinion: false,
    titleLines: 3,
    reviewLines: 3,
    fileName: "vastaps.png",
  },
  story: {
    width: 1080,
    height: 1920,
    top: 250,
    bottom: 320,
    posterBleed: true,
    posterWithOpinion: true,
    titleLines: 4,
    reviewLines: 8,
    fileName: "vastaps-story.png",
  },
};

/**
 * The type and the spacing, in card pixels. Laid out from the bottom up on
 * both renderers: the wordmark sits on the bottom inset, everything else
 * stacks above it with the gaps below, and the poster takes whatever is left
 * between the top inset and the title. Anchoring the fixed furniture to the
 * bottom edge is what stops a three-line title pushing the rating row through
 * the wordmark — "Ugyanaz másként - Kortársunk, Rómeó és Júlia" is a real
 * title in this catalogue.
 */
export const SHARE_CARD = {
  margin: 84,

  title: { size: 76, lineHeight: 92 },
  subtitle: { size: 34, lineHeight: 44 },
  mask: { size: 72, gap: 18 },
  review: { size: 36, lineHeight: 50 },
  tags: { size: 28, lineHeight: 38 },
  cast: { size: 28, lineHeight: 38, lines: 2 },
  /**
   * The footer: a hairline, then the mark with the domain in gold on the
   * left and the tagline in the dim tone on the right. It used to be the
   * mark and the word "Vastaps" alone, at tab-bar size — a signature, which
   * told a first-time viewer nothing they could act on. The card is the one
   * thing that leaves the app, so the line under the evening now says where
   * to find it (`vastaps.app`, the domain a person can type from a story) and
   * what it is (the landing page's own subtitle). Still one line, still
   * quieter than the title: a card about an evening with a colophon, not an
   * advertisement with an evening on it.
   */
  wordmark: { mark: 44, size: 38, lineHeight: 44 },
  tagline: { size: 28, lineHeight: 44 },
  rule: 1,

  /** Vertical gaps, each named for what sits above it. */
  gap: {
    posterToTitle: 56,
    titleToSubtitle: 12,
    subtitleToMasks: 22,
    masksToOpinion: 48,
    reviewToTags: 24,
    tagsToCast: 16,
    opinionToRule: 56,
    ruleToWordmark: 24,
  },

  /** On a story, how far above the poster's bottom edge the fade starts. */
  posterFade: 380,
} as const;

/**
 * `hex` at `alpha`, for the story's poster fade: a gradient has to run from
 * the surface colour at zero opacity to the same colour at full, and both
 * renderers need it as a string.
 */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Whether anything of the opinion would be printed. */
export function hasOpinion(input: ShareCardInput): boolean {
  const o = input.opinion;
  return !!(o?.text?.trim() || o?.tags?.length || o?.cast?.length);
}

/** Whether the card draws its poster, given what else is on it. */
export function showsPoster(input: ShareCardInput): boolean {
  return !!input.posterUrl && (SHARE_CARD_FORMATS[input.format].posterWithOpinion || !hasOpinion(input));
}

/** The tags as one line, the way the card prints them. */
export function formatTagsLine(tags: string[]): string {
  return tags.join(" · ");
}

/** The review text as the card prints it: one paragraph, in Hungarian quotes. */
export function formatReviewText(text: string): string {
  return `„${text.trim().replace(/\s+/g, " ")}”`;
}
