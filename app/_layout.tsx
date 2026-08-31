import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFonts } from "@/hooks/useAppFonts";
import { colors } from "@/theme/colors";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="play/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="checkin" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="add-play" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="sign-up" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
