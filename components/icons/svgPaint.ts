import { Platform } from "react-native";

/**
 * How an icon's colour reaches an SVG shape.
 *
 * On the web the palette is a set of CSS custom properties (see
 * theme/themes.ts), and `var()` is not reliably supported inside an SVG
 * *presentation attribute* — presentation attributes are a separate cascade
 * origin, and engines implemented custom properties there last and unevenly.
 * Where it is not supported the property falls back to its initial value, and
 * `stroke`'s initial value is `none`. Every icon in this app is stroke-only on
 * a `fill="none"` canvas, so the failure mode is not a wrong colour — it is
 * the entire icon set rendering invisible.
 *
 * As a CSS *declaration* the same value is universally supported, and
 * react-native-web passes `fill` and `stroke` through untouched because
 * neither is in its `colorProps` map. So on web the paint goes through
 * `style`, and on native, where react-native-svg wants the props and there
 * are no custom properties to resolve, it stays a prop.
 */
export const strokePaint = (color: string) =>
  Platform.OS === "web" ? ({ style: { stroke: color } } as const) : ({ stroke: color } as const);

export const fillPaint = (color: string) =>
  Platform.OS === "web" ? ({ style: { fill: color } } as const) : ({ fill: color } as const);

/** Both at once, for a shape that is filled and outlined in different colours. */
export const paint = (fill: string, stroke: string) =>
  Platform.OS === "web"
    ? ({ style: { fill, stroke } } as const)
    : ({ fill, stroke } as const);
