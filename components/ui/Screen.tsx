import type { ReactNode } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { maxWidth } from "@/theme/tokens";

/**
 * Centres and caps the width of a screen's content.
 *
 * Every screen was a single full-bleed column, which is right on a phone and
 * wrong the moment the app is opened in a desktop browser — the web export is
 * a shipping surface here, not a preview. At 1400px the two-up poster grid on
 * Discover stretched each tile to roughly 580 by 870 points: a browsing
 * thumbnail rendered larger than the play detail hero.
 *
 * `width="reading"` is the narrower cap, for screens that are mostly prose. A
 * synopsis set across a full desktop window runs well past the ~70 characters
 * a line can carry before the eye starts losing its place on the way back to
 * the left margin.
 *
 * On a phone this renders as a plain full-width View — the cap is simply never
 * reached — so it is safe to wrap every screen in one.
 */
export function Screen({
  children,
  width = "content",
  style,
}: {
  children: ReactNode;
  width?: keyof typeof maxWidth;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.outer, style]}>
    <View style={[styles.inner, { maxWidth: maxWidth[width] }]}>{children}</View>
  </View>;
}

/**
 * The same width cap, for content already inside a ScrollView.
 *
 * `Screen` takes `flex: 1` to fill the viewport, which is wrong inside scroll
 * content — it would collapse the column to the visible height. This one sizes
 * to its children instead, so a screen can run a full-bleed hero and then pull
 * the text back into a readable column beneath it.
 */
export function ContentColumn({
  children,
  width = "reading",
  style,
}: {
  children: ReactNode;
  width?: keyof typeof maxWidth;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.column, { maxWidth: maxWidth[width] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
  column: {
    width: "100%",
    alignSelf: "center",
  },
});
