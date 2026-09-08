import { View, StyleSheet } from "react-native";
import { space } from "@/theme/tokens";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

/**
 * The screen has nothing to show — and says which kind of nothing.
 *
 * Three different situations were being rendered almost identically: a list
 * that is genuinely empty, a search that matched nothing, and a fetch that
 * failed. They call for different words and different actions ("add the first
 * one" versus "try again"), so keeping them in one component is about making
 * the difference deliberate rather than about saving lines.
 *
 * An empty screen is an invitation to act, so there is normally an action. A
 * failure explains what to do next rather than apologising.
 *
 * Set like a section rather than like a dialog: left-aligned, an eyebrow
 * naming the place, the title in the display face. Centred grey text in the
 * middle of a dark void read as an error even when it was saying "nothing
 * yet, and that is fine".
 */
export function EmptyState({
  eyebrow,
  title,
  body,
  actionLabel,
  onAction,
  align = "start",
}: {
  /** Where we are: "Kívánságlista", "Keresés". */
  eyebrow?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `center` for a state that fills a whole screen with nothing around it. */
  align?: "start" | "center";
}) {
  const centered = align === "center";
  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      {!!eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
      <Text variant="title" style={centered && styles.centeredText}>
        {title}
      </Text>
      {!!body && (
        <Text variant="bodySmall" tone="dim" style={[styles.body, centered && styles.centeredText]}>
          {body}
        </Text>
      )}
      {!!actionLabel && !!onAction && (
        <Button label={actionLabel} variant="outline" onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-start",
    gap: space.sm,
    paddingVertical: space["3xl"],
    paddingHorizontal: space.xl,
  },
  centered: { alignItems: "center", paddingVertical: space["5xl"] },
  centeredText: { textAlign: "center" },
  body: { maxWidth: 420 },
  action: { marginTop: space.sm, alignSelf: "flex-start" },
});
