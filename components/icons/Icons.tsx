import Svg, { Path, Circle, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { strokePaint } from "@/components/icons/svgPaint";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/**
 * The palette defaults below are default *parameters*, which JavaScript
 * evaluates on every call rather than once at import — so each one reads the
 * theme that is on at the moment the icon renders. See theme/colors.ts.
 *
 * That leaves only the question of whether an icon re-renders when the theme
 * changes, and it does: an icon is always drawn by a component that holds a
 * stylesheet, those subscribe to the theme through `makeStyles`, and nothing in
 * this app is memoised in between.
 */

export function HomeIcon({ size = 21, color = colors.textFaint, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11.5 12 4l9 7.5" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CompassIcon({ size = 21, color = colors.textFaint, strokeWidth = 1.8 }: IconProps) {
  // A real compass rose, not a second magnifier — the Discover tab and the
  // search field inside it used to share the exact same glyph.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path
        d="M15.6 8.4 13.9 13.9 8.4 15.6 10.1 10.1z"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TicketIcon({ size = 21, color = colors.textFaint, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UserIcon({ size = 21, color = colors.textFaint, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = colors.onAccent, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = colors.textDim, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 17, color = colors.textFaint, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path d="m21 21-4.3-4.3" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 16, color = colors.textFaint, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.8 7.6a4.6 4.6 0 0 0-7.8-3.3L12 5.3l-1-1a4.6 4.6 0 0 0-7.8 3.3c0 2 1 3.6 2.5 5.1L12 19l6.3-6.3c1.5-1.5 2.5-3.1 2.5-5.1z"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CommentIcon({ size = 16, color = colors.textFaint, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 9 9 0 0 1-3.6-.8L3 20l1-4.8A8.4 8.4 0 1 1 21 11.5z"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 17, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 17, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Leaving the app — on the button that opens the theatre's own page. */
export function ExternalLinkIcon({ size = 14, color = colors.gold, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The affordance on a control that opens a list of options. */
export function ChevronDownIcon({ size = 13, color = colors.textDim, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 9 7 7 7-7" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Marks the chosen option in a list. */
export function CheckIcon({ size = 16, color = colors.gold, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 13 4.5 4.5L19 7" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 6 12 12M18 6 6 18" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ShareIcon({ size = 16, color = colors.text, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={2.4} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Circle cx={6} cy={12} r={2.4} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Circle cx={18} cy={19} r={2.4} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" {...strokePaint(color)} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CalendarIcon({ size = 16, color = colors.textFaint, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={2.5} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path d="M3.5 9.5h17M8 3v4M16 3v4" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon({ size = 16, color = colors.textFaint, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.4} {...strokePaint(color)} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CameraIcon({ size = 15, color = colors.textFaint, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={2.5} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path d="M8 7 9.5 4h5L16 7" {...strokePaint(color)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13.5} r={3.4} {...strokePaint(color)} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SettingsIcon({ size = 19, color = colors.text, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} {...strokePaint(color)} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.4-2.2.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.2-.9-2 3.4L4.6 10.5a7.6 7.6 0 0 0 0 3L2.7 15l2 3.4 2.2-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.2.9 2-3.4z"
        {...strokePaint(color)}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
