import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { legacy, space } from "@/theme/tokens";
import { useShareCard } from "@/components/share/ShareCardProvider";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { Sheet, SheetOption } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { strings } from "@/i18n/hu";
import type { ShareCardFormat, ShareCardInput, ShareCardOpinion } from "@/services/shareCardSpec";
import { makeStyles } from "@/theme/styles";

/**
 * "Which picture, and with what on it?"
 *
 * One tap on *Megosztás* used to make the square card straight away. Now
 * there are two cards — the square, and the 9:16 story (T-108) — and one
 * question that only the author may answer: whether the opinion goes on it.
 * That is two choices too many for a header button, and one sheet is the
 * app's idiom for them (ReportSheet, AddToListSheet).
 *
 * The opinion switch starts off every time the sheet opens, and is not shown
 * at all on somebody else's entry. Sharing the evening — title, venue, date,
 * the masks — is sharing what is public anyway; sharing the words is the
 * author's to do, one card at a time, and the app never does it for them.
 *
 * Each format row makes its card and opens the share sheet on the spot;
 * there is no separate "go" button, because the format is the decision.
 */
export function ShareSheet({
  visible,
  onClose,
  card,
  opinion,
}: {
  visible: boolean;
  onClose: () => void;
  /** The evening, without the opinion; `format` is chosen here. */
  card: Omit<ShareCardInput, "format" | "opinion">;
  /**
   * What the switch would add. Given only on the author's own entry, and only
   * when there is something to add — an empty opinion has no switch to offer.
   */
  opinion?: ShareCardOpinion;
}) {
  const { share } = useShareCard();

  const [withOpinion, setWithOpinion] = useState(false);
  const [busy, setBusy] = useState<ShareCardFormat>();
  const [error, setError] = useState<string>();

  // Off on every opening. A switch left on from the last share would put the
  // review on a card the person did not read the sheet for. Reset during the
  // render that opens it rather than in an effect, so the first frame of the
  // sheet is already the clean one (and the lint count of T-011 stays put).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setWithOpinion(false);
      setBusy(undefined);
      setError(undefined);
    }
  }

  const canAddOpinion =
    !!opinion && !!(opinion.text?.trim() || opinion.tags?.length || opinion.cast?.length);

  async function make(format: ShareCardFormat) {
    if (busy) return;
    setError(undefined);
    setBusy(format);
    try {
      const ok = await share({
        ...card,
        format,
        opinion: canAddOpinion && withOpinion ? opinion : undefined,
      });
      if (ok) onClose();
      else setError(strings.entry.shareFailed);
    } catch {
      setError(strings.entry.shareFailed);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={strings.shareCard.sheetTitle}>
          <Text variant="bodySmall" tone="dim" style={{ paddingVertical: space.sm }}>
            {strings.shareCard.lead}
          </Text>

          {canAddOpinion && (
            <View style={{ paddingBottom: space.sm }}>
              <ToggleRow
                label={strings.shareCard.withOpinion}
                blurb={strings.shareCard.withOpinionBlurb}
                on={withOpinion}
                onChange={setWithOpinion}
                disabled={!!busy}
              />
            </View>
          )}

          <FormatRow
            label={strings.shareCard.square}
            blurb={strings.shareCard.squareBlurb}
            ratio={1}
            busy={busy === "square"}
            disabled={!!busy}
            onPress={() => make("square")}
          />
          <FormatRow
            label={strings.shareCard.story}
            blurb={strings.shareCard.storyBlurb}
            ratio={9 / 16}
            busy={busy === "story"}
            disabled={!!busy}
            onPress={() => make("story")}
          />

          {!!error && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent" style={{ paddingTop: space.sm }}>
              {error}
            </Text>
          )}
    </Sheet>
  );
}

/** One format to choose: a little frame in the card's proportions, a name, a line. */
function FormatRow({
  label,
  blurb,
  ratio,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  blurb: string;
  /** Width over height — the frame's shape says what the card's will be. */
  ratio: number;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const frameH = 34;
  return (
    <SheetOption onPress={onPress} disabled={disabled} busy={busy} keepBusyOpaque accessibilityLabel={label}>
      <View style={styles.frameWell}>
        <View style={[styles.frame, { width: Math.round(frameH * ratio), height: frameH }]} />
      </View>
      <View style={{ flex: 1, gap: space["2xs"] }}>
        <Text variant="subheading">{busy ? strings.shareCard.preparing : label}</Text>
        <Text variant="caption" tone="faint">{blurb}</Text>
      </View>
      <ChevronRightIcon size={15} color={colors.textFaint} />
    </SheetOption>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  frameWell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    borderWidth: legacy.thickHairline,
    borderColor: colors.gold,
    borderRadius: legacy.frameRadius,
  },
}));
