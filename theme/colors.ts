/**
 * The active palette, as every screen sees it.
 *
 * This module deliberately keeps the shape it has always had — one flat object
 * of colour tokens — because 46 files import it and most of those references
 * are written inline, in JSX, as `colors.textDim`. Changing the shape would
 * have meant rewriting all of them.
 *
 * Instead the *values* change per platform, and on both platforms a read of
 * `colors.x` resolves to the theme that is on right now:
 *
 * - On the web each token is the string "var(--vc-...)". react-native-web
 *   recognises a CSS custom property as a colour and passes it through
 *   verbatim, so the generated atomic classes are stable and a theme switch is
 *   one `data-theme` attribute write on the root element. app/+html.tsx
 *   defines what those properties resolve to; theme/themes.ts holds the
 *   palettes and explains the mechanism and its one sharp edge in full.
 *
 * - On native there are no custom properties, so this is a Proxy over whichever
 *   palette is currently active. Every property read goes to the live theme,
 *   which means an inline `colors.gold` in a component's JSX, or an icon's
 *   `color = colors.textFaint` default, is correct on the next render without
 *   any of those call sites knowing a theme exists.
 *
 * The one rule when adding a token: on the web its value must be a bare
 * `var(...)`. Anything react-native-web cannot recognise is emitted as
 * `undefined` into the stylesheet and silently dropped by the browser, which
 * is why alpha variants are their own tokens rather than mixed at the call
 * site.
 *
 * ## What the Proxy cannot fix, and how you find out
 *
 * A live read is only live if it happens per render. A value captured *once*,
 * at module scope — a `StyleSheet.create` block, a `const TONES = {...}` map —
 * freezes whatever palette happened to be active at import, which on native is
 * before the reader's stored choice has even been read back. That is the whole
 * bug this file exists to prevent, and it fails silently: the screen simply
 * keeps the old colour.
 *
 * So a module-scope read is detectable by *when* it happens. Imports run before
 * `setActivePalette` is first called, and nothing else does. In development the
 * Proxy therefore warns on any read taken before then, naming the token, which
 * turns a silent stale colour into a line in the console at boot.
 *
 * The way to hold a palette across renders is theme/styles.ts: `makeStyles`
 * takes a factory rather than an object, and calls it once per theme.
 */
import { Platform } from "react-native";
import { cssVarName, themes, DEFAULT_DARK, type Palette, type ThemeId } from "./themes";

const TOKENS = Object.keys(themes.velvetDark) as (keyof Palette)[];

const varPalette = Object.fromEntries(
  TOKENS.map((token) => [token, "var(" + cssVarName(token) + ")"])
) as Palette;

/**
 * The palette the native app is currently painted in.
 *
 * Module state rather than React state on purpose: it has to be readable from
 * the inline `colors.x` call sites, which are ordinary property reads in the
 * middle of a render and have no way to reach a hook. What makes those reads
 * *arrive* on screen is the subscription in theme/styles.ts, which re-renders
 * the components that hold styles; this variable only decides what they see.
 */
let active: Palette = themes[DEFAULT_DARK];
let applied = false;

const warned = new Set<string>();

function warnStaleRead(token: string) {
  if (warned.has(token)) return;
  warned.add(token);
  console.warn(
    "[theme] colors." +
      token +
      " was read at module scope, before a theme was applied. The value is " +
      "frozen at the default palette and will not follow the reader's choice. " +
      "Move it inside a makeStyles() factory or read it during render. " +
      "See theme/colors.ts."
  );
}

const livePalette = new Proxy({} as Palette, {
  get(_target, key) {
    if (typeof key !== "string" || !(key in active)) return undefined;
    if (__DEV__ && !applied) warnStaleRead(key);
    return active[key as keyof Palette];
  },
  // Spreads and `Object.keys(colors)` should behave as they would on a plain
  // object; theme/styles.ts leans on this to build a theme's token list.
  has: (_target, key) => typeof key === "string" && key in active,
  ownKeys: () => [...TOKENS],
  getOwnPropertyDescriptor: (_target, key) =>
    typeof key === "string" && key in active
      ? { enumerable: true, configurable: true, value: active[key as keyof Palette] }
      : undefined,
});

export const colors: Palette = Platform.OS === "web" ? varPalette : livePalette;

/**
 * Point the native palette at a theme.
 *
 * Called from ThemeContext during render, so that the reads a component makes
 * in the same pass already see the new theme. A no-op on the web, where the
 * palette is a set of custom properties and the switch is an attribute write.
 */
export function setActivePalette(id: ThemeId) {
  if (Platform.OS === "web") return;
  active = themes[id];
  applied = true;
}

export type ColorToken = keyof Palette;
