import { useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { overlay } from "@/theme/tokens";

/**
 * A card that answers the hand, after reactbits' "Tilted Card" and "Glare
 * Hover".
 *
 * Two behaviours, one per input. Under a finger the card gives a little —
 * scales to 0.98 on press and springs back — which is what makes a poster
 * feel like a thing rather than a picture. Under a mouse it tilts towards
 * the pointer by a few degrees, and a soft highlight follows across it. The
 * tilt is web-only on purpose: the pointer events that drive it exist there,
 * and a card that tilts under a thumb it cannot see would be tilting at
 * random.
 *
 * The `Pressable` is the outer element and the animated surface sits inside
 * it, so a caller may not put another Pressable inside — on the web that is
 * a <button> inside a <button>. Buttons that belong beside a card go beside
 * it in the tree, the way `TonightHero` already does.
 */
export function PressCard({
  children,
  onPress,
  style,
  surfaceStyle,
  tilt = 6,
  glare = true,
  radius = 0,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** The animated surface's own style — the rounded, clipped box. */
  surfaceStyle?: StyleProp<ViewStyle>;
  /** Maximum tilt, in degrees. 0 turns the pointer tilt off. */
  tilt?: number;
  glare?: boolean;
  /** The surface's corner radius, so the glare clips to it. */
  radius?: number;
}) {
  const reduced = useReducedMotion();
  const scale = useAnimatedValue(1);
  const rx = useAnimatedValue(0);
  const ry = useAnimatedValue(0);
  const glareX = useAnimatedValue(-1);
  // The surface's size, for the glare's travel. State rather than a ref so
  // the interpolation below is rebuilt once the card has been measured.
  const [size, setSize] = useState({ w: 1, h: 1 });

  const spring = (v: Animated.Value, to: number) =>
    Animated.spring(v, { toValue: to, useNativeDriver: NATIVE_DRIVER, speed: 24, bounciness: 6 }).start();

  const web = Platform.OS === "web" && !reduced && tilt > 0;

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onPressIn={() => !reduced && spring(scale, 0.98)}
      onPressOut={() => !reduced && spring(scale, 1)}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })}
      // Pointer events are what react-native-web maps hover to; on native the
      // props are inert and the card simply never tilts.
      onPointerMove={
        web
          ? (e) => {
              // Against the card's own box, not `offsetX`: react-native-web
              // hands over the raw DOM event, whose offsets are relative to
              // whichever child the pointer happens to be over.
              const box = (e.currentTarget as unknown as HTMLElement).getBoundingClientRect();
              const px = (e.nativeEvent.clientX - box.left) / (box.width || 1) - 0.5;
              const py = (e.nativeEvent.clientY - box.top) / (box.height || 1) - 0.5;
              rx.setValue(-py * tilt);
              ry.setValue(px * tilt);
              glareX.setValue(px * 2);
            }
          : undefined
      }
      onPointerLeave={
        web
          ? () => {
              spring(rx, 0);
              spring(ry, 0);
              Animated.timing(glareX, { toValue: -1, duration: 300, useNativeDriver: NATIVE_DRIVER }).start();
            }
          : undefined
      }
      style={style}
    >
      <Animated.View
        style={[
          surfaceStyle,
          {
            borderRadius: radius,
            overflow: "hidden",
            transform: [
              { perspective: 900 },
              { scale },
              { rotateX: rx.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) },
              { rotateY: ry.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) },
            ],
          },
        ]}
      >
        {children}
        {glare && web && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.glare,
              {
                transform: [
                  { translateX: glareX.interpolate({ inputRange: [-1, 1], outputRange: [-size.w, size.w] }) },
                  { rotate: "18deg" },
                ],
              },
            ]}
          >
            <View style={styles.glareBand} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glare: { alignItems: "center", justifyContent: "center" },
  // A tall soft band, moved across the card by `glareX`. White at low alpha
  // rather than a palette token: it is light on a photograph, in every theme.
  glareBand: { width: "38%", height: "200%", backgroundColor: overlay.glare },
});
