import { View, StyleSheet, DimensionValue } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect, Line } from "react-native-svg";
import { colors } from "@/theme/colors";

/**
 * Stand-in for a production photo/poster: a warm spotlight-on-velvet
 * gradient with faint curtain-fold lines, matching the placeholder used
 * throughout the design canvas. Swap for a real <Image> once the play's
 * photo/poster URL is available from the data layer.
 */
export function PosterPlaceholder({
  width = "100%",
  height = 160,
  radius = 8,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="spot" cx="50%" cy="28%" r="75%">
            <Stop offset="0%" stopColor="#4a2416" stopOpacity={1} />
            <Stop offset="62%" stopColor="#2b120c" stopOpacity={1} />
            <Stop offset="100%" stopColor="#150907" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#spot)" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
});
