// Icônes au trait fin (5.1 Style : « icônes au trait fin »).
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

const ICONS = {
  home: <Path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  cycle: <Circle cx="12" cy="12" r="8.5" />,
  fasts: (
    <>
      <Path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0" />
      <Path d="M12 6.5V4M5.6 9.6 4 8M18.4 9.6 20 8" />
    </>
  ),
  practitioners: (
    <>
      <Circle cx="11" cy="8" r="4" />
      <Path d="M3.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5M18 3v5M15.5 5.5h5" />
    </>
  ),
  blog: (
    <>
      <Path d="M3.5 5.5C6 4.5 9 4.6 12 6.2c3-1.6 6-1.7 8.5-.7v13c-2.5-1-5.5-.9-8.5.7-3-1.6-6-1.7-8.5-.7z" />
      <Path d="M12 6.2v13" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="m16 16 4.5 4.5" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
      <Circle cx="12" cy="15" r="1.6" />
    </>
  ),
  compass: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  volume: (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  stop: <Rect x="7" y="7" width="10" height="10" rx="2" />,
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 20.5c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" />
    </>
  ),
  chevronLeft: <Path d="m14.5 5-7 7 7 7" />,
  chevronRight: <Path d="m9.5 5 7 7-7 7" />,
  chevronDown: <Path d="m5 9.5 7 7 7-7" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  drop: <Path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  moon: <Path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  sunrise: (
    <>
      <Path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 6.5V9M5.6 10.6 7 12M18.4 10.6 17 12" />
      <Path d="m9.5 5.5 2.5-2.5 2.5 2.5" />
    </>
  ),
  sunset: (
    <>
      <Path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M5.6 10.6 7 12M18.4 10.6 17 12" />
      <Path d="m9.5 4 2.5 2.5L14.5 4M12 3v3.5" />
    </>
  ),
  sliders: <Path d="M4 6.5h10M18 6.5h2M4 17.5h4M12 17.5h8M14 4v5M8 15v5" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  heart: <Path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.5-7.5 10-7.5 10z" />,
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  logout: <Path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16l-4-4 4-4M6 12h10" />,
  scale: (
    <>
      <Rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <Path d="M8 9.5a4.5 4.5 0 0 1 8 0M12 9.5l1.5-2" />
    </>
  ),
  bulb: (
    <>
      <Path d="M9 18h6M10 21h4" />
      <Path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  bellOff: (
    <>
      <Path d="M8.5 4.8A6 6 0 0 1 18 11v4.5M6 9.5v7L4.5 18H17" />
      <Path d="M10 20.5a2 2 0 0 0 4 0M3.5 3.5l17 17" />
    </>
  ),
  history: (
    <>
      <Path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <Path d="M3.5 4v4.5H8M12 7.5V12l3 2" />
    </>
  ),
  chat: <Path d="M20.5 11.5c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.6c-1-1.3-1.7-2.8-1.7-4.4C3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.5z" />,
  mail: (
    <>
      <Rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <Path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: <Path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  video: (
    <>
      <Rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
      <Path d="m15.5 10.5 5.5-3v9l-5.5-3z" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <Circle cx="12" cy="10" r="2.3" />
    </>
  ),
  locate: (
    <>
      <Circle cx="12" cy="12" r="6" />
      <Circle cx="12" cy="12" r="1.8" />
      <Path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5" />
    </>
  ),
  star: <Path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  edit: <Path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  share: <Path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />,
  swap: <Path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  baby: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M9 10.5h.01M15 10.5h.01M9.5 14.5c1.5 1.3 3.5 1.3 5 0" />
    </>
  ),
  sparkle: <Path d="M12 3.5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />,
  chart: <Path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />,
  list: <Path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  users: (
    <>
      <Circle cx="9" cy="8.5" r="3.5" />
      <Path d="M2.5 19.5c.6-3.3 3.3-5.5 6.5-5.5s5.9 2.2 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.5c1.6.8 2.7 2.6 3 5" />
    </>
  ),
  briefcase: (
    <>
      <Rect x="3" y="7" width="18" height="13" rx="2.5" />
      <Path d="M9 7V5h6v2M3 12.5h18" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  arrowUp: <Path d="M12 20V4M5.5 10.5 12 4l6.5 6.5" />,
  globe: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17" />
      <Path d="M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5S14.4 18.4 12 20.5c-2.4-2.1-3.6-5.4-3.6-8.5S9.6 6.1 12 3.5z" />
    </>
  ),
  // Chapelet (dhikr) : un anneau de grains et son pompon.
  beads: (
    <>
      <Circle cx="12" cy="4.6" r="1.5" />
      <Circle cx="17.2" cy="6.8" r="1.5" />
      <Circle cx="19.4" cy="12" r="1.5" />
      <Circle cx="17.2" cy="17.2" r="1.5" />
      <Circle cx="6.8" cy="17.2" r="1.5" />
      <Circle cx="4.6" cy="12" r="1.5" />
      <Circle cx="6.8" cy="6.8" r="1.5" />
      <Path d="M12 17.5v4M10.5 21.5h3" />
    </>
  ),
  undo: <Path d="M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12" />,
  reset: <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />,
  vibrate: (
    <>
      <Rect x="8" y="4" width="8" height="16" rx="2" />
      <Path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3" />
    </>
  ),
  note: (
    <>
      <Path d="M5.5 4h13a1 1 0 0 1 1 1v9.5L14.5 20h-9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <Path d="M19.5 14.5h-4a1 1 0 0 0-1 1V20M8.5 9h7M8.5 12.5h4" />
    </>
  ),
  repeat: <Path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3M20 12.5v1a4 4 0 0 1-4 4H4" />,
  external: <Path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 6 7h4.5" />,
  eye: (
    <>
      <Path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M3.5 3.5l17 17M10.6 10.6a3 3 0 0 0 4.2 4.2M9.5 5.2A10.5 10.5 0 0 1 12 5c6 0 9.5 7 9.5 7a18.6 18.6 0 0 1-3.2 4.4M6.6 6.6A18.8 18.8 0 0 0 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 4.4-.9" />
    </>
  ),
};

export default function Icon({ name, size = 24, color = colors.prune, strokeWidth = 1.8, fill = 'none' }) {
  const shape = ICONS[name];
  if (!shape) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {shape}
    </Svg>
  );
}

