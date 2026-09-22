import type { ReactNode } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { hairlineWidth, radius, space, thumb } from "@/theme/tokens";
import { pressStyle } from "@/components/ui/pressable";
import { makeStyles, useColors } from "@/theme/styles";
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
  action,
  onPress,
}: {
  play: Play;
  /** Secondary lines — venue, the date it was seen, whatever fits the screen. */
  meta?: ReactNode;
  /** Right-hand content, e.g. a rating. Read-only: it sits inside the row's
   * own pressable, so anything tappable goes in `action` instead. */
  trailing?: ReactNode;
  /**
   * A control at the end of the row — remove from this list, unfollow.
   *
   * A sibling of the pressable rather than a child of it, the same way
   * `PersonRow` does it: a button inside a button is invalid HTML, warns on
   * every render, and reads as a single target to a screen reader. That is
   * what T-070 reported on the list screen.
   */
  action?: ReactNode;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = useColors();
  const body = (
    <>
      <PosterPlaceholder
        poster={play.poster}
        title={play.title}
        seed={play.id}
        width={thumb.row.width}
        height={thumb.row.height}
        radius={radius.sm}
        preferThumb
      />
      <View style={{ flex: 1, gap: space["2xs"] }}>
        <Text variant="subheading" numberOfLines={2}>
          {play.title}
        </Text>
        {meta}
      </View>
      {trailing}
    </>
  );

  if (action) {
    return (
      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          style={pressStyle("row", palette, styles.pressableRow)}
          accessibilityRole="button"
          accessibilityLabel={play.title}
        >
          {body}
        </Pressable>
        {action}
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={pressStyle("row", palette, styles.row)} accessibilityRole="button" accessibilityLabel={play.title}>
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  // The image row — see theme/tokens.ts `thumb.row`: the same slot on every
  // screen that lists productions, with a hairline under it so a column of
  // rows has one rhythm rather than a gap the screen chose.
  row: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "flex-start",
    paddingVertical: space.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
  },
  // The row's own body when a control sits beside it: the same layout, but
  // the hairline and the vertical padding stay on the wrapper, so a row with
  // an action is exactly as tall as one without.
  pressableRow: { flex: 1, flexDirection: "row", gap: space.md, alignItems: "flex-start" },
}));
