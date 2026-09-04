import { useEffect, useId, useState } from "react";
import { View, StyleSheet, DimensionValue } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Line } from "react-native-svg";
import { colors } from "@/theme/colors";
import type { Poster } from "@/data/types";

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
  width = "100%",
  height = 160,
  radius = 8,
  scrim = false,
  preferThumb = false,
  contentFit = "cover",
  priority,
}: {
  poster?: Poster;
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

  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={spotId} cx="50%" cy="28%" r="75%">
            <Stop offset="0%" stopColor="#4a2416" stopOpacity={1} />
            <Stop offset="62%" stopColor="#2b120c" stopOpacity={1} />
            <Stop offset="100%" stopColor="#150907" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${spotId})`} />
        {Array.from({ length: 14 }).map((_, i) => (
          <Line
            key={i}
            x1={`${(i / 13) * 100}%`}
            y1={0}
            x2={`${(i / 13) * 100}%`}
            y2="100%"
            stroke="#000"
            strokeOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </Svg>
      {scrim && <Scrim id={scrimId} />}
    </View>
  );
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

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
});
