import { View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/ui/TabBar";
import { TopBar } from "@/components/ui/TopBar";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { strings } from "@/i18n/hu";

/**
 * The four sections, with a phone's navigation or a desktop's.
 *
 * Below the `expanded` breakpoint the bottom tab bar with its raised "+"; from
 * it, a top bar the width of the content and no bar underneath. Same routes,
 * same screens — only where the reader reaches for them changes.
 */
export default function TabsLayout() {
  const wide = useAtLeast("expanded");

  return (
    <View style={{ flex: 1 }}>
      {wide && <TopBar />}
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => (wide ? null : <TabBar {...props} />)}>
        <Tabs.Screen name="index" options={{ title: strings.tabs.feed }} />
        <Tabs.Screen name="discover" options={{ title: strings.tabs.discover }} />
        <Tabs.Screen name="watchlist" options={{ title: strings.tabs.watchlist }} />
        <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
      </Tabs>
    </View>
  );
}
