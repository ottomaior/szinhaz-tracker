import { Platform, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import type { Palette } from "@/theme/themes";
import { duration } from "@/theme/tokens";

/**
 * What every pressable does under a finger, a pointer and a keyboard.
 *
 * One rule, applied through the primitives rather than per screen, because
 * the alternative was what the app had: a poster that tilted, a dock that
 * grew, a toast action that dimmed, and forty rows, chips and buttons that
 * did nothing at all when pressed.
 *
 *  - `row`    — a list row, a chip, a sheet option, an icon button on the
 *               page: the ground tints while pressed or hovered.
 *  - `fill`   — a filled control (the gold button): it dims a step, since a
 *               tint on gold reads as dirt.
 *  - `quiet`  — text-only controls: opacity, like `fill`, without the ground.
 *
 * The web gets `hovered` from react-native-web's Pressable; native never
 * sets it. The `transitionDuration` is a web-only style that react-native-web
 * passes through to CSS; on native the state change is instant, which is what
 * a press feels like there anyway.
 *
 * Focus is not handled here: the ring is one `:focus-visible` rule in
 * app/+html.tsx, so it is the browser's ring, at the browser's timing, on
 * every element that can take focus.
 */
export type PressKind = "row" | "fill" | "quiet";

type State = PressableStateCallbackType & { hovered?: boolean };

const WEB_TRANSITION =
  Platform.OS === "web"
    ? ({ transitionProperty: "background-color, opacity", transitionDuration: `${duration.state}ms` } as unknown as ViewStyle)
    : null;

export function pressStyle(
  kind: PressKind,
  palette: Palette,
  base?: StyleProp<ViewStyle>
): (state: PressableStateCallbackType) => StyleProp<ViewStyle> {
  return (state) => {
    const { pressed, hovered } = state as State;
    const live = pressed || !!hovered;
    return [
      base,
      WEB_TRANSITION,
      kind === "row" && live && { backgroundColor: palette.neutralTintBg },
      kind !== "row" && pressed && { opacity: 0.8 },
    ];
  };
}

/** The one look for a control that cannot be pressed right now. */
export const disabledStyle: ViewStyle = { opacity: 0.45 };
