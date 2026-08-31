import { View, Pressable } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { colors } from "@/theme/colors";

/**
 * The app's signature rating glyph: a theatrical mask, used everywhere a
 * star would normally go (feed cards, play detail, the check-in flow).
 */
export function MaskIcon({
  size = 20,
  state = "off",
  color = colors.gold,
  offColor = colors.hairline,
}: {
  size?: number;
  /** "on" = filled/active, "off" = empty/inactive */
  state?: "on" | "off";
  color?: string;
  offColor?: string;
}) {
  const stroke = state === "on" ? color : offColor;
  const fill = state === "on" ? color : "none";
  // Eyes/mouth are cut out of the fill, so on "on" they use the surface
  // color the icon sits on; simplest robust choice is transparent via the
  // background showing through isn't possible in SVG fill, so we punch
  // holes using the bg color passed as `offColor`'s complement — in
  // practice we just draw them in the base app background tone.
  const punchColor = state === "on" ? colors.bg : offColor;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 10c0-4.4 3.6-7 8-7s8 2.6 8 7c0 3-1.6 4.6-1.6 7.4 0 2.5-2.9 3.6-6.4 3.6s-6.4-1.1-6.4-3.6C5.6 14.6 4 13 4 10z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Ellipse cx={9} cy={10} rx={1.2} ry={1.5} fill={punchColor} />
      <Ellipse cx={15} cy={10} rx={1.2} ry={1.5} fill={punchColor} />
      <Path d="M9 15.3c1 1 5 1 6 0" stroke={punchColor} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** A row of 5 masks representing a 0-5 rating (rounded to the nearest whole mask). */
export function MaskRatingRow({
  rating,
  size = 16,
  gap = 4,
  onPressMask,
}: {
  rating: number;
  size?: number;
  gap?: number;
  /** Optional: called with (index 1-5) when a mask is tapped, for editable ratings. */
  onPressMask?: (value: number) => void;
}) {
  const filled = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", gap }}>
      {Array.from({ length: 5 }).map((_, i) =>
        onPressMask ? (
          <Pressable key={i} onPress={() => onPressMask(i + 1)} hitSlop={6}>
            <MaskIcon state={i < filled ? "on" : "off"} size={size} />
          </Pressable>
        ) : (
          <MaskIcon key={i} state={i < filled ? "on" : "off"} size={size} />
        )
      )}
    </View>
  );
}
