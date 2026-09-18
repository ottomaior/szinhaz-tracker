import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * One tap on the hand, at the moments that deserve one (T-086).
 *
 * `light` answers a choice being made — a mask in the rating row, a poster
 * ticked in the grid. `selection` answers a control changing state — a chip,
 * a palette, a toggle. `success` answers something being saved, `warning`
 * something being removed. Four words rather than expo-haptics' full menu,
 * so the app cannot accumulate seven slightly different ticks.
 *
 * A no-op on the web, and on any device that refuses — a haptic that throws
 * is not worth a caught promise at every call site, so the promise is
 * swallowed here.
 */
export type HapticKind = "light" | "selection" | "success" | "warning";

export function haptic(kind: HapticKind): void {
  if (Platform.OS === "web") return;
  let call: Promise<void>;
  switch (kind) {
    case "light":
      call = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "selection":
      call = Haptics.selectionAsync();
      break;
    case "success":
      call = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      call = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
  }
  call.catch(() => undefined);
}
