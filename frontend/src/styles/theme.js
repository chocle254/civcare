// ─────────────────────────────────────────────────────────────────────────
// CivCare shared design tokens.
//
// Direction: light "modern health app" with tactile depth — soft
// lavender gradient background, frosted-glass cards, embossed
// (skeuomorphic) icon bubbles, and springy motion throughout.
//
// Import this into any page to keep the app visually consistent:
//   import { theme } from '../../styles/theme';
// ─────────────────────────────────────────────────────────────────────────

export const theme = {
  color: {
    bg:            '#F1F3FB',
    // layered radial blobs used as the page backdrop so glass cards have
    // something soft to blur — this is what makes the frosted-glass
    // surfaces read as glass instead of flat white.
    bgGradient: `
      radial-gradient(760px 480px at 8% -8%, rgba(108,124,250,0.16), transparent 60%),
      radial-gradient(620px 460px at 105% 12%, rgba(139,108,246,0.14), transparent 55%),
      radial-gradient(700px 520px at -5% 70%, rgba(34,199,154,0.10), transparent 55%),
      radial-gradient(640px 480px at 100% 100%, rgba(49,180,232,0.10), transparent 55%),
      #F1F3FB
    `,
    bgElevated:    '#FFFFFF',
    surface:       '#FFFFFF',
    surfaceMuted:  '#F6F7FC',
    surfaceRaised: '#EEF1FB',
    hairline:      'rgba(20,22,43,0.07)',
    hairlineStrong:'rgba(20,22,43,0.12)',

    // Glassmorphism — frosted translucent surfaces over bgGradient
    glass:        'rgba(255,255,255,0.62)',
    glassStrong:  'rgba(255,255,255,0.78)',
    glassBorder:  'rgba(255,255,255,0.65)',
    glassShadow:  '0 8px 30px rgba(31,38,80,0.10)',
    blur:         'blur(18px) saturate(160%)',

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
    glass: '0 8px 30px rgba(31,38,80,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
    // skeuomorphic "embossed bubble" — soft light from top-left, soft
    // shadow bottom-right, used for icon wraps / avatars / rings
    embossOut: '-4px -4px 10px rgba(255,255,255,0.7), 4px 6px 14px rgba(31,38,80,0.10)',
    embossIn:  'inset 2px 2px 5px rgba(31,38,80,0.10), inset -2px -2px 5px rgba(255,255,255,0.7)',
  },
  ease: {
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  fontImport:
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');",
  // Shared CSS for interactive press/tap feedback + reduced-motion safety.
  // Append this string inside each page's <style> block.
  motionCss: `
    .cc-press { transition: transform 0.18s var(--cc-spring, cubic-bezier(0.34,1.56,0.64,1)), box-shadow 0.18s ease; }
    .cc-press:active { transform: scale(0.96); }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
    }
  `,
};

