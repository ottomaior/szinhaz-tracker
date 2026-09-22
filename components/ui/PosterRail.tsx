import { ScrollView, StyleSheet } from "react-native";
import { AnimatedList } from "@/components/motion/Reveal";
import { PosterTile } from "@/components/ui/PosterTile";
import { Text } from "@/components/ui/Text";
import type { ProgramEntry } from "@/data/types";
import { gutter, space, thumb } from "@/theme/tokens";
import { formatTime } from "@/utils/datetime";

/**
 * One evening across every theatre in scope, as a row of posters.
 *
 * The lead on Discover answers "what is on next" with one production; this
 * answers the question a theatregoer with a free evening actually has — what
 * *else* is on that night — and answers it with faces rather than a list.
 * Each tile is a `PosterTile` at the rail width, arriving one after another.
 */
export function PosterRail({ entries, onOpen }: { entries: ProgramEntry[]; onOpen: (playId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <AnimatedList axis="x" stagger={50} initialDelay={80} style={styles.rail}>
        {entries.map((entry) => (
          <PosterTile
            key={entry.performanceId}
            poster={entry.poster}
            title={entry.title}
            seed={entry.playId}
            width={thumb.tile.width}
            titleLines={1}
            onPress={() => onOpen(entry.playId)}
            meta={
              <Text variant="caption" tone="faint" numberOfLines={1}>
                <Text variant="caption" tone="accent">{formatTime(entry.startsAt)}</Text>
                {" · "}
                {entry.venueName}
              </Text>
            }
          />
        ))}
      </AnimatedList>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", gap: space.md, paddingHorizontal: gutter, paddingVertical: space.xs },
});
