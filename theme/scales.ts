/**
 * The scales, as plain numbers.
 *
 * Split out of `theme/tokens.ts` so that a plain Node script can read them.
 * `tokens.ts` imports `react-native` for `Platform.select`, which Metro
 * resolves and `tsx` cannot parse, so the landing site's token generator
 * — `scripts/landing-tokens.ts` — could not reach the very numbers it exists
 * to stay in step with. The alternative was hand-copying them into the
 * generator, which is the thing that generator was written to prevent.
 *
 * Nothing here may import anything with a runtime dependency on React Native.
 * `tokens.ts` re-exports all of it, so every existing `from "@/theme/tokens"`
 * is unchanged.
 */

/**
 * Spacing, on a 4px grid.
 *
 * Named by size rather than by purpose, because the same gap does different
 * jobs in different places and purpose-named tokens ("cardPadding") multiply
 * until they mean nothing.
 */
export const space = {
  /** Between a title line and the meta line under it, where the leading already carries most of the air. */
  "2xs": 2,
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
/**
 * Control heights.
 *
 * Three, and every pressable in the app is one of them: `sm` for a chip, a
 * pill button and a segmented tab; `md` for a button, a field and anything a
 * finger has to land on (`minTouchTarget`, under another name); `lg` only for
 * the search field that heads a screen. A bar — the modal header, the top
 * bar's inner row — is `bar`.
 */
export const control = {
  sm: 32,
  md: 44,
  lg: 50,
} as const;
/**
 * Motion, in three durations.
 *
 * `state` is a thing changing under the finger — a chip toggling, a row
 * pressed, a hover arriving. `enter` is a thing arriving or leaving: a toast,
 * a sheet, the next step of a form. `reveal` is a screen introducing itself:
 * the fade-and-lift of a list, the words of a title, a number counting up.
 * Everything in components/motion picks one of the three; nothing chooses
 * its own number.
 */
export const duration = {
  state: 160,
  enter: 260,
  reveal: 420,
} as const;
