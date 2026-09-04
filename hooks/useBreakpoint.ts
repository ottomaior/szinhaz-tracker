import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme/tokens";

export type Breakpoint = "compact" | "medium" | "expanded" | "wide";

const ORDER: Breakpoint[] = ["compact", "medium", "expanded", "wide"];

/**
 * The current viewport bucket.
 *
 * react-native-web compiles StyleSheet.create to real CSS classes but does not
 * support media queries inside them, so responsive layout in this app has to
 * be decided in JavaScript from the measured window rather than declared in
 * styles. `useWindowDimensions` already re-renders on resize and rotation,
 * which is what makes that workable.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();

  if (width >= breakpoints.wide) return "wide";
  if (width >= breakpoints.expanded) return "expanded";
  if (width >= breakpoints.medium) return "medium";
  return "compact";
}

/** True when the viewport is at least `min` — `useAtLeast("expanded")`. */
export function useAtLeast(min: Breakpoint): boolean {
  const current = useBreakpoint();
  return ORDER.indexOf(current) >= ORDER.indexOf(min);
}

/**
 * Picks the value for the current breakpoint, falling back to the nearest
 * smaller one that was given.
 *
 *   const columns = useResponsive({ compact: 2, expanded: 4, wide: 5 });
 *
 * Written mobile-first: `compact` is required, everything above it optional,
 * so a layout that needs no wide-screen treatment simply says nothing about it.
 */
export function useResponsive<T>(values: { compact: T; medium?: T; expanded?: T; wide?: T }): T {
  const current = useBreakpoint();

  for (let i = ORDER.indexOf(current); i >= 0; i--) {
    const value = values[ORDER[i]];
    if (value !== undefined) return value;
  }
  return values.compact;
}
