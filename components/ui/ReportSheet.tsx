import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import {
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  reportContent,
  type ReportReason,
  type ReportTarget,
} from "@/services/moderationService";
import { CheckIcon, CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

const TITLES: Record<ReportTarget, string> = {
  review: strings.moderation.reportTitleReview,
  comment: strings.moderation.reportTitleComment,
  profile: strings.moderation.reportTitleProfile,
};

/**
 * "What is wrong with this?"
 *
 * Built on the same sheet as AddToListSheet, SelectChip and DateField, because
 * a fourth idiom for "tap to choose" would read as a fourth kind of thing —
 * and this is the one screen in the app where somebody is already upset and
 * should not also have to work out how the control behaves.
 *
 * A reason has to be picked before the button does anything. The note is
 * optional and stays optional: requiring somebody to explain harassment in
 * their own words, in a box, is a reason not to report it.
 *
 * The sheet closes on a successful send and says so from the screen underneath
 * rather than holding a confirmation of its own. Nothing here promises a
 * timescale — one person reads this queue, and "we will review within 24 hours"
 * is a sentence a one-person operation cannot keep.
 */
export function ReportSheet({
  target,
  targetId,
  visible,
  onClose,
  onReported,
}: {
  target: ReportTarget;
  targetId: string;
  visible: boolean;
  onClose: () => void;
  /** Fired after the report lands, so the caller can flip its own label. */
  onReported: () => void;
}) {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const fontsLoaded = useAppFonts();

  const [reason, setReason] = useState<ReportReason>();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  // Reset on each opening. A reason left selected from last time is a reason
  // somebody sends without reading, and the note is even worse: it would carry
  // a sentence about a different person's comment.
  useEffect(() => {
    if (!visible) return;
    setReason(undefined);
    setNote("");
    setError(undefined);
  }, [visible]);

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await reportContent(target, targetId, reason, note);
      onReported();
      onClose();
    } catch {
      setError(strings.moderation.failed);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      {/* Pinned with absoluteFill rather than `flex: 1`, for the reason
          AddToListSheet gives: on react-native-web a Modal's child inherits no
          definite height and the sheet collapses into the corner. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={strings.common.close}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />

          <View style={styles.sheetHeader}>
            <Text variant="subheading">{TITLES[target]}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={strings.common.close}
            >
              <CloseIcon size={17} color={colors.textDim} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: space.sm }}>
            <Text variant="bodySmall" tone="dim" style={{ paddingVertical: space.sm }}>
              {strings.moderation.reportLead}
            </Text>

            <View accessibilityRole="radiogroup" aria-label={TITLES[target]}>
              {REPORT_REASONS.map((id) => {
                const selected = reason === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setReason(id)}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    accessibilityState={{ selected }}
                    style={styles.option}
                  >
                    <Text variant="body" tone={selected ? "accent" : "default"} style={{ flex: 1 }}>
                      {strings.moderation.reasons[id]}
                    </Text>
                    {selected && <CheckIcon size={16} />}
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={strings.moderation.notePlaceholder}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.moderation.notePlaceholder}
              multiline
              // No `maxLength`, for the reason the bio and comment fields give:
              // silently swallowing keystrokes reads as a broken keyboard. The
              // service truncates instead, and the column allows 1000.
              style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
            />
            {note.trim().length > REPORT_NOTE_MAX_LENGTH && (
              <Text variant="caption" tone="accent">
                {strings.social.tooLong(REPORT_NOTE_MAX_LENGTH)}
              </Text>
            )}

            {!!error && (
              <Text accessibilityRole="alert" variant="bodySmall" tone="accent" style={{ paddingTop: space.sm }}>
                {error}
              </Text>
            )}
          </ScrollView>

          <Pressable
            onPress={submit}
            disabled={!reason || sending}
            accessibilityRole="button"
            aria-busy={sending}
            accessibilityState={{ disabled: !reason || sending, busy: sending }}
            style={[styles.submitRow, { opacity: reason && !sending ? 1 : 0.4 }]}
          >
            <Text variant="label" tone="accent">
              {sending ? strings.moderation.submitting : strings.moderation.submit}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: overlay.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    ...elevation.floating,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
    marginBottom: space.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: space.sm,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouchTarget,
    paddingVertical: space.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 64,
    marginTop: space.md,
    fontSize: inputFontSize,
    color: colors.text,
    textAlignVertical: "top",
  },
  submitRow: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.md,
    alignItems: "center",
  },
}));
