import { useEffect, useId, useRef, useState } from "react";
import { View, StyleSheet, DimensionValue, Platform, Text as RNText } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Line } from "react-native-svg";
import { displayFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import type { Poster } from "@/data/types";
import { makeStyles } from "@/theme/styles";

/**
 * A production's cover art, or a warm spotlight-on-velvet stand-in when there
 * isn't one — the same placeholder the design canvas used.
 *
 * Three things this handles that a bare <Image> did not:
 *
 *  - It renders the small stored rendition in grids and list rows
 *    (`preferThumb`). The full-size files are around 200 KB each, so a
 *    forty-item rail used to pull roughly 8 MB; the thumbnails are ~13 KB.
 *  - It shows the blurhash while the real file decodes, so a scrolling list
 *    fades images in instead of popping grey boxes.
 *  - It uses expo-image, which caches to memory and disk. The plain RN Image
 *    re-fetched the same poster on every remount.
 *
 * `scrim` draws a bottom-up dark gradient over the image so caption text laid
 * on top of it stays readable no matter how bright the photo is.
 */
/**
 * The shape a hero frame should take for a given poster.
 *
 * The catalogue is close to half landscape production stills and half
 * portrait artwork, and forcing either into the other's frame loses the part
 * worth looking at. A hero follows its own picture instead, within limits:
 * the clamp keeps a panorama from becoming a letterbox slit and a tall
 * poster from pushing everything else off the screen. Whatever the clamp
 * still cuts is handled by `backdrop`, which shows the frame whole over a
 * blurred copy of itself rather than cropping it.
 */
/**
 * How long a tile that is on screen may show nothing before it is treated as
 * stuck rather than slow (T-119). Posters are mirrored into our own bucket
 * and measured at well under 250ms on production, so this is generous by an
 * order of magnitude — it should only ever catch a genuine failure.
 */
const STUCK_AFTER_MS = 6000;

/** How often the watchdog looks, while a tile it is watching is still empty. */
const WATCH_TICK_MS = 1500;

export const HERO_MIN_ASPECT = 4 / 5;
export const HERO_MAX_ASPECT = 4 / 3;

export function posterAspect(poster: Poster | undefined, fallback: number): number {
  if (!poster?.width || !poster?.height) return fallback;
  return Math.min(HERO_MAX_ASPECT, Math.max(HERO_MIN_ASPECT, poster.width / poster.height));
}

export function PosterPlaceholder({
  poster,
  title,
  seed,
  width = "100%",
  height = 160,
  radius = 8,
  scrim = false,
  preferThumb = false,
  contentFit = "cover",
  priority,
  portraitFrame = false,
  backdrop = false,
}: {
  poster?: Poster;
  /** The production's title. Its first letter becomes the stand-in's monogram. */
  title?: string;
  /** Anything stable per production — the id — used to pick a colourway. */
  seed?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  scrim?: boolean;
  /** Use the small rendition — for grids, rails and list rows. */
  preferThumb?: boolean;
  /** "cover" fills and crops; "contain" shows the whole frame. */
  contentFit?: "cover" | "contain";
  priority?: "low" | "normal" | "high";
  /**
   * Set by callers whose frame is taller than wide — the Discover tiles, the
   * onboarding grid. A landscape image cropped to such a frame keeps the
   * middle of a banner whose title runs edge to edge, so Vígszínház's key
   * visuals read "RDÁSKIRÁLY" and "MÉLET" (T-060). With this set, a wide
   * image is shown whole, letterboxed over a blurred copy of itself.
   */
  portraitFrame?: boolean;
  /**
   * With `contentFit="contain"`, fill the frame's bare edges with a blurred
   * copy of the image rather than the surface colour — the letterbox
   * `portraitFrame` draws, offered on its own. The play hero on a wide
   * screen uses it: the whole still is shown, and the band it sits in still
   * reads as the picture rather than as a picture with margins.
   */
  backdrop?: boolean;
}) {
  const styles = useStyles();

  const [failedUri, setFailedUri] = useState<string>();

  // The watchdog's two pieces of state (T-119). `settled` is whether the
  // image has arrived; `attempt` is bumped to remount it when it has not.
  const [settled, setSettled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wrapRef = useRef<View>(null);
  // On a phone every mounted tile loads, so it is on screen as far as this
  // is concerned; on the web the browser defers until the tile is near the
  // viewport, and a watchdog that ignored that would pull all 134 posters a
  // Discover page mounts rather than the six a phone can show.
  const [onScreen, setOnScreen] = useState(Platform.OS !== "web");

  // Gradient ids live in the document's global id namespace on web, so every
  // instance needs its own — otherwise all of them resolve `url(#spot)` to
  // whichever placeholder mounted first, and unmounting that one leaves the
  // rest painting an unresolved fill.
  const gradientId = useId().replace(/:/g, "");
  const spotId = `spot-${gradientId}`;
  const scrimId = `scrim-${gradientId}`;

  const uri = poster && (preferThumb ? (poster.thumbUrl ?? poster.url) : poster.url);

  // A failure is remembered per-uri: this component gets reused with a
  // different play as lists re-render, and a stale `failed` flag would hide a
  // perfectly good image.
  useEffect(() => {
    setFailedUri((current) => (current === uri ? current : undefined));
    setSettled(false);
    setAttempt(0);
  }, [uri]);

  /**
   * The rescue, and the reason it counts the clock itself (T-119).
   *
   * `loading="lazy"` — which expo-image puts on every image on the web — is
   * implemented with the browser's intersection machinery, and the evidence
   * says that machinery is what fails: a tile in plain view whose request
   * never starts, and therefore never errors, so the blurhash stays put. An
   * `IntersectionObserver` would be the tidy way to notice, except it is the
   * very thing under suspicion — measured here, one did not fire at all on a
   * 550px-tall image sitting in the viewport. So this asks the layout
   * directly instead, on a slow tick, and only for tiles that have not
   * arrived yet.
   *
   * Seeing the tile on screen does two things: it drops `loading` to
   * `eager`, which is what actually starts a request the browser overlooked,
   * and it starts the clock. Covers come from our own bucket and answer in
   * well under 250ms, so a tile still empty after `STUCK_AFTER_MS` is stuck
   * rather than slow: remount once to try again, and if that is no better
   * show the monogram, which at least names the production.
   */
  useEffect(() => {
    if (!uri || settled || failedUri === uri) return;

    // A phone loads what it mounts, so there is nothing to wait to become
    // visible and nothing to make eager — just the clock.
    if (Platform.OS !== "web") {
      const timer = setTimeout(
        () => (attempt === 0 ? setAttempt(1) : setFailedUri(uri)),
        attempt === 0 ? STUCK_AFTER_MS : STUCK_AFTER_MS * 2
      );
      return () => clearTimeout(timer);
    }

    let waited = 0;
    const limit = attempt === 0 ? STUCK_AFTER_MS : STUCK_AFTER_MS * 2;
    const tick = setInterval(() => {
      const node = wrapRef.current as unknown as HTMLElement | null;
      const rect = node?.getBoundingClientRect?.();
      // No box yet, or off screen: the browser is right to be waiting, and
      // an empty tile nobody can see is not a fault.
      if (!rect || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      setOnScreen(true);
      waited += WATCH_TICK_MS;
      if (waited < limit) return;
      clearInterval(tick);
      if (attempt === 0) setAttempt(1);
      else setFailedUri(uri);
    }, WATCH_TICK_MS);
    return () => clearInterval(tick);
  }, [uri, settled, failedUri, attempt]);

  // Wider than 5:4 is a banner, not a poster; anything nearer square still
  // crops acceptably.
  const isLandscape = !!poster?.width && !!poster?.height && poster.width / poster.height > 1.25;
  const letterbox = (portraitFrame && isLandscape && contentFit === "cover") || (backdrop && contentFit === "contain");
  const fit = letterbox ? "contain" : contentFit;

  if (uri && failedUri !== uri) {
    return (
      <View ref={wrapRef} style={[styles.wrap, { width, height, borderRadius: radius }]}>
        {letterbox && (
          <Image
            key={`backdrop-${attempt}`}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={18}
            cachePolicy="memory-disk"
            loading={onScreen ? "eager" : "lazy"}
            accessible={false}
          />
        )}
        <Image
          // Remounts the view when the watchdog gives up waiting, which is
          // what starts the request over. Named, because the letterbox
          // backdrop above is a sibling and would otherwise share the key.
          key={`main-${attempt}`}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          // Fades from the blurhash rather than snapping in.
          transition={220}
          placeholder={poster?.blurhash ? { blurhash: poster.blurhash } : undefined}
          placeholderContentFit={fit}
          cachePolicy="memory-disk"
          // expo-image defers every image on the web by default. Once this
          // tile is known to be on screen there is nothing left to defer,
          // and saying so is what rescues a tile the browser overlooked.
          loading={onScreen ? "eager" : "lazy"}
          priority={priority}
          onLoad={() => setSettled(true)}
          onError={() => setFailedUri(uri)}
        />
        {scrim && <Scrim id={scrimId} />}
      </View>
    );
  }

  const way = colourway(seed ?? title ?? "");
  const monogram = initial(title);

  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={spotId} cx="50%" cy="26%" r="82%">
            <Stop offset="0%" stopColor={way.light} stopOpacity={1} />
            <Stop offset="58%" stopColor={way.mid} stopOpacity={1} />
            <Stop offset="100%" stopColor={way.dark} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${spotId})`} />
        {/* The curtain folds, kept but softened: at the old weight they were
            the loudest thing in a grid of otherwise photographic posters. */}
        {Array.from({ length: 14 }).map((_, i) => (
          <Line
            key={i}
            x1={`${(i / 13) * 100}%`}
            y1={0}
            x2={`${(i / 13) * 100}%`}
            y2="100%"
            stroke="#000"
            strokeOpacity={0.07}
            strokeWidth={2}
          />
        ))}
      </Svg>
      {/* The title's first letter, set in the display face. A wall of
          identical brown rectangles told you nothing and read as broken
          loading; a monogram makes each stand-in belong to its production and
          gives the eye something to distinguish rows by. */}
      {!!monogram && (
        <View style={[styles.monogramWrap, { pointerEvents: "none" }]}>
          <MonogramText size={monogramSize(height)}>{monogram}</MonogramText>
        </View>
      )}
      {scrim && <Scrim id={scrimId} />}
    </View>
  );
}

/** Rendered separately so the font hook is not called on the image path. */
function MonogramText({ children, size }: { children: string; size: number }) {
  const fontsLoaded = useAppFonts();
  return (
    <RNText
      allowFontScaling={false}
      numberOfLines={1}
      style={{
        fontFamily: displayFont(fontsLoaded),
        fontSize: size,
        lineHeight: Math.round(size * 1.18),
        // Deliberately off the palette: the colourway underneath is always
        // dark artwork (see COLORWAYS below), so this has to stay light-side
        // gold even on a theme where `colors.gold` is a dark bronze.
        color: "#dbb155",
        opacity: 0.26,
      }}
    >
      {children}
    </RNText>
  );
}

/**
 * Scales the monogram to the tile so the same component reads correctly in a
 * 64px profile-grid thumbnail and a 460px detail hero. A percentage height
 * ("100%" in those grids) carries no number to scale from, so it falls back to
 * a size that suits the small end, which is where percentages are used.
 */
function monogramSize(height: DimensionValue): number {
  if (typeof height === "number") return Math.max(18, Math.min(96, Math.round(height * 0.34)));
  return 30;
}

/**
 * The first letter of the title, skipping the decorative punctuation Hungarian
 * titles open with — „Izzik a galagonya" should show I, not the quote mark.
 */
function initial(title?: string): string {
  if (!title) return "";
  const cleaned = title.replace(/^[^\p{L}\p{N}]+/u, "");
  return cleaned.slice(0, 1).toLocaleUpperCase("hu");
}

/**
 * Six colourways drawn from the Velvet Curtain palette, chosen by a hash of
 * the production id so a given play always gets the same one — a grid of
 * stand-ins then reads as a set of playbills rather than one repeated tile.
 */
const COLOURWAYS = [
  { light: "#5a2a19", mid: "#2f130c", dark: "#150907" }, // ember
  { light: "#4a1f2c", mid: "#2a1019", dark: "#130709" }, // burgundy
  { light: "#5c3a17", mid: "#311e0b", dark: "#160c05" }, // amber
  { light: "#3a2140", mid: "#221327", dark: "#100a13" }, // aubergine
  { light: "#1f3a3a", mid: "#122122", dark: "#080f10" }, // verdigris
  { light: "#4d3520", mid: "#2a1c11", dark: "#130d08" }, // bronze
] as const;

function colourway(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLOURWAYS[hash % COLOURWAYS.length];
}

/** Bottom-up dark gradient that keeps overlaid caption text legible. */
function Scrim({ id }: { id: string }) {
  return (
    <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#090403" stopOpacity={0.92} />
          <Stop offset="45%" stopColor="#090403" stopOpacity={0.55} />
          <Stop offset="100%" stopColor="#090403" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  monogramWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
}));
