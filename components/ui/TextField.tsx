import type { Ref } from "react";
import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import { inputFontSize } from "@/theme/type";
import { hairlineWidth, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { makeStyles, useColors } from "@/theme/styles";

/**
 * Every text field in the app.
 *
 * A `TextInput` cannot be a `Text`, so it is the one element that has to be
 * told its font by hand — and nine screens told it, each with its own copy of
 * the same six lines of chrome, which is how the same box came to have three
 * paddings. The face, the 16px size that keeps iOS Safari from zooming
 * (theme/type.ts), the surface and the hairline live here now; a screen says
 * only what is different about its field.
 *
 * `multiline` fields grow from a minimum a comfortable sentence tall and put
 * the caret at the top, where a note starts. `bare` is the input alone — the
 * face, the size, the colour — for a control that draws its own chrome
 * around it, which is the search field and nothing else.
 */
/**
 * A function declaration with `ref` as an ordinary prop, rather than
 * `forwardRef(...)`: React 19 passes `ref` through to a function component,
 * and a `forwardRef` call at module scope reads `colors.textFaint` in a way
 * theme/palette.test.ts cannot tell apart from a frozen palette.
 */
export function TextField({
  ref,
  style,
  multiline,
  placeholderTextColor,
  bare = false,
  ...rest
}: TextInputProps & { ref?: Ref<TextInput>; style?: StyleProp<TextStyle>; bare?: boolean }) {
  const styles = useStyles();
  const fontsLoaded = useAppFonts();
  const palette = useColors();
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={placeholderTextColor ?? palette.textFaint}
      {...rest}
      style={[bare ? styles.bare : styles.field, multiline && styles.multiline, { fontFamily: bodyFont(fontsLoaded) }, style]}
    />
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.lg,
    fontSize: inputFontSize,
    color: colors.text,
  },
  bare: {
    fontSize: inputFontSize,
    color: colors.text,
  },
  multiline: {
    minHeight: space["5xl"],
    textAlignVertical: "top",
  },
}));
