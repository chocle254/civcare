// ─────────────────────────────────────────────────────────────────────────
// CivCare shared design tokens.
//
// Direction: calm clinical confidence, not "generic AI app." Deep ink
// background instead of pure black; one warm accent (care/warmth) plus one
// cool accent (vitals/positive state) instead of a rainbow of neon gradients.
// No blurred colour orbs, no glow-everything — trust reads as restraint.
//
// Import this into any page to keep the app visually consistent:
//   import { theme } from '../../styles/theme';
// ─────────────────────────────────────────────────────────────────────────

export const theme = {
  color: {
    bg:            '#0A0D12',
    bgElevated:    '#0F131A',
    surface:       '#12161D',
    surfaceRaised: '#1A1F28',
    hairline:      'rgba(237,239,242,0.08)',
    hairlineStrong:'rgba(237,239,242,0.14)',

    ink:      '#EDEFF2',
    inkDim:   'rgba(237,239,242,0.60)',
    inkFaint: 'rgba(237,239,242,0.36)',

    // Primary — warmth, care, the brand's one bold move
    gold:     '#E0A458',
    goldDim:  'rgba(224,164,88,0.14)',
    goldText: '#F0C286',

    // Secondary — vitals / positive / "on track"
    teal:     '#34B8A6',
    tealDim:  'rgba(52,184,166,0.14)',

    // Alerts only — never decorative
    coral:    '#E2665B',
    coralDim: 'rgba(226,102,91,0.14)',
  },
  font: {
    display: "'Fraunces', Georgia, serif",
    ui:      "'Inter', -apple-system, 'Segoe UI', sans-serif",
    mono:    "'IBM Plex Mono', 'Courier New', monospace",
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 },
  fontImport:
    "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');",
};
