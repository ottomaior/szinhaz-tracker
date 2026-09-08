import { View, Pressable, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { colors } from "@/theme/colors";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { HomeIcon, CompassIcon, TicketIcon, UserIcon, PlusIcon } from "@/components/icons/Icons";
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

/**
 * Custom bottom tab bar matching the design canvas: 4 real routes plus a
 * raised center "+" action that pushes the check-in modal rather than
 * being a tab of its own.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();

  // Split routes around the midpoint so the "+" sits dead center.
  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);
  const left = routes.slice(0, mid);
  const right = routes.slice(mid);

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const isFocused = state.index === index;
    const color = isFocused ? colors.gold : colors.textFaint;
    const label = TAB_LABELS[route.name] ?? route.name;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={label}
        aria-selected={isFocused}
        accessibilityState={{ selected: isFocused }}
        style={styles.tab}
      >
        {TAB_ICONS[route.name]?.(color)}
        <Text style={{ fontFamily: bodyFont(fontsLoaded, "semibold"), fontSize: 10, letterSpacing: 0.02, color }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {left.map((r, i) => renderTab(r, i))}

      <Pressable
        style={styles.centerBtn}
        onPress={() => router.push("/checkin")}
        accessibilityRole="button"
        accessibilityLabel={strings.checkin.headerTitle}
      >
        <PlusIcon />
      </Pressable>

      {right.map((r, i) => renderTab(r, mid + i))}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  tab: {
    alignItems: "center",
    gap: 4,
    minWidth: 56,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    borderWidth: 6,
    borderColor: colors.bgElevated,
    // The glow of a lit button, as one boxShadow string — see theme/tokens.ts
    // for why not the deprecated shadow* props.
    boxShadow: `0 4px 10px ${colors.goldGlow}`,
  },
}));
