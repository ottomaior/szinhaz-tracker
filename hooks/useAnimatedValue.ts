import { useRef } from "react";
import { Animated } from "react-native";

/**
 * `useAnimatedValue` the way React Native ships it since 0.71.
 *
 * The types export it, but react-native-web (0.21) does not implement it, so
 * an import from "react-native" typechecks and then throws
 * "useAnimatedValue is not a function" the first time the dock renders in a
 * browser. Every animated primitive imports this one instead; the semantics
 * are the same — one `Animated.Value` for the life of the component.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const ref = useRef<Animated.Value | null>(null);
  if (ref.current === null) ref.current = new Animated.Value(initial);
  return ref.current;
}
