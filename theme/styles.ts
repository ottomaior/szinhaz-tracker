/**
 * How a stylesheet gets to keep a palette.
 *
 * theme/colors.ts makes a *read* of `colors.gold` live on both platforms, which
 * covers every inline use in JSX. What it cannot cover is a value captured once
 * and reused forever, and that is exactly what `StyleSheet.create` is: an
 * object literal, evaluated when the module is imported, holding whatever the
 * palette said at that moment. On the web that was fine, because the value it
 * held was the *string* "var(--vc-gold)" and the browser did the resolving. On
 * native it is a hex code, and it is the reason the theme picker sat there for
 * a whole release doing nothing.
 *
 * So a stylesheet stops being a value and becomes a factory:
 *
 *     const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
 *       card: { backgroundColor: colors.surface, ...elevation.floating },
 *     }));
 *
 *     function Card() {
 *       const styles = useStyles();
 *       ...
 *     }
 *
 * The parameters shadow the `colors` and `elevation` imports on purpose: the
 * body of the block is then identical to what it was before, and a factory that
 * reaches for the module-level ones instead is a mistake you have to make
 * deliberately.
 *
 * ## Cost
 *
 * The factory runs once per theme, not once per render — five times in the
 * worst case, for a reader who tries every palette — and the sheets are cached
 * for the life of the process. What each render pays is a `useContext` and a
 * `Map` lookup.
 *
 * On the web it runs exactly once, because there is only ever one sheet there:
 * the tokens are custom properties, and the browser reassigns their values on
 * its own. That is also why the context below carries the literal "css" on the
 * web rather than a theme id — a constant context value has no subscribers to
 * notify, so switching a theme in a browser still re-renders nothing at all.
 */
import { useContext } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { PaintContext, type PaintTarget } from "@/contexts/PaintContext";
import { colors as ambientColors } from "./colors";
import { elevationFor, type Elevation } from "./tokens";
import { themes, type Palette } from "./themes";

type Sheet = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** What the tree is painting with right now. Changes only on native. */
export function usePaintTarget(): PaintTarget {
  return useContext(PaintContext);
}

function paletteFor(target: PaintTarget): Palette {
  // "css" means the custom-property palette from theme/colors.ts, whose values
  // are `var(...)` strings rather than colours.
  return target === "css" ? ambientColors : themes[target];
}

/**
 * The palette this render must use, and a subscription to changes of it.
 *
 * Reach for this in a component that colours something inline and has no
 * stylesheet of its own to subscribe through. A component that already calls a
 * `makeStyles` hook is subscribed by that, and can keep reading the module-level
 * `colors` inline.
 */
export function useColors(): Palette {
  return paletteFor(usePaintTarget());
}

/**
 * Bind a stylesheet factory to its cache, without the React part.
 *
 * `makeStyles` is this plus a subscription, and is what a component wants. This
 * is here for the two callers that have no component to hang a hook on: the
 * test that checks a theme swap actually changes the colours, and anything that
 * needs a sheet for a theme other than the one on screen.
 */
export function makeSheetFactory<T extends Sheet>(
  factory: (colors: Palette, elevation: Elevation) => T
): (target: PaintTarget) => T {
  const cache = new Map<PaintTarget, T>();

  return (target: PaintTarget): T => {
    let sheet = cache.get(target);
    if (!sheet) {
      const palette = paletteFor(target);
      sheet = StyleSheet.create(factory(palette, elevationFor(palette)));
      cache.set(target, sheet);
    }
    return sheet;
  };
}

/**
 * Turn a stylesheet into a hook that returns the right one for the active theme.
 */
export function makeStyles<T extends Sheet>(
  factory: (colors: Palette, elevation: Elevation) => T
): () => T {
  const sheetFor = makeSheetFactory(factory);
  return function useStyles(): T {
    return sheetFor(usePaintTarget());
  };
}
