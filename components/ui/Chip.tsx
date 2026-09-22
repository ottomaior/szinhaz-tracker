import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { control, hairlineWidth, radius, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { disabledStyle, pressStyle } from "@/components/ui/pressable";
import { makeStyles, useColors } from "@/theme/styles";
import { haptic } from "@/utils/haptics";

/**
 * A small pill that names a choice: a filter, a tag, a showtime, a season.
 *
 * `control.sm` tall, the label role, gold when `active`. The same shape
 * carries the date field's quick picks and the trigger of a `SelectChip`,
 * which pass `leading` and `trailing` for their icons; a `Chip` without an
 * `onPress` is a tag and paints the same without being a control.
 */
export function Chip({
  label,
  active = false,
  disabled = false,
  onPress,
  leading,
  trailing,
  accessibilityLabel,
  style,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const palette = useColors();
  const body = (
    <>
      {leading}
      <Text variant="label" tone={active ? "inverse" : "dim"} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </>
  );
  if (!onPress) return <View style={[styles.base, active ? styles.active : styles.inactive, style]}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={active}
      accessibilityState={{ selected: active, disabled }}
      style={pressStyle(active ? "fill" : "row", palette, [
        styles.base,
        active ? styles.active : styles.inactive,
        disabled && disabledStyle,
        style,
      ])}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: control.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  active: {
    backgroundColor: colors.gold,
  },
  inactive: {
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
}));
