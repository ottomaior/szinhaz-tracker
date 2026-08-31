import { Platform } from "react-native";

/**
 * Font families. The real faces load via @expo-google-fonts (see
 * hooks/useAppFonts.ts); until they're loaded (or if loading fails on a
 * given platform) these fall back to a close system serif/sans so the app
 * never renders blank text.
 */
export const fonts = {
  displaySemibold: "BodoniModa_600SemiBold",
  displayRegular: "BodoniModa_400Regular",
  displayFallback: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" }),

  body: "Sora_400Regular",
  bodyMedium: "Sora_500Medium",
  bodySemibold: "Sora_600SemiBold",
  bodyBold: "Sora_700Bold",
  bodyFallback: Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
} as const;

export function displayFont(loaded: boolean, weight: "regular" | "semibold" = "semibold") {
  if (!loaded) return fonts.displayFallback;
  return weight === "semibold" ? fonts.displaySemibold : fonts.displayRegular;
}

export function bodyFont(
  loaded: boolean,
  weight: "regular" | "medium" | "semibold" | "bold" = "regular"
) {
  if (!loaded) return fonts.bodyFallback;
  switch (weight) {
    case "medium":
      return fonts.bodyMedium;
    case "semibold":
      return fonts.bodySemibold;
    case "bold":
      return fonts.bodyBold;
    default:
      return fonts.body;
  }
}
