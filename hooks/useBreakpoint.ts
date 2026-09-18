import { useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme/tokens";

export type Breakpoint = "compact" | "medium" | "expanded" | "wide";

const ORDER: Breakpoint[] = ["compact", "medium", "expanded", "wide"];

const noop = () => () => {};

/**
 * False for the render that has to match the server's HTML, true after.
 *
 * The static export renders every page with no window, so `useWindowDimensions`
 * answers 0 and every breakpoint is `compact`. A desktop browser then
 * hydrates that HTML while computing `expanded`, the first child of the tab
 * layout differs (a top bar against none), and React throws #418 and
 * re-renders the whole tree from scratch — on every desktop load, and loudly
 * enough to hide any real mismatch behind it (T-075).
 *
 * `useSyncExternalStore` is React's own answer to "different on the server":
 * during hydration it uses the server snapshot, then re-renders with the
 * client one. No effect that sets state, so the T-011 count stays where it
 * is; on native there is no server snapshot and the answer is true at once.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}

/**
 * The current viewport bucket.
 *
 * react-native-web compiles StyleSheet.create to real CSS classes but does not
 * support media queries inside them, so responsive layout in this app has to
 * be decided in JavaScript from the measured window rather than declared in
 * styles. `useWindowDimensions` already re-renders on resize and rotation,
 * which is what makes that workable.
 *
 * Until hydrated it answers `compact` whatever the window says, so that the
 * first client render is the server's render. A desktop reader sees the phone
 * layout for one frame and then the right one; that frame is the price of
 * static HTML without media queries, and it is far cheaper than the full
 * re-render the mismatch used to cost.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();

  if (!hydrated) return "compact";
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
