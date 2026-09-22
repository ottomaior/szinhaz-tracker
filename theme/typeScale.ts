/**
 * The type roles, as plain data.
 *
 * Split out of `theme/type.ts` for the same reason `theme/scales.ts` was
 * split out of `theme/tokens.ts`: `type.ts` reaches `./colors` and
 * `./typography`, both of which call `Platform.select` at runtime, so a plain
 * Node script could not read the one thing it needs — the sizes and leadings
 * the app sets its text at. The landing site's generator emits them as CSS
 * custom properties, and it should read them rather than repeat them.
 *
 * Nothing here may import anything with a runtime dependency on React Native.
 * `type.ts` re-exports all of it, so every existing `from "@/theme/type"`
 * is unchanged.
 */

export type TypeVariant =
  /** Play and screen titles. The app's voice. */
  | "display"
  /** Section heroes and modal titles. */
  | "title"
  /** Rail and group headings. */
  | "heading"
  /**
   * A figure that is the point of its line: a curtain time, a rating, the day
   * of the month in a programme. Bodoni at a size where its numerals still
   * hold, in the accent colour by default.
   */
  | "numeral"
  /**
   * The small tracked line above a heading or on artwork that says what
   * *kind* of thing follows — "Műsor", "Legközelebb · péntek", the theatre on
   * a poster. Uppercase, so it must stay short; Sora, because the didone has
   * no small caps and falls apart at this size.
   */
  | "eyebrow"
  /** Card titles, list-row primaries. */
  | "subheading"
  /** Default running text. */
  | "body"
  /** Secondary running text, dense lists. */
  | "bodySmall"
  /** Buttons, chips, field labels. */
  | "label"
  /** Metadata, timestamps, counts. */
  | "caption";

export type TypeTone = "default" | "dim" | "faint" | "accent" | "inverse";

export type VariantSpec = {
  size: number;
  lineHeight: number;
  family: "display" | "body";
  weight: "regular" | "medium" | "semibold" | "bold";
  letterSpacing?: number;
  /** The tone a role takes when the call site names none. Most take `default`. */
  tone?: TypeTone;
  uppercase?: boolean;
};

export const typeScale: Record<TypeVariant, VariantSpec> = {
  // Bodoni tightens up as it grows; negative tracking keeps large settings
  // from looking loose, which is standard practice for a didone at size.
  display: { size: 32, lineHeight: 37, family: "display", weight: "semibold", letterSpacing: -0.4 },
  title: { size: 24, lineHeight: 29, family: "display", weight: "semibold", letterSpacing: -0.2 },
  heading: { size: 19, lineHeight: 24, family: "display", weight: "semibold" },
  // Figures, not words: 22px keeps the hairlines of a didone numeral above a
  // pixel on every screen the app ships to. Accent by default because a
  // curtain time or a score is the answer its line exists to give.
  numeral: { size: 22, lineHeight: 26, family: "display", weight: "semibold", letterSpacing: -0.2, tone: "accent" },

  // From here down, Sora — see the note above about hairline serifs at size.
  subheading: { size: 16, lineHeight: 21, family: "body", weight: "semibold" },
  body: { size: 15, lineHeight: 23, family: "body", weight: "regular" },
  bodySmall: { size: 13.5, lineHeight: 20, family: "body", weight: "regular" },
  label: { size: 12.5, lineHeight: 16, family: "body", weight: "semibold" },
  caption: { size: 11.5, lineHeight: 15, family: "body", weight: "medium" },
  // Tracked wide because it is set in capitals; a capital line at natural
  // spacing reads as shouting, tracked it reads as a label on a programme.
  eyebrow: { size: 10.5, lineHeight: 14, family: "body", weight: "semibold", letterSpacing: 1.5, tone: "accent", uppercase: true },
};
