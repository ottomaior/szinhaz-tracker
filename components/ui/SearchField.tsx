import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { minTouchTarget, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { SearchIcon, CloseIcon } from "@/components/icons/Icons";
import { strings } from "@/i18n/hu";
import { makeStyles } from "@/theme/styles";

/**
 * The one search field.
 *
 * Four screens each drew their own — a magnifier, a TextInput and a close
 * cross in a row — with three different paddings, two radii, and no agreed
 * answer to what happens on focus. On the web the browser drew its own white
 * focus rectangle inside the bar, which is most of what made it look dated.
 *
 * This is a pill on `surface`, with a hairline that turns gold-tinted on
 * focus and the magnifier warming to gold with it: the same grammar as the
 * chips and the primary button, so the field reads as part of the set rather
 * than as a form control dropped onto it. The trailing slot does one thing at
 * a time — a small gold spinner while an answer is on its way, a cross to
 * clear once there is text, nothing when the field is empty — so the reader is
 * never shown two controls in the same corner.
 *
 * Sixteen-pixel text is not a taste: below that iOS Safari zooms the page on
 * focus (`theme/type.ts`).
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  loading = false,
  autoFocus = false,
  prominent = false,
  handleMode = false,
  onSubmit,
  onClear,
  onFocusChange,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  /** A newer answer is on its way; shows a spinner in the trailing slot. */
  loading?: boolean;
  autoFocus?: boolean;
  /** Taller, for a field that heads a screen rather than sits in a form. */
  prominent?: boolean;
  /** For @handles and the like: no auto-capitalisation, no autocorrect. */
  handleMode?: boolean;
  /** Enter, or the keyboard's search key. */
  onSubmit?: () => void;
  /** After the field has been emptied by the cross or by Escape. */
  onClear?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const styles = useStyles();
  const fontsLoaded = useAppFonts();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const hasText = value.length > 0;

  function clear() {
    onChangeText("");
    onClear?.();
    inputRef.current?.focus();
  }

  function onKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    // Only the web keyboard sends Escape; on a phone the cross is the way out.
    if (e.nativeEvent.key === "Escape" && hasText) clear();
  }

  return (
    <View
      style={[styles.field, prominent && styles.prominent, focused && styles.focused]}
      accessibilityRole={Platform.OS === "web" ? ("search" as never) : undefined}
    >
      <SearchIcon size={prominent ? 18 : 17} color={focused ? colors.gold : colors.textFaint} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocusChange?.(false);
        }}
        onKeyPress={onKeyPress}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        autoCapitalize={handleMode ? "none" : "sentences"}
        autoCorrect={!handleMode}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
      />
      <View style={styles.trailing}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : hasText ? (
          <Pressable
            onPress={clear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.common.clearSearch}
            style={styles.clear}
          >
            <CloseIcon size={14} color={colors.textDim} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: minTouchTarget,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  prominent: {
    minHeight: 50,
  },
  focused: {
    borderColor: colors.goldTintBorder,
    backgroundColor: colors.surface2,
  },
  input: {
    flex: 1,
    // Zero vertical padding: the row's minHeight is the height, so the text
    // sits centred instead of on a padding of its own.
    paddingVertical: 0,
    fontSize: inputFontSize,
    color: colors.text,
    // The browser's focus rectangle, which the gold hairline replaces.
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  trailing: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutralTintBg,
  },
}));
