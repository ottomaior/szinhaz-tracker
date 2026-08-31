import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function HomeIcon({ size = 21, color = "#80716d", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11.5 12 4l9 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CompassIcon({ size = 21, color = "#80716d", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m21 21-4.3-4.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TicketIcon({ size = 21, color = "#80716d", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UserIcon({ size = 21, color = "#80716d", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = "#120505", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = "#b9a69e", strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 17, color = "#80716d", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m21 21-4.3-4.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 16, color = "#80716d", strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.8 7.6a4.6 4.6 0 0 0-7.8-3.3L12 5.3l-1-1a4.6 4.6 0 0 0-7.8 3.3c0 2 1 3.6 2.5 5.1L12 19l6.3-6.3c1.5-1.5 2.5-3.1 2.5-5.1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CommentIcon({ size = 16, color = "#80716d", strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 9 9 0 0 1-3.6-.8L3 20l1-4.8A8.4 8.4 0 1 1 21 11.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 17, color = "#f5ede4", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color = "#f5ede4", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ShareIcon({ size = 16, color = "#f5ede4", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={6} cy={12} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={18} cy={19} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CalendarIcon({ size = 16, color = "#80716d", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3.5 9.5h17M8 3v4M16 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon({ size = 16, color = "#80716d", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CameraIcon({ size = 15, color = "#80716d", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 7 9.5 4h5L16 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13.5} r={3.4} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SettingsIcon({ size = 19, color = "#f5ede4", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.4-2.2.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.2-.9-2 3.4L4.6 10.5a7.6 7.6 0 0 0 0 3L2.7 15l2 3.4 2.2-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.2.9 2-3.4z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
