import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { hairlineWidth, radius } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";

/**
 * A section of Settings as one card, its rows parted by hairlines (T-117).
 *
 * Settings used to draw every row as its own bordered, filled box — nineteen
 * of them on a signed-in phone. Nineteen boxes is not nineteen decisions; it
 * is one list read as a stack of unrelated tiles, and it is most of what made
 * the screen feel like a form rather than a place. A section is the unit a
 * person actually thinks in, so a section is the unit that gets a border.
 *
 * The rows inside are drawn bare — no border, no fill of their own — which is
 * why `ToggleRow` takes a `bare` prop rather than this file styling around it:
 * the row still owns its own padding and press feedback, and only gives up
 * the box.
 *
 * `null` children are dropped rather than divided, so a row that renders
 * conditionally does not leave a hairline with nothing under it.
 */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const styles = useStyles();

  const rows = Children.toArray(children).filter((child) => isValidElement(child));
  if (rows.length === 0) return null;

  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        // The index is the key of a position, not of a row: these lists are
        // written out in the source and never reorder.
        <View key={i} style={i > 0 ? styles.divided : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    group: {
      borderRadius: radius.md,
      borderWidth: hairlineWidth,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
      // The rows square their own corners off against the card's radius.
      overflow: "hidden",
    },
    // Softer than the card's own edge: a divider inside a box should part the
    // rows, not compete with the border that holds them.
    divided: { borderTopWidth: hairlineWidth, borderTopColor: colors.hairlineSoft },
  })
);
