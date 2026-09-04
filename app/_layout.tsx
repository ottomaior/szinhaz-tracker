import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFontsSettled } from "@/hooks/useAppFonts";
import { colors } from "@/theme/colors";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Hard ceiling on how long the splash screen may stay up. Font loading can
 * hang indefinitely on a flaky connection without ever resolving or
 * rejecting, and every screen already renders correctly with the system
 * fallback faces — so a stuck download must never be able to hold the app
 * hostage behind the splash.
 */
const SPLASH_TIMEOUT_MS = 4000;

export default function RootLayout() {
  const fontsSettled = useAppFontsSettled();

  useEffect(() => {
    if (fontsSettled) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsSettled]);

  useEffect(() => {
    const handle = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, []);

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
          <Stack.Screen name="user/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="people" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="checkin" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="add-play" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="sign-up" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
