/**
 * The active palette, as every screen sees it.
 *
 * This module deliberately keeps the shape it has always had — one flat object
 * of colour tokens — because 38 files import it and ~140 of those references
 * sit inside module-level `StyleSheet.create` blocks that evaluate once, at
 * import. Changing the shape would have meant rewriting all of them.
 *
 * Instead the *values* change per platform:
 *
 * - On the web each token is the string "var(--vc-...)". react-native-web
 *   recognises a CSS custom property as a colour and passes it through
 *   verbatim, so the generated atomic classes are stable and a theme switch is
 *   one `data-theme` attribute write on the root element. app/+html.tsx
 *   defines what those properties resolve to; theme/themes.ts holds the
 *   palettes and explains the mechanism and its one sharp edge in full.
 *
 * - On native there are no custom properties and no picker, so this is the
 *   Velvet Curtain palette exactly as before. app.json's
 *   `userInterfaceStyle: "dark"` and the #120505 splash background are pinned
 *   to match, and should stay pinned: the asymmetry is deliberate.
 *
 * The one rule when adding a token: on the web its value must be a bare
 * `var(...)`. Anything react-native-web cannot recognise is emitted as
 * `undefined` into the stylesheet and silently dropped by the browser, which
 * is why alpha variants are their own tokens rather than mixed at the call
 * site.
 */
import { Platform } from "react-native";
import { cssVarName, themes, type Palette } from "./themes";

const varPalette = Object.fromEntries(
  Object.keys(themes.velvetDark).map((token) => [token, "var(" + cssVarName(token) + ")"])
) as Palette;

export const colors: Palette = Platform.OS === "web" ? varPalette : themes.velvetDark;

export type ColorToken = keyof Palette;
