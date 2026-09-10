import { Pressable, StyleSheet, View } from "react-native";
import { radius, space } from "@/theme/tokens";
import { PosterPlaceholder } from "@/components/ui/PosterPlaceholder";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import type { ProgramEntry } from "@/data/types";
import { budapestDayKey, formatRuntimeMinutes, formatTime, todayInBudapest } from "@/utils/datetime";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * One performance as a line in a programme.
 *
 * This replaces two shapes that answered the same question differently: the
 * 16:5 banner rows on Discover, which turned six evenings into a screen of
 * letterboxed photographs, and the boxed cards in Műsor. A programme is a
 * list — the reader scans down a column of dates or times and reads across —
 * so the row is built like one: a fixed lead column, a small still, the title,
 * and one line of facts.
 *
 * `lead` is what the column carries. On Discover the rows span several days,
 * so the lead is the day of the month with its weekday, today in gold; in the
 * calendar every row is already on one chosen day, so the lead is the curtain
 * time instead and the day would be noise.
 */
export function ProgramRow({
  entry,
  lead = "date",
  onPress,
}: {
  entry: ProgramEntry;
  lead?: "date" | "time";
  onPress: () => void;
}) {
  const styles = useStyles();

  const isToday = budapestDayKey(entry.startsAt) === todayInBudapest();
  const kind = programKind(entry);
  const meta =
    lead === "date"
      ? [entry.venueName, kind]
      : [entry.room, entry.runtimeMinutes != null ? formatRuntimeMinutes(entry.runtimeMinutes) : undefined, kind];

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={entry.title}>
      {lead === "date" ? (
        <View style={styles.lead}>
          <Text variant="numeral" tone={isToday ? "accent" : "default"}>
            {budapestDatePart(entry.startsAt, "day")}
          </Text>
          <Text variant="eyebrow" tone={isToday ? "accent" : "faint"} style={styles.weekday}>
            {isToday ? strings.discover.upcomingToday : budapestDatePart(entry.startsAt, "weekday")}
          </Text>
        </View>
      ) : (
        <View style={[styles.lead, styles.leadTime]}>
          <Text variant="numeral">{formatTime(entry.startsAt)}</Text>
        </View>
      )}

      <PosterPlaceholder
        poster={entry.poster}
        title={entry.title}
        seed={entry.playId}
        width={48}
        height={64}
        radius={radius.sm}
        preferThumb
      />

      <View style={styles.body}>
        <Text variant="subheading" numberOfLines={2}>
          {entry.title}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {lead === "date" && (
            <Text variant="caption" tone="accent">
              {formatTime(entry.startsAt)}
              {" · "}
            </Text>
          )}
          {meta.filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * What kind of evening this is, in one or two words.
 *
 * The house's own line under the title where there is one — `vígjáték`,
 * `opera két felvonásban`, `énekkari próba`, `a Vígszínház előadása` — and
 * the genre bucket otherwise. The line wins because it is what the theatre
 * prints on its own calendar rows and it is strictly more specific: `Próza` is
 * a filter category, and it is what let two public choir rehearsals read as
 * two performances of a play (T-002, T-031). Not a rule about which lines are
 * interesting enough to show: a heuristic over Hungarian phrasing would stop
 * being right without telling anyone (T-008). Provenance lines are printed as
 * they are — "whose show is this" is the right answer to give on a row.
 *
 * The first letter is raised because the line sits in a run of labels that
 * are all capitalised — `Musical`, `Próza`, `4 óra` — and a lower-case
 * `vígjáték` between them reads as a slip rather than as the house's
 * typography. The production page prints the line as the house sets it.
 */
export function programKind(entry: ProgramEntry): string | undefined {
  if (entry.subtitle) return entry.subtitle.charAt(0).toLocaleUpperCase("hu-HU") + entry.subtitle.slice(1);
  return entry.genreNormalized ? strings.genres[entry.genreNormalized] ?? entry.genreNormalized : undefined;
}

/** A row-shaped placeholder, so a programme holds its height while it loads. */
export function ProgramRowSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={[styles.lead, { gap: 6 }]}>
        <Skeleton width={26} height={22} />
        <Skeleton width={22} height={9} />
      </View>
      <Skeleton width={48} height={64} />
      <View style={[styles.body, { gap: 8 }]}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={10} width="50%" />
      </View>
    </View>
  );
}

/**
 * A part of a performance's date, as Budapest sees it.
 *
 * Built with an explicit time zone rather than from the device's: a 19:00
 * curtain is 17:00 UTC, and a reader in another zone would otherwise be shown
 * the wrong day for a show they are booking in Hungary.
 */
function budapestDatePart(iso: string, part: "day" | "weekday"): string {
  const date = new Date(iso);
  if (part === "day") {
    return new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", day: "numeric" }).format(date).replace(/\.$/, "");
  }
  // Three letters rather than Intl's "short" form, which for Hungarian is a
  // single letter for most days — a lone "P" under a number reads as a typo,
  // not as péntek. Keyed on the English short name, which is stable.
  const key = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Budapest", weekday: "short" }).format(date);
  return WEEKDAY_SHORT[key] ?? "";
}

const WEEKDAY_SHORT: Record<string, string> = {
  Mon: "Hét",
  Tue: "Ked",
  Wed: "Sze",
  Thu: "Csü",
  Fri: "Pén",
  Sat: "Szo",
  Sun: "Vas",
};

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  // Fixed width so the dates form a column rather than stepping in and out
  // with the width of each number.
  lead: { width: 44, alignItems: "center", justifyContent: "center" },
  leadTime: { width: 58, alignItems: "flex-start" },
  weekday: { marginTop: -2 },
  body: { flex: 1, gap: 3 },
}));
