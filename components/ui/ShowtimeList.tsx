import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { radius, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { budapestMonthKey, formatMonthHeading, formatShortDate, formatTime, formatWeekday } from "@/utils/datetime";
import { strings } from "@/i18n/hu";
import type { Performance, Play } from "@/data/types";

/**
 * Every upcoming date for one production, grouped by month.
 *
 * This is the screen's answer to "when can I actually see this", and until now
 * nothing answered it. `getUpcomingPerformances()` had existed in
 * services/playsService.ts since the performances table was added and had zero
 * call sites — 148 future showtimes sat in the database, each with the stage it
 * plays on, while play detail showed a single "next performance" line and
 * nothing else.
 *
 * Grouped by month rather than listed flat because a production in repertory
 * runs across a season: an unbroken list of twenty dates is a wall, and the
 * month headings are what let someone find the weekend they were thinking of.
 */
export function ShowtimeList({ performances, play }: { performances: Performance[]; play: Play }) {
  const [expanded, setExpanded] = useState(false);

  const months = useMemo(() => groupByMonth(performances), [performances]);

  if (performances.length === 0) {
    return (
      <View style={{ gap: space.sm }}>
        <Text variant="subheading">{strings.playDetail.showtimes}</Text>
        <Text variant="bodySmall" tone="faint">
          {emptyReason(play)}
        </Text>
      </View>
    );
  }

  // Six is roughly a month of a repertory run, and enough to see a pattern of
  // weekends without the list pushing the cast section off the screen.
  const COLLAPSED_LIMIT = 6;
  const total = performances.length;
  const shown = expanded ? months : groupByMonth(performances.slice(0, COLLAPSED_LIMIT));
  const canExpand = total > COLLAPSED_LIMIT;

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.rowBetween}>
        <Text variant="subheading">{strings.playDetail.showtimes}</Text>
        <Text variant="label" tone="accent">
          {strings.playDetail.showtimesCount(total)}
        </Text>
      </View>

      <View style={{ gap: space.lg }}>
        {shown.map((month) => (
          <View key={month.key} style={{ gap: space.sm }}>
            {/* The heading is dropped when every date is in one month: it
                would just repeat what each row already says. */}
            {months.length > 1 && (
              <Text variant="caption" tone="faint">
                {month.heading}
              </Text>
            )}
            {month.items.map((p) => (
              <ShowtimeRow key={p.id} performance={p} />
            ))}
          </View>
        ))}
      </View>

      {canExpand && (
        <Pressable onPress={() => setExpanded((s) => !s)} hitSlop={8} accessibilityRole="button">
          <Text variant="label" tone="accent">
            {expanded ? strings.playDetail.showtimesSeeLess : strings.playDetail.showtimesSeeAll(total)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ShowtimeRow({ performance }: { performance: Performance }) {
  return (
    <View style={styles.row}>
      <View style={styles.dateBlock}>
        <Text variant="label">{formatShortDate(performance.startsAt)}</Text>
        <Text variant="caption" tone="faint">
          {formatWeekday(performance.startsAt)}
        </Text>
      </View>
      <Text variant="body" tone="accent">
        {formatTime(performance.startsAt)}
      </Text>
      {/* The stage, where the source names one. Which room a Katona production
          plays in — the main house, the Kamra, the Sufni — changes the evening
          enough to be worth a line, and the sync job has always collected it. */}
      {!!performance.room && (
        <Text variant="caption" tone="dim" numberOfLines={1} style={{ flexShrink: 1 }}>
          {performance.room}
        </Text>
      )}
    </View>
  );
}

/**
 * Why there is nothing to list.
 *
 * A blank space reads as a bug. These four sentences are the honest readings of
 * the four states a dateless production can be in, and they matter here because
 * 55 of the 157 productions currently in the repertoire have no published dates
 * at all — that is the theatre not having announced its next season yet, not
 * the app failing to find something.
 */
function emptyReason(play: Play): string {
  switch (play.status) {
    case "running":
    case "dormant":
      return strings.playDetail.noShowtimesRunning;
    case "announced":
      return strings.playDetail.noShowtimesAnnounced;
    case "ended":
      return strings.playDetail.noShowtimesEnded;
    default:
      return strings.playDetail.noShowtimesUnknown;
  }
}

type MonthGroup = { key: string; heading: string; items: Performance[] };

function groupByMonth(performances: Performance[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const p of performances) {
    const key = budapestMonthKey(p.startsAt);
    let group = groups.get(key);
    if (!group) {
      group = { key, heading: formatMonthHeading(p.startsAt), items: [] };
      groups.set(key, group);
    }
    group.items.push(p);
  }
  // The query already returns these in ascending order; sorting the keys keeps
  // that true regardless of what a future caller hands in.
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  // Fixed width so the times line up in a column down the list rather than
  // starting at a different x for every date.
  dateBlock: { width: 76, gap: 2 },
});
