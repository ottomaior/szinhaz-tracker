import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/theme/colors";
import { avatar, bar, hairlineWidth, icon, space } from "@/theme/tokens";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { pressStyle } from "@/components/ui/pressable";
import { makeStyles, useColors } from "@/theme/styles";

/**
 * The text row: the second of the app's two list rows (PlayRow, with a
 * poster, is the first). A face or an icon at the left, a title and one line
 * under it, something at the right, a hairline underneath.
 *
 * Seven screens had their own — the people search, the followers, the inbox,
 * the block list, the cast, the friends who saw a production, the settings
 * links — and the seven agreed on nothing but the avatar's diameter. This is
 * the one, `bar` tall at least, so a column of them has one rhythm.
 */
export function PersonRow({
  name,
  meta,
  avatarUri,
  initials,
  serif = false,
  trailing,
  onPress,
  accessibilityLabel,
  style,
}: {
  name: string;
  /** One line under the name: credits, a date, a handle. */
  meta?: ReactNode;
  avatarUri?: string;
  initials: string;
  /** Bodoni initials, for a performer rather than a member. */
  serif?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const palette = useColors();
  const body = (
    <>
      <Avatar uri={avatarUri} initials={initials} size={avatar.row} serif={serif} />
      <View style={styles.lines}>
        <Text variant="subheading" numberOfLines={1}>
          {name}
        </Text>
        {typeof meta === "string" ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {meta}
          </Text>
        ) : (
          meta
        )}
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      style={pressStyle("row", palette, [styles.row, style])}
    >
      {body}
    </Pressable>
  );
}

/**
 * A row that leads somewhere: a label, an optional line under it, a chevron.
 * Settings, the profile's "Listák", the share sheet's formats.
 */
export function LinkRow({
  label,
  blurb,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  blurb?: string;
  leading?: ReactNode;
  /** Replaces the chevron. */
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const palette = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={pressStyle("row", palette, [styles.row, style])}
    >
      {leading}
      <View style={styles.lines}>
        <Text variant="subheading" numberOfLines={1}>
          {label}
        </Text>
        {!!blurb && (
          <Text variant="caption" tone="faint" numberOfLines={2}>
            {blurb}
          </Text>
        )}
      </View>
      {trailing ?? <ChevronRightIcon size={icon.inline} color={colors.textFaint} />}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: bar,
    paddingVertical: space.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
  },
  lines: { flex: 1, gap: space["2xs"] },
}));
