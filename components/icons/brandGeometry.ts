/**
 * The brand mark's geometry, in one place.
 *
 * The mark is a proscenium: a valance across the top, two wings tied back
 * under it, and a star burning in the opening between them. The curtain says
 * theatre; the star is the rating — the two things this app is for, in one
 * shape.
 *
 * Four renderers draw these numbers and none of them can see the others:
 * `BrandMark` draws them as SVG inside the app, `services/shareCardService.ts`
 * fills them onto a canvas, and `scripts/generate-icons.ts` writes both
 * `assets/logo-source.svg` and every raster the stores and the browser ask
 * for. That is exactly the situation `maskGeometry.ts` was written to avoid:
 * hand-copied path data drifts the moment one copy is touched, and the drift
 * is only ever visible somewhere you are not looking — a store listing,
 * somebody else's screenshot, a browser tab.
 *
 * Coordinates are in the 64×64 box every renderer scales from.
 *
 * Two things here are load-bearing and were arrived at by drawing the icon at
 * 22, 32 and 48 points and looking at it rather than by taste:
 *
 * - **Everything is a fill.** The first draft hung the wings from a stroked
 *   rod. A stroke has to be scaled by hand for every renderer that is not
 *   SVG, and on the web a `stroke` that fails to resolve falls back to `none`
 *   (see `svgPaint.ts`) — which would drop the rod silently and leave the
 *   wings floating. Four fills have neither problem.
 *
 * - **The opening is wide and the star is small inside it.** The wings' inner
 *   edges bow *outwards* as they fall, so the gap is at its widest exactly
 *   where the star sits: about 20 units across at y=32, against a star 16
 *   wide. Narrowing that clearance — a bigger star, straighter wings — welds
 *   all three shapes into one blob at launcher size, which is what the first
 *   draft did.
 */
export const BRAND_VIEWBOX = 64;

/**
 * The valance across the top, its lower edge sagging under its own weight.
 *
 * Two swags meeting at a point in the middle, rather than one even sag. The
 * sag is the one cue that separates this from architecture: with a straight
 * lower edge the three shapes read as a gate — two posts and a lintel — and
 * the mark stops being about theatre at all. A single shallow sag was not
 * enough to carry it; the double swag is legible down to about 32 points.
 */
export const BRAND_VALANCE_PATH = "M4 9H60V14Q46 23 32 15Q18 23 4 14Z";

/** The left wing: straight down the outside, drawn back on the inside, hem swinging free. */
export const BRAND_CURTAIN_LEFT_PATH = "M6 15H23C20 27 20 41 22 51Q14 56 6 52Z";

/** The right wing, mirrored through x=32. */
export const BRAND_CURTAIN_RIGHT_PATH = "M58 15H41C44 27 44 41 42 51Q50 56 58 52Z";

/** Five points, centred on (32, 35), outer radius 8.5, inner radius 3.5. */
export const BRAND_STAR_PATH =
  "M32 26.5l2.06 5.67 6.02.2-4.75 3.71 1.67 5.8L32 38.5l-5 3.38 1.67-5.8-4.75-3.71 6.02-.2z";

/** Every filled shape in the mark, in paint order. */
export const BRAND_PATHS = [
  BRAND_VALANCE_PATH,
  BRAND_CURTAIN_LEFT_PATH,
  BRAND_CURTAIN_RIGHT_PATH,
  BRAND_STAR_PATH,
] as const;

/**
 * How much of a square the mark should occupy, per surface.
 *
 * A launcher icon is a small square seen among other small squares, and it
 * wants to be nearly filled; an Android adaptive foreground is cropped to a
 * shape the manufacturer chooses, and everything outside the central 66% can
 * be cut away. `scripts/generate-icons.ts` is the only reader.
 */
export const BRAND_INSET = {
  /** iOS / web launcher icon: the mark on its own ground. */
  icon: 0.68,
  /** Android adaptive foreground: inside the safe circle, with room to spare. */
  adaptive: 0.46,
  /** Splash: small, because it is seen at full screen size. */
  splash: 0.34,
} as const;
