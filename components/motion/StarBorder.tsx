import { useEffect, useState, type ReactNode } from "react";
import { Animated, useAnimatedValue, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { radius as radii } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";

/**
 * A moving gold highlight around the one control a screen is built for,
 * after reactbits' "Star Border".
 *
 * Two soft points of light circle the edge of the wrapper — one along the top
 * running left, one along the bottom running right — behind whatever the
 * wrapper holds, so the button inside keeps its own fill and only its rim
 * catches the light. Reserved for the primary action: "Előadás naplózása"
 * on a production, "Mentés" at the end of a check-in. Two of these on one
 * screen would be two answers to "what do I do here".
 *
 * Reduced motion holds the lights still at the corners, which reads as a
 * lit rim rather than as a control that is stuck.
 */
export function StarBorder({ children, style, radius = radii.pill, speed = 5200 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; speed?: number }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const progress = useAnimatedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: NATIVE_DRIVER })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduced, speed]);

  const span = Math.max(width, 1);
  const leftward = progress.interpolate({ inputRange: [0, 1], outputRange: [span, -LIGHT] });
  const rightward = progress.interpolate({ inputRange: [0, 1], outputRange: [-LIGHT, span] });

  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Three stacked discs at falling alpha stand in for a blur, which
          neither platform can draw on a plain View without a library. */}
      <Animated.View pointerEvents="none" style={[styles.light, { top: -LIGHT * 0.62, transform: [{ translateX: leftward }] }]}>
        <Glow />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.light, { bottom: -LIGHT * 0.62, transform: [{ translateX: rightward }] }]}>
        <Glow />
      </Animated.View>
      <View style={[styles.inner, { borderRadius: radius }]}>{children}</View>
    </View>
  );
}

const LIGHT = 120;

function Glow() {
  const styles = useStyles();
  return (
    <View style={styles.glowBox}>
      <View style={[styles.disc, { width: LIGHT, height: LIGHT, borderRadius: LIGHT / 2, opacity: 0.22 }]} />
      <View style={[styles.disc, { width: LIGHT * 0.6, height: LIGHT * 0.6, borderRadius: LIGHT * 0.3, opacity: 0.35 }]} />
      <View style={[styles.disc, { width: LIGHT * 0.28, height: LIGHT * 0.28, borderRadius: LIGHT * 0.14, opacity: 0.9 }]} />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    padding: 1.5,
    backgroundColor: colors.surface2,
  },
  inner: { overflow: "hidden" },
  light: { position: "absolute", left: 0, width: LIGHT, height: LIGHT },
  glowBox: { width: LIGHT, height: LIGHT, alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", backgroundColor: colors.gold },
}));
