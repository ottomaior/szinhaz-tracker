import { useId, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hairlineWidth, radius, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { useTheme } from "@/contexts/ThemeContext";
import { themes } from "@/theme/themes";

/**
 * A panel that a pointer lights up from within, after reactbits'
 * "Spotlight Card".
 *
 * On the web a soft gold radial gradient follows the mouse across the
 * surface; on a phone, where there is no hover, it is the same panel at rest
 * — the surface, a hairline and the corner radius panels share. Used for the
 * showtimes on a production, which is the block the reader is deciding on.
 */
export function SpotlightCard({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const styles = useStyles();
  // A gradient stop needs a literal colour, not the web palette's `var()` —
  // see components/icons/svgPaint.ts — so this reads the resolved theme.
  const gold = themes[useTheme().resolved].gold;
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const web = Platform.OS === "web" && !reduced;

  return (
    <View
      style={[styles.card, padded && styles.padded, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })}
      // Measured against the card's box — `offsetX` is relative to whichever
      // child row the pointer is over, and would jump at every row edge.
      onPointerMove={
        web
          ? (e) => {
              const box = (e.currentTarget as unknown as HTMLElement).getBoundingClientRect();
              setSpot({ x: e.nativeEvent.clientX - box.left, y: e.nativeEvent.clientY - box.top });
            }
          : undefined
      }
      onPointerLeave={web ? () => setSpot(null) : undefined}
    >
      {web && !!spot && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`}>
            <Defs>
              <RadialGradient id={`spot-${id}`} cx={spot.x} cy={spot.y} r={Math.max(size.w, size.h) * 0.55} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={gold} stopOpacity={0.16} />
                <Stop offset="1" stopColor={gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#spot-${id})`} />
          </Svg>
        </View>
      )}
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineSoft,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...elevation.raised,
  },
  padded: { paddingHorizontal: space.lg, paddingVertical: space.md },
}));
