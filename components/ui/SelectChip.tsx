import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { hairlineWidth, legacy, radius, space } from "@/theme/tokens";
import { legacyType } from "@/theme/type";
import { useAppFonts } from "@/hooks/useAppFonts";
import { CheckIcon, ChevronDownIcon, PinIcon } from "@/components/icons/Icons";
import { Sheet, SheetOption } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";
import { haptic } from "@/utils/haptics";

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
  const styles = useStyles();

  const fontsLoaded = useAppFonts();
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
                when nothing has been picked. Drawn as a pill with a pin and a
                chevron rather than as a bare line of text: it is the control
                a reader reaches for most, and printed like a subtitle nobody
                knew it could be pressed. */}
            <PinIcon size={14} color={colors.gold} />
            <Text variant="bodySmall" numberOfLines={1} style={{ flexShrink: 1 }}>
              <Text variant="bodySmall" weight="semibold">
                {selected?.label ?? strings.discover.filterAll}
              </Text>
              {!!subtitle && (
                <Text variant="bodySmall" tone="dim">
                  {` · ${subtitle}`}
                </Text>
              )}
            </Text>
            <ChevronDownIcon size={13} color={colors.textDim} />
          </View>
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
            style={[legacyType(active ? "chipActive" : "chip", fontsLoaded), { color: active ? colors.onAccent : colors.textDim, maxWidth: 150 }]}
          >
            {label}
          </Text>
          <ChevronDownIcon size={12} color={active ? colors.onAccent : colors.textFaint} />
        </Pressable>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={title ?? name}>
            <ScrollView
              // Bounded so a long list — 8 theatres, 9 genres — scrolls inside
              // the sheet instead of pushing it off the top of the screen.
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: space.sm }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <SheetOption
                    key={option.value ?? "__all__"}
                    onPress={() => {
                      haptic("selection");
                      onChange(option.value);
                      setOpen(false);
                    }}
                    selected={isSelected}
                    style={styles.option}
                    trailing={isSelected ? <CheckIcon size={16} /> : undefined}
                  >
                    <Text variant="body" tone={isSelected ? "accent" : "default"} style={{ flex: 1 }}>
                      {option.label}
                    </Text>
                  </SheetOption>
                );
              })}
            </ScrollView>
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: legacy.chipPaddingVertical,
    paddingHorizontal: legacy.chipPaddingHorizontal,
    borderRadius: radius.pill,
  },
  chipActive: { backgroundColor: colors.gold },
  chipIdle: { backgroundColor: colors.surface, borderWidth: hairlineWidth, borderColor: colors.hairline },

  /* Painted like the idle chips, a size up, so it is unmistakably a button:
     the city is the control most readers touch first, and unpainted it read
     as a subtitle. Sits under the title with a little air above it. */
  header: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    minHeight: legacy.headerChipMinHeight,
    paddingVertical: legacy.headerChipPaddingVertical,
    paddingLeft: legacy.headerChipPaddingLeft,
    paddingRight: legacy.chipPaddingHorizontal,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    justifyContent: "center",
  },
  headerLine: { flexDirection: "row", alignItems: "center", gap: space.sm },

  // A step taller than the Sheet's own option: a list of eight theatres is
  // read, not scanned, and the extra air is what makes it a list.
  option: { paddingVertical: space.md },
}));
