import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { avatar, hairlineWidth, radius, space } from "@/theme/tokens";
import { Avatar } from "@/components/ui/Avatar";
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
 * The top of a profile: a face, a name, a line under it, and whatever the
 * page offers to do about the person — a follow button, an unblock.
 *
 * The person page and the public profile drew this twice, with the avatar
 * at 64 on one and 72 on the other and the name in two different roles.
 * One header, `avatar.hero` and the title role, so a performer's page and
 * a reader's page are the same kind of page.
 */
export function ProfileHeader({
  name,
  meta,
  bio,
  avatarUri,
  initials,
  serif = false,
  children,
}: {
  name: string;
  meta?: string;
  /** A paragraph under the row, where one runs to three lines. */
  bio?: string;
  avatarUri?: string;
  initials: string;
  serif?: boolean;
  /** The page's own controls: a follow button and its hint. */
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.profile}>
      <View style={styles.profileRow}>
        <Avatar uri={avatarUri} initials={initials} size={avatar.hero} serif={serif} />
        <View style={{ flex: 1, gap: space["2xs"] }}>
          <Text variant="title" numberOfLines={2}>
            {name}
          </Text>
          {!!meta && (
            <Text variant="bodySmall" tone="faint">
              {meta}
            </Text>
          )}
        </View>
      </View>
      {/* Under the row rather than beside the name: a bio runs to three
          lines often enough that squeezing it next to a 72pt avatar would
          set it two words wide. */}
      {!!bio && (
        <Text variant="bodySmall" tone="dim">
          {bio}
        </Text>
      )}
      {children}
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

  profile: { gap: space.lg },
  profileRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  // Hairlines between the figures, not a surface around them: a row of
  // counts is a fact about the page, not an object on it.
  stats: { flexDirection: "row", paddingVertical: space.md },
  stat: { flex: 1, alignItems: "center", gap: space["2xs"] },
  statDivided: { borderLeftWidth: hairlineWidth, borderLeftColor: colors.hairlineSoft },
  statLabel: { textAlign: "center" },

  meter: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meterLabel: { width: space["5xl"] + space.xl },
  track: { flex: 1, height: space.xs, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.gold },
  meterValue: { width: space["3xl"], textAlign: "right" },
}));
