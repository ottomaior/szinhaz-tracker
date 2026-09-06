import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_STORAGE_KEY,
  themes,
  type ThemeId,
} from "@/theme/themes";

/** A reader's choice: one of the palettes, or "whatever the device is set to". */
export type ThemePreference = ThemeId | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  /** What `system` currently resolves to. Only meaningful for labelling the picker. */
  resolved: ThemeId;
  /** False until the stored preference has been read — see the note below. */
  hydrated: boolean;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: DEFAULT_DARK,
  hydrated: false,
  setPreference: () => {},
});

function isPreference(value: string | null): value is ThemePreference {
  return value === "system" || (value != null && value in themes);
}

/**
 * Remembers which palette the reader picked.
 *
 * This provider is deliberately thin, because **the theme is not state that
 * renders anything.** The palette reaches the screen as CSS custom properties
 * (theme/themes.ts explains how), so applying a theme is one attribute write
 * on the document element — no re-render, and every `StyleSheet.create` in the
 * app keeps the class it was born with. What React owns here is only the
 * picker's checked row.
 *
 * "System" is likewise not tracked in JavaScript: app/+html.tsx expresses it
 * as two `prefers-color-scheme` media queries, which keep working when the OS
 * flips mid-session, before hydration, and even if the bundle never loads.
 * `useColorScheme` is read only so the picker can say which one system means
 * right now.
 *
 * The preference starts at "system" and fills in from storage inside an
 * effect rather than being read synchronously, for the reason
 * hooks/useRecentSearches.ts sets out: the web build is statically
 * pre-rendered, and a first render that already knew this browser's choice
 * would not match the server's markup. The visible flash that would otherwise
 * cause is handled outside React, by the inline script in app/+html.tsx, which
 * stamps the attribute before the first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);
  const scheme = useColorScheme();

  const resolved: ThemeId =
    preference === "system" ? (scheme === "light" ? DEFAULT_LIGHT : DEFAULT_DARK) : preference;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (isPreference(stored)) setPreferenceState(stored);
      })
      // An unreadable entry is not worth surfacing: the worst case is the
      // reader getting the system default and having to pick again.
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      if (Platform.OS !== "web") return;

      document.documentElement.setAttribute("data-theme", next);
      // `theme-color` tints the browser's own chrome and is read outside CSS,
      // so it is the one place a custom property will not do.
      const nextResolved =
        next === "system" ? (scheme === "light" ? DEFAULT_LIGHT : DEFAULT_DARK) : next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes[nextResolved].bg);
    },
    [scheme]
  );

  return (
    <ThemeContext.Provider value={{ preference, resolved, hydrated, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
