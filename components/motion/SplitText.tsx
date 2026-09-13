import { useEffect, useMemo } from "react";
import { Animated, Easing, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { Text } from "@/components/ui/Text";
import type { TypeTone, TypeVariant } from "@/theme/type";

/**
 * A title that arrives a word at a time, after reactbits' "Split Text".
 *
 * Split on words rather than on characters, and that is not a shortcut:
 * every glyph in its own Text node loses the kerning between them, and a
 * didone with its hairlines is exactly the face that shows it. A word is the
 * smallest piece Bodoni can be broken into without looking wrong.
 *
 * The words are laid out by a wrapping row, so a long title breaks between
 * words exactly where the plain Text would have; the wrapper carries the
 * accessibility label so a screen reader hears one title, not five.
 */
export function SplitText({
  text,
  variant = "display",
  tone,
  stagger = 55,
  delay = 0,
  color,
  style,
  textStyle,
  numberOfLines,
}: {
  text: string;
  variant?: TypeVariant;
  tone?: TypeTone;
  stagger?: number;
  delay?: number;
  /** Overrides the tone — for a title laid on a scrimmed poster. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  // One value per word, rebuilt for a new title so the entrance replays.
  // Keyed on the text rather than the count: two titles of the same length
  // are still two titles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const values = useMemo(() => words.map(() => new Animated.Value(reduced ? 1 : 0)), [text]);

  useEffect(() => {
    if (reduced) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    values.forEach((v) => v.setValue(0));
    const anim = Animated.stagger(
      stagger,
      values.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER })
      )
    );
    const handle = setTimeout(() => anim.start(), delay);
    return () => {
      clearTimeout(handle);
      anim.stop();
    };
  }, [values, reduced, stagger, delay]);

  // Word count changed under us (the hook above keeps `values` from the first
  // render): fall back to a plain title rather than index past the array.
  if (values.length !== words.length) {
    return (
      <Text variant={variant} tone={tone} numberOfLines={numberOfLines} style={[color ? { color } : undefined, textStyle]}>
        {text}
      </Text>
    );
  }

  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap" }, style]} accessibilityRole="header" accessibilityLabel={text}>
      {words.map((word, i) => {
        const v = values[i];
        const last = i === words.length - 1;
        return (
          <Animated.View
            key={`${i}-${word}`}
            style={{
              opacity: v,
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["2deg", "0deg"] }) },
              ],
            }}
            // Every word but the whole title is decoration to a screen reader.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text variant={variant} tone={tone} style={[color ? { color } : undefined, textStyle]}>
              {last ? word : `${word} `}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
