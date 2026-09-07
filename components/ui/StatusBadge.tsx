import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/theme/styles";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { strings } from "@/i18n/hu";
import type { Palette } from "@/theme/themes";
import type { PlayStatus } from "@/data/types";

/**
 * "Is this still on?" — the answer Discover and Play Detail exist to give.
 *
 * `unknown` renders nothing at all rather than a placeholder: it means the
 * source data is stale, and a badge saying so would be noise to a reader who
 * cannot act on it.
 */
export function StatusBadge({ status, size = "md" }: { status: PlayStatus; size?: "sm" | "md" }) {
  const fontsLoaded = useAppFonts();
  const colors = useColors();
  if (status === "unknown") return null;

  const tone = tonesFor(colors)[status];
  const small = size === "sm";

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.base,
        small && styles.small,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      {status === "running" && <View style={[styles.dot, { backgroundColor: tone.text }]} />}
      <Text
        style={{
          fontFamily: bodyFont(fontsLoaded, "bold"),
          fontSize: small ? 9.5 : 10.5,
          letterSpacing: 0.04,
          color: tone.text,
        }}
      >
        {strings.status[status]}
      </Text>
    </View>
  );
}

// Gold is reserved for "you can go and see this". Everything else is
// deliberately quiet: an ended production is still worth browsing and
// logging, so its badge should read as a fact, not as a warning.
//
// Built per call rather than held as a constant: a constant would have read the
// palette once, when this module was imported, and gone on showing that theme's
// colours for the life of the process. theme/colors.ts has the long version.
const tonesFor = (
  colors: Palette
): Record<Exclude<PlayStatus, "unknown">, { bg: string; border: string; text: string }> => ({
  running: { bg: colors.goldTintBg, border: colors.goldTintBorder, text: colors.gold },
  announced: { bg: colors.neutralTintBg, border: colors.hairline, text: colors.text },
  dormant: { bg: colors.surface, border: colors.hairline, text: colors.textDim },
  ended: { bg: colors.surface, border: colors.hairlineSoft, text: colors.textFaint },
});

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  small: { paddingVertical: 2, paddingHorizontal: 7, gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
