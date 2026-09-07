import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { gutter, radius, space } from "@/theme/tokens";
import { themes, THEME_ORDER, type ThemeId } from "@/theme/themes";
import { CheckIcon, ChevronRightIcon } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  deleteAccount,
  downloadMyData,
  isDataExportSupported,
} from "@/services/accountService";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * Everything that is a preference rather than a profile.
 *
 * Kept separate from `edit-profile`, which is about who other people see; a
 * theme is about this device.
 *
 * It is also where anything that is not a screen of its own ends up: the legal
 * documents are linked from here because this is where somebody looks when
 * they want to know what they agreed to.
 */
export default function SettingsScreen() {
  const styles = useStyles();

  const { session } = useAuth();
  const { preference, resolved, hydrated, setPreference } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.settings.title} fallbackRoute="/(tabs)/profile" />
      <Screen width="reading">
        <ScrollView contentContainerStyle={styles.content}>
          <View style={{ gap: space.xs }}>
            <Text variant="heading">{strings.settings.appearance}</Text>
            <Text variant="caption" tone="faint">
              {strings.settings.appearanceHint}
            </Text>
          </View>

          <View style={{ gap: space.sm }} accessibilityRole="radiogroup" aria-label={strings.settings.appearance}>
            {THEME_ORDER.map((id) => (
              <ThemeRow
                key={id}
                swatch={id}
                label={strings.settings.themes[id]}
                blurb={strings.settings.themeBlurbs[id]}
                // Nothing is checked until the stored preference has been read,
                // so the pre-rendered markup does not claim a choice this
                // browser may not have made.
                selected={hydrated && preference === id}
                onPress={() => setPreference(id)}
              />
            ))}
            <ThemeRow
              swatch={resolved}
              label={strings.settings.themeSystem}
              blurb={strings.settings.themeSystemNow(strings.settings.themes[resolved])}
              selected={hydrated && preference === "system"}
              onPress={() => setPreference("system")}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Text variant="heading">{strings.settings.legal}</Text>
          </View>

          <View style={{ gap: space.sm }}>
            <LinkRow
              href="/legal/adatvedelem"
              label={strings.settings.legalPrivacy}
              blurb={strings.settings.legalPrivacyHint}
            />
            <LinkRow
              href="/legal/feltetelek"
              label={strings.settings.legalTerms}
              blurb={strings.settings.legalTermsHint}
            />
            <LinkRow
              href="/legal/impresszum"
              label={strings.settings.legalImprint}
              blurb={strings.settings.legalImprintHint}
            />
          </View>

          {/* A block list belongs to an account, so there is nothing here to
              show a signed-out visitor — and unlike the appearance section
              above, this is not a device preference that has to be reachable
              without one. */}
          {session ? (
            <>
              <View style={{ gap: space.xs }}>
                <Text variant="heading">{strings.settings.safety}</Text>
              </View>
              <View style={{ gap: space.sm }}>
                <LinkRow
                  href="/blocked"
                  label={strings.settings.blockedUsers}
                  blurb={strings.settings.blockedUsersHint}
                />
              </View>
            </>
          ) : null}

          {/* Nothing to export and nothing to delete without an account, so the
              whole section is absent rather than present-and-disabled. */}
          {session ? <AccountSection /> : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

/**
 * One choice, showing itself.
 *
 * The swatch reads its colours from `themes[id]` rather than from `colors`,
 * which is the whole point: `colors` is the *active* palette, so using it here
 * would draw the same five swatches five times over.
 */
function ThemeRow({
  swatch,
  label,
  blurb,
  selected,
  onPress,
}: {
  swatch: ThemeId;
  label: string;
  blurb: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();

  const palette = themes[swatch];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      // Both spellings on purpose: react-native-web 0.19 reads `aria-checked`
      // and ignores `accessibilityState` entirely, so a radio group written the
      // older way announces no selection at all in a browser.
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={[styles.swatch, { backgroundColor: palette.bg, borderColor: palette.hairline }]}>
        <View style={[styles.swatchCard, { backgroundColor: palette.surface }]} />
        <View style={[styles.swatchRule, { backgroundColor: palette.text }]} />
        <View style={[styles.swatchDot, { backgroundColor: palette.gold }]} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{label}</Text>
        <Text variant="caption" tone="faint" numberOfLines={2}>
          {blurb}
        </Text>
      </View>

      {selected ? <CheckIcon /> : <View style={{ width: 16 }} />}
    </Pressable>
  );
}

/**
 * A row that opens a document.
 *
 * The only place in the app that navigates with `Link` rather than
 * `router.push`, and deliberately so: on the web `Link` renders a real
 * anchor, and these three are the routes somebody actually wants to
 * middle-click, open in a second tab and read alongside the form they are
 * filling in. Everywhere else in the app a row is a control, not an address.
 *
 * `asChild` hands the href and the press handler to the Pressable below rather
 * than wrapping it in a second element, so the row keeps its own layout.
 */
function LinkRow({
  href,
  label,
  blurb,
}: {
  href: Href;
  label: string;
  blurb: string;
}) {
  const styles = useStyles();

  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subheading">{label}</Text>
          <Text variant="caption" tone="faint">
            {blurb}
          </Text>
        </View>
        <ChevronRightIcon />
      </Pressable>
    </Link>
  );
}

/**
 * The two things you can do to the account itself: take it with you, or end it.
 *
 * Both are GDPR obligations the app had no answer for — Art. 20 and Art. 17 —
 * and both are required by the app stores later. They sit last, below the
 * preferences, because that is where a destructive control belongs and because
 * neither is something anybody opens Settings to do.
 */
function AccountSection() {
  const styles = useStyles();

  const router = useRouter();
  const fontsLoaded = useAppFonts();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  const canExport = isDataExportSupported();
  const confirmWord = strings.settings.deleteConfirmWord;
  // Trimmed but not case-folded: the word is the deliberate part.
  const confirmed = typed.trim() === confirmWord;

  async function handleExport() {
    if (exporting) return;
    setExportError(undefined);
    setExporting(true);
    try {
      await downloadMyData();
    } catch {
      setExportError(strings.settings.exportError);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleting || !confirmed) return;
    setDeleteError(undefined);
    setDeleting(true);
    try {
      await deleteAccount();
      // `replace`, not `push`: there is no account behind this screen any more,
      // and leaving it on the stack means the back gesture lands on a profile
      // that will fail to load.
      router.replace("/(tabs)");
    } catch {
      setDeleteError(strings.settings.deleteError);
      setDeleting(false);
    }
  }

  return (
    <>
      <View style={{ gap: space.xs }}>
        <Text variant="heading">{strings.settings.account}</Text>
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <Text variant="subheading">{strings.settings.exportTitle}</Text>
          <Text variant="caption" tone="faint">
            {canExport ? strings.settings.exportHint : strings.settings.exportUnsupported}
          </Text>
        </View>
        {canExport ? (
          <Button
            label={exporting ? strings.settings.exportWorking : strings.settings.exportButton}
            variant="outline"
            onPress={handleExport}
            loading={exporting}
            disabled={exporting}
          />
        ) : null}
        {!!exportError && (
          <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
            {exportError}
          </Text>
        )}
      </View>

      <View style={styles.danger}>
        <View style={{ gap: space.xs }}>
          <Text variant="subheading">{strings.settings.deleteTitle}</Text>
          <Text variant="bodySmall" tone="dim">
            {strings.settings.deleteHint}
          </Text>
        </View>

        {confirming ? (
          <>
            <Text variant="bodySmall" tone="dim">
              {strings.settings.deleteConfirmPrompt(confirmWord)}
            </Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={confirmWord}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.settings.deleteConfirmPrompt(confirmWord)}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
            />
            {!!deleteError && (
              <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
                {deleteError}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button
                label={strings.common.cancel}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setConfirming(false);
                  setTyped("");
                  setDeleteError(undefined);
                }}
              />
              <Button
                label={deleting ? strings.settings.deleteWorking : strings.settings.deleteConfirm}
                style={{ flex: 1 }}
                onPress={handleDelete}
                loading={deleting}
                disabled={!confirmed || deleting}
              />
            </View>
          </>
        ) : (
          <Button
            label={strings.settings.deleteStart}
            variant="outline"
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space["4xl"], gap: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
  rowSelected: { borderColor: colors.gold, backgroundColor: colors.surface },
  /**
   * The one irreversible control in the app, boxed off from the preferences
   * above it. `gold` rather than a red that does not exist in any of the four
   * palettes: the accent is what this design system uses to mean "look here",
   * and inventing a fifth colour for one border would read as a different app.
   */
  danger: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: inputFontSize,
    color: colors.text,
  },
  /**
   * A miniature of the theme rather than a row of colour chips: four bare
   * swatches say which colours are in a palette, but not what it feels like to
   * read. This is a page with a card, a line of text and the accent on it.
   */
  swatch: {
    width: 52,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 5,
    gap: 3,
  },
  swatchCard: { position: "absolute", top: 5, left: 5, right: 5, height: 14, borderRadius: 3 },
  swatchRule: { height: 3, width: "70%", borderRadius: 2, opacity: 0.85 },
  swatchDot: { height: 3, width: "35%", borderRadius: 2 },
}));
