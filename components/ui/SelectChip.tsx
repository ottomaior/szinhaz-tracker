import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { elevation, gutter, minTouchTarget, overlay, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "@/components/icons/Icons";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * One facet of the filter bar: a chip showing its current value, which opens a
 * sheet to change it.
 *
 * This replaces three full rows of option chips. On a 375×812 phone those rows
 * pushed the first result to 401px — half the screen was controls before
 * anything you had come to see, and in the Műsor calendar exactly one
 * performance was visible above the fold.
 *
 * The chip still carries its value rather than collapsing to a bare "Filters"
 * button, which is the point: this app hides a filter row rather than show one
 * that returns nothing, and changes the "Népszerű" heading when the sort no
 * longer matches it, on the principle that a control which misdescribes its
 * list is worse than no control. A screen quietly filtered to Debrecen and
 * opera, looking unfiltered, would be the same mistake.
 */

export type SelectOption = {
  /** `undefined` is the unset choice — "Mind". */
  value?: string;
  label: string;
};

export function SelectChip({
  name,
  value,
  options,
  onChange,
  title,
  defaultValue,
  variant = "chip",
  subtitle,
}: {
  /** What this facet is, shown when nothing is chosen: "Műfaj". */
  name: string;
  value?: string;
  options: SelectOption[];
  onChange: (value?: string) => void;
  /** Heading on the sheet. Defaults to `name`. */
  title?: string;
  /**
   * The value that counts as "not set", for a facet that always has one.
   *
   * Sorting is the case this exists for: a list is always in some order, so a
   * sort chip would otherwise be highlighted permanently and the highlight
   * would stop meaning anything. Gold here says "you changed this", which is
   * only true once the value differs from where it started.
   */
  defaultValue?: string;
  /**
   * How the trigger looks. The sheet is identical either way.
   *
   * `header` exists for the city on Felfedezés, which stopped being one facet
   * among several when it started scoping the whole screen — the rails, the
   * upcoming timeline and the sentence in the greeting all read from it. A
   * control that decides what a screen is about belongs above the screen's
   * title, not in a row of chips that merely narrow a grid. The sheet, its
   * options and its accessibility are shared rather than reimplemented,
   * because there is only one question being asked.
   */
  variant?: "chip" | "header";
  /** A quiet second line under a `header` trigger: "8 színház". */
  subtitle?: string;
}) {
  const fontsLoaded = useAppFonts();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const isSet = value !== undefined && value !== defaultValue;
  // The value when there is one, the facet's name when there is not — so the
  // chip reads as "Debrecen" once set and "Város" while it is not. A facet
  // sitting at its default names itself, since the default is not news.
  const label = isSet ? selected?.label ?? name : name;
  const active = isSet;

  const a11yLabel = `${name}: ${selected?.label ?? strings.discover.filterAll}`;

  return (
    <>
      {variant === "header" ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          aria-expanded={open}
          accessibilityState={{ expanded: open }}
          style={styles.header}
        >
          <View style={styles.headerLine}>
            {/* The chosen city, or "Mind" — never the facet's name. Unlike a
                chip, this trigger is the only thing on screen saying what the
                whole page is scoped to, so it has to read as an answer even
                when nothing has been picked. */}
            <Text variant="subheading" numberOfLines={1}>
              {selected?.label ?? strings.discover.filterAll}
            </Text>
            <ChevronDownIcon size={14} color={colors.textDim} />
          </View>
          {!!subtitle && (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          aria-expanded={open}
          accessibilityState={{ expanded: open }}
          style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: bodyFont(fontsLoaded, active ? "bold" : "medium"),
              fontSize: 12.5,
              color: active ? colors.onAccent : colors.textDim,
              maxWidth: 150,
            }}
          >
            {label}
          </Text>
          <ChevronDownIcon size={12} color={active ? colors.onAccent : colors.textFaint} />
        </Pressable>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        // Android's hardware back closes the sheet rather than leaving the
        // screen, which `onRequestClose` is what wires up.
        accessibilityViewIsModal
      >
        {/* Tapping the dimmed area behind the sheet dismisses it. The sheet
            itself stops the press, so a tap inside never closes it. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={strings.common.close}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => {}}>
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Text variant="subheading">{title ?? name}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={strings.common.close}>
                <CloseIcon size={17} color={colors.textDim} />
              </Pressable>
            </View>

            <ScrollView
              // Bounded so a long list — 8 theatres, 9 genres — scrolls inside
              // the sheet instead of pushing it off the top of the screen.
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: space.sm }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value ?? "__all__"}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    aria-pressed={isSelected}
                    accessibilityState={{ selected: isSelected }}
                    style={styles.option}
                  >
                    <Text variant="body" tone={isSelected ? "accent" : "default"} style={{ flex: 1 }}>
                      {option.label}
                    </Text>
                    {isSelected && <CheckIcon size={16} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  chipActive: { backgroundColor: colors.gold },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },

  /* Unpainted on purpose: this trigger sits over the header's wash and reads
     as a heading you can change, not as a control dropped on top of one. The
     touch target is met by the two lines plus the vertical padding. */
  header: { paddingVertical: space.xs, paddingRight: space.sm, minHeight: minTouchTarget, justifyContent: "center" },
  headerLine: { flexDirection: "row", alignItems: "center", gap: space.xs },

  /*
   * Absolutely filled rather than `flex: 1`.
   *
   * On react-native-web a Modal's child does not inherit a definite height, so
   * `flex: 1` collapses it to its content and the sheet renders as a few words
   * in the bottom-left corner with no backdrop. Pinning all four edges gives
   * the same result on native and is unambiguous on web.
   */
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
  /** The short bar that says a sheet can be dismissed downward. */
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
    paddingVertical: space.md,
  },
});
