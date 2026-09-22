import { ScrollView, StyleSheet, View } from "react-native";
import { PressCard } from "@/components/motion/PressCard";
import { FadeIn } from "@/components/motion/Reveal";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Text } from "@/components/ui/Text";
import type { ProgramEntry } from "@/data/types";
import { gutter, radius, space } from "@/theme/tokens";
import { formatTime } from "@/utils/datetime";

/**
 * One evening across every theatre in scope, as a row of posters.
 *
 * The lead on Discover answers "what is on next" with one production; this
 * answers the question a theatregoer with a free evening actually has — what
 * *else* is on that night — and answers it with faces rather than a list.
 * Tiles are 4:5, the shape that keeps the centre of a landscape production
 * still when it is cropped, and each one gives under the finger.
 */
export function PosterRail({ entries, onOpen }: { entries: ProgramEntry[]; onOpen: (playId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {entries.map((entry, i) => (
        <FadeIn key={entry.performanceId} delay={80 + i * 50} axis="x" distance={16}>
          <PressCard
            onPress={() => onOpen(entry.playId)}
            accessibilityRole="button"
            accessibilityLabel={entry.title}
            style={styles.item}
            surfaceStyle={styles.tile}
            radius={radius.lg}
            tilt={8}
          >
            <PosterPlaceholder poster={entry.poster} title={entry.title} seed={entry.playId} height="100%" radius={0} preferThumb portraitFrame />
          </PressCard>
          <View style={styles.caption}>
            <Text variant="label" numberOfLines={1}>
              {entry.title}
            </Text>
            <Text variant="caption" tone="faint" numberOfLines={1}>
              <Text variant="caption" tone="accent">{formatTime(entry.startsAt)}</Text>
              {" · "}
              {entry.venueName}
            </Text>
          </View>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

const TILE_WIDTH = 124;

const styles = StyleSheet.create({
  rail: { gap: space.md, paddingHorizontal: gutter, paddingVertical: space.xs },
  item: { width: TILE_WIDTH },
  tile: { width: TILE_WIDTH, aspectRatio: 4 / 5 },
  caption: { gap: space["2xs"], marginTop: space.sm, width: TILE_WIDTH },
});
