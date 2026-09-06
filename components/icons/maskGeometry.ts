/**
 * The mask glyph's geometry, in one place.
 *
 * `MaskIcon` draws it as SVG for the app; the share card draws the same paths
 * onto a canvas. This is the one genuinely distinctive mark the product has —
 * most logging apps rate in stars — so the version that leaves the app must be
 * the version inside it. Two copies of these numbers would drift the moment
 * either was touched, and the drift would only ever be visible on somebody
 * else's screenshot.
 *
 * Coordinates are in the 24×24 box both renderers scale from.
 */
export const MASK_VIEWBOX = 24;

/** The outline: forehead, cheeks, chin. */
export const MASK_BODY_PATH =
  "M4 10c0-4.4 3.6-7 8-7s8 2.6 8 7c0 3-1.6 4.6-1.6 7.4 0 2.5-2.9 3.6-6.4 3.6s-6.4-1.1-6.4-3.6C5.6 14.6 4 13 4 10z";

/** The mouth, drawn as a stroke rather than a fill. */
export const MASK_MOUTH_PATH = "M9 15.3c1 1 5 1 6 0";

export const MASK_EYES = [
  { cx: 9, cy: 10, rx: 1.2, ry: 1.5 },
  { cx: 15, cy: 10, rx: 1.2, ry: 1.5 },
] as const;

export const MASK_STROKE_WIDTH = 1.5;
