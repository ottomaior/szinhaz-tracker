import { Pressable, Text, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline";
  icon?: React.ReactNode;
  style?: object;
}) {
  const fontsLoaded = useAppFonts();
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, isPrimary ? styles.primary : styles.outline, style]}
    >
      {icon}
      <Text
        style={{
          fontFamily: bodyFont(fontsLoaded, "bold"),
          fontSize: 13.5,
          color: isPrimary ? colors.bg : colors.text,
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
}: {
  onPress?: () => void;
  children: React.ReactNode;
  translucent?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconBtn,
        translucent ? styles.iconBtnTranslucent : styles.iconBtnSolid,
        active && styles.iconBtnActive,
      ]}
    >
      <View>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnTranslucent: {
    backgroundColor: "rgba(10,4,3,0.55)",
  },
  iconBtnSolid: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
});
