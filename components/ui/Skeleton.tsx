import { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet, type DimensionValue } from "react-native";
import { colors } from "@/theme/colors";
import { radius as radii, space } from "@/theme/tokens";

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
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

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
});
