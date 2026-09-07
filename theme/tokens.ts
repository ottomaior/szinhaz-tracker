/**
 * Layout tokens for the "Velvet Curtain" system — the values the screens were
 * already using, given names.
 *
 * Nothing here is a new visual direction. The palette in theme/colors.ts and
 * the two brand faces are the app's identity and stay exactly as they are;
 * what was missing was consistency underneath them. Spacing, radii and type
 * sizes were retyped per screen, so font sizes drifted across some twenty
 * values (10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14 …) that no one chose —
 * they accumulated.
 */
import { Platform, type ViewStyle } from "react-native";
import { colors } from "./colors";
import type { Palette } from "./themes";

/**
 * Spacing, on a 4px grid.
 *
 * Named by size rather than by purpose, because the same gap does different
 * jobs in different places and purpose-named tokens ("cardPadding") multiply
 * until they mean nothing.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 64,
} as const;

/** The screen gutter every full-width screen shares. */
export const gutter = space.xl;

/**
 * Corner radii, scaled to the element.
 *
 * Deliberately not one radius everywhere: a 40px cast thumbnail and a
 * full-width sheet rounded identically read as the same kind of object, which
 * flattens the hierarchy. Small things get a tight radius, large surfaces a
 * generous one.
 */
export const radius = {
  sm: 6, // thumbnails, chips, small tiles
  md: 10, // cards, inputs, buttons
  lg: 14, // panels and grouped sections
  xl: 20, // sheets and modals
  pill: 999,
} as const;

/** Hairlines should read as one device pixel, not one layout point. */
export const hairlineWidth = Platform.select({ ios: 0.5, android: 0.5, default: 1 }) as number;

/**
 * Depth, built from warm light rather than grey shadow.
 *
 * On a near-black burgundy ground a neutral drop shadow is invisible, so
 * elevation here is carried by a hairline catching light along the top edge —
 * the way a lit surface reads on a dark stage — and the shadow is kept for
 * separating only the largest surfaces from the background.
 *
 * Both colours are palette tokens rather than literals, so a light theme can
 * drop the top highlight (which means nothing on cream) and soften the
 * shadow. The alpha lives inside the token and `shadowOpacity` is 1, rather
 * than the other way round: the web build discards `shadowOpacity` when the
 * colour is a custom property — see theme/themes.ts — and on iOS
 * `shadowOpacity: 1` times the colour's own alpha is the same result.
 */
export type Elevation = {
  none: ViewStyle;
  raised: ViewStyle;
  floating: ViewStyle;
};

/** The two depth recipes, for a given palette. */
export const elevationFor = (palette: Palette): Elevation => ({
  none: {},
  raised: {
    borderTopWidth: hairlineWidth,
    borderTopColor: palette.edgeHighlight,
  },
  floating: {
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

/**
 * The same, against whichever palette is active.
 *
 * Getters rather than a plain object, and that is load-bearing: an object
 * literal would read `colors.shadow` once, when this module is imported, and
 * on native that is before the reader's stored theme has been read back — the
 * exact staleness theme/colors.ts warns about. A getter defers the read to the
 * moment of use.
 *
 * Inside a `makeStyles` factory take the `elevation` argument instead. The
 * factory runs once per theme rather than once per render, so it must be
 * handed the palette it is building for rather than reaching for the live one.
 */
export const elevation: Elevation = {
  none: {},
  get raised() {
    return elevationFor(colors).raised;
  },
  get floating() {
    return elevationFor(colors).floating;
  },
};

/**
 * Veils that deliberately do not belong to the theme.
 *
 * `scrim` sits between a sheet and the app and pushes the app back, which is
 * as true on cream as it is on velvet — iOS and Material both darken behind a
 * sheet in light mode too. The `onImage*` values sit on a production
 * photograph, which has no idea what theme is on: a cream pill over a dark
 * stage still is harder to read in every theme, not easier.
 *
 * These were nine hand-mixed rgba literals scattered across the screens.
 * Collecting them here is what makes it visible that they were considered and
 * left alone on purpose, rather than missed.
 */
export const overlay = {
  /** Behind a sheet or a popover, over the app itself. */
  scrim: "rgba(9,4,3,0.6)",
  /** A chip or badge laid over a poster. */
  onImage: "rgba(9,4,3,0.78)",
  /** A translucent icon button on a full-bleed hero image. */
  onImageSoft: "rgba(10,4,3,0.55)",
  /** A veil over a poster the user is picking from. */
  onImageVeil: "rgba(18,5,5,0.55)",
  /** Credit text set directly on artwork. */
  onImageText: "rgba(245,237,228,0.62)",
  /**
   * A caption laid over a scrimmed poster — the feed card's title and byline.
   *
   * Light in every theme, and deliberately not `colors.text`. The scrim below
   * it is dark whatever the palette says, so a theme whose text is near-black
   * renders this caption as dark plum over a bright production photograph,
   * which is unreadable. That is what happened the moment a light theme became
   * the default; the two other light themes had the same latent bug and simply
   * had not been anyone's default yet.
   */
  onImageHeading: "#f8f4fb",
} as const;

/**
 * Viewport widths at which the layout changes.
 *
 * react-native-web does not support media queries inside StyleSheet.create, so
 * these are read at runtime through hooks/useBreakpoint.ts rather than
 * expressed in CSS.
 */
export const breakpoints = {
  /** Phones. */
  compact: 0,
  /** Large phones in landscape, small tablets. */
  medium: 600,
  /** Tablets and small desktop windows. */
  expanded: 900,
  /** Full desktop browsers. */
  wide: 1280,
} as const;

/**
 * How wide content is allowed to get.
 *
 * Every screen was a single full-bleed column, which on a desktop browser
 * stretched a two-up poster grid across the whole window — tiles ended up
 * nearly 600px wide and 900px tall for what is meant to be a browsing rail.
 *
 * `reading` is tighter than `content` on purpose: a synopsis set the full
 * width of a 1400px window runs far past the ~70 characters a line can carry
 * before the eye loses its place returning to the left margin.
 */
export const maxWidth = {
  reading: 680,
  content: 1100,
} as const;

/** Below this, a tap target is hard to hit reliably. */
export const minTouchTarget = 44;
