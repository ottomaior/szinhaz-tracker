import { Tabs } from "expo-router";
import { TabBar } from "@/components/ui/TabBar";
import { strings } from "@/i18n/hu";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: strings.tabs.feed }} />
      <Tabs.Screen name="discover" options={{ title: strings.tabs.discover }} />
      <Tabs.Screen name="watchlist" options={{ title: strings.tabs.watchlist }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
    </Tabs>
  );
}
