import { useEffect, useId, useState } from "react";
import { View, StyleSheet, DimensionValue, Text as RNText } from "react-native";
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
}) {
  const styles = useStyles();

  const [failedUri, setFailedUri] = useState<string>();

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
  }, [uri]);

  if (uri && failedUri !== uri) {
    return (
      <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          // Fades from the blurhash rather than snapping in.
          transition={220}
          placeholder={poster?.blurhash ? { blurhash: poster.blurhash } : undefined}
          placeholderContentFit={contentFit}
          cachePolicy="memory-disk"
          priority={priority}
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
        <View style={styles.monogramWrap} pointerEvents="none">
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
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
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
