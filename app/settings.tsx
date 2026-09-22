import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, hairlineWidth, radius, space } from "@/theme/tokens";
import { themes, THEME_ORDER, type ThemeId } from "@/theme/themes";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/ui/Notice";
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
import { isOperator } from "@/services/statsService";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";
import { haptic } from "@/utils/haptics";
import { InstallCard } from "@/components/ui/InstallCard";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { NotificationsSection } from "@/components/ui/NotificationsSection";

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

          <View style={styles.swatchStrip} accessibilityRole="radiogroup" aria-label={strings.settings.appearance}>
            {THEME_ORDER.map((id) => (
              <ThemeSwatch
                key={id}
                swatch={id}
                label={strings.settings.themes[id]}
                // The palette's description is no longer printed under every
                // swatch — the drawing says it faster — but it is still the
                // best thing to read aloud, so it becomes the hint.
                hint={strings.settings.themeBlurbs[id]}
                // Nothing is checked until the stored preference has been read,
                // so the pre-rendered markup does not claim a choice this
                // browser may not have made.
                selected={hydrated && preference === id}
                onPress={() => {
                  haptic("selection");
                  setPreference(id);
                }}
              />
            ))}
            <ThemeSwatch
              swatch={resolved}
              label={strings.settings.themeSystem}
              hint={strings.settings.themeSystemNow(strings.settings.themes[resolved])}
              selected={hydrated && preference === "system"}
              onPress={() => {
                haptic("selection");
                setPreference("system");
              }}
            />
          </View>

          {/* Only where installing is possible and not yet done: a section
              that says "you cannot do this here" is noise (6.4). */}
          <InstallCard />

          <View style={{ gap: space.xs }}>
            <Text variant="heading">{strings.settings.legal}</Text>
          </View>

          {/* The three hints stay: unlike a toggle, a document cannot show
              what is inside it from its title alone. */}
          <SettingsGroup>
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
          </SettingsGroup>

          {/* A block list belongs to an account, so there is nothing here to
              show a signed-out visitor — and unlike the appearance section
              above, this is not a device preference that has to be reachable
              without one. */}
          {/* Which devices hear, and about what (T-089). Signed-in only:
              a subscription is a row on the account. */}
          {session ? <NotificationsSection /> : null}

          {session ? (
            <>
              <View style={{ gap: space.xs }}>
                <Text variant="heading">{strings.settings.safety}</Text>
              </View>
              <SettingsGroup>
                <LinkRow
                  href="/blocked"
                  label={strings.settings.blockedUsers}
                  blurb={strings.settings.blockedUsersHint}
                />
              </SettingsGroup>
            </>
          ) : null}

          {/* The operator's numbers (T-099). Asked of the server once per
              signed-in visit and shown to one account; everyone else never
              learns the section exists. */}
          {session ? <OperationsSection /> : null}

          {/* Nothing to export and nothing to delete without an account, so the
              whole section is absent rather than present-and-disabled. */}
          {session ? <AccountSection /> : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

/**
 * One choice, showing itself — a miniature of the theme with its name under
 * it, six across two rows rather than six cards down the page (T-117).
 *
 * The swatch reads its colours from `themes[id]` rather than from `colors`,
 * which is the whole point: `colors` is the *active* palette, so using it here
 * would draw the same six swatches six times over.
 *
 * The description that used to sit beside each name is now the accessibility
 * hint. A drawing of a cream page with a burgundy rule says "the same
 * playbill, printed" quicker than the sentence does — but only to someone
 * who can see it, which is why the sentence is kept rather than deleted.
 */
function ThemeSwatch({
  swatch,
  label,
  hint,
  selected,
  onPress,
}: {
  swatch: ThemeId;
  label: string;
  hint: string;
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
      accessibilityHint={hint}
      // Both spellings on purpose: react-native-web 0.19 reads `aria-checked`
      // and ignores `accessibilityState` entirely, so a radio group written the
      // older way announces no selection at all in a browser.
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      style={styles.swatchCell}
    >
      <View
        style={[
          styles.swatch,
          { backgroundColor: palette.bg, borderColor: palette.hairline },
          selected && styles.swatchSelected,
        ]}
      >
        <View style={[styles.swatchCard, { backgroundColor: palette.surface }]} />
        <View style={[styles.swatchRule, { backgroundColor: palette.text }]} />
        <View style={[styles.swatchDot, { backgroundColor: palette.gold }]} />
      </View>
      <Text variant="caption" tone={selected ? "accent" : "faint"} numberOfLines={1} style={styles.swatchLabel}>
        {label}
      </Text>
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
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={styles.rowBare}>
        <View style={{ flex: 1, gap: space["2xs"] }}>
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
 * One row, for one person: the way to the usage dashboard.
 *
 * `is_operator()` is the same check `usage_stats()` makes at the door, so
 * the row cannot appear for an account the page would then refuse. Rendered
 * as nothing until the answer is in, and as nothing when the answer is no.
 */
function OperationsSection() {
  const [operator, setOperator] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isOperator().then((yes) => {
      if (!cancelled) setOperator(yes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!operator) return null;

  return (
    <>
      <View style={{ gap: space.xs }}>
        <Text variant="heading">{strings.settings.operations}</Text>
      </View>
      <SettingsGroup>
        <LinkRow href="/stats" label={strings.settings.stats} blurb={strings.settings.statsHint} />
      </SettingsGroup>
    </>
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
        <View style={{ gap: space["2xs"] }}>
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
        {!!exportError && <Notice>{exportError}</Notice>}
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
            <TextField
              value={typed}
              onChangeText={setTyped}
              placeholder={confirmWord}
              accessibilityLabel={strings.settings.deleteConfirmPrompt(confirmWord)}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.confirmInput}
            />
            {!!deleteError && <Notice>{deleteError}</Notice>}
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

/**
 * The theme miniature's own geometry — a 52x40 page with a card, a rule and
 * a dot on it. Off the spacing grid on purpose: this is a drawing of a
 * screen at a twentieth of its size, not a piece of layout.
 */
const SWATCH_INSET = 5;
const SWATCH_LINE = 3;

const useStyles = makeStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space["4xl"], gap: space.lg },
  // Rows are drawn bare now: the section's `SettingsGroup` owns the box.
  rowBare: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  /**
   * Six palettes across, wrapping to two rows of three on a phone. Percentage
   * widths rather than a fixed swatch size so the miniatures grow with the
   * column instead of leaving a ragged gap on a wide screen.
   */
  swatchStrip: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // Three across on a phone, and capped so the miniatures do not balloon
  // into posters on a wide screen: this is a picker, not a gallery.
  swatchCell: { width: "31.5%", maxWidth: 148, gap: space.xs, alignItems: "center" },
  swatchLabel: { textAlign: "center" },
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
    borderWidth: hairlineWidth,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  // On the ground rather than on a surface: the field sits inside the one
  // boxed block on the screen, and a surface inside a surface disappears.
  confirmInput: { backgroundColor: colors.bg, padding: space.md },
  /**
   * A miniature of the theme rather than a row of colour chips: four bare
   * swatches say which colours are in a palette, but not what it feels like to
   * read. This is a page with a card, a line of text and the accent on it.
   */
  swatch: {
    width: "100%",
    aspectRatio: 52 / 40,
    borderRadius: radius.sm,
    borderWidth: hairlineWidth,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: SWATCH_INSET,
    gap: SWATCH_LINE,
  },
  // The only mark of the choice, now that the row and its tick are gone.
  swatchSelected: { borderWidth: 2, borderColor: colors.gold },
  swatchCard: { position: "absolute", top: SWATCH_INSET, left: SWATCH_INSET, right: SWATCH_INSET, height: space.lg - SWATCH_LINE, borderRadius: SWATCH_LINE },
  swatchRule: { height: SWATCH_LINE, width: "70%", borderRadius: SWATCH_LINE, opacity: 0.85 },
  swatchDot: { height: SWATCH_LINE, width: "35%", borderRadius: SWATCH_LINE },
}));
