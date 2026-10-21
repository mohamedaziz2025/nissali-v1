// Icônes au trait fin (24 × 24), cohérentes avec l'app mobile.
const PATHS = {
  send: <path d="M4 12 20 4l-4.5 16-3.8-6.7z M11.7 13.3 20 4" />,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  reply: <path d="M9.5 7 4.5 12l5 5M5 12h9a5.5 5.5 0 0 1 5.5 5.5V19" />,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" /><circle cx="9.3" cy="10" r=".9" /><circle cx="14.7" cy="10" r=".9" /></>,
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" /></>,
  flag: <path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11" />,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="8" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.8" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.8" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.8" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19.5c.6-3.3 3.3-5.5 6.5-5.5s5.9 2.2 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.5c1.6.8 2.7 2.6 3 5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" /></>,
  stethoscope: <><path d="M6 3.5v5a4.5 4.5 0 0 0 9 0v-5M6 3.5H4.5M15 3.5h1.5M10.5 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19.5" cy="11" r="2" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
  layers: <><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></>,
  tag: <><path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8 8z" /><circle cx="8" cy="8" r="1.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  star: <path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />,
  book: <><path d="M4 5.5C6.4 4.5 9.2 4.6 12 6.2c2.8-1.6 5.6-1.7 8-.7v13c-2.4-1-5.2-.9-8 .7-2.8-1.6-5.6-1.7-8-.7z" /><path d="M12 6.2v13" /></>,
  quote: <path d="M7.5 11H4.5V7.5a3 3 0 0 1 3-3M16.5 11h-3V7.5a3 3 0 0 1 3-3M4.5 11v3.5a3 3 0 0 0 3 3h0V11M13.5 11v3.5a3 3 0 0 0 3 3h0V11" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  shield: <><path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4" /><path d="M12 7.5V12l3 2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5h6v2M3 12.5h18" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  chevronRight: <path d="m9.5 5 7 7-7 7" />,
  chevronDown: <path d="m5 9.5 7 7 7-7" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: <path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16l-4-4 4-4M6 12h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  euro: <path d="M18 6.5a6.5 6.5 0 1 0 0 11M4.5 10.5h9M4.5 13.5h9" />,
  trendUp: <path d="m3.5 16 6-6 4 4 7-7M15 7h5.5v5.5" />,
  heart: <path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.5-7.5 10-7.5 10z" />,
  video: <><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="m15.5 10.5 5.5-3v9l-5.5-3z" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  file: <><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10z" /><path d="M14 3.5v5h5M9 13h6M9 16.5h4" /></>,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-4.5" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 17.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-1.5" />,
  printer: <><path d="M7 8.5V3.5h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A2 2 0 0 1 5.5 8.5h13a2 2 0 0 1 2 2v5A1.5 1.5 0 0 1 19 17h-2" /><rect x="7" y="14" width="10" height="6.5" rx="1" /></>,
  note: <><path d="M5 4.5h14v10l-5 5H5z" /><path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4" /></>,
  alert: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4M12 16.8h.01" /></>,
  sparkle: <path d="M12 3.5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />,
  swap: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  external: <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 6 7h4.5" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
};

export default function Icon({ name, size, className, title }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {p}
    </svg>
  );
}

export function Logo({ size = 24 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M30 71.5V49a20 20 0 0 1 40 0v22.5" fill="none" stroke="currentColor" strokeWidth="8.5" strokeLinecap="round" />
      <path d="M50 52V71.5" stroke="currentColor" strokeWidth="8.5" strokeLinecap="round" />
    </svg>
  );
}
