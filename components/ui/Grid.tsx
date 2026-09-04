import { Children, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { space } from "@/theme/tokens";
import { useResponsive } from "@/hooks/useBreakpoint";

/**
 * A responsive tile grid.
 *
 * Column count comes from the viewport, but the tile width is computed from
 * the grid's own measured width rather than from a percentage. That matters
 * because percentages and `gap` fight each other — four tiles at 25% plus
 * three gaps overflows the row — and because the grid sits inside a
 * width-capped Screen, so the window width is not what it is dividing up.
 *
 * The old layout hardcoded `width: "47.5%"`, which on a desktop browser gave
 * two tiles roughly 580 points wide: a browsing thumbnail rendered larger than
 * the play detail hero.
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
  const [width, setWidth] = useState(0);
  const cols = useResponsive(columns ?? { compact: 2, medium: 3, expanded: 4, wide: 5 });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const tileWidth = width > 0 ? (width - gap * (cols - 1)) / cols : undefined;

  return (
    <View onLayout={onLayout} style={[{ flexDirection: "row", flexWrap: "wrap", gap }, style]}>
      {/* Until the first layout pass there is no width to divide, so tiles are
          held back rather than flashing at full width and reflowing. */}
      {tileWidth === undefined
        ? null
        : Children.map(children, (child, i) => (
            <View key={i} style={{ width: tileWidth }}>
              {child}
            </View>
          ))}
    </View>
  );
}
