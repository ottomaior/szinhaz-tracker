import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { colors } from "@/theme/colors";
import { dock, hairlineWidth, radius, space } from "@/theme/tokens";
import { dockLabel } from "@/theme/type";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { HomeIcon, CompassIcon, TicketIcon, UserIcon, PlusIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

const TAB_ICONS: Record<string, (color: string) => React.ReactNode> = {
  index: (color) => <HomeIcon color={color} />,
  discover: (color) => <CompassIcon color={color} />,
  watchlist: (color) => <TicketIcon color={color} />,
  profile: (color) => <UserIcon color={color} />,
};

const TAB_LABELS: Record<string, string> = {
  index: strings.tabs.feed,
  discover: strings.tabs.discover,
  watchlist: strings.tabs.watchlist,
  profile: strings.tabs.profile,
};

/** The dock's height above the bottom edge, before the safe-area inset. */
const DOCK_HEIGHT = dock.height;
const DOCK_MARGIN = dock.margin;

/**
 * How much of the bottom of a screen the dock covers.
 *
 * The dock floats over the page rather than sitting under it, so every tab
 * screen pads its scroll content by this much, or the last row is hidden
 * behind the glass. Follows the safe-area inset: on a phone with a home
 * indicator or three-button navigation the dock sits higher.
 */
export function useDockInset(): number {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + Math.max(insets.bottom, DOCK_MARGIN) + space.xl;
}

/**
 * The bottom navigation as a floating dock, after reactbits' "Dock".
 *
 * Four real routes and the raised gold "+" that pushes the check-in, as
 * before — what changed is the object they sit on. The bar used to be a
 * strip welded to the bottom edge; now it floats a little above it on a
 * translucent pill, so the page is seen to continue underneath and the "+"
 * reads as the one lit thing on the screen rather than as a bump in a wall.
 *
 * Under a mouse each item grows towards the pointer, the way a dock does;
 * under a finger it springs on press. Both stay off when the reader has
 * asked for reduced motion. The active route carries a gold dot under its
 * label rather than only a colour, so it survives a colour-blind reading.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);
  const left = routes.slice(0, mid);
  const right = routes.slice(mid);

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const isFocused = state.index === index;
    const label = TAB_LABELS[route.name] ?? route.name;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    return <DockItem key={route.key} label={label} focused={isFocused} onPress={onPress} icon={TAB_ICONS[route.name]} />;
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, DOCK_MARGIN) }]} pointerEvents="box-none">
      <View style={[styles.dock, Platform.OS === "web" && WEB_BLUR]}>
        {left.map((r, i) => renderTab(r, i))}
        <PlusButton />
        {right.map((r, i) => renderTab(r, mid + i))}
      </View>
    </View>
  );
}

function DockItem({
  label,
  focused,
  onPress,
  icon,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
  icon?: (color: string) => React.ReactNode;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const scale = useAnimatedValue(1);
  const color = focused ? colors.gold : colors.textFaint;
  const spring = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: NATIVE_DRIVER, speed: 30, bounciness: 8 }).start();
  const web = Platform.OS === "web" && !reduced;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduced && spring(0.92)}
      onPressOut={() => !reduced && spring(1)}
      onPointerEnter={web ? () => spring(1.18) : undefined}
      onPointerLeave={web ? () => spring(1) : undefined}
      accessibilityRole="tab"
      accessibilityLabel={label}
      aria-selected={focused}
      accessibilityState={{ selected: focused }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {icon?.(color)}
        {/* "Kívánságlista" is the longest label and the dock item is a
            fifth of the width: on a phone with a larger system font it broke
            into two lines (T-106). One line, shrinking a little before it
            would wrap, and never growing past a modest multiplier. */}
        <Text
          variant="caption"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.15}
          style={[dockLabel, { color }]}
        >
          {label}
        </Text>
        <View style={[styles.dot, focused && styles.dotOn]} />
      </Animated.View>
    </Pressable>
  );
}

function PlusButton() {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const scale = useAnimatedValue(1);
  const lift = useAnimatedValue(0);
  const web = Platform.OS === "web" && !reduced;
  const to = (s: number, y: number) =>
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: NATIVE_DRIVER, speed: 30, bounciness: 8 }),
      Animated.spring(lift, { toValue: y, useNativeDriver: NATIVE_DRIVER, speed: 30, bounciness: 8 }),
    ]).start();

  return (
    <Pressable
      onPress={() => router.push("/checkin")}
      onPressIn={() => !reduced && to(0.94, 0)}
      onPressOut={() => !reduced && to(1, 0)}
      onPointerEnter={web ? () => to(1.08, -5) : undefined}
      onPointerLeave={web ? () => to(1, 0) : undefined}
      accessibilityRole="button"
      accessibilityLabel={strings.checkin.headerTitle}
      style={styles.centerSlot}
    >
      <Animated.View style={[styles.centerBtn, { transform: [{ scale }, { translateY: lift }] }]}>
        <PlusIcon />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The frosted glass behind the dock. `backdropFilter` is not in React
 * Native's style type — it is a web-only property react-native-web passes
 * through — so it is added as a plain object on the web alone.
 */
const WEB_BLUR = { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as unknown as object;

const useStyles = makeStyles((colors) => StyleSheet.create({
  // Transparent and absolute: the page scrolls on underneath the dock, and
  // every screen already leaves ~100pt of bottom padding for it.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  dock: {
    width: "100%",
    maxWidth: 440,
    height: DOCK_HEIGHT,
    borderRadius: dock.radius,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: dock.paddingX,
    paddingBottom: dock.paddingBottom,
    backgroundColor: colors.dockGlass,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: `0 1px 0 ${colors.edgeHighlight} inset, 0 20px 40px -20px ${colors.shadow}, 0 0 40px -18px ${colors.goldGlow}`,
  },
  tab: { width: dock.itemWidth, alignItems: "center" },
  tabInner: { alignItems: "center", gap: dock.itemGap },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: "transparent" },
  dotOn: { backgroundColor: colors.gold },
  centerSlot: { alignItems: "center", justifyContent: "flex-end", marginBottom: dock.plusLift },
  centerBtn: {
    width: dock.plusSize,
    height: dock.plusSize,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 10px 26px -8px ${colors.goldGlow}`,
  },
}));
