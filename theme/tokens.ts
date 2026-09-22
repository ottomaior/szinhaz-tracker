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
 * shadow. The alpha lives inside the colour token.
 *
 * `boxShadow` rather than the four `shadow*` props, which React Native
 * deprecated in 0.86 and warned about on every dev session. On the web the
 * string is passed straight through to CSS, so a `var(--vc-shadow)` colour
 * resolves per theme exactly as the colour tokens do; on native the new
 * architecture parses the same string.
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
    boxShadow: `0 8px 24px ${palette.shadow}`,
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
  /**
   * The accent, on artwork. `colors.gold` is claret on the printed theme,
   * which on a scrimmed photograph is a dark red on near-black; this is the
   * lit gold in every theme, because the scrim under it is the stage in every
   * theme.
   */
  onImageAccent: "#ecd08a",
  /** A hairline on the dark card: the rule above the profile's stats. */
  onImageRule: "rgba(246,238,232,0.14)",
  /** The band of light that sweeps a pressed poster — components/motion/PressCard. */
  glare: "rgba(255,255,255,0.10)",
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

export const bar = 56;

/** An accent rule beside a notice or a quotation: thicker than a hairline, thinner than a bar. */
export const rule = 2;

/**
 * The sizes a thing appears at, named so the same object is the same size
 * on every screen.
 *
 * Before this the app used six poster-thumbnail geometries, eight avatar
 * diameters, nine mask sizes and eight chrome-icon sizes for what a reader
 * experiences as one thumbnail, one face, one glyph and one icon. Each set
 * below is the whole allowed range; a screen that needs a fourth avatar size
 * needs a reason, not a number.
 */
export const thumb = {
  /** A production in a list row. 2:3, the poster's own proportion. */
  row: { width: 56, height: 84 },
  /** A tile in a rail or a fold of covers. 4:5, so a rail is a rail and not a row turned sideways. */
  tile: { width: 124, height: 155 },
} as const;

export const avatar = {
  /** Beside a comment or in a byline's second line. */
  inline: 32,
  /** A byline, a header: the face that says whose screen this is. */
  byline: 36,
  /** A list row about a person. */
  row: 44,
  /** The face at the top of a profile. */
  hero: 72,
} as const;

/** The mask rating glyph — see components/icons/MaskIcon.tsx. */
export const mask = {
  /** In a meta line, next to a caption. */
  inline: 12,
  /** In a row's trailing slot, and the interactive sub-rows of the check-in. */
  row: 16,
  /** The check-in's overall rating: five masks you press. */
  hero: 30,
} as const;

/** Chrome icons — components/icons/Icons.tsx. */
export const icon = {
  /** Sitting in a line of text: a chevron, a pin, a heart on a counter. */
  inline: 16,
  /** A standalone tap target: the bell, the close cross, the back arrow. */
  chrome: 20,
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

/** The one spring: quick, with a little give. The dock keeps its own, livelier one. */
export const spring = { speed: 24, bounciness: 6 } as const;

/**
 * The floating dock — components/ui/TabBar.tsx — is deliberately its own
 * object, after reactbits' "Dock": a pill that does not share the control
 * heights because it is not a control but a piece of furniture the controls
 * sit on. Its numbers are named here so that they are visibly chosen.
 */
export const dock = {
  height: 66,
  margin: 14,
  radius: 26,
  paddingX: 6,
  paddingBottom: 8,
  itemWidth: 60,
  itemGap: 3,
  plusSize: 54,
  plusLift: 6,
  labelSize: 10,
  labelLineHeight: 13,
} as const;
