import { Pressable, Text, StyleSheet, View, ActivityIndicator } from "react-native";
import { colors } from "@/theme/colors";
import { overlay } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { makeStyles } from "@/theme/styles";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  style,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline";
  icon?: React.ReactNode;
  style?: object;
  /** Blocks presses and dims the button — use for "already submitting". */
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
  const isPrimary = variant === "primary";
  const isBlocked = disabled || loading;
  const labelColor = isPrimary ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-busy={loading}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={[styles.base, isPrimary ? styles.primary : styles.outline, isBlocked && styles.blocked, style]}
    >
      {loading ? <ActivityIndicator size="small" color={labelColor} /> : icon}
      <Text
        style={{
          fontFamily: bodyFont(fontsLoaded, "bold"),
          fontSize: 13.5,
          color: labelColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Small square icon-only button (back arrow, share, bookmark…) */
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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-pressed={active}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={6}
      style={[
        styles.iconBtn,
        translucent ? styles.iconBtnTranslucent : styles.iconBtnSolid,
        active && styles.iconBtnActive,
        disabled && styles.blocked,
      ]}
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
    gap: 7,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.gold,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  blocked: {
    opacity: 0.55,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnTranslucent: {
    backgroundColor: overlay.onImageSoft,
  },
  iconBtnSolid: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
}));
