import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { radius, space } from "@/theme/tokens";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Text } from "@/components/ui/Text";
import type { ListSummary } from "@/services/listsService";
import type { Play } from "@/data/types";
import { strings } from "@/i18n/hu";

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
export function ListCard({
  list,
  playsById,
  onPress,
}: {
  list: ListSummary;
  playsById: Map<string, Play>;
  onPress: () => void;
}) {
  const covers = list.coverPlayIds.map((id) => playsById.get(id)).filter((p): p is Play => !!p);

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={list.title}>
      <View style={styles.covers}>
        {covers.length === 0 ? (
          <View style={styles.emptyCover} />
        ) : (
          covers.map((play, i) => (
            <View key={play.id} style={[styles.coverSlot, i > 0 && { marginLeft: -22 }, { zIndex: covers.length - i }]}>
              <PosterPlaceholder
                poster={play.poster}
                title={play.title}
                seed={play.id}
                width={40}
                height={60}
                radius={radius.sm}
                preferThumb
              />
            </View>
          ))
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
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

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  covers: { flexDirection: "row", alignItems: "center", width: 96 },
  coverSlot: {
    borderRadius: radius.sm,
    // A hairline between overlapping covers, so the stack reads as separate
    // productions rather than one smeared image.
    borderWidth: 1,
    borderColor: colors.bg,
  },
  emptyCover: {
    width: 40,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
});
