import type { ReactNode } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { radius, space } from "@/theme/tokens";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Text } from "@/components/ui/Text";
import type { Play } from "@/data/types";

/**
 * A production as a list row: thumbnail, title, and whatever the surrounding
 * screen needs to say about it.
 *
 * The profile's tabs used to render bare poster grids. That looks tidy with
 * real cover art and tells you nothing without it — a column of stand-ins with
 * no titles is not a diary you can read. Anywhere the point is "which plays
 * are these", the title has to be on the row.
 */
export function PlayRow({
  play,
  meta,
  trailing,
  onPress,
}: {
  play: Play;
  /** Secondary lines — venue, the date it was seen, whatever fits the screen. */
  meta?: ReactNode;
  /** Right-hand content, e.g. a rating. */
  trailing?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={play.title}>
      <PosterPlaceholder
        poster={play.poster}
        title={play.title}
        seed={play.id}
        width={56}
        height={84}
        radius={radius.sm}
        preferThumb
      />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="subheading" numberOfLines={2}>
          {play.title}
        </Text>
        {meta}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
});
