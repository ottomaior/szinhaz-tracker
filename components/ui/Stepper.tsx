import { useEffect, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { CheckIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { control, duration, radius, rule, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";

/**
 * A short form in acts, after reactbits' "Stepper".
 *
 * `StepIndicator` is the row of numbered discs with the bars between them
 * filling gold as each step is passed; `StepPane` slides the current step's
 * content in from the right. The check-in used to be one long scroll that
 * asked when, how much, what did you think and would you recommend it all at
 * once; three questions one at a time is how somebody actually recalls an
 * evening.
 */
export function StepIndicator({ steps, current, labels }: { steps: number; current: number; labels?: string[] }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps, now: current }} style={{ gap: space.sm }}>
      <View style={styles.row}>
        {Array.from({ length: steps }).map((_, i) => {
          const n = i + 1;
          const done = n < current;
          const cur = n === current;
          return (
            <View key={n} style={[styles.segment, i === steps - 1 && styles.segmentLast]}>
              <View style={[styles.disc, (done || cur) && styles.discOn, cur && styles.discCurrent]}>
                {done ? (
                  <CheckIcon color={colors.onAccent} />
                ) : (
                  <Text variant="caption" style={{ color: cur ? colors.onAccent : colors.textFaint }}>
                    {n}
                  </Text>
                )}
              </View>
              {i < steps - 1 && <Bar filled={done} />}
            </View>
          );
        })}
      </View>
      {!!labels && (
        <View style={styles.labels}>
          {labels.map((label, i) => (
            <Text
              key={label}
              variant="caption"
              tone={i + 1 === current ? "accent" : "faint"}
              numberOfLines={1}
              style={[styles.label, i === 0 && { textAlign: "left" }, i === labels.length - 1 && { textAlign: "right" }]}
            >
              {label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({ filled }: { filled: boolean }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const scale = useAnimatedValue(filled ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      scale.setValue(filled ? 1 : 0);
      return;
    }
    Animated.timing(scale, { toValue: filled ? 1 : 0, duration: duration.reveal, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
  }, [filled, scale, reduced]);
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, { transform: [{ scaleX: scale }] }]} />
    </View>
  );
}

/**
 * One step's content. Mount it for the current step only; it enters from the
 * side the reader came from.
 */
export function StepPane({ children, direction = 1 }: { children: ReactNode; direction?: 1 | -1 }) {
  const reduced = useReducedMotion();
  const progress = useAnimatedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    Animated.timing(progress, { toValue: 1, duration: duration.reveal, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress, reduced]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [28 * direction, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  segment: { flex: 1, flexDirection: "row", alignItems: "center" },
  segmentLast: { flex: 0 },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  disc: {
    width: control.sm,
    height: control.sm,
    borderRadius: radius.pill,
    borderWidth: rule,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  discOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  discCurrent: { boxShadow: `0 0 0 ${space.xs}px ${colors.goldTintBg}` },
  label: { flex: 1, textAlign: "center" },
  bar: { flex: 1, height: rule, backgroundColor: colors.hairline, overflow: "hidden" },
  barFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.gold, transformOrigin: "left" },
}));
