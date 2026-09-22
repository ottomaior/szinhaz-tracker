import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { hairlineWidth, radius, space } from "@/theme/tokens";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { makeStyles } from "@/theme/styles";

/**
 * "Are you sure?" — a title, a line, two buttons, on a surface.
 *
 * The profile's sign-out, the entry's delete and the user page's block each
 * drew this themselves. A surface is earned here: the card is one object the
 * reader answers as a whole, and it sits inside a page that is otherwise
 * flat, which is what makes the question visible.
 */
export function ConfirmCard({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  notice,
  style,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** An error from the last attempt, rendered by the caller as a Notice. */
  notice?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]}>
      <Text variant="subheading">{title}</Text>
      {!!body && (
        <Text variant="bodySmall" tone="dim">
          {body}
        </Text>
      )}
      {notice}
      <View style={styles.actions}>
        <Button label={cancelLabel} variant="outline" style={styles.action} onPress={onCancel} disabled={busy} />
        <Button label={confirmLabel} style={styles.action} onPress={onConfirm} loading={busy} />
      </View>
    </View>
  );
}

/**
 * A row of figures with a word under each: plays seen, this season,
 * followers, following.
 *
 * Four screens had their own (the profile's card, the public profile, the
 * person page, the season page). One shape: the figure as a `numeral`, the
 * label as a caption, equal columns, a hairline between them when asked.
 */
export function StatsRow({
  items,
  divided = false,
  style,
}: {
  items: { value: ReactNode; label: string; onPress?: () => void }[];
  divided?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.stats, style]}>
      {items.map((item, i) => (
        <View key={item.label} style={[styles.stat, divided && i > 0 && styles.statDivided]}>
          {typeof item.value === "number" || typeof item.value === "string" ? (
            <Text variant="numeral">{String(item.value)}</Text>
          ) : (
            item.value
          )}
          <Text variant="caption" tone="faint" style={styles.statLabel}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A quantity as a bar: a rating out of five, a genre's share of a season,
 * an answer's share of a questionnaire.
 *
 * Three local track-and-fill implementations existed (the play page's rating
 * bars, the season page's genre bars, the stats page's option bars) with
 * three heights and two radii. One track, one fill, gold.
 */
export function MeterBar({
  fraction,
  label,
  value,
  style,
}: {
  /** 0–1. */
  fraction: number;
  label?: string;
  /** The figure printed at the end: "4.5", "12". */
  value?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={[styles.meter, style]}>
      {!!label && (
        <Text variant="caption" tone="dim" style={styles.meterLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      {value !== undefined && (
        <Text variant="label" style={styles.meterValue}>
          {value}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  card: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: space.lg,
    ...elevation.raised,
  },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },

  stats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: space["2xs"] },
  statDivided: { borderLeftWidth: hairlineWidth, borderLeftColor: colors.hairlineSoft },
  statLabel: { textAlign: "center" },

  meter: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meterLabel: { width: space["5xl"] + space.xl },
  track: { flex: 1, height: space.xs, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.gold },
  meterValue: { width: space["3xl"], textAlign: "right" },
}));
