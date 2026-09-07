import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from "react-native";
import { useAppFonts } from "@/hooks/useAppFonts";
import { typeStyle, type TypeTone, type TypeVariant } from "@/theme/type";
import { useColors } from "@/theme/styles";

/**
 * Every piece of text in the app.
 *
 * Before this, each text node repeated the same three lines by hand —
 *
 *   fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 12.5, color: colors.textFaint
 *
 * — which is how the app ended up with twenty different font sizes and why
 * every screen had to thread `fontsLoaded` through its own styles. Naming the
 * role instead of the values is what keeps the scale from drifting again.
 *
 * `style` still works for one-off layout concerns (margins, alignment), but a
 * new font size appearing in a screen is a sign the scale needs a role, not
 * that the screen needs an override.
 */
export function Text({
  variant = "body",
  tone = "default",
  style,
  ...rest
}: RNTextProps & {
  variant?: TypeVariant;
  tone?: TypeTone;
  style?: StyleProp<TextStyle>;
}) {
  const fontsLoaded = useAppFonts();
  // Every piece of text in the app comes through here, so this is also where
  // most of the tree learns that the theme changed — see theme/styles.ts.
  const colors = useColors();
  return <RNText {...rest} style={[typeStyle(variant, fontsLoaded, tone, colors), style]} />;
}
