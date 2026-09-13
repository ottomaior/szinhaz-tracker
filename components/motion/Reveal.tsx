import { Children, isValidElement, useEffect, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Entrance motion, after reactbits' "Fade Content" and "Animated List".
 *
 * `FadeIn` brings one block up from a few points below; `AnimatedList` hands
 * each child its own delay so a column of rows arrives one after the other
 * rather than all at once. Both start *from* the resting state when the
 * reader has asked for reduced motion, and neither ever leaves a block
 * parked invisible: the animation runs once on mount and the resting state is
 * fully opaque.
 *
 * Deliberately the built-in Animated API and nothing heavier: the app has no
 * Reanimated dependency, and a 400ms opacity/translate on mount does not need
 * one.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 420,
  distance = 12,
  axis = "y",
  style,
}: {
  children: ReactNode;
  /** Milliseconds before this block starts. */
  delay?: number;
  duration?: number;
  /** How far it travels in, in points. */
  distance?: number;
  /** `y` rises into place; `x` slides in from the left, the way a list row does. */
  axis?: "x" | "y";
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useAnimatedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, reduced, delay, duration]);

  const travel = progress.interpolate({ inputRange: [0, 1], outputRange: [axis === "y" ? distance : -distance, 0] });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [axis === "y" ? { translateY: travel } : { translateX: travel }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** How many rows take their own place in the queue before the rest arrive together. */
const STAGGER_CAP = 8;

/**
 * Its children, each arriving `stagger` milliseconds after the one before.
 *
 * Children keep their own keys, so a list that re-renders with the same rows
 * does not replay the entrance; only rows that mount for the first time do.
 */
export function AnimatedList({
  children,
  stagger = 60,
  initialDelay = 0,
  axis = "x",
  style,
  itemStyle,
}: {
  children: ReactNode;
  stagger?: number;
  initialDelay?: number;
  axis?: "x" | "y";
  style?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <Animated.View style={style}>
      {items.map((child, i) => (
        // Capped: the stagger is for the rows in view when the list arrives.
        // A hundredth diary row waiting five seconds off-screen would simply
        // be blank for whoever scrolls straight to it.
        <FadeIn key={child.key ?? i} delay={initialDelay + Math.min(i, STAGGER_CAP) * stagger} axis={axis} style={itemStyle}>
          {child}
        </FadeIn>
      ))}
    </Animated.View>
  );
}
