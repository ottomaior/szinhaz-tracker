import { createContext } from "react";
import { Platform } from "react-native";
import { DEFAULT_DARK, type ThemeId } from "@/theme/themes";

/**
 * What the tree paints with.
 *
 * A theme id on native. On the web the literal "css", because there the palette
 * is a set of CSS custom properties and the switch happens in the browser, not
 * in React — so this value is constant for the life of the document and nothing
 * subscribed to it ever re-renders.
 */
export type PaintTarget = ThemeId | "css";

/**
 * Deliberately its own module, and deliberately not part of ThemeContext.
 *
 * ThemeContext's value carries the *preference* — which row the picker checks,
 * whether it has been read back from storage yet — and that changes for reasons
 * a stylesheet does not care about. Almost every component in the app subscribes
 * to this one, so it should change only when the actual colours do.
 */
export const PaintContext = createContext<PaintTarget>(
  Platform.OS === "web" ? "css" : DEFAULT_DARK
);
