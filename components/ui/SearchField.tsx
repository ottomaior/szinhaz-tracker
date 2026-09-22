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
import { control, hairlineWidth, icon, minTouchTarget, radius, space } from "@/theme/tokens";
import { TextField } from "@/components/ui/TextField";
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
      {/* In its own box, so a narrow field — the top bar's, on a laptop —
          shrinks the text rather than the magnifier. A flex row shrinks
          whatever it can, and an icon at nought pixels reads as a field
          somebody forgot to finish. */}
      <View style={styles.icon}>
        <SearchIcon size={prominent ? icon.chrome : icon.inline} color={focused ? colors.gold : colors.textFaint} />
      </View>
      <TextField
        bare
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
        // Android wraps a long hint onto a second line inside a fixed-height
        // field and clips it (T-104); one line, always.
        numberOfLines={1}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={styles.input}
      />
      <View style={styles.trailing}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : hasText ? (
          <Pressable
            onPress={clear}
            hitSlop={space.sm}
            accessibilityRole="button"
            accessibilityLabel={strings.common.clearSearch}
            style={styles.clear}
          >
            <CloseIcon color={colors.textDim} />
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
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    // A long placeholder in a short field spilled out over whatever sat
    // beside it: a flex item may not shrink below its content unless it is
    // told it may, and the box has to clip what is still too long.
    overflow: "hidden",
  },
  icon: { flexShrink: 0 },
  prominent: {
    minHeight: control.lg,
  },
  focused: {
    borderColor: colors.goldTintBorder,
    backgroundColor: colors.surface2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    // Zero vertical padding: the row's minHeight is the height, so the text
    // sits centred instead of on a padding of its own.
    paddingVertical: 0,
    fontSize: inputFontSize,
    color: colors.text,
    // The browser's focus rectangle, which the gold hairline replaces.
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  trailing: {
    width: control.sm,
    height: control.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  clear: {
    width: space["2xl"],
    height: space["2xl"],
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutralTintBg,
  },
}));
