import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { icon, legacy, radius, space } from "@/theme/tokens";
import { CheckIcon } from "@/components/icons/Icons";
import { makeStyles } from "@/theme/styles";

/**
 * The circle that fills gold when a thing is chosen: on a ToggleRow, on the
 * first run's theatre rows, on the onboarding grid's tiles.
 *
 * Three copies of the same 26px disc existed, each with its own tick size.
 * This is the one, and it is only ever drawn by a control that owns the
 * press — it has no `onPress` of its own on purpose.
 */
export function CheckDisc({ on }: { on: boolean }) {
  const styles = useStyles();
  return <View style={[styles.disc, on && styles.on]}>{on && <CheckIcon size={icon.inline} color={colors.onAccent} />}</View>;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  disc: {
    width: space["2xl"],
    height: space["2xl"],
    borderRadius: radius.pill,
    borderWidth: legacy.thickHairline,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  on: { backgroundColor: colors.gold, borderColor: colors.gold },
}));
