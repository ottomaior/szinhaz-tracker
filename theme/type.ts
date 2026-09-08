/**
 * The type scale: eight roles, replacing the ~20 ad-hoc font sizes the screens
 * had accumulated.
 *
 * Two rules shape it.
 *
 * First, sizes come from a scale rather than from taste at each call site. The
 * steps below run on roughly a major third from a 15px body, rounded to whole
 * and half points that render crisply — so `heading` next to `body` is always
 * the same relationship, wherever they appear.
 *
 * Second, and more importantly: **Bodoni Moda is only used at 19px and above.**
 * It is a didone, built on extreme thick/thin contrast and hairline serifs.
 * That contrast is what gives the app its playbill character at title size,
 * and it is exactly what collapses at 12px, where the hairlines fall below a
 * pixel and the face turns to mush — worst of all on Android and on a
 * non-retina monitor. Anything small is Sora, which was drawn for it.
 */
import type { TextStyle } from "react-native";
import { bodyFont, displayFont } from "./typography";
import { colors } from "./colors";
import type { Palette } from "./themes";

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

type VariantSpec = {
  size: number;
  lineHeight: number;
  family: "display" | "body";
  weight: "regular" | "medium" | "semibold" | "bold";
  letterSpacing?: number;
  /** The tone a role takes when the call site names none. Most take `default`. */
  tone?: TypeTone;
  uppercase?: boolean;
};

const VARIANTS: Record<TypeVariant, VariantSpec> = {
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

/**
 * A function of the palette rather than a map of it: a map would read the
 * colours once, when this module is imported, which on native is before the
 * reader's stored theme has been read back. theme/colors.ts explains why that
 * goes stale and stays stale.
 */
const toneColor = (palette: Palette, tone: TypeTone): string => {
  switch (tone) {
    case "dim":
      return palette.textDim;
    case "faint":
      return palette.textFaint;
    case "accent":
      return palette.gold;
    // For text sitting on a gold fill.
    case "inverse":
      return palette.onAccent;
    default:
      return palette.text;
  }
};

/**
 * The style for one role.
 *
 * `fontsLoaded` is threaded through because the brand faces load
 * asynchronously and every screen renders before they arrive — see
 * theme/typography.ts.
 */
export function typeStyle(
  variant: TypeVariant,
  fontsLoaded: boolean,
  tone?: TypeTone,
  palette: Palette = colors
): TextStyle {
  const spec = VARIANTS[variant];
  return {
    fontFamily: spec.family === "display" ? displayFont(fontsLoaded, spec.weight === "regular" ? "regular" : "semibold") : bodyFont(fontsLoaded, spec.weight),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    color: toneColor(palette, tone ?? spec.tone ?? "default"),
    textTransform: spec.uppercase ? "uppercase" : undefined,
  };
}

export const typeScale = VARIANTS;

/**
 * Font size for text fields.
 *
 * 16px, and deliberately a step above `body`: iOS Safari zooms the page in
 * whenever a focused input's text is smaller than 16px, and the web export is
 * a shipping surface here. Every field was 13–15px, so tapping any of them on
 * an iPhone jerked the layout sideways and left the user to pinch back out.
 *
 * A TextInput cannot use the Text component, so this is the one place a size
 * is still set by hand.
 */
export const inputFontSize = 16;
