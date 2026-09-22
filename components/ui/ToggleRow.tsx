import { Pressable, StyleSheet, View } from "react-native";
import { hairlineWidth, radius, space } from "@/theme/tokens";
import { CheckDisc } from "@/components/ui/CheckDisc";
import { disabledStyle, pressStyle } from "@/components/ui/pressable";
import { useColors } from "@/theme/styles";
import { makeStyles } from "@/theme/styles";
import { Text } from "@/components/ui/Text";
import { haptic } from "@/utils/haptics";

/**
 * One on/off setting: a label, an optional line under it, and a disc that
 * fills gold.
 *
 * The same tick the first run's theatre rows use, rather than the platform
 * switch, so a list of these reads as one of the app's lists and looks the
 * same in every palette and on both platforms.
 *
 * `bare` drops the border and the fill for a row that lives inside a
 * `SettingsGroup`, which draws the box for the whole section instead
 * (T-117). The gold-when-on border goes with it, and nothing is lost: the
 * disc has been saying the same thing all along.
 */
export function ToggleRow({
  label,
  blurb,
  on,
  onChange,
  disabled = false,
  bare = false,
}: {
  label: string;
  blurb?: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  bare?: boolean;
}) {
  const styles = useStyles();
  const palette = useColors();
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
      style={pressStyle("row", palette, [
        styles.row,
        bare ? styles.bare : on && styles.rowOn,
        disabled && disabledStyle,
      ])}
    >
      <View style={{ flex: 1, gap: space["2xs"] }}>
        <Text variant="subheading">{label}</Text>
        {!!blurb && (
          <Text variant="caption" tone="faint">
            {blurb}
          </Text>
        )}
      </View>
      <CheckDisc on={on} />
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
  bare: { borderWidth: 0, borderRadius: 0, backgroundColor: "transparent" },
}));
