import { Pressable, StyleSheet, View } from "react-native";
import { hairlineWidth, radius, space } from "@/theme/tokens";
import { pressStyle } from "@/components/ui/pressable";
import { useColors } from "@/theme/styles";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Text } from "@/components/ui/Text";
import type { ListSummary } from "@/services/listsService";
import type { Play } from "@/data/types";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * A list as a row: what it is called, how big it is, and a glimpse of what is in it.
 *
 * The covers come from a map the *screen* fetched in one query, not from a
 * request this component makes — four thumbnails per card times a screen of
 * cards is the per-item request pattern `getVenuesByIds` exists to avoid.
 *
 * They overlap rather than sitting in a row: a list is one object with several
 * things in it, and four separate tiles read as four separate list rows. The
 * stack also degrades honestly — a list with two entries shows two.
 */
/**
 * The cover fan: four thumbnails overlapping by `OVERLAP`, at the small
 * size that is this card's motif rather than the row thumbnail — four
 * of those side by side would be a rail, not a glimpse.
 */
const COVER = { width: 40, height: 60 };
const OVERLAP = space.xl;
const FAN_WIDTH = COVER.width + (COVER.width - OVERLAP) * 3;

export function ListCard({
  list,
  playsById,
  onPress,
}: {
  list: ListSummary;
  playsById: Map<string, Play>;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = useColors();

  const covers = list.coverPlayIds.map((id) => playsById.get(id)).filter((p): p is Play => !!p);

  return (
    <Pressable onPress={onPress} style={pressStyle("row", palette, styles.card)} accessibilityRole="button" accessibilityLabel={list.title}>
      <View style={styles.covers}>
        {covers.length === 0 ? (
          <View style={styles.emptyCover} />
        ) : (
          covers.map((play, i) => (
            <View key={play.id} style={[styles.coverSlot, i > 0 && { marginLeft: -OVERLAP }, { zIndex: covers.length - i }]}>
              <PosterPlaceholder
                poster={play.poster}
                title={play.title}
                seed={play.id}
                width={COVER.width}
                height={COVER.height}
                radius={radius.sm}
                preferThumb
              />
            </View>
          ))
        )}
      </View>

      <View style={{ flex: 1, gap: space["2xs"] }}>
        <Text variant="subheading" numberOfLines={2}>
          {list.title}
        </Text>
        {!!list.description && (
          <Text variant="caption" tone="dim" numberOfLines={2}>
            {list.description}
          </Text>
        )}
        <Text variant="caption" tone="faint">
          {[
            strings.lists.itemCount(list.itemCount),
            list.isRanked ? strings.lists.rankedBadge : undefined,
            // Only worth saying when it is the unusual case. Every list is
            // public by default, so a "public" badge on all of them would be
            // decoration; "private" is information.
            list.isPublic ? undefined : strings.lists.privateBadge,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  covers: { flexDirection: "row", alignItems: "center", width: FAN_WIDTH },
  coverSlot: {
    borderRadius: radius.sm,
    // A hairline between overlapping covers, so the stack reads as separate
    // productions rather than one smeared image.
    borderWidth: hairlineWidth,
    borderColor: colors.bg,
  },
  emptyCover: {
    width: COVER.width,
    height: COVER.height,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
}));
