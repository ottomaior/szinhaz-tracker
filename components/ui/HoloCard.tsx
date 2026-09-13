import { useEffect, useId, type ReactNode } from "react";
import { Animated, useAnimatedValue, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { useTheme } from "@/contexts/ThemeContext";
import { themes } from "@/theme/themes";
import { overlay, radius, space } from "@/theme/tokens";
import { BrandMark } from "@/components/icons/BrandMark";
import { makeStyles } from "@/theme/styles";

/**
 * The reader's own card, after reactbits' "Profile Card".
 *
 * A claret-to-plum ground with a slow diagonal sheen crossing it, the
 * proscenium mark stamped in the corner like a season ticket's crest, and
 * whatever the caller puts on it — name, handle, the season's tally. Dark in
 * every theme, deliberately: on the printed themes it is the one lit object
 * on the page, the way a ticket is the one glossy thing in a programme, and
 * the text on it takes `overlay` colours for the reason the poster captions
 * do.
 *
 * The sheen is a translucent band moved by one looping timing; reduced
 * motion parks it off the card.
 */
export function HoloCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const sheen = useAnimatedValue(0);
  // Gradient stops need literal colours — see components/icons/svgPaint.ts.
  const theme = themes[useTheme().resolved];

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(2600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, reduced]);

  return (
    <View style={[styles.card, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`holo-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={CARD_TOP} />
              <Stop offset="0.55" stopColor={CARD_MID} />
              <Stop offset="1" stopColor={CARD_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#holo-${id})`} />
        </Svg>
      </View>
      {!reduced && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheen,
            {
              transform: [
                { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-320, 720] }) },
                { rotate: "20deg" },
              ],
            },
          ]}
        >
          <View style={[styles.band, { backgroundColor: theme.gold, opacity: 0.08 }]} />
          <View style={[styles.band, { width: 26, backgroundColor: "#ffffff", opacity: 0.09 }]} />
          <View style={[styles.band, { backgroundColor: theme.gold, opacity: 0.08 }]} />
        </Animated.View>
      )}
      <View style={styles.stamp} pointerEvents="none">
        <BrandMark size={44} color={overlay.onImageAccent} />
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

// The card's own ground: the claret of the curtain in the dark theme, taken
// through plum to near-black. Literals, because the card is the same object in
// every theme.
const CARD_TOP = "#3a1826";
const CARD_MID = "#1c0d13";
const CARD_BOTTOM = "#120609";

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.goldTintBorder,
    boxShadow: `0 24px 48px -24px ${colors.shadow}`,
  },
  sheen: { position: "absolute", top: -200, bottom: -200, left: 0, width: 120, flexDirection: "row", gap: 10 },
  band: { width: 40, height: "100%" },
  stamp: { position: "absolute", top: space.lg, right: space.lg, opacity: 0.9 },
  body: { padding: space.xl },
}));
