import { useEffect, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { colors } from "@/theme/colors";
import { duration, gutter, hairlineWidth, icon, maxWidth, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles, useColors } from "@/theme/styles";
import { disabledStyle, pressStyle } from "@/components/ui/pressable";

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
 *
 * On a wide screen it is a panel rather than a bar: a bottom sheet the width
 * of a 1280pt browser window puts four words of a list across a foot of
 * glass, and the reader's eye is nowhere near the bottom edge there. From
 * the `expanded` breakpoint it centres at `maxWidth.reading / 2` and keeps
 * its own corners.
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
  const wide = useAtLeast("expanded");
  const { height: windowHeight } = useWindowDimensions();

  /*
   * How tall the sheet may be, in pixels off the window.
   *
   * It was `maxHeight: "80%"`, which a browser resolves against the parent —
   * and the parent here is a wrapper that is itself as tall as this sheet's
   * contents, so the cap came out a fifth short of the contents every time
   * and the list underneath ran out through the bottom of the panel. A cap
   * has to be measured against the thing it is protecting the reader from,
   * which is the window.
   */
  const maxHeight = Math.round(windowHeight * (wide ? 0.8 : 0.72));

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
      <Pressable style={[styles.backdrop, wide && styles.backdropWide]} onPress={onClose} accessibilityLabel={strings.common.close}>
        <Rise distance={wide ? space.md : space["3xl"]}>
          <Pressable
            style={[
              styles.sheet,
              { maxHeight },
              wide ? styles.sheetWide : { paddingBottom: Math.max(insets.bottom, space.lg) },
            ]}
            onPress={() => {}}
          >
            {/* The bar that says "drag me down" — on a phone. A centred
                panel is not dragged anywhere, and the bar on one reads as a
                control that does nothing. */}
            {!wide && <View style={styles.grabber} />}
            <View style={styles.header}>
              <Text variant="subheading">{title}</Text>
              <Pressable onPress={onClose} hitSlop={space.sm} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={icon.chrome} color={colors.textDim} />
              </Pressable>
            </View>
            {/* The body may shrink, and that is load-bearing: the surface
                above is capped against the window, and without this the
                wrapper kept its full natural height, so a list inside it was
                clipped by the surface with no way to scroll to the rest. */}
            <View style={[styles.body, contentStyle]}>{children}</View>
          </Pressable>
        </Rise>
      </Pressable>
    </Modal>
  );
}

/**
 * The surface arriving. A bottom sheet travels a step of the screen; a
 * centred panel only lifts a little, the way a dialog does — a panel that
 * flies up from the bottom edge of a desktop window reads as a phone.
 */
function Rise({ children, distance }: { children: ReactNode; distance: number }) {
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
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
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
  const palette = useColors();
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
      style={pressStyle("row", palette, [styles.option, style, busy && !keepBusyOpaque && styles.busy, disabled && !busy && disabledStyle])}
    >
      {children}
      {trailing}
    </Pressable>
  );
}

/**
 * The body of a sheet whose contents may be longer than the sheet: it takes
 * what the header and the footer leave and scrolls inside it, rather than
 * each sheet guessing a height of its own — they had guessed 340, 360 and
 * 420. The right-hand padding is the scrollbar's lane, so a tick at the end
 * of a row is not sitting under it.
 */
export const sheetScroll = {
  style: { flexShrink: 1 } as ViewStyle,
  contentContainerStyle: { paddingBottom: space.sm, paddingRight: space.sm } as ViewStyle,
};

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
  backdropWide: { justifyContent: "center", alignItems: "center" },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    // Nothing paints outside a rounded surface: a list long enough to scroll
    // used to carry on past the corner rather than stop at it.
    overflow: "hidden",
    ...elevation.floating,
  },
  sheetWide: {
    width: maxWidth.reading / 2,
    borderRadius: radius.xl,
    paddingBottom: space.lg,
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
  body: { flexShrink: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouchTarget,
    paddingVertical: space.sm,
  },
  busy: { opacity: 0.5 },
  footer: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.md,
    alignItems: "center",
  },
}));
