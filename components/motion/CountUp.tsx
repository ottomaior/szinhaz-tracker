import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { duration as motion } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import type { TypeTone, TypeVariant } from "@/theme/type";
import type { StyleProp, TextStyle } from "react-native";

/**
 * A figure that counts to its value, after reactbits' "Count Up".
 *
 * Not on first sight: the app's motion rule is that nothing animates on the
 * first paint of a screen, and four numbers rolling up from zero under the
 * reader's name were the one place a screen opened on something still
 * changing. The figure prints at its value and counts only when the value
 * changes — after a check-in lands, after a follow — from the number it
 * showed to the number it shows now.
 *
 * Drives a JS-side Animated value and prints it through state: text content
 * cannot be animated natively, and for a number that runs for under a second
 * a re-render per frame is fine. Formatted in Hungarian (space-grouped
 * thousands), and settles on the exact value rather than the eased one.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = motion.reveal,
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
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const anim = useAnimatedValue(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || start === value) {
      setShown(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: p }) => setShown(start + (value - start) * p));
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
