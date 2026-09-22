import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import {
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  reportContent,
  type ReportReason,
  type ReportTarget,
} from "@/services/moderationService";
import { CheckIcon } from "@/components/icons/Icons";
import { Sheet, SheetFooter, SheetOption, sheetScroll } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
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
    <Sheet visible={visible} onClose={onClose} title={TITLES[target]}>
          <ScrollView {...sheetScroll}>
            <Text variant="bodySmall" tone="dim" style={{ paddingVertical: space.sm }}>
              {strings.moderation.reportLead}
            </Text>

            <View accessibilityRole="radiogroup" aria-label={TITLES[target]}>
              {REPORT_REASONS.map((id) => {
                const selected = reason === id;
                return (
                  <SheetOption
                    key={id}
                    onPress={() => setReason(id)}
                    accessibilityRole="radio"
                    selected={selected}
                    trailing={selected ? <CheckIcon /> : undefined}
                  >
                    <Text variant="body" tone={selected ? "accent" : "default"} style={{ flex: 1 }}>
                      {strings.moderation.reasons[id]}
                    </Text>
                  </SheetOption>
                );
              })}
            </View>

            <TextField
              value={note}
              onChangeText={setNote}
              placeholder={strings.moderation.notePlaceholder}
              accessibilityLabel={strings.moderation.notePlaceholder}
              multiline
              // No `maxLength`, for the reason the bio and comment fields give:
              // silently swallowing keystrokes reads as a broken keyboard. The
              // service truncates instead, and the column allows 1000.
              style={styles.input}
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

          <SheetFooter style={{ opacity: reason && !sending ? 1 : 0.4 }}>
            <Pressable
              onPress={submit}
              disabled={!reason || sending}
              accessibilityRole="button"
              aria-busy={sending}
              accessibilityState={{ disabled: !reason || sending, busy: sending }}
            >
              <Text variant="label" tone="accent">
                {sending ? strings.moderation.submitting : strings.moderation.submit}
              </Text>
            </Pressable>
          </SheetFooter>
    </Sheet>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  input: { marginTop: space.md },
}));
