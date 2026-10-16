// ─────────────────────────────────────────────────────────────────────────
// Shared inline SVG icon set — no icon-library dependency, keeps every
// redesigned page visually consistent (1.8px stroke, rounded joins).
// ─────────────────────────────────────────────────────────────────────────

const base = (p) => ({
  width: p.size || 20,
  height: p.size || 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.color || 'currentColor',
  strokeWidth: p.strokeWidth || 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  // Theme colours are CSS variables; inline style resolves var() reliably.
  style: p.color ? { stroke: p.color, ...p.style } : p.style,
  'aria-hidden': p['aria-label'] ? undefined : true,
  className: p.className,
});

export const Icon = {
  Home: (p) => (
    <svg {...base(p)}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.5V20h5v-6h1v6h5V9.5" />
    </svg>
  ),
  HomeFilled: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="currentColor" style={p.color ? { fill: p.color } : undefined} aria-hidden="true">
      <path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9z" />
    </svg>
  ),
  Heart: (p) => (
    <svg {...base(p)}>
      <path d="M12 20s-7-4.35-9.5-8.8C.9 8.1 2.3 5 5.4 5c1.9 0 3.2 1 4 2.2C10.4 6 11.7 5 13.6 5c3.1 0 4.5 3.1 2.9 6.2C19 15.65 12 20 12 20z" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg {...base(p)}>
      <path d="M12 3l1.8 4.9L18.5 9l-4.7 1.9L12 15.8l-1.8-4.9L5.5 9l4.7-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  ),
  Records: (p) => (
    <svg {...base(p)}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 13h6M9 16.5h6" />
    </svg>
  ),
  Profile: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-4 3.1-6.8 7-6.8s7 2.8 7 6.8" />
    </svg>
  ),
  Bell: (p) => (
    <svg {...base(p)}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  ),
  Search: (p) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  ),
  Filter: (p) => (
    <svg {...base(p)}>
      <path d="M4 6h16M7.5 12h9M11 18h2" />
    </svg>
  ),
  Star: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 14} height={p.size || 14} fill={p.filled ? (p.color || '#FFB020') : 'none'} stroke={p.color || '#FFB020'} strokeWidth="1.5">
      <path d="M12 3.5l2.5 5.6 6 .6-4.5 4 1.3 6-5.3-3.2L6.7 19.7l1.3-6-4.5-4 6-.6L12 3.5z" strokeLinejoin="round" />
    </svg>
  ),
  Phone: (p) => (
    <svg {...base(p)}>
      <path d="M5 4.5h3.2L9.7 8 8 9.5c.7 1.9 2.1 3.3 4 4l1.5-1.7 3.5 1.5V17c0 1.1-.9 2-2 2C9 19 4 14 4 8c0-1.1.9-2 2-2z" />
    </svg>
  ),
  Clock: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Chevron: (p) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth || 2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  ChevronLeft: (p) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth || 2}>
      <path d="M15 6L9 12l6 6" />
    </svg>
  ),
  Hospital: (p) => (
    <svg {...base(p)}>
      <path d="M4 21V8l8-4 8 4v13" />
      <path d="M9 21v-5h6v5" />
      <path d="M12 9v4M10 11h4" />
    </svg>
  ),
  Building: (p) => (
    <svg {...base(p)}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 8h1.2M9 11.5h1.2M9 15h1.2M13.8 8H15M13.8 11.5H15M13.8 15H15" />
      <path d="M10 20.5v-3h4v3" />
    </svg>
  ),
  Footprint: (p) => (
    <svg {...base(p)}>
      <path d="M8 3.5c-2 0-3 2-3 4.3 0 1.6.6 2.4.6 4 0 2-1.6 2.7-1.6 5 0 1.8 1.3 3.2 3 3.2 1.9 0 2.5-1.5 2.5-3.7V8c0-2.6-.5-4.5-1.5-4.5z" />
      <circle cx="6" cy="6.2" r=".9" fill={p.color || 'currentColor'} stroke="none" />
    </svg>
  ),
  Moon: (p) => (
    <svg {...base(p)}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  ),
  Droplet: (p) => (
    <svg {...base(p)}>
      <path d="M12 3.5s6 6.7 6 11a6 6 0 0 1-12 0c0-4.3 6-11 6-11z" />
    </svg>
  ),
  Shield: (p) => (
    <svg {...base(p)}>
      <path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6.1l7-2.6z" />
      <path d="M9 12l2 2 4-4.2" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth || 2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Pill: (p) => (
    <svg {...base(p)}>
      <g transform="rotate(45 12 12)">
        <rect x="5" y="9" width="14" height="6" rx="3" />
        <line x1="12" y1="9" x2="12" y2="15" />
      </g>
    </svg>
  ),
  History: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Users: (p) => (
    <svg {...base(p)}>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
    </svg>
  ),
  Video: (p) => (
    <svg {...base(p)}>
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </svg>
  ),
  VideoOff: (p) => (
    <svg {...base(p)}>
      <path d="M3 3l18 18M10 6h3.5A2.5 2.5 0 0 1 16 8.5v3l4.5-3v8.2M15.5 15.5V15A2.5 2.5 0 0 1 13 18H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5 6" />
    </svg>
  ),
  Mic: (p) => (
    <svg {...base(p)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  ),
  MicOff: (p) => (
    <svg {...base(p)}>
      <path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .8-.15 1.6-.42 2.3M12 17.5V21" />
    </svg>
  ),
  PhoneOff: (p) => (
    <svg {...base(p)}>
      <path d="M21 15.5v2.6a1.9 1.9 0 0 1-2.1 1.9A17.6 17.6 0 0 1 4 5.1 1.9 1.9 0 0 1 5.9 3h2.6a1 1 0 0 1 1 .8l.6 3a1 1 0 0 1-.3.9L8.3 9.2a14 14 0 0 0 6.5 6.5l1.5-1.5a1 1 0 0 1 .9-.3l3 .6a1 1 0 0 1 .8 1z" transform="rotate(135 12 12)" />
    </svg>
  ),
  Settings: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  Logout: (p) => (
    <svg {...base(p)}>
      <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5M16 16.5 20.5 12 16 7.5M20.5 12H9.5" />
    </svg>
  ),
  Close: (p) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Check: (p) => (
    <svg {...base(p)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  CheckCircle: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
    </svg>
  ),
  Alert: (p) => (
    <svg {...base(p)}>
      <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  ),
  Info: (p) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  ),
  Chart: (p) => (
    <svg {...base(p)}>
      <path d="M4 20V4M4 20h16M8.5 16v-4M12.5 16V8M16.5 16v-6" />
    </svg>
  ),
  Grid: (p) => (
    <svg {...base(p)}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  ),
  Stethoscope: (p) => (
    <svg {...base(p)}>
      <path d="M6 3v5a4.5 4.5 0 0 0 9 0V3M10.5 12.5V15a4.5 4.5 0 0 0 9 0v-1.5" />
      <circle cx="19.5" cy="11" r="2.2" />
    </svg>
  ),
  MapPin: (p) => (
    <svg {...base(p)}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  ),
  Refresh: (p) => (
    <svg {...base(p)}>
      <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4.5v4h4M4 13a8 8 0 0 0 14.6 4.5M20 19.5v-4h-4" />
    </svg>
  ),
  Plus: (p) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Trash: (p) => (
    <svg {...base(p)}>
      <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9.5 7V4.5h5V7" />
    </svg>
  ),
  File: (p) => (
    <svg {...base(p)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ),
  Lock: (p) => (
    <svg {...base(p)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Mail: (p) => (
    <svg {...base(p)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  Eye: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  EyeOff: (p) => (
    <svg {...base(p)}>
      <path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.8 3.4M6.5 7.6A15.5 15.5 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.1-1M9.9 10a2.8 2.8 0 0 0 4 4" />
    </svg>
  ),
  More: (p) => (
    <svg {...base(p)}>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </svg>
  ),
};

export default Icon;
