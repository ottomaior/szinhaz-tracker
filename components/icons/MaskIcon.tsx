import { View, Pressable } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { colors } from "@/theme/colors";
import {
  MASK_BODY_PATH,
  MASK_EYES,
  MASK_MOUTH_PATH,
  MASK_STROKE_WIDTH,
  MASK_VIEWBOX,
} from "@/components/icons/maskGeometry";

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
    <Svg width={size} height={size} viewBox={`0 0 ${MASK_VIEWBOX} ${MASK_VIEWBOX}`}>
      <Path d={MASK_BODY_PATH} fill={fill} stroke={stroke} strokeWidth={MASK_STROKE_WIDTH} />
      {MASK_EYES.map((eye) => (
        <Ellipse key={eye.cx} cx={eye.cx} cy={eye.cy} rx={eye.rx} ry={eye.ry} fill={punchColor} />
      ))}
      <Path
        d={MASK_MOUTH_PATH}
        stroke={punchColor}
        strokeWidth={MASK_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
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
    <View
      style={{ flexDirection: "row", gap }}
      accessibilityRole={onPressMask ? "radiogroup" : "image"}
      accessibilityLabel={onPressMask ? undefined : `${filled}/5`}
    >
      {Array.from({ length: 5 }).map((_, i) =>
        onPressMask ? (
          <Pressable
            key={i}
            onPress={() => onPressMask(i + 1)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={`${i + 1}/5`}
            accessibilityState={{ checked: filled === i + 1 }}
          >
            <MaskIcon state={i < filled ? "on" : "off"} size={size} />
          </Pressable>
        ) : (
          <MaskIcon key={i} state={i < filled ? "on" : "off"} size={size} />
        )
      )}
    </View>
  );
}
