import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { NATIVE_DRIVER, useReducedMotion } from "@/hooks/useReducedMotion";
import { colors } from "@/theme/colors";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { gutter, radius, space } from "@/theme/tokens";
import { makeStyles } from "@/theme/styles";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";

/**
 * One line that answers an action, and sometimes takes it back (T-085).
 *
 * Successes used to be silent and the destructive things had no way back
 * except a dialog in front of them. A toast is the other shape: do the thing,
 * say so, and for the few seconds it is on screen offer to undo it. The undo
 * is the point, not the message — a "removed" with no way back is a receipt.
 *
 * One at a time. A second toast replaces the first rather than stacking,
 * because two of them is a log, and the action on the older one was almost
 * certainly meant for something the reader has moved on from.
 *
 * Bottom of the screen on a phone, above the tab bar and the raised "+", and
 * top-right on a wide screen where the bottom is a long way from the eye.
 * Respects reduced motion like everything in `components/motion/`.
 */
export type ToastOptions = {
  message: string;
  /** A single text action — "Visszavonás" — that also dismisses the toast. */
  action?: { label: string; onPress: () => void | Promise<void> };
  /** Milliseconds on screen. Longer by default when there is something to undo. */
  duration?: number;
};

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => undefined, dismiss: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

type Active = ToastOptions & { id: number };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setActive(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      const id = ++counter.current;
      setActive({ ...options, id });
      const duration = options.duration ?? (options.action ? 6000 : 3500);
      timer.current = setTimeout(() => {
        timer.current = null;
        setActive((current) => (current?.id === id ? null : current));
      }, duration);
    },
    []
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {active && <ToastView key={active.id} toast={active} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

/**
 * Below the floating tab bar's top edge on a phone: the bar is 64pt tall
 * and sits `space.md` above the safe area, and the raised "+" reaches
 * another ~22pt above it. The toast clears all of that.
 */
const PHONE_BOTTOM_CLEARANCE = 112;

function ToastView({ toast, onDismiss }: { toast: Active; onDismiss: () => void }) {
  const styles = useStyles();
  const wide = useAtLeast("expanded");
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const fontsLoaded = useAppFonts();
  const progress = useAnimatedValue(reduced ? 1 : 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reduced) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress, reduced]);

  async function handleAction() {
    if (!toast.action || busy) return;
    setBusy(true);
    try {
      await toast.action.onPress();
    } finally {
      onDismiss();
    }
  }

  const placement = wide
    ? { top: insets.top + 84, right: gutter, width: 380 }
    : { bottom: insets.bottom + PHONE_BOTTOM_CLEARANCE, left: gutter, right: gutter };
  const slideFrom = wide ? -12 : 16;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      <Animated.View
        role={Platform.OS === "web" ? "status" : undefined}
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          placement,
          {
            opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [slideFrom, 0] }) }],
          },
        ]}
      >
        <Text variant="bodySmall" style={{ flex: 1 }} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.action && (
          <Pressable
            onPress={handleAction}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontFamily: bodyFont(fontsLoaded, "bold"), fontSize: 13, color: colors.gold }}>
              {toast.action.label}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={strings.feedback.dismiss}
          style={styles.close}
        >
          <Text variant="caption" tone="faint">
            ✕
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors, elevation) => StyleSheet.create({
  card: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...elevation.floating,
  },
  action: { paddingHorizontal: space.xs, paddingVertical: space.xs },
  close: { paddingLeft: space.xs },
}));
