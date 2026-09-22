import { useEffect, useState } from "react";
import { Animated, Easing, View, StyleSheet, type DimensionValue } from "react-native";
import { useColors } from "@/theme/styles";
import { radius as radii, space, thumb } from "@/theme/tokens";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * A placeholder shaped like the content that is coming.
 *
 * The screens showed nothing at all while loading, so the first paint moved
 * everything on the page — and an empty Discover was indistinguishable from a
 * failed one until the request finally settled. Holding the shape means the
 * layout arrives once.
 *
 * The pulse is the one piece of non-user-triggered motion in the app, and it
 * is here because it is the thing that distinguishes "still loading" from
 * "loaded, and genuinely blank".
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = radii.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: object;
}) {
  // Held in state rather than a ref because `pulse` is read during render, by
  // the `interpolate` call below, and a ref must not be. The lazy initialiser
  // also means the Animated.Value is constructed once rather than on every
  // render and immediately thrown away.
  const [pulse] = useState(() => new Animated.Value(0));
  const colors = useColors();
  const reduced = useReducedMotion();

  useEffect(() => {
    // Reduced motion: hold a steady mid-tone rather than pulse. The shape is
    // still the shape, which is most of what a skeleton says.
    if (reduced) {
      pulse.setValue(0.5);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface, opacity }, style]} />;
}

/** One browsing tile: poster, title, venue. Matches the real card's rhythm. */
export function PosterCardSkeleton({ aspectRatio = 3 / 4 }: { aspectRatio?: number }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ aspectRatio }}>
        <Skeleton width="100%" height="100%" radius={radii.md} />
      </View>
      <Skeleton height={12} width="85%" />
      <Skeleton height={10} width="55%" />
    </View>
  );
}

/**
 * One list row, before it has loaded: the shape of `PlayRow` — a poster's
 * thumbnail, a title, a line of meta — so the list arrives in place.
 */
export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={thumb.row.width} height={thumb.row.height} />
      <View style={styles.rowLines}>
        <Skeleton height={space.lg} width="70%" />
        <Skeleton height={space.md} width="45%" />
      </View>
    </View>
  );
}

/**
 * A whole screen, before it has loaded: a title, a line, and three rows.
 *
 * For the six screens that used to show a blank page until their data came
 * back — the inbox, the season, a person's profile, the profile editor — and
 * so looked broken for as long as the request took. The shape is generic on
 * purpose: it says "a screen is coming", not which one.
 */
export function ScreenSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.screen}>
      <Skeleton height={space["2xl"]} width="55%" />
      <Skeleton height={space.md} width="35%" style={styles.screenMeta} />
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </View>
  );
}

/** A horizontal run of tiles, for a rail that has not loaded yet. */
export function SkeletonRail({ count = 4, width = 132 }: { count?: number; width?: number }) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width }}>
          <PosterCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", gap: space.lg, overflow: "hidden" },
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingVertical: space.sm },
  rowLines: { flex: 1, gap: space.sm, paddingTop: space.xs },
  screen: { gap: space.sm },
  screenMeta: { marginBottom: space.lg },
});
