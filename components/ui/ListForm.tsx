import { useState } from "react";
import { View, StyleSheet, TextInput, Switch } from "react-native";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

export type ListFormValues = {
  title: string;
  description: string;
  isRanked: boolean;
  isPublic: boolean;
};

const EMPTY: ListFormValues = { title: "", description: "", isRanked: false, isPublic: true };

/**
 * What a list is: its title, a line about it, and two decisions.
 *
 * One form for creating and for editing, because until there was an edit the
 * create form was the last time any of these could be changed (T-062). The
 * fields are the four columns `listsService.updateList` takes, no more.
 *
 * `onSubmit` is awaited and its rejection is shown under the fields; the
 * caller decides what happens on success (navigating to the new list, or
 * closing the editor), which is the one thing the two uses do differently.
 */
export function ListForm({
  initial,
  submitLabel,
  submittingLabel,
  notice,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ListFormValues>;
  submitLabel: string;
  submittingLabel: string;
  /** A line above the fields — "«Hamlet» rákerül az új listára." */
  notice?: string;
  onSubmit: (values: ListFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const fontsLoaded = useAppFonts();

  const [title, setTitle] = useState(initial?.title ?? EMPTY.title);
  const [description, setDescription] = useState(initial?.description ?? EMPTY.description);
  const [isRanked, setIsRanked] = useState(initial?.isRanked ?? EMPTY.isRanked);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? EMPTY.isPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setError(undefined);
    setSaving(true);
    try {
      await onSubmit({ title: trimmed, description: description.trim(), isRanked, isPublic });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : strings.lists.updateError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.composer}>
      {!!notice && (
        <Text variant="bodySmall" tone="accent">
          {notice}
        </Text>
      )}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={strings.lists.titlePlaceholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={strings.lists.titlePlaceholder}
        maxLength={120}
        style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={strings.lists.descriptionPlaceholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={strings.lists.descriptionPlaceholder}
        multiline
        style={[styles.input, styles.textArea, { fontFamily: bodyFont(fontsLoaded) }]}
      />

      {/* Whether the order is a judgement. Recorded rather than inferred,
          because numbering a list its author never ranked asserts something
          they did not say. */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall">{strings.lists.rankedLabel}</Text>
          <Text variant="caption" tone="faint">{strings.lists.rankedHint}</Text>
        </View>
        <Switch
          value={isRanked}
          onValueChange={setIsRanked}
          trackColor={{ false: colors.surface2, true: colors.goldDeep }}
          thumbColor={isRanked ? colors.gold : colors.textFaint}
          accessibilityLabel={strings.lists.rankedLabel}
        />
      </View>

      {/* Public is the default and the point — a list is something written
          to be read — so the switch is phrased as the exception. */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall">{strings.lists.privateLabel}</Text>
          <Text variant="caption" tone="faint">{strings.lists.privateHint}</Text>
        </View>
        <Switch
          value={!isPublic}
          onValueChange={(isPrivate) => setIsPublic(!isPrivate)}
          trackColor={{ false: colors.surface2, true: colors.goldDeep }}
          thumbColor={!isPublic ? colors.gold : colors.textFaint}
          accessibilityLabel={strings.lists.privateLabel}
        />
      </View>

      {!!error && (
        <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
          {error}
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label={strings.common.cancel} variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label={saving ? submittingLabel : submitLabel}
          style={{ flex: 1 }}
          disabled={saving || !title.trim()}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  composer: {
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.text,
    // 16px: iOS Safari zooms the page whenever a focused field's text is
    // smaller. See the note in README's design system section.
    fontSize: inputFontSize,
  },
  textArea: { minHeight: 68, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
}));
