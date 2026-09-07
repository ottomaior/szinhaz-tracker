import { useEffect } from "react";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFontsSettled } from "@/hooks/useAppFonts";
import { useColors } from "@/theme/styles";
import { themeScheme } from "@/theme/themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { strings } from "@/i18n/hu";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

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
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </AuthProvider>
  );
}

/**
 * The app itself, one level below ThemeProvider.
 *
 * Split out for the ordinary React reason: the status bar, the background
 * behind a screen transition and the splash-screen handoff all need to know
 * which theme is on, and a component cannot read a context it renders.
 */
function AppShell() {
  const fontsSettled = useAppFontsSettled();
  // `hydrated` is false until the stored theme has been read back. Waiting for
  // it keeps the app behind the splash for one AsyncStorage round trip, which
  // is cheaper than showing a reader the default palette and then swapping it
  // out from under them a frame later.
  const { hydrated, resolved } = useTheme();
  const colors = useColors();
  const ready = fontsSettled && hydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    const handle = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, []);

  return (
    <SafeAreaProvider>
      {/* app/+html.tsx already titles the served document, which is what a
          crawler and the loading tab see. This is for after hydration:
          expo-router mounts react-helmet, which inserts its own empty
          <title> and wins on document.title unless something claims it. */}
      <Head>
        <title>{strings.appName}</title>
      </Head>
      {/* The OS draws the clock and battery itself, so it is the one piece of
          chrome that cannot take a colour from the palette — it takes a side.
          theme/themes.ts records which side each theme sits on. */}
      <StatusBar style={themeScheme[resolved] === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="play/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="user/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="person/[slug]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="list/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="entry/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="season/[start]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="lists" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="onboarding" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="people" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="inbox" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="edit-profile" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="settings" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="blocked" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        {/* The legal documents. Modals like the rest of the chrome, but
            they are also the app’s only routes that get linked to from
            outside it, so they must stay reachable at a plain URL with no
            session and no history behind them. */}
        <Stack.Screen name="legal/adatvedelem" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="legal/feltetelek" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="legal/impresszum" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="checkin" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="add-play" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="sign-up" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="forgot-password" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        {/* Reached from a link in an e-mail rather than from inside the app,
            so like the legal routes it has to work as a plain URL with no
            history behind it. */}
        <Stack.Screen name="reset-password" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
