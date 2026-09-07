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
import { setActivePalette } from "@/theme/colors";
import { PaintContext, type PaintTarget } from "./PaintContext";

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
 * On the web this provider is close to inert, because there **the theme is not
 * state that renders anything.** The palette reaches the screen as CSS custom
 * properties (theme/themes.ts explains how), so applying a theme is one
 * attribute write on the document element — no re-render, and every stylesheet
 * in the app keeps the class it was born with. What React owns there is only
 * the picker's checked row.
 *
 * Native has no custom properties, so the same switch has to be made by React.
 * `PaintContext` below carries the resolved theme id; the `makeStyles` hooks in
 * theme/styles.ts subscribe to it, so the components holding stylesheets
 * re-render with the palette swapped. `setActivePalette` covers the rest — the
 * inline `colors.x` reads scattered through the screens' JSX, which are plain
 * property reads with no way to reach a hook.
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

  // `DEFAULT_DARK` until the effect below has run, for the same reason
  // `preference` starts at "system": `useColorScheme()` is read during render,
  // and it does not agree with itself across the hydration boundary. The static
  // export has no `matchMedia`, so it renders "light"; a reader whose phone is
  // in dark mode renders "dark" on the first client pass. Settings puts that
  // value on screen — as the system row's swatch, and by name in "jelenleg:
  // Bársony" — so the two passes produced different markup and React threw the
  // whole pre-rendered document away with error #418.
  //
  // This is the one screen that reads it, but the correction belongs here
  // rather than there: `resolved` is a value that is simply not knowable before
  // hydration, and the next thing to read it should not have to rediscover why.
  const resolved: ThemeId = !hydrated
    ? DEFAULT_DARK
    : preference === "system"
      ? scheme === "light"
        ? DEFAULT_LIGHT
        : DEFAULT_DARK
      : preference;

  // Before this provider's children render, not after: an inline
  // `colors.surface` in a screen is read during that same pass, and a palette
  // still pointing at the old theme would hand it the previous colour. A plain
  // assignment to module state, so repeating it on every render costs nothing.
  setActivePalette(resolved);

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

  // "css" on the web is a constant, so nothing subscribed to PaintContext ever
  // re-renders there — see contexts/PaintContext.ts.
  const paint: PaintTarget = Platform.OS === "web" ? "css" : resolved;

  return (
    <ThemeContext.Provider value={{ preference, resolved, hydrated, setPreference }}>
      <PaintContext.Provider value={paint}>{children}</PaintContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
