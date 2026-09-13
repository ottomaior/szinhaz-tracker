import { useEffect, useState } from "react";
import { Animated, useAnimatedValue, Easing } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Text } from "@/components/ui/Text";
import type { TypeTone, TypeVariant } from "@/theme/type";
import type { StyleProp, TextStyle } from "react-native";

/**
 * A figure that counts up to its value on first sight, after reactbits'
 * "Count Up".
 *
 * Drives a JS-side Animated value and prints it through state: text content
 * cannot be animated natively, and for a number that runs for under a second
 * a re-render per frame is fine. Formatted in Hungarian (space-grouped
 * thousands), and settles on the exact value rather than the eased one.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  delay = 0,
  variant = "numeral",
  tone,
  style,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  variant?: TypeVariant;
  tone?: TypeTone;
  style?: StyleProp<TextStyle>;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const anim = useAnimatedValue(0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: p }) => setShown(value * p));
    const timing = Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timing.start(({ finished }) => {
      if (finished) setShown(value);
    });
    return () => {
      timing.stop();
      anim.removeListener(id);
    };
  }, [value, reduced, duration, delay, anim]);

  return (
    <Text variant={variant} tone={tone} style={style}>
      {format(shown, decimals)}
    </Text>
  );
}

function format(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
}
