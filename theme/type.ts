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

// The roles themselves are plain data and live in ./typeScale, so a Node
// script can read them without pulling in React Native. See theme/typeScale.ts.
export { type TypeVariant, type TypeTone, typeScale } from "./typeScale";
import type { VariantSpec } from "./typeScale";
import { typeScale as VARIANTS, type TypeVariant, type TypeTone } from "./typeScale";


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
export type TypeWeight = VariantSpec["weight"];

export function typeStyle(
  variant: TypeVariant,
  fontsLoaded: boolean,
  tone?: TypeTone,
  palette: Palette = colors,
  /** A heavier or lighter cut of the role's face, for a name inside a sentence. Never a different size. */
  weight?: TypeWeight
): TextStyle {
  const spec = VARIANTS[variant];
  const w = weight ?? spec.weight;
  return {
    fontFamily: spec.family === "display" ? displayFont(fontsLoaded, w === "regular" ? "regular" : "semibold") : bodyFont(fontsLoaded, w),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    color: toneColor(palette, tone ?? spec.tone ?? "default"),
    textTransform: spec.uppercase ? "uppercase" : undefined,
  };
}


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

/**
 * The dock's label is the one piece of text outside the scale, and it is
 * outside on purpose: five labels share the width of a phone, "Kívánságlista"
 * is the longest, and `caption` (11.5) broke it into two lines on a large
 * system font (T-106). Named here rather than typed in the dock so that it
 * is visibly a decision.
 */
export const dockLabel: TextStyle = { fontSize: 10, lineHeight: 13 };
