import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { overlay, radius, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { makeStyles } from "@/theme/styles";

/**
 * The two small things that are not StatusBadge.
 *
 * `OverlayPill` is a word laid on a photograph — the venue on a feed card,
 * "Ma este" on the Discover hero, the date on a rail tile. It takes its
 * colours from `overlay`, not the palette, because the scrim under it is dark
 * in every theme. One height, the eyebrow role, and never more than one per
 * picture.
 *
 * `CountBadge` is a number on a control: the unread count on the bell. Gold,
 * because it is the one thing on the header asking to be looked at; a dot
 * when there is nothing to count.
 */
export function OverlayPill({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.overlay, style]}>
      <Text variant="eyebrow" numberOfLines={1} style={{ color: overlay.onImageAccent }}>
        {children}
      </Text>
    </View>
  );
}

export function CountBadge({ count, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  if (count !== undefined && count <= 0) return null;
  return (
    <View style={[styles.count, count === undefined && styles.dot, style]}>
      {count !== undefined && (
        <Text variant="caption" tone="inverse" style={styles.countText}>
          {count > 99 ? "99+" : String(count)}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  overlay: {
    alignSelf: "flex-start",
    maxWidth: "70%",
    backgroundColor: overlay.onImage,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  count: {
    minWidth: space.xl,
    height: space.xl,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { lineHeight: space.xl },
  dot: {
    minWidth: space.sm,
    height: space.sm,
    paddingHorizontal: 0,
  },
}));
