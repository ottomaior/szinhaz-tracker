import { Pressable, StyleSheet, View } from "react-native";
import { hairlineWidth, legacy, radius, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { colors } from "@/theme/colors";
import { CheckIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { haptic } from "@/utils/haptics";

/**
 * One on/off setting: a label, a line under it, and a disc that fills gold.
 *
 * The same tick the first run's theatre rows use, rather than the platform
 * switch, so a list of these reads as one of the app's lists and looks the
 * same in every palette and on both platforms.
 */
export function ToggleRow({
  label,
  blurb,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  blurb?: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        haptic("selection");
        onChange(!on);
      }}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      style={[styles.row, on && styles.rowOn, disabled && styles.disabled]}
    >
      <View style={{ flex: 1, gap: space["2xs"] }}>
        <Text variant="subheading">{label}</Text>
        {!!blurb && (
          <Text variant="caption" tone="faint">
            {blurb}
          </Text>
        )}
      </View>
      <View style={[styles.tick, on && styles.tickOn]}>{on && <CheckIcon size={14} color={colors.onAccent} />}</View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.gold },
  disabled: { opacity: 0.55 },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: legacy.thickHairline,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  tickOn: { backgroundColor: colors.gold, borderColor: colors.gold },
}));
