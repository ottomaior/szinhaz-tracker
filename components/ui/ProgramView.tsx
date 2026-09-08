import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { gutter, space } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgramRow, ProgramRowSkeleton } from "@/components/ui/ProgramRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getProgramDays, getProgramForDay, type ProgramFilters } from "@/services/playsService";
import type { ProgramDay, ProgramEntry } from "@/data/types";
import { formatDayLabel, formatLongDate, formatWeekday, todayInBudapest } from "@/utils/datetime";
import { strings } from "@/i18n/hu";

/**
 * The catalogue read from the calendar end: pick an evening, see what is on.
 *
 * Every other view in the app starts from a production and asks when it plays.
 * This is the inverse, and it is how someone actually decides to go out — the
 * date is fixed first and the production is the thing being chosen. The data
 * for it has been collected since the performances table existed; nothing had
 * ever been able to query it this way round.
 *
 * Days with nothing scheduled are never offered. A theatre's week has dark
 * nights in it, and a date picker that lets you land on one is a picker full
 * of dead ends.
 *
 * `header` rides inside this view's own scroll content rather than above it,
 * so Discover can hand over its filter row and have it scroll away with the
 * days instead of adding to the pinned bar. In the states that have nothing
 * to scroll — loading, failed, no days at all — it simply sits on top.
 */
export function ProgramView({ filters, header }: { filters: ProgramFilters; header?: ReactNode }) {
  const router = useRouter();
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>();
  const [entries, setEntries] = useState<ProgramEntry[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [failed, setFailed] = useState(false);

  const { city, venueId, venueType, genre } = filters;

  const loadDays = useCallback(async () => {
    setFailed(false);
    setLoadingDays(true);
    try {
      const next = await getProgramDays(60, { city, venueId, venueType, genre });
      setDays(next);
      // Keep the chosen evening across a filter change when it survives it,
      // rather than snapping back to today and losing the reader's place.
      setSelectedDay((current) =>
        current && next.some((d) => d.day === current) ? current : next[0]?.day
      );
    } catch {
      setFailed(true);
      setDays([]);
      setSelectedDay(undefined);
    } finally {
      setLoadingDays(false);
    }
  }, [city, venueId, venueType, genre]);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    if (!selectedDay) {
      setEntries([]);
      return;
    }
    let active = true;
    setLoadingEntries(true);
    getProgramForDay(selectedDay, { city, venueId, venueType, genre })
      .then((next) => {
        if (active) setEntries(next);
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setLoadingEntries(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDay, city, venueId, venueType, genre]);

  const today = todayInBudapest();

  // One theatre per heading. A mixed list sorted purely by time makes the
  // reader re-read the venue on every row to work out where they would be
  // going; grouped, the venue is said once and the times read as a column.
  const byVenue = useMemo(() => {
    const groups = new Map<string, { venueId: string; venueName: string; venueCity: string; items: ProgramEntry[] }>();
    for (const e of entries) {
      let group = groups.get(e.venueId);
      if (!group) {
        group = { venueId: e.venueId, venueName: e.venueName, venueCity: e.venueCity, items: [] };
        groups.set(e.venueId, group);
      }
      group.items.push(e);
    }
    return [...groups.values()].sort((a, b) => a.venueName.localeCompare(b.venueName, "hu"));
  }, [entries]);

  if (loadingDays) {
    return (
      <>
        {header}
        <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <ProgramRowSkeleton key={i} />
          ))}
        </View>
      </>
    );
  }

  if (failed) {
    return (
      <>
        {header}
        <EmptyState title={strings.common.loadError} actionLabel={strings.common.retry} onAction={loadDays} />
      </>
    );
  }

  if (days.length === 0) {
    return (
      <>
        {header}
        <EmptyState eyebrow={strings.program.modeProgram} title={strings.program.emptyTitle} body={strings.program.emptyBody} />
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: space.xl }}>
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((d) => (
          <Chip
            key={d.day}
            label={formatDayLabel(d.day, today)}
            active={selectedDay === d.day}
            onPress={() => setSelectedDay(d.day)}
          />
        ))}
      </ScrollView>

      {!!selectedDay && (
        <SectionHeader
          style={{ paddingHorizontal: gutter }}
          eyebrow={
            selectedDay === today
              ? strings.discover.heroTonight
              : formatWeekday(`${selectedDay}T12:00:00Z`)
          }
          title={formatLongDate(`${selectedDay}T12:00:00Z`)}
          action={strings.program.performanceCount(entries.length)}
        />
      )}

      {loadingEntries ? (
        <View style={{ paddingHorizontal: gutter }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ProgramRowSkeleton key={i} />
          ))}
        </View>
      ) : (
        byVenue.map((group) => (
          <View key={group.venueId} style={{ paddingHorizontal: gutter }}>
            <View style={styles.venueHeading}>
              <Text variant="subheading">{group.venueName}</Text>
              <Text variant="caption" tone="faint">
                {group.venueCity}
              </Text>
            </View>
            {group.items.map((e) => (
              <ProgramRow key={e.performanceId} entry={e} lead="time" onPress={() => router.push(`/play/${e.playId}`)} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dayRow: { gap: space.sm, paddingHorizontal: gutter },
  venueHeading: { flexDirection: "row", alignItems: "baseline", gap: space.sm, paddingBottom: space.xs },
});
