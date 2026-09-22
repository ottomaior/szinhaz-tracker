import { useEffect, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { colors } from "@/theme/colors";
import { duration, gutter, hairlineWidth, legacy, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * The bottom sheet: a scrim, a surface with rounded top corners, a grabber, a
 * title with a close cross, and whatever the caller puts under it.
 *
 * Five components drew this by hand — SelectChip, DateField, AddToListSheet,
 * ReportSheet and ShareSheet — forty lines each, and they had drifted: one
 * header sat a step lower than the others, one option row was taller, a busy
 * row dimmed to 0.5 in one sheet and 0.4 in the next. The chrome lives here
 * now and the five keep only what is theirs: the options, the calendar, the
 * reasons, the formats.
 *
 * Pinned with absoluteFill rather than `flex: 1`: on react-native-web a
 * Modal's child inherits no definite height, so `flex: 1` collapses the sheet
 * into the bottom-left corner with no backdrop behind it. All four edges
 * pinned reads the same on native and is unambiguous on web.
 *
 * Rises rather than fades: `Modal` fades the scrim, and the surface slides
 * up over `duration.enter` — unless the reader has asked for less motion, in
 * which case it is simply there.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** For the body under the header — a sheet that needs a step more or less of air above its content. */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's hardware back closes the sheet rather than leaving the
      // screen, which `onRequestClose` is what wires up.
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Tapping the dimmed area behind the sheet dismisses it. The sheet
          itself stops the press, so a tap inside never closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={strings.common.close}>
        <Rise>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text variant="subheading">{title}</Text>
              <Pressable onPress={onClose} hitSlop={space.sm} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={legacy.sheetCloseIcon} color={colors.textDim} />
              </Pressable>
            </View>
            <View style={contentStyle}>{children}</View>
          </Pressable>
        </Rise>
      </Pressable>
    </Modal>
  );
}

/** The surface arriving from below. */
function Rise({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useAnimatedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: duration.enter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress, reduced]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [space["3xl"], 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * One choice in a sheet: a row at least a touch target tall, with room for a
 * tick or a chevron at its end.
 */
export function SheetOption({
  onPress,
  selected = false,
  disabled = false,
  busy = false,
  accessibilityRole = "button",
  accessibilityLabel,
  keepBusyOpaque = false,
  style,
  children,
  trailing,
}: {
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  busy?: boolean;
  accessibilityRole?: "button" | "radio";
  accessibilityLabel?: string;
  /** A row that says "preparing…" in words does not also need to fade. */
  keepBusyOpaque?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      aria-pressed={accessibilityRole === "button" ? selected : undefined}
      aria-checked={accessibilityRole === "radio" ? selected : undefined}
      aria-busy={busy}
      accessibilityState={{ selected, disabled, busy }}
      style={[styles.option, style, busy && !keepBusyOpaque && styles.busy, disabled && !busy && styles.dimmed]}
    >
      {children}
      {trailing}
    </Pressable>
  );
}

/** The line under the options: "Új lista", "Küldés". */
export function SheetFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.footer, style]}>{children}</View>;
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
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
  /** The short bar that says a sheet can be dismissed downward. */
  grabber: {
    alignSelf: "center",
    width: space["4xl"] - space.xs,
    height: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    marginBottom: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: space.sm,
    marginBottom: space.xs,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairlineSoft,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouchTarget,
    paddingVertical: space.sm,
  },
  busy: { opacity: 0.5 },
  dimmed: { opacity: 0.4 },
  footer: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.md,
    alignItems: "center",
  },
}));
