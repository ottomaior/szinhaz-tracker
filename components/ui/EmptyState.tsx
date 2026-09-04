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
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text variant="heading" style={styles.centered}>
        {title}
      </Text>
      {!!body && (
        <Text variant="bodySmall" tone="dim" style={styles.centered}>
          {body}
        </Text>
      )}
      {!!actionLabel && !!onAction && <Button label={actionLabel} variant="outline" onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space["5xl"],
    paddingHorizontal: space["2xl"],
  },
  centered: { textAlign: "center" },
});
