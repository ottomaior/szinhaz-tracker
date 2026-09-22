import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Text } from "@/components/ui/Text";
import { control, hairlineWidth, radius, space, spring } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";

/**
 * A row of tabs with one gold pill that slides to the chosen one, after
 * reactbits' "Pill Nav".
 *
 * Replaces the underlined text tabs the feed, Discover and the profile each
 * drew by hand. The pill is one Animated.View behind the labels, moved by
 * spring to the measured position of the active tab, so a change of tab is a
 * thing the eye can follow rather than an underline that jumps.
 *
 * `variant="bar"` is the same control drawn flat, for a top bar that already
 * has a background: no track, the pill becomes a soft tint.
 */
export function PillTabs<K extends string>({
  tabs,
  value,
  onChange,
  variant = "pill",
  style,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  variant?: "pill" | "bar";
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const x = useAnimatedValue(0);
  const width = useAnimatedValue(0);
  const settled = useRef(false);

  const active = layouts[value];
  useEffect(() => {
    if (!active) return;
    if (!settled.current || reduced) {
      x.setValue(active.x);
      width.setValue(active.width);
      settled.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: active.x, useNativeDriver: false, ...spring }),
      Animated.spring(width, { toValue: active.width, useNativeDriver: false, ...spring }),
    ]).start();
  }, [active, x, width, reduced]);

  const flat = variant === "bar";

  return (
    <View style={[flat ? styles.trackFlat : styles.track, style]} accessibilityRole="tablist">
      {!!active && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, flat ? styles.pillFlat : styles.pillGold, { transform: [{ translateX: x }], width }]}
        />
      )}
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            onLayout={(e) => {
              const { x: lx, width: lw } = e.nativeEvent.layout;
              setLayouts((cur) =>
                cur[tab.key]?.x === lx && cur[tab.key]?.width === lw ? cur : { ...cur, [tab.key]: { x: lx, width: lw } }
              );
            }}
            accessibilityRole="tab"
            aria-selected={selected}
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            {/* Inverse only once the pill is actually behind the label: before
                the first onLayout there is nothing gold to sit on, and an
                inverse label on the bare track is invisible. */}
            <Text variant="label" tone={selected ? (flat || !active ? "default" : "inverse") : "faint"}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineSoft,
    gap: space["2xs"],
  },
  trackFlat: { flexDirection: "row", alignSelf: "flex-start", gap: space["2xs"] },
  tab: { height: control.sm, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pill: { position: "absolute", top: space.xs, bottom: space.xs, left: 0, borderRadius: radius.pill },
  pillGold: { backgroundColor: colors.gold, boxShadow: `0 4px 14px ${colors.goldGlow}` },
  pillFlat: { top: 0, bottom: 0, backgroundColor: colors.neutralTintBg },
}));
