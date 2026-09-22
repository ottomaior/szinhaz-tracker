import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/theme/styles";
import { legacyType } from "@/theme/type";
import { hairlineWidth, legacy, radius } from "@/theme/tokens";
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
 *
 * Two forms. The pill is for a screen about one production, where the status
 * is worth a line of its own. `inline` is for a tile in a grid or a row in a
 * list, and there it says nothing at all for `running`: forty tiles wearing
 * forty identical gold pills told the reader nothing, since running is what a
 * browsing grid is *of*. The exceptions — paused, closed, not yet open — are
 * the news, and they keep a quiet pill so the eye lands on them.
 */
export function StatusBadge({
  status,
  size = "md",
  inline = false,
}: {
  status: PlayStatus;
  size?: "sm" | "md";
  inline?: boolean;
}) {
  const fontsLoaded = useAppFonts();
  const colors = useColors();
  if (status === "unknown") return null;
  if (inline && status === "running") return null;

  const tone = tonesFor(colors)[status];
  const small = size === "sm" || inline;

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
      <Text style={[legacyType(small ? "badgeSmall" : "badge", fontsLoaded), { color: tone.text }]}>
        {strings.status[status]}
      </Text>
    </View>
  );
}

/**
 * The status as part of a sentence: a dot and the word, with no box.
 *
 * For the line under a title that already carries the next date — "● Műsoron ·
 * Következő: szept. 19." — where a pill would be a badge interrupting prose.
 * A Text rather than a View so it can sit *inside* the sentence and wrap with
 * it: as a separate box the rest of the line broke underneath it on a phone.
 */
export function StatusInline({ status }: { status: PlayStatus }) {
  const fontsLoaded = useAppFonts();
  const colors = useColors();
  if (status === "unknown") return null;
  const tone = tonesFor(colors)[status];
  return (
    <Text style={[legacyType("statusInline", fontsLoaded), { color: tone.text }]}>
      {"● "}
      {strings.status[status]}
    </Text>
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
    gap: legacy.badgeGap,
    alignSelf: "flex-start",
    borderWidth: hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: legacy.badgePaddingVertical,
    paddingHorizontal: legacy.badgePaddingHorizontal,
  },
  small: { paddingVertical: legacy.badgeSmallPaddingVertical, paddingHorizontal: legacy.badgeSmallPaddingHorizontal, gap: legacy.badgeSmallGap },
  dot: { width: legacy.badgeGap, height: legacy.badgeGap, borderRadius: radius.pill },
});
