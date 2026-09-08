import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";

/**
 * The one way a section introduces itself.
 *
 * Every screen used to open its sections with a bare 16px Sora subheading,
 * which made a browsing rail, a list of showtimes and a settings group all
 * look like the same kind of thing. The context each heading was carrying —
 * "Népszerű itt: Debrecen", "Időpontok · 2 előadás" — was crammed into the
 * heading text or hung beside it in whatever the screen had to hand.
 *
 * Here the context goes on an eyebrow above the title, the title is set in
 * the display face, and whatever the section offers as a way out — "Összes",
 * a count, "Teljes műsor" — sits on the baseline at the right. Used identically
 * on Discover, play detail, profile, person and list pages, so a reader learns
 * the shape once.
 */
export function SectionHeader({
  title,
  eyebrow,
  action,
  onAction,
  trailing,
  style,
}: {
  title: string;
  /** What kind of section this is, or what it is scoped to. */
  eyebrow?: string;
  /** A link at the right, e.g. "Összes". Rendered as a pressable when `onAction` is given. */
  action?: string;
  onAction?: () => void;
  /** Anything else at the right — a count, a control. Wins over `action`. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titles}>
        {!!eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
        <Text variant="heading">{title}</Text>
      </View>
      {trailing ??
        (!!action &&
          (onAction ? (
            <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${title}: ${action}`}>
              <Text variant="label" tone="accent">
                {action}
              </Text>
            </Pressable>
          ) : (
            <Text variant="label" tone="faint">
              {action}
            </Text>
          )))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
  },
  titles: { flexShrink: 1, gap: 3 },
});
