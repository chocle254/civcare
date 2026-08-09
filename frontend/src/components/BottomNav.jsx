import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../styles/theme';

const { color, font, radius } = theme;

const TABS = [
  { id: 'home',      label: 'Home',        path: '/dashboard',         emoji: '🏠' },
  { id: 'health',    label: 'Health',      path: '/medications',       emoji: '❤️' },
  { id: 'assistant', label: 'AI Assistant',path: '/chat',               emoji: '✨' },
  { id: 'records',   label: 'Records',     path: '/diagnosis-history', emoji: '📄' },
  { id: 'more',      label: 'More',        emoji: '⋯' },
];

const MORE_ITEMS = [
  { emoji: '🩺', title: 'Find a Doctor',    sub: 'Consult online',     path: '/consultation' },
  { emoji: '🏥', title: 'Hospitals Nearby', sub: 'Find care near you', path: '/hospitals' },
  { emoji: '💊', title: 'Medications',      sub: 'Reminders & doses',  path: '/medications' },
  { emoji: '📋', title: 'Diagnosis History',sub: 'Past consultations', path: '/diagnosis-history' },
  { emoji: '👤', title: 'Profile',          sub: 'Your details',       path: '/profile' },
  { emoji: '🚪', title: 'Sign Out',         sub: 'Log out of CivCare', action: 'logout' },
];

export default function BottomNav({ active }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleTab = (t) => {
    if (t.id === 'more') { setMoreOpen(true); return; }
    navigate(t.path);
  };

  const handleMoreItem = (item) => {
    setMoreOpen(false);
    if (item.action === 'logout') { localStorage.clear(); navigate('/'); return; }
    navigate(item.path);
  };

  return (
    <>
      <nav className="cc-bottomnav" style={s.bar}>
        {TABS.map((t) => {
          const isActive = t.id === active || (t.id === 'more' && moreOpen);
          return (
            <button key={t.id} style={s.btn} className="cc-navbtn" onClick={() => handleTab(t)}>
              {isActive && <span style={s.activeBubble} />}
              <span style={{ ...s.emoji, opacity: isActive ? 1 : 0.55, transform: isActive ? 'scale(1.12)' : 'scale(1)' }}>{t.emoji}</span>
              <span style={{ ...s.label, color: isActive ? color.blue : color.inkFaint }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {moreOpen && (
        <>
          <div style={s.overlay} onClick={() => setMoreOpen(false)} />
          <div style={s.sheet}>
            <div style={s.sheetPill} />
            <div style={s.sheetHeader}>
              <p style={s.sheetTitle}>More</p>
              <button style={s.closeBtn} className="cc-press" onClick={() => setMoreOpen(false)} aria-label="Close">✕</button>
            </div>
            <div style={s.grid}>
              {MORE_ITEMS.map((item, i) => (
                <button
                  key={item.title} style={{ ...s.gridCard, animationDelay: `${i * 0.04}s` }}
                  className="cc-press cc-griditem" onClick={() => handleMoreItem(item)}
                >
                  <span style={s.gridEmojiWrap}><span style={s.gridEmoji}>{item.emoji}</span></span>
                  <span style={s.gridTitle}>{item.title}</span>
                  <span style={s.gridSub}>{item.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        .cc-bottomnav { display: flex; }
        .cc-navbtn { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .cc-navbtn:active { transform: scale(0.9); }
        .cc-griditem { animation: gridIn 0.34s cubic-bezier(0.34,1.56,0.64,1) both; }
        ${theme.motionCss}
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes gridIn { from{opacity:0;transform:translateY(10px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes bubblePop { from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
      `}</style>
    </>
  );
}

const s = {
  bar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', width: '100%',
    background: color.glassStrong, backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderTop: `1px solid ${color.glassBorder}`,
    boxShadow: '0 -8px 24px rgba(31,38,80,0.08)',
    justifyContent: 'space-around', alignItems: 'center',
    padding: '9px 4px calc(8px + env(safe-area-inset-bottom))', zIndex: 100, boxSizing: 'border-box',
  },
  btn: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
    minWidth: 50, fontFamily: font.ui,
  },
  activeBubble: {
    position: 'absolute', top: -2, width: 34, height: 34, borderRadius: '50%',
    background: color.blueDim, animation: 'bubblePop 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
  },
  emoji: { position: 'relative', fontSize: 19, lineHeight: 1, transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)' },
  label: { position: 'relative', fontSize: 10, fontWeight: 600 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(16,18,32,0.4)', backdropFilter: 'blur(2px)', zIndex: 200, animation: 'fadeIn 0.2s ease both' },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
    background: color.glassStrong, backdropFilter: 'blur(26px) saturate(160%)', WebkitBackdropFilter: 'blur(26px) saturate(160%)',
    border: `1px solid ${color.glassBorder}`, borderBottom: 'none',
    borderRadius: '24px 24px 0 0', padding: '14px 20px calc(24px + env(safe-area-inset-bottom))',
    zIndex: 201, animation: 'sheetUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both', maxHeight: '78vh', overflowY: 'auto',
    boxShadow: '0 -12px 40px rgba(31,38,80,0.18)',
  },
  sheetPill: { width: 36, height: 4, borderRadius: 2, background: color.hairlineStrong, margin: '0 auto 14px' },
  sheetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 19, fontWeight: 800, color: color.ink, margin: 0 },
  closeBtn: {
    width: 32, height: 32, borderRadius: '50%', background: color.surfaceMuted, border: 'none',
    boxShadow: theme.shadow.embossOut,
    color: color.inkDim, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 4 },
  gridCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left',
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, borderRadius: radius.lg,
    boxShadow: theme.shadow.glass,
    padding: '16px 14px', cursor: 'pointer', fontFamily: font.ui, minHeight: 92,
  },
  gridEmojiWrap: {
    width: 38, height: 38, borderRadius: 12, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: color.surfaceMuted, boxShadow: theme.shadow.embossOut,
  },
  gridEmoji: { fontSize: 18, lineHeight: 1 },
  gridTitle: { fontSize: 13.5, fontWeight: 700, color: color.ink },
  gridSub: { fontSize: 11.5, color: color.inkFaint },
};
