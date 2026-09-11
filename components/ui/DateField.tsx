import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { gutter, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { dayKeyOffset, formatLongDate, todayInBudapest } from "@/utils/datetime";
import {
  monthGrid,
  monthHeading,
  parseDayKey,
  shiftMonth as shiftMonthBy,
  toDayKey,
  WEEKDAY_LABELS,
} from "@/utils/calendar";
import { makeStyles } from "@/theme/styles";

/**
 * "When were you there?" — a chip carrying its date, which opens a month grid.
 *
 * Built rather than installed. `@react-native-community/datetimepicker` is
 * native-only in practice and the web export is what actually ships, so it
 * would have meant two different controls; and a bare text field asking for a
 * date in some format is the kind of input people get wrong and then abandon.
 *
 * Shaped after SelectChip deliberately — same chip, same sheet, same grabber —
 * because this sits in a row beside filters and check-in controls, and a second
 * idiom for "tap to choose" would read as a different kind of thing.
 *
 * Future dates are never offered. This records an evening somebody attended,
 * and a diary that can hold next month is a diary you cannot trust the totals
 * of.
 *
 * "No date" is a value too, not the absence of one. Onboarding writes entries
 * without a date, and the form used to open one of those with today's date
 * already in the chip — so saving a rating quietly turned "I don't remember"
 * into "tonight" (T-044). The chip now shows "Dátum nélkül" for such an entry,
 * and the sheet offers it beside Ma and Tegnap, so a date can be taken away as
 * well as given (T-061).
 */

export function DateField({
  value,
  onChange,
  label = strings.checkin.dateLabel,
}: {
  /** `YYYY-MM-DD` in Budapest, or undefined for an entry with no date. */
  value: string | undefined;
  onChange: (dayKey: string | undefined) => void;
  label?: string;
}) {
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const today = todayInBudapest();
  const yesterday = dayKeyOffset(-1);

  // The month on screen, which starts at the chosen date's month and then
  // follows the arrows independently of the selection.
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseDayKey(value ?? today);
    return { year, month };
  });

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const todayParts = parseDayKey(today);
  const atCurrentMonth = cursor.year === todayParts.year && cursor.month === todayParts.month;

  function shiftMonth(by: number) {
    setCursor((c) => shiftMonthBy(c.year, c.month, by));
  }

  function choose(dayKey: string | undefined) {
    onChange(dayKey);
    setOpen(false);
  }

  // "ma" and "tegnap" cover most check-ins on their own: the app is opened on
  // the tram home, or the next morning.
  const chipLabel =
    value === undefined
      ? strings.checkin.noDate
      : value === today
        ? strings.checkin.today
        : value === yesterday
          ? strings.checkin.yesterday
          : formatLongDate(`${value}T12:00:00Z`);

  return (
    <>
      <Pressable
        onPress={() => {
          const { year, month } = parseDayKey(value ?? today);
          setCursor({ year, month });
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chipLabel}`}
        aria-expanded={open}
        accessibilityState={{ expanded: open }}
        style={styles.chip}
      >
        <CalendarIcon size={13} color={colors.gold} />
        <Text
          numberOfLines={1}
          style={{ fontFamily: bodyFont(fontsLoaded, "medium"), fontSize: 12.5, color: colors.text }}
        >
          {chipLabel}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        {/* Same construction as SelectChip's sheet, and for the same reason:
            on react-native-web a Modal's child inherits no definite height, so
            `flex: 1` collapses the sheet into the corner with no backdrop. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={strings.common.close}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => {}}>
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Text variant="subheading">{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={17} color={colors.textDim} />
              </Pressable>
            </View>

            <View style={styles.quickRow}>
              <QuickPick label={strings.checkin.today} active={value === today} onPress={() => choose(today)} />
              <QuickPick label={strings.checkin.yesterday} active={value === yesterday} onPress={() => choose(yesterday)} />
              <QuickPick label={strings.checkin.noDate} active={value === undefined} onPress={() => choose(undefined)} />
            </View>

            <View style={styles.monthBar}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.checkin.previousMonth}>
                <ChevronLeftIcon size={16} color={colors.textDim} />
              </Pressable>
              <Text variant="label">{monthHeading(cursor.year, cursor.month)}</Text>
              {/* Hidden rather than disabled at the current month: there is
                  nothing forward of today to reach, and a control that is
                  present but inert invites the tap anyway. */}
              {atCurrentMonth ? (
                <View style={{ width: 16 }} />
              ) : (
                <Pressable onPress={() => shiftMonth(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.checkin.nextMonth}>
                  <ChevronRightIcon size={16} color={colors.textDim} />
                </Pressable>
              )}
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((d, i) => (
                <View key={i} style={styles.cell}>
                  <Text variant="caption" tone="faint">{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`blank-${i}`} style={styles.cell} />;
                const dayKey = toDayKey(cursor.year, cursor.month, day);
                const isFuture = dayKey > today;
                const isSelected = dayKey === value;
                return (
                  <Pressable
                    key={dayKey}
                    disabled={isFuture}
                    onPress={() => choose(dayKey)}
                    accessibilityRole="button"
                    aria-pressed={isSelected}
                    accessibilityState={{ selected: isSelected, disabled: isFuture }}
                    accessibilityLabel={formatLongDate(`${dayKey}T12:00:00Z`)}
                    style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected]}
                  >
                    <Text
                      variant="bodySmall"
                      tone={isSelected ? "inverse" : isFuture ? "faint" : "default"}
                      style={isFuture ? { opacity: 0.4 } : undefined}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function QuickPick({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-pressed={active}
      accessibilityState={{ selected: active }}
      style={[styles.quick, active ? styles.quickActive : styles.quickIdle]}
    >
      <Text
        style={{
          fontFamily: bodyFont(fontsLoaded, active ? "bold" : "medium"),
          fontSize: 12.5,
          color: active ? colors.onAccent : colors.textDim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignSelf: "flex-start",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    ...elevation.floating,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    marginBottom: space.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: space.sm,
    marginBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },

  quickRow: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  quick: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill },
  quickActive: { backgroundColor: colors.gold },
  quickIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },

  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },

  weekdayRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // Seven to a row, sized by fraction rather than by a fixed width so the grid
  // fits a 320px phone and a wide web window alike.
  cell: {
    width: `${100 / 7}%`,
    height: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: { borderRadius: radius.pill },
  dayCellSelected: { backgroundColor: colors.gold },
}));
