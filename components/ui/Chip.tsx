import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { legacyType } from "@/theme/type";
import { hairlineWidth, legacy, radius } from "@/theme/tokens";
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
      <Text style={[legacyType(active ? "chipActive" : "chip", fontsLoaded), { color: active ? colors.onAccent : colors.textDim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  base: {
    paddingVertical: legacy.chipPaddingVertical,
    paddingHorizontal: legacy.chipPaddingHorizontal,
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
