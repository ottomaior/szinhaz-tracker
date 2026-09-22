import { Pressable, StyleSheet, View, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/theme/colors";
import { control, hairlineWidth, overlay, radius, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { disabledStyle, pressStyle } from "@/components/ui/pressable";
import { makeStyles, useColors } from "@/theme/styles";

/**
 * The button, in three variants and two sizes.
 *
 * `md` is `control.md` tall — the touch target — with the label role and
 * the card radius; every full-width action in the app is one. `sm` is a
 * pill at `control.sm`, for the secondary controls that used to be drawn
 * by hand in nine places with nine paddings: the profile's edit and sign
 * out, the entry's owner actions, the follow pill on a venue row, the top
 * bar's log action, a comment's like and send.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  style,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  /**
   * `primary` is the one filled gold control a screen gets. `outline` is a
   * secondary commitment — follow, cancel. `text` is a link out or a quiet
   * alternative under a primary ("Jegyek ↗", "Bejelentkezés"); it keeps the
   * button's height so a row of the three lines up, but paints nothing.
   */
  variant?: "primary" | "outline" | "text";
  size?: "md" | "sm";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blocks presses and dims the button — use for "already submitting". */
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const palette = useColors();

  const isPrimary = variant === "primary";
  const isBlocked = disabled || loading;
  const tone = isPrimary ? "inverse" : variant === "text" ? "accent" : "default";
  const labelColor = isPrimary ? colors.onAccent : variant === "text" ? colors.gold : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-busy={loading}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={pressStyle(isPrimary ? "fill" : "quiet", palette, [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        isPrimary ? styles.primary : variant === "text" ? styles.text : styles.outline,
        isBlocked && disabledStyle,
        style,
      ])}
    >
      {loading ? <ActivityIndicator size="small" color={labelColor} /> : icon}
      <Text variant="label" tone={tone} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A round icon-only button: back, share, watchlist, add-to-list. */
export function IconButton({
  onPress,
  children,
  translucent = false,
  active = false,
  disabled = false,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  translucent?: boolean;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  const palette = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-pressed={active}
      accessibilityState={{ disabled, selected: active }}
      style={pressStyle(active ? "fill" : "row", palette, [
        styles.iconBtn,
        translucent ? styles.iconBtnTranslucent : styles.iconBtnSolid,
        active && styles.iconBtnActive,
        disabled && disabledStyle,
      ])}
    >
      <View>{children}</View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  md: {
    minHeight: control.md,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  sm: {
    minHeight: control.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
  },
  primary: {
    backgroundColor: colors.gold,
  },
  outline: {
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  text: {
    paddingHorizontal: space.sm,
  },
  iconBtn: {
    width: control.md,
    height: control.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnTranslucent: {
    backgroundColor: overlay.onImageSoft,
  },
  iconBtnSolid: {
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  iconBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
}));
