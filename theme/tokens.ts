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
import { Platform } from "react-native";

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
 */
export const elevation = {
  none: {},
  raised: {
    borderTopWidth: hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  floating: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
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
