import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, useAnimatedValue, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { useColors } from "@/theme/styles";

/**
 * A burst of eight gold sparks from a point, after reactbits' "Click Spark".
 *
 * Used where a tap is a small act of judgement — choosing a mask — so the
 * choice is answered with something more than a fill colour changing.
 * `useSpark()` hands back the element to mount and a function to fire it at
 * a point in the wrapper's own coordinates; each burst is its own short
 * animation and removes itself when done.
 */
const RAYS = 8;
const LENGTH = 26;

export function useSpark() {
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const next = useRef(0);
  const reduced = useReducedMotion();

  const fire = (x: number, y: number) => {
    if (reduced) return;
    const id = next.current++;
    setBursts((cur) => [...cur, { id, x, y }]);
    setTimeout(() => setBursts((cur) => cur.filter((b) => b.id !== id)), 600);
  };

  const element = (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <Burst key={b.id} x={b.x} y={b.y} />
      ))}
    </View>
  );

  return { fire, element };
}

function Burst({ x, y }: { x: number; y: number }) {
  const palette = useColors();
  const progress = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress]);

  const travel = progress.interpolate({ inputRange: [0, 1], outputRange: [6, LENGTH + 8] });
  const scaleY = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.9, 0] });

  return (
    <View style={{ position: "absolute", left: x, top: y }}>
      {Array.from({ length: RAYS }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 3,
            height: 10,
            borderRadius: 2,
            backgroundColor: palette.gold,
            marginLeft: -1.5,
            opacity,
            transform: [{ rotate: `${i * (360 / RAYS)}deg` }, { translateY: travel }, { scaleY }],
          }}
        />
      ))}
    </View>
  );
}

/**
 * The same, as a wrapper: sparks fire wherever a child reports a press, via
 * the `onSpark` it is handed.
 */
export function SparkField({ children, style }: { children: (fire: (x: number, y: number) => void) => ReactNode; style?: StyleProp<ViewStyle> }) {
  const { fire, element } = useSpark();
  return (
    <View style={style}>
      {children(fire)}
      {element}
    </View>
  );
}
