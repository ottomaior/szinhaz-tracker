import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { makeStyles } from "@/theme/styles";
import { haptic } from "@/utils/haptics";

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic("selection");
              onPress();
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={active}
      accessibilityState={{ selected: active }}
      style={[styles.base, active ? styles.active : styles.inactive]}
    >
      <Text
        style={{
          fontFamily: bodyFont(fontsLoaded, active ? "bold" : "medium"),
          fontSize: 12.5,
          color: active ? colors.onAccent : colors.textDim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  base: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  active: {
    backgroundColor: colors.gold,
  },
  inactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
}));
