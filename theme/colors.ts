/**
 * "Velvet Curtain" design system tokens.
 *
 * These are sRGB hex equivalents of the OKLCH values used in the original
 * design canvas (see PRODUCT/design notes). React Native's style engine does
 * not accept oklch() color functions, so the values below were computed via
 * the OKLab -> linear sRGB -> sRGB pipeline to match exactly what the canvas
 * mockups rendered.
 */
export const colors = {
  bg: "#120505", // oklch(14% 0.025 25)
  bgElevated: "#1d0c0a", // oklch(18% 0.03 26)
  surface: "#251210", // oklch(21% 0.032 27)
  surface2: "#331d1a", // oklch(26% 0.035 28)

  hairline: "rgba(255,255,255,0.10)",
  hairlineSoft: "rgba(255,255,255,0.06)",

  text: "#f5ede4", // oklch(95% 0.015 75)
  textDim: "#b9a69e", // oklch(74% 0.025 45)
  textFaint: "#80716d", // oklch(56% 0.02 35)

  gold: "#dbb155", // oklch(78% 0.12 85)
  goldDeep: "#b28324", // oklch(64% 0.12 80)

  shadow: "rgba(0,0,0,0.45)",
} as const;

export type ColorToken = keyof typeof colors;
