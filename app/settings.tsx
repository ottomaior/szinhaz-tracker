import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link, type Href } from "expo-router";
import { colors } from "@/theme/colors";
import { gutter, radius, space } from "@/theme/tokens";
import { themes, THEME_ORDER, type ThemeId } from "@/theme/themes";
import { CheckIcon, ChevronRightIcon } from "@/components/icons/Icons";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { strings } from "@/i18n/hu";

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

const styles = StyleSheet.create({
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
});
