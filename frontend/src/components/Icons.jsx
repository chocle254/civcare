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
});

export const Icon = {
  Home: (p) => (
    <svg {...base(p)}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.5V20h5v-6h1v6h5V9.5" />
    </svg>
  ),
  HomeFilled: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill={p.color || 'currentColor'}>
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
};

export default Icon;
