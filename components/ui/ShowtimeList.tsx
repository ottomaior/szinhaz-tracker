import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { budapestMonthKey, formatMonthHeading, formatShortDate, formatTime, formatWeekday } from "@/utils/datetime";
import { strings } from "@/i18n/hu";
import type { Performance, Play } from "@/data/types";
import { makeStyles } from "@/theme/styles";

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
 *
 * Set as a table on hairlines rather than as a stack of cards: the dates form
 * one column, the curtain times another, and the eye runs down them the way it
 * runs down a printed programme. `action` is the way out to the box office,
 * which belongs on this section's baseline because this is where somebody has
 * just found the evening they want.
 */
export function ShowtimeList({
  performances,
  play,
  action,
  onAction,
}: {
  performances: Performance[];
  play: Play;
  action?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();

  const [expanded, setExpanded] = useState(false);

  const months = useMemo(() => groupByMonth(performances), [performances]);

  // What kind of evening each date is, on every row rather than once above
  // the list. The header already prints the house's line under the title,
  // and it was not enough: a column of five dated rows that each say only
  // `Csokonai Teátrum` still reads as five performances of a play, which is
  // what T-002 was about. Csokonai's own calendar repeats the line on every
  // row, so this is the source's convention, not a new one. Provenance lines
  // stay on the vendégjáték note above (T-025) instead of five times here.
  const kind = play.subtitle && !play.producedBy ? play.subtitle : undefined;

  if (performances.length === 0) {
    return (
      <View style={{ gap: space.sm }}>
        <SectionHeader title={strings.playDetail.showtimes} action={action} onAction={onAction} />
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
      <SectionHeader
        eyebrow={strings.playDetail.showtimesCount(total)}
        title={strings.playDetail.showtimes}
        action={action}
        onAction={onAction}
      />

      <View>
        {shown.map((month) => (
          <View key={month.key}>
            {/* The heading is dropped when every date is in one month: it
                would just repeat what each row already says. */}
            {months.length > 1 && (
              <Text variant="eyebrow" tone="faint" style={styles.monthHeading}>
                {month.heading}
              </Text>
            )}
            {month.items.map((p) => (
              <ShowtimeRow key={p.id} performance={p} kind={kind} />
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

function ShowtimeRow({ performance, kind }: { performance: Performance; kind?: string }) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <View style={styles.dateBlock}>
        <Text variant="label">{formatShortDate(performance.startsAt)}</Text>
        <Text variant="caption" tone="faint">
          {formatWeekday(performance.startsAt)}
        </Text>
      </View>
      <Text variant="numeral" style={styles.time}>
        {formatTime(performance.startsAt)}
      </Text>
      {/* The stage, where the source names one. Which room a Katona production
          plays in — the main house, the Kamra, the Sufni — changes the evening
          enough to be worth a line, and the sync job has always collected it. */}
      {/* Stacked rather than joined with a separator: at phone width the two
          share about 150pt, and "Csokonai Teátrum · énekkari próba" wrapped
          mid-phrase. Two short lines read as two facts. */}
      {(!!performance.room || !!kind) && (
        <View style={{ flexShrink: 1, gap: 1 }}>
          {!!performance.room && (
            <Text variant="caption" tone="dim" numberOfLines={1}>
              {performance.room}
            </Text>
          )}
          {!!kind && (
            <Text variant="caption" tone="dim" numberOfLines={2}>
              {kind}
            </Text>
          )}
        </View>
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

const useStyles = makeStyles((colors) => StyleSheet.create({
  monthHeading: { paddingTop: space.md, paddingBottom: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md - 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  // Fixed widths so the dates and the times line up in columns down the list
  // rather than starting at a different x for every row.
  dateBlock: { width: 92, gap: 1 },
  time: { width: 64 },
}));
