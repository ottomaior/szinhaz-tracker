import { Children, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { space } from "@/theme/tokens";
import { useResponsive } from "@/hooks/useBreakpoint";

/**
 * A responsive tile grid.
 *
 * Column count comes from the viewport; the gutter is a percentage-safe one
 * rather than flex `gap`.
 *
 * The layout this replaced hardcoded `width: "47.5%"`, which on a desktop
 * browser gave two tiles roughly 580 points wide — a browsing thumbnail
 * rendered larger than the play detail hero. The fix for that measured the
 * grid's own width with `onLayout` and divided it, holding the tiles back until
 * the first layout pass so they would not flash at full width and reflow.
 *
 * That traded a flash for something worse: **a grid that renders nothing at all
 * if the layout event never arrives**, which is exactly what the onboarding
 * grid did inside a modal — a 335pt-wide container with zero children and no
 * skeleton, no empty state and no error, because as far as the component was
 * concerned it had not been measured yet.
 *
 * So there is no measurement any more. Percentages and `gap` fight each other —
 * four tiles at 25% plus three gaps overflow the row — so the gutter is applied
 * as padding *inside* each tile's wrapper, with a negative margin on the
 * container to pull the outer edges back flush. That is exact at any width,
 * needs nothing measured, and cannot fail to draw.
 */
export function Grid({
  children,
  gap = space.lg,
  columns,
  style,
}: {
  children: ReactNode;
  gap?: number;
  /** Override the responsive default, e.g. a denser grid on a profile. */
  columns?: { compact: number; medium?: number; expanded?: number; wide?: number };
  style?: StyleProp<ViewStyle>;
}) {
  const cols = useResponsive(columns ?? { compact: 2, medium: 3, expanded: 4, wide: 5 });
  const half = gap / 2;

  return (
    <View
      style={[
        { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -half },
        style,
      ]}
    >
      {Children.map(children, (child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: half, paddingBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
}
