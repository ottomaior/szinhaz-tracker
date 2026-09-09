import { View, Pressable } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { useColors } from "@/theme/styles";
import { strings } from "@/i18n/hu";
import { fillPaint, paint, strokePaint } from "@/components/icons/svgPaint";
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
  color,
  offColor,
}: {
  size?: number;
  /** "on" = filled/active, "off" = empty/inactive */
  state?: "on" | "off";
  color?: string;
  offColor?: string;
}) {
  // Resolved from the palette here rather than as default parameters, because
  // this component has to re-render when the theme changes and only a hook can
  // make that happen. The plain icons in Icons.tsx can stay on defaults; they
  // are always drawn inside something that already subscribes.
  const palette = useColors();
  const on = color ?? palette.gold;
  const off = offColor ?? palette.hairline;

  const stroke = state === "on" ? on : off;
  const fill = state === "on" ? on : "none";
  // Eyes/mouth are cut out of the fill, so on "on" they use the surface
  // color the icon sits on; simplest robust choice is transparent via the
  // background showing through isn't possible in SVG fill, so we punch
  // holes using the bg color passed as `offColor`'s complement — in
  // practice we just draw them in the base app background tone.
  const punchColor = state === "on" ? palette.onAccent : off;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MASK_VIEWBOX} ${MASK_VIEWBOX}`}>
      <Path d={MASK_BODY_PATH} {...paint(fill, stroke)} strokeWidth={MASK_STROKE_WIDTH} />
      {MASK_EYES.map((eye) => (
        <Ellipse key={eye.cx} cx={eye.cx} cy={eye.cy} rx={eye.rx} ry={eye.ry} {...fillPaint(punchColor)} />
      ))}
      <Path
        d={MASK_MOUTH_PATH}
        {...strokePaint(punchColor)}
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
  /**
   * `undefined` is "not answered", and draws as five empty masks with nothing
   * selected. That is also how a 0 would draw, so it is only unambiguous
   * because nothing in the app stores a 0: `rating_overall` and the three
   * dimensions under it are constrained to 0.5-5 (0001). Sighted readers get
   * the distinction from whatever the caller puts beside the row — see
   * `SubRatingRow` in app/checkin.tsx — and screen readers from the label
   * below.
   */
  rating: number | undefined;
  size?: number;
  gap?: number;
  /**
   * Optional: called when a mask is tapped, for editable ratings. Passes 1-5,
   * or `undefined` when the tap was on the mask that is already the whole
   * rating — which is the only way back out of a rating once it is given.
   */
  onPressMask?: (value: number | undefined) => void;
}) {
  const filled = rating === undefined ? 0 : Math.round(rating);
  return (
    <View
      style={{ flexDirection: "row", gap }}
      accessibilityRole={onPressMask ? "radiogroup" : "image"}
      accessibilityLabel={
        onPressMask ? undefined : rating === undefined ? strings.common.notRated : `${filled}/5`
      }
    >
      {Array.from({ length: 5 }).map((_, i) =>
        onPressMask ? (
          <Pressable
            key={i}
            // Compared against `rating` and not against `filled`, so that
            // tapping the fifth mask on a stored 4.5 rounds it up to a 5
            // rather than clearing it. Only a tap on the exact whole number
            // already given is read as "I did not mean to answer this".
            onPress={() => onPressMask(rating === i + 1 ? undefined : i + 1)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={`${i + 1}/5`}
            accessibilityHint={rating === i + 1 ? strings.common.clearRating : undefined}
            aria-checked={filled === i + 1}
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
