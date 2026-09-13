import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Whether the reader has asked their device for less motion.
 *
 * Every entrance animation in components/motion reads this and collapses to
 * its resting state when it is on. On the web it is the `prefers-reduced-
 * motion` media query; on native it is the OS accessibility switch. Both are
 * read once and then followed, so flipping the setting mid-session is honoured
 * on the next screen.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "matchMedia" in window) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !("matchMedia" in window)) return;
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = () => setReduced(query.matches);
      query.addEventListener?.("change", onChange);
      return () => query.removeEventListener?.("change", onChange);
    }
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (active) setReduced(on);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * The Animated driver flag, decided once.
 *
 * Native drives transforms and opacity off the JS thread; react-native-web has
 * no native thread and warns when asked for one.
 */
export const NATIVE_DRIVER = Platform.OS !== "web";
