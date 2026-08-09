import { useNavigate } from 'react-router-dom';
import { theme } from '../styles/theme';
import { Icon } from './Icons';

const { color, font } = theme;

const TABS = [
  { id: 'home',      label: 'Home',        path: '/dashboard',        Icon: Icon.Home,     IconFilled: Icon.HomeFilled },
  { id: 'health',    label: 'Health',      path: '/medications',      Icon: Icon.Heart },
  { id: 'assistant', label: 'AI Assistant',path: '/chat',             Icon: Icon.Sparkle },
  { id: 'records',   label: 'Records',     path: '/diagnosis-history',Icon: Icon.Records },
  { id: 'profile',   label: 'Profile',     path: '/profile',          Icon: Icon.Profile },
];

export default function BottomNav({ active }) {
  const navigate = useNavigate();

  return (
    <>
      <nav className="cc-bottomnav" style={s.bar}>
        {TABS.map((t) => {
          const isActive = t.id === active;
          const TabIcon = isActive && t.IconFilled ? t.IconFilled : t.Icon;
          return (
            <button key={t.id} style={s.btn} onClick={() => navigate(t.path)}>
              <span style={{ color: isActive ? color.blue : color.inkFaint }}>
                <TabIcon size={22} />
              </span>
              <span style={{ ...s.label, color: isActive ? color.blue : color.inkFaint }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
      <style>{`
        .cc-bottomnav { display: flex; }
      `}</style>
    </>
  );
}

const s = {
  bar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
    background: color.bgElevated, borderTop: `1px solid ${color.hairline}`,
    boxShadow: theme.shadow.nav,
    justifyContent: 'space-around', alignItems: 'center',
    padding: '10px 4px calc(8px + env(safe-area-inset-bottom))', zIndex: 100,
  },
  btn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
    minWidth: 52, fontFamily: font.ui,
  },
  label: { fontSize: 10, fontWeight: 600 },
};
