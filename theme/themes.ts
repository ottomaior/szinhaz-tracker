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

/**
 * The house style: a plum-black stage, claret surfaces, and a champagne gold.
 *
 * Re-cut in September 2026 from the original burgundy. The old ground
 * (#120505) and its surfaces (#251210, #331d1a) were all the same red-brown at
 * three brightnesses, so a card on the page read as a slightly lighter patch
 * of the same wall and the gold sat on it as brass. Here the ground is taken a
 * step darker and towards plum, the surfaces are the claret of the curtain
 * itself, and the gold is lifted a little so it reads as lit rather than
 * tarnished. Same identity, more depth between the layers.
 */
const velvetDark: Palette = {
  bg: "#0f0709", // oklch(12% 0.025 5)
  bgElevated: "#170b0f",
  surface: "#1c0d13", // oklch(16% 0.035 355)
  surface2: "#2a1520", // oklch(21% 0.045 350)

  hairline: "rgba(246,238,232,0.11)",
  hairlineSoft: "rgba(246,238,232,0.06)",
  edgeHighlight: "rgba(246,238,232,0.06)",

  // Contrast measured against bg / surface / surface2, as the note above the
  // type explains.
  text: "#f6efe6", // 17.45 / 16.49 / 15.01
  textDim: "#c2afa8", // 9.47 / 8.95 / 8.15
  /**
   * This colour carries metadata at the app's smallest sizes *inside cards*,
   * which is exactly where the two surface grounds are, so it is the token
   * that decides whether the theme passes. 6.36 / 6.01 / 5.47.
   */
  textFaint: "#9f8e8a",

  gold: "#e4bf72", // oklch(82% 0.11 85) — 11.37 / 10.74 / 9.78
  goldDeep: "#a97c2e", // recessive fill, never text
  onAccent: "#140709", // 11.27:1 on gold

  goldTintBg: "rgba(228,191,114,0.14)",
  goldTintBorder: "rgba(228,191,114,0.42)",
  neutralTintBg: "rgba(246,239,230,0.08)",

  shadow: "rgba(0,0,0,0.5)",
  goldGlow: "rgba(228,191,114,0.38)",
};

/**
 * The same playbill, printed rather than lit: warm cream stock and ink.
 *
 * The light default since September 2026, and the accent is the interesting
 * problem. #e4bf72 is about 1.8:1 on cream — fine as a fill, unusable as text,
 * and the accent *is* text here (it is what says "you can still go and see
 * this"). The previous answer was the same hue taken down to an ochre ink,
 * which cleared AA but read as mustard. The accent token names a role, not a
 * hue — the lavender theme makes the same argument for violet — so here the
 * role is carried by the claret of the dark theme's curtain: what is lit gold
 * on the stage is printed in red on the programme.
 */
const playbillLight: Palette = {
  bg: "#faf5ec", // oklch(97% 0.014 85)
  bgElevated: "#f5eddf",
  surface: "#f1e8d7", // oklch(93% 0.022 85)
  surface2: "#e6dac4", // oklch(88% 0.030 84)

  // Ink at low alpha, not white: a pale hairline is invisible on paper. Set a
  // little higher than the dark themes' 0.10, because a dark line at 10% on
  // cream reads weaker than a white one at 10% on near-black.
  hairline: "rgba(31,23,20,0.14)",
  hairlineSoft: "rgba(31,23,20,0.08)",
  /**
   * No top highlight. `elevation.raised` draws a lit top edge, which is a
   * dark-stage metaphor: on cream a pale line is invisible and a dark one
   * reads as a shadow cast upwards, which is worse than nothing.
   */
  edgeHighlight: "transparent",

  text: "#1f1714", // 16.24 / 14.50 / 12.76
  textDim: "#574a42", // 7.85 / 7.01 / 6.17
  textFaint: "#6b5d54", // 5.83 / 5.20 / 4.58

  gold: "#7a2433", // oklch(36% 0.13 15) — 9.09 / 8.11 / 7.14
  /**
   * Lighter than `gold` here, and that is not a mistake. Its two consumers —
   * the histogram's off-peak bars and the lists Switch track — use it as a
   * *recessive* accent fill, and on a light ground recessive means lighter.
   * The name describes the role, not the value.
   */
  goldDeep: "#b7727d",
  onAccent: "#fff8f0", // 9.37:1 on the accent

  goldTintBg: "rgba(122,36,51,0.10)",
  goldTintBorder: "rgba(122,36,51,0.36)",
  neutralTintBg: "rgba(31,23,20,0.06)",

  // Warm rather than neutral, and much softer: a 45% black shadow that reads
  // as depth on near-black reads as dirt on cream.
  shadow: "rgba(70,30,30,0.16)",
  goldGlow: "rgba(122,36,51,0.26)",
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
 * Both defaults are the house style now: Bársony lit, or Színlap printed.
 * Levendula was the light default until September 2026, which meant a phone
 * in light mode opened a lilac app under a landing page that had just sold it
 * velvet and gold. The two playbill themes are one brand at two times of day;
 * the lavender one stays in the picker as a taste.
 */
export const DEFAULT_DARK: ThemeId = "velvetDark";
export const DEFAULT_LIGHT: ThemeId = "playbillLight";

/** Order in the picker: the two defaults first, then the alternatives. */
export const THEME_ORDER: ThemeId[] = [
  "velvetDark",
  "playbillLight",
  "lavenderLight",
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
