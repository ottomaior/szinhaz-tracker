/**
 * The palettes a reader can choose between.
 *
 * Only colour varies. Bodoni Moda, the mask rating glyph, the spacing grid and
 * the radii are the app's identity rather than a preference, and they are the
 * same in every theme — see theme/type.ts and theme/tokens.ts.
 *
 * ## How a theme actually reaches the screen
 *
 * Differently on each platform, and that is the one thing worth knowing about
 * this app's theming.
 *
 * On the web it never goes through React at all, because react-native-web
 * treats a CSS custom property as a valid colour and passes it through
 * verbatim:
 *
 *     // react-native-web/dist/modules/isWebColor/index.js
 *     color === 'currentcolor' || color === 'inherit' || color.indexOf('var(') === 0
 *
 * So on the web `colors.bg` is the *string* "var(--vc-bg)", the generated
 * atomic CSS class is stable, and switching a theme is one attribute write on
 * the root element — no re-render, no restyle pass in React at all. The values
 * below are what app/+html.tsx writes into the custom properties.
 *
 * Native has no custom properties, so there the switch is React's job:
 * theme/colors.ts resolves `colors.bg` against whichever palette is active, and
 * theme/styles.ts rebuilds each screen's stylesheet per theme and re-renders the
 * components holding one. That is the whole reason `makeStyles` exists.
 *
 * ## The constraint that shape imposes
 *
 * `isWebColor` matches only strings that *start with* `var(`. Anything else
 * falls through to `processColor`, comes back null, and is emitted as the
 * literal declaration `background-color:undefined`, which the browser drops
 * without a warning. So `rgba(var(--vc-gold-rgb), 0.15)` and `color-mix()`
 * are not available to us, and every alpha a theme needs — the badge tints,
 * the tab bar's glow, the top-edge highlight — has to be its own token with
 * the alpha already mixed in. That is why this list is 18 tokens and not 12.
 *
 * The constraint is the web's, but the shape is shared: a native palette is the
 * same 18 tokens, so a theme is written once and works on both.
 *
 * ## Contrast
 *
 * Ratios below are measured against `bg` / `surface` / `surface2`. All three
 * matter: `textFaint` carries metadata at 11.5px and most often does it
 * *inside a card*, so `surface2` — not `bg` — is the ground that decides
 * whether it passes. Every text token in every theme clears WCAG AA's 4.5:1
 * on all three.
 */
export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surface2: string;
  hairline: string;
  hairlineSoft: string;
  edgeHighlight: string;
  text: string;
  textDim: string;
  textFaint: string;
  gold: string;
  goldDeep: string;
  onAccent: string;
  goldTintBg: string;
  goldTintBorder: string;
  neutralTintBg: string;
  shadow: string;
  goldGlow: string;
};

export type ThemeId =
  | "velvetDark"
  | "lavenderLight"
  | "playbillLight"
  | "minimalLight"
  | "modernDark";

/** The original: a near-black warm burgundy stage with a lit gold accent. */
const velvetDark: Palette = {
  bg: "#120505", // oklch(14% 0.025 25)
  bgElevated: "#1d0c0a", // oklch(18% 0.03 26)
  surface: "#251210", // oklch(21% 0.032 27)
  surface2: "#331d1a", // oklch(26% 0.035 28)

  hairline: "rgba(255,255,255,0.10)",
  hairlineSoft: "rgba(255,255,255,0.06)",
  edgeHighlight: "rgba(255,255,255,0.06)",

  text: "#f5ede4", // oklch(95% 0.015 75) — 17.26 / 15.45 / 13.61
  textDim: "#b9a69e", // oklch(74% 0.025 45) — 8.59 / 7.68 / 6.77
  /**
   * Lifted twice, both times for the same reason. #80716d measured 4.29:1 on
   * `bg`; #8a7a75 fixed that but was still 4.37 on `surface` and 3.85 on
   * `surface2` — and this colour carries metadata at the app's smallest sizes
   * *inside cards*, which is exactly where those two grounds are. This is
   * 6.04 / 5.41 / 4.76 and passes on all three.
   */
  textFaint: "#9a8a84",

  gold: "#dbb155", // oklch(78% 0.12 85) — 9.94 / 8.90 / 7.84
  goldDeep: "#b28324", // oklch(64% 0.12 80) — recessive fill, never text
  onAccent: "#120505", // 9.94:1 on gold

  goldTintBg: "rgba(219,177,85,0.15)",
  goldTintBorder: "rgba(219,177,85,0.45)",
  neutralTintBg: "rgba(245,237,228,0.08)",

  shadow: "rgba(0,0,0,0.45)",
  goldGlow: "rgba(219,177,85,0.40)",
};

/**
 * The same playbill, printed rather than lit: warm cream stock and ink.
 *
 * The accent is the interesting problem. #dbb155 is about 1.9:1 on cream —
 * fine as a fill, unusable as text, and gold *is* text here (it is what says
 * "you can still go and see this"). #7d5810 is the same hue family taken down
 * until it clears AA on the darkest card ground, so it reads as the ink side
 * of the brand's gold rather than as a different colour.
 */
const playbillLight: Palette = {
  bg: "#fbf6ec", // oklch(97% 0.014 85)
  bgElevated: "#f6efe1", // oklch(95% 0.018 85)
  surface: "#f2ead9", // oklch(93% 0.022 85)
  surface2: "#e7dbc6", // oklch(89% 0.030 84)

  // Ink at low alpha, not white: a pale hairline is invisible on paper. Set a
  // little higher than the dark themes' 0.10, because a dark line at 10% on
  // cream reads weaker than a white one at 10% on near-black.
  hairline: "rgba(30,24,21,0.14)",
  hairlineSoft: "rgba(30,24,21,0.08)",
  /**
   * No top highlight. `elevation.raised` draws a lit top edge, which is a
   * dark-stage metaphor: on cream a pale line is invisible and a dark one
   * reads as a shadow cast upwards, which is worse than nothing.
   */
  edgeHighlight: "transparent",

  text: "#1e1815", // 16.29 / 14.66 / 12.82
  textDim: "#544940", // 8.11 / 7.30 / 6.38
  textFaint: "#665950", // 6.27 / 5.64 / 4.93

  gold: "#7d5810", // oklch(45% 0.09 78) — 5.95 / 5.36 / 4.69
  /**
   * Lighter than `gold` here, and that is not a mistake. Its two consumers —
   * the histogram's off-peak bars and the lists Switch track — use it as a
   * *recessive* accent fill, and on a light ground recessive means lighter.
   * The name describes the role, not the value.
   */
  goldDeep: "#c08f2e",
  onAccent: "#fffbf3", // 6.21:1 on gold

  goldTintBg: "rgba(125,88,16,0.12)",
  goldTintBorder: "rgba(125,88,16,0.38)",
  neutralTintBg: "rgba(30,24,21,0.06)",

  // Warm rather than neutral, and much softer: a 45% black shadow that reads
  // as depth on near-black reads as dirt on cream.
  shadow: "rgba(70,48,20,0.16)",
  goldGlow: "rgba(125,88,16,0.28)",
};

/**
 * Neutral and quiet: no burgundy, no paper warmth, nothing but the content.
 *
 * The accent stays gold rather than going grey with everything else.
 * StatusBadge's `running` tone is the app's one "you can still go and see
 * this" signal, and a grey badge for it loses information, not decoration.
 */
const minimalLight: Palette = {
  bg: "#ffffff",
  bgElevated: "#fafafa",
  surface: "#f4f4f5",
  surface2: "#e6e6e9",

  hairline: "rgba(0,0,0,0.12)",
  hairlineSoft: "rgba(0,0,0,0.07)",
  edgeHighlight: "transparent",

  text: "#17171a", // 17.89 / 16.28 / 14.36
  textDim: "#53535a", // 7.63 / 6.94 / 6.12
  textFaint: "#67676f", // 5.61 / 5.10 / 4.50

  gold: "#6b5715", // oklch(41% 0.075 92) — 7.00 / 6.37 / 5.62
  goldDeep: "#b39642", // recessive fill — lighter, as on playbill
  onAccent: "#ffffff", // 7.00:1 on gold

  goldTintBg: "rgba(107,87,21,0.10)",
  goldTintBorder: "rgba(107,87,21,0.35)",
  neutralTintBg: "rgba(0,0,0,0.05)",

  shadow: "rgba(0,0,0,0.12)",
  goldGlow: "rgba(107,87,21,0.22)",
};

/**
 * The dark theme for someone who does not want the burgundy: a cool charcoal
 * with the same gold, so the accent still means what it means everywhere else.
 */
const modernDark: Palette = {
  bg: "#0f1114", // oklch(17% 0.008 250)
  bgElevated: "#16191d", // oklch(21% 0.009 250)
  surface: "#1c2025", // oklch(24% 0.010 250)
  surface2: "#272c33", // oklch(29% 0.012 252)

  hairline: "rgba(255,255,255,0.10)",
  hairlineSoft: "rgba(255,255,255,0.06)",
  edgeHighlight: "rgba(255,255,255,0.07)",

  text: "#e9ecf0", // 15.96 / 13.82 / 11.86
  textDim: "#a9b1bb", // 8.73 / 7.56 / 6.49
  textFaint: "#8b939e", // 6.09 / 5.27 / 4.53

  gold: "#d8b45c", // 9.55 / 8.27 / 7.10
  goldDeep: "#8f7530",
  onAccent: "#0f1114", // 9.55:1 on gold

  goldTintBg: "rgba(216,180,92,0.14)",
  goldTintBorder: "rgba(216,180,92,0.42)",
  neutralTintBg: "rgba(233,236,240,0.07)",

  shadow: "rgba(0,0,0,0.55)",
  goldGlow: "rgba(216,180,92,0.38)",
};

/**
 * The house lights up rather than down: a pale lilac wash over white cards.
 *
 * This is the app's default on a light device, and the palette the current
 * layout was drawn against — the greeting, the date stamps over the artwork
 * and the upcoming-performances timeline all assume a light ground.
 *
 * The accent is the one thing worth explaining. Everywhere else in this file
 * `gold` is literally gold, but the token names a *role*, not a hue: it is
 * what the app uses to say "you can still go and see this". Under a lilac
 * wash an actual gold reads as a stain rather than as a signal, so here the
 * role is carried by a deep violet — the same violet the raised "+" and the
 * `running` badge draw from, so the accent still means one thing throughout.
 * `goldDeep` is *lighter* than `gold` for the reason it is on the two other
 * light themes: its consumers use it as a recessive fill, and on a light
 * ground recessive means lighter.
 */
const lavenderLight: Palette = {
  bg: "#f7f2fb", // oklch(96% 0.018 305)
  bgElevated: "#f2ebf8",
  surface: "#ffffff",
  surface2: "#ece4f4", // oklch(92% 0.026 303)

  // Plum ink at low alpha rather than white, for the reason the playbill
  // theme uses it: a pale hairline is invisible on a pale ground.
  hairline: "rgba(36,24,54,0.13)",
  hairlineSoft: "rgba(36,24,54,0.07)",
  /** No lit top edge — that is a dark-stage metaphor. See `playbillLight`. */
  edgeHighlight: "transparent",

  text: "#241436", // 15.51 / 17.10 / 13.82
  textDim: "#544064", // 8.30 / 9.15 / 7.40
  textFaint: "#6a5480", // 5.97 / 6.58 / 5.32

  gold: "#6b3fa0", // 6.70 / 7.38 / 5.97
  goldDeep: "#a98cc9", // recessive fill — lighter, as on the other light themes
  onAccent: "#ffffff", // 7.38:1 on gold

  goldTintBg: "rgba(107,63,160,0.10)",
  goldTintBorder: "rgba(107,63,160,0.34)",
  neutralTintBg: "rgba(36,20,54,0.055)",

  // Violet-biased rather than neutral black: a grey shadow under a lilac card
  // reads as dirt, the same problem the playbill theme has with cream.
  shadow: "rgba(58,30,88,0.16)",
  goldGlow: "rgba(107,63,160,0.26)",
};

export const themes: Record<ThemeId, Palette> = {
  velvetDark,
  lavenderLight,
  playbillLight,
  minimalLight,
  modernDark,
};

/** Which side of light/dark each theme sits on, for `color-scheme` and the System option. */
export const themeScheme: Record<ThemeId, "dark" | "light"> = {
  velvetDark: "dark",
  lavenderLight: "light",
  playbillLight: "light",
  minimalLight: "light",
  modernDark: "dark",
};

/**
 * What "follow the system" resolves to.
 *
 * A device set to light gets Levendula, which is the app's current design
 * direction. A device set to dark still gets Bársony: there is no lavender
 * dark twin yet, and inverting a light palette would produce neither.
 */
export const DEFAULT_DARK: ThemeId = "velvetDark";
export const DEFAULT_LIGHT: ThemeId = "lavenderLight";

/** Order in the picker: the current direction first, then the house style, then the alternatives. */
export const THEME_ORDER: ThemeId[] = [
  "lavenderLight",
  "velvetDark",
  "playbillLight",
  "minimalLight",
  "modernDark",
];

/**
 * Stored bare (not JSON) so the no-flash script in app/+html.tsx can read it
 * with one synchronous localStorage call and no parse. AsyncStorage's web
 * build writes straight to window.localStorage under this exact key.
 */
export const THEME_STORAGE_KEY = "theme.v1";

/** `bgElevated` -> `--vc-bg-elevated`. */
export const cssVarName = (token: string) =>
  "--vc-" + token.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
