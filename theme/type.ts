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
};

const VARIANTS: Record<TypeVariant, VariantSpec> = {
  // Bodoni tightens up as it grows; negative tracking keeps large settings
  // from looking loose, which is standard practice for a didone at size.
  display: { size: 32, lineHeight: 37, family: "display", weight: "semibold", letterSpacing: -0.4 },
  title: { size: 24, lineHeight: 29, family: "display", weight: "semibold", letterSpacing: -0.2 },
  heading: { size: 19, lineHeight: 24, family: "display", weight: "semibold" },

  // From here down, Sora — see the note above about hairline serifs at size.
  subheading: { size: 16, lineHeight: 21, family: "body", weight: "semibold" },
  body: { size: 15, lineHeight: 23, family: "body", weight: "regular" },
  bodySmall: { size: 13.5, lineHeight: 20, family: "body", weight: "regular" },
  label: { size: 12.5, lineHeight: 16, family: "body", weight: "semibold" },
  caption: { size: 11.5, lineHeight: 15, family: "body", weight: "medium" },
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
  tone: TypeTone = "default",
  palette: Palette = colors
): TextStyle {
  const spec = VARIANTS[variant];
  return {
    fontFamily: spec.family === "display" ? displayFont(fontsLoaded, spec.weight === "regular" ? "regular" : "semibold") : bodyFont(fontsLoaded, spec.weight),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    color: toneColor(palette, tone),
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
