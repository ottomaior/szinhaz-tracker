import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PressCard } from "@/components/motion/PressCard";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Text } from "@/components/ui/Text";
import type { Play } from "@/data/types";
import { radius, space, thumb } from "@/theme/tokens";

/**
 * A production as a tile: the poster, the title, a line under it.
 *
 * The one shape for a poster in a rail or a grid. Discover drew three —
 * the rail's tile, a premiere card and a trending card — with two aspect
 * ratios, two radii and two caption layouts, and only the rail's gave
 * under the finger. This one is 4:5 (the proportion that keeps the centre
 * of a landscape production still when it is cropped), `radius.md` like
 * every card, and presses and tilts through `PressCard`.
 *
 * `width` fixes the tile for a rail; left out, the tile fills its grid
 * cell. Nothing is ever drawn on the artwork here — a status, a rating —
 * because forty tiles carrying eighty pieces of chrome told the reader
 * nothing. What has to be said goes in `meta`, under the title.
 */
export function PosterTile({
  poster,
  title,
  seed,
  meta,
  onPress,
  width,
  titleLines = 2,
  style,
}: {
  poster: Play["poster"];
  title: string;
  seed: string;
  /** The line under the title: a venue, a time and a venue, a status. */
  meta?: ReactNode;
  onPress: () => void;
  /** A fixed width for a rail; undefined fills the cell. */
  width?: number;
  titleLines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[width !== undefined && { width }, style]}>
      <PressCard
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        surfaceStyle={styles.tile}
        radius={radius.md}
      >
        <PosterPlaceholder poster={poster} title={title} seed={seed} height="100%" radius={0} preferThumb portraitFrame />
      </PressCard>
      <View style={styles.caption}>
        <Text variant="label" numberOfLines={titleLines}>
          {title}
        </Text>
        {typeof meta === "string" ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {meta}
          </Text>
        ) : (
          meta
        )}
      </View>
    </View>
  );
}

/** The tile's proportion, shared with the skeleton that stands in for it. */
export const TILE_ASPECT = thumb.tile.width / thumb.tile.height;

const styles = StyleSheet.create({
  tile: { width: "100%", aspectRatio: TILE_ASPECT },
  caption: { gap: space["2xs"], marginTop: space.sm },
});
