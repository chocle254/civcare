// ─────────────────────────────────────────────────────────────────────────
// CivCare shared design tokens.
//
// Direction: clean, light "modern health app" — soft lavender-tinted
// background, white elevated cards, one confident blue/violet primary for
// actions + navigation, teal for "live/positive" signal, warm coral only
// for vitals/alerts. Generous radii, no dark glass, no neon.
//
// Import this into any page to keep the app visually consistent:
//   import { theme } from '../../styles/theme';
// ─────────────────────────────────────────────────────────────────────────

export const theme = {
  color: {
    bg:            '#F1F3FB',
    bgElevated:    '#FFFFFF',
    surface:       '#FFFFFF',
    surfaceMuted:  '#F6F7FC',
    surfaceRaised: '#EEF1FB',
    hairline:      'rgba(20,22,43,0.07)',
    hairlineStrong:'rgba(20,22,43,0.12)',

    ink:      '#161826',
    inkDim:   'rgba(22,24,38,0.58)',
    inkFaint: 'rgba(22,24,38,0.38)',
    onDark:   '#FFFFFF',
    onDarkDim:'rgba(255,255,255,0.78)',
    onDarkFaint: 'rgba(255,255,255,0.55)',

    // Primary — actions, active nav, brand
    blue:     '#4C6FFF',
    blueDim:  'rgba(76,111,255,0.12)',
    blueDeep: '#3A56D4',
    violet:   '#8B6CF6',
    heroFrom: '#6E7BFA',
    heroTo:   '#8B6CF6',

    // Secondary — "live", positive, on-track
    teal:     '#16B378',
    tealDim:  'rgba(22,179,120,0.12)',

    // Vitals / alerts accents
    coral:    '#FF6584',
    coralDim: 'rgba(255,101,132,0.12)',
    amber:    '#FFB020',
    amberDim: 'rgba(255,176,32,0.12)',
    sky:      '#31B4E8',
    skyDim:   'rgba(49,180,232,0.12)',
    mint:     '#22C79A',
    mintDim:  'rgba(34,199,154,0.12)',
    pink:     '#F2569B',
    pinkDim:  'rgba(242,86,155,0.12)',
  },
  font: {
    display: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    ui:      "'Inter', -apple-system, 'Segoe UI', sans-serif",
    mono:    "'IBM Plex Mono', 'Courier New', monospace",
  },
  radius: { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 },
  shadow: {
    card: '0 1px 2px rgba(20,22,43,0.04), 0 8px 24px rgba(20,22,43,0.06)',
    raised: '0 4px 10px rgba(20,22,43,0.06), 0 16px 32px rgba(76,111,255,0.10)',
    nav: '0 -2px 16px rgba(20,22,43,0.05)',
  },
  fontImport:
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');",
};
