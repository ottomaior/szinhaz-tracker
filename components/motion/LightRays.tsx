import { useEffect, useId } from "react";
import { Animated, useAnimatedValue, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Polygon, Stop } from "react-native-svg";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { overlay } from "@/theme/tokens";

/**
 * Stage light falling across a poster, after reactbits' "Light Rays".
 *
 * Seven soft beams fanning down from a point above the top edge, drawn as SVG
 * polygons with a gold-to-transparent gradient and breathed by one slow
 * opacity loop. Deliberately SVG rather than a canvas or a shader: it runs
 * identically on iOS, Android and the web with the dependency the app
 * already has, and a hero costs the GPU seven translucent triangles.
 *
 * The gold is `overlay.onImageAccent`, not the palette's accent: this sits on
 * a production photograph under a dark scrim, which is the stage in every
 * theme, and a claret ray on a photograph would read as a stain.
 *
 * `pointerEvents="none"` throughout: it is light, not a control.
 */
export function LightRays({ rays = 7, strength = 0.22, origin = 0.35 }: { rays?: number; strength?: number; origin?: number }) {
  const reduced = useReducedMotion();
  const breath = useAnimatedValue(0.75);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 3600, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(breath, { toValue: 0.75, duration: 3600, useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduced]);

  // Drawn in a 100×100 box and stretched to the hero, so the fan keeps its
  // shape whatever the poster's ratio.
  const ox = origin * 100;
  const oy = -30;
  const spread = 110;
  const beams = Array.from({ length: rays }).map((_, i) => {
    const t = i / (rays - 1) - 0.5;
    const angle = t * spread;
    const width = 4 + (i % 3) * 3;
    const rad = (a: number) => (a * Math.PI) / 180;
    const len = 170;
    const a1 = rad(angle - width / 2);
    const a2 = rad(angle + width / 2);
    return `${ox},${oy} ${ox + Math.sin(a1) * len},${oy + Math.cos(a1) * len} ${ox + Math.sin(a2) * len},${oy + Math.cos(a2) * len}`;
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: breath }]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`ray-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={overlay.onImageAccent} stopOpacity={strength} />
              <Stop offset="0.55" stopColor={overlay.onImageAccent} stopOpacity={strength * 0.35} />
              <Stop offset="1" stopColor={overlay.onImageAccent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {beams.map((points, i) => (
            <Polygon key={i} points={points} fill={`url(#ray-${id})`} />
          ))}
        </Svg>
      </View>
    </Animated.View>
  );
}
