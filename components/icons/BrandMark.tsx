import Svg, { Path } from "react-native-svg";
import { useColors } from "@/theme/styles";
import { fillPaint } from "@/components/icons/svgPaint";
import { BRAND_PATHS, BRAND_VIEWBOX } from "@/components/icons/brandGeometry";

/**
 * The app's own mark: a curtain parting on a star.
 *
 * This is the logo, not a rating glyph — `MaskIcon` is what goes where a star
 * would normally go. The two are deliberately different shapes, so that a row
 * of masks under a heading never reads as five logos.
 *
 * Gold by default, because that is what it is on the launcher icon and on the
 * splash, and a mark should not change colour when it moves from the home
 * screen into the app.
 */
export function BrandMark({ size = 24, color }: { size?: number; color?: string }) {
  // Read from the palette through the hook rather than as a default parameter:
  // this has to re-render when the theme changes, and only a hook makes that
  // happen. Same reasoning as MaskIcon.
  const palette = useColors();
  const gold = color ?? palette.gold;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BRAND_VIEWBOX} ${BRAND_VIEWBOX}`}>
      {BRAND_PATHS.map((d) => (
        <Path key={d} d={d} {...fillPaint(gold)} />
      ))}
    </Svg>
  );
}
