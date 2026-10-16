// ─────────────────────────────────────────────────────────────────────────
// CivCare shared design tokens (JS mirror of the CSS tokens in index.css).
//
// Direction: calm, clinical, high-legibility. Solid surfaces with hairline
// borders, one action blue, and status colours reserved for meaning.
//
// Every value is a CSS custom property, so inline styles automatically
// follow the light/dark palette defined in index.css. Keys are kept stable
// from the earlier theme so existing pages keep working; the old "glass",
// "gradient" and "emboss" keys now resolve to solid, restrained equivalents.
//
//   import { theme } from '../../styles/theme';
// ─────────────────────────────────────────────────────────────────────────

const v = (name) => `var(--cc-${name})`;

export const theme = {
  color: {
    bg:            v('bg'),
    bgGradient:    v('bg'),
    bgElevated:    v('surface'),
    surface:       v('surface'),
    surfaceMuted:  v('surface-2'),
    surfaceRaised: v('surface-3'),
    hairline:      v('border'),
    hairlineStrong:v('border-strong'),

    // Former glass surfaces → solid
    glass:        v('surface'),
    glassStrong:  v('surface'),
    glassBorder:  v('border'),
    glassShadow:  v('shadow-sm'),
    blur:         'none',

    ink:      v('text'),
    inkDim:   v('muted'),
    inkFaint: v('faint'),
    onDark:   '#FFFFFF',
    onDarkDim:'rgba(255,255,255,0.82)',
    onDarkFaint: 'rgba(255,255,255,0.62)',
    onPrimary: v('on-primary'),

    // Primary — actions, active nav, brand
    blue:     v('primary'),
    blueDim:  v('primary-soft'),
    blueDeep: v('primary-hover'),
    blueBorder: v('primary-border'),
    violet:   v('info'),
    violetDim:v('info-soft'),
    // Brand hero surfaces carry white text in both modes, so they stay a fixed deep blue.
    heroFrom: '#1769aa',
    heroTo:   '#12578e',

    // Positive / live / on-track
    teal:     v('success'),
    tealDim:  v('success-soft'),
    mint:     v('success'),
    mintDim:  v('success-soft'),

    // Status accents
    coral:    v('danger'),
    coralDim: v('danger-soft'),
    pink:     v('danger'),
    pinkDim:  v('danger-soft'),
    amber:    v('warning'),
    amberDim: v('warning-soft'),
    gold:     v('warning'),
    sky:      v('info'),
    skyDim:   v('info-soft'),
  },
  font: {
    display: v('font'),
    ui:      v('font'),
    mono:    v('mono'),
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
  shadow: {
    card:      v('shadow-sm'),
    raised:    v('shadow'),
    nav:       v('shadow-sm'),
    glass:     v('shadow-sm'),
    embossOut: 'none',
    embossIn:  'none',
  },
  ease: {
    spring: 'cubic-bezier(0.2, 0, 0, 1)',
    smooth: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  // Fonts are loaded globally by index.css; kept for pages that interpolate it.
  fontImport: '',
  // Shared press feedback + reduced-motion safety, appended in page <style>s.
  motionCss: `
    .cc-press { transition: transform 0.12s cubic-bezier(0.2,0,0,1), background 0.15s ease, border-color 0.15s ease; }
    .cc-press:active { transform: translateY(1px); }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
    }
  `,
};
