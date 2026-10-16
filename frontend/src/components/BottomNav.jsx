import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from './Icons';

const API = process.env.REACT_APP_API_URL;

const TABS = [
  { id: 'home',      label: 'Home',        path: '/dashboard',    icon: 'Home' },
  { id: 'meds',      label: 'Medications', path: '/medications',  icon: 'Pill' },
  { id: 'assistant', label: 'Assistant',   path: '/chat',         icon: 'Sparkle' },
  { id: 'doctor',    label: 'Doctors',     path: '/consultation', icon: 'Stethoscope', badge: 'doctors' },
  { id: 'more',      label: 'More',        icon: 'Grid' },
];

const MORE_ITEMS = [
  { icon: 'Hospital', title: 'Hospitals nearby',  sub: 'Find care near you',     path: '/hospitals' },
  { icon: 'History',  title: 'Diagnosis history', sub: 'Past consultations',     path: '/diagnosis-history' },
  { icon: 'Profile',  title: 'Profile',           sub: 'Your details',           path: '/profile' },
  { icon: 'Logout',   title: 'Sign out',          sub: 'Log out of CivCare',     action: 'logout', danger: true },
];

export default function BottomNav({ active }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [doctorCount, setDoctorCount] = useState(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/doctors/available`)
      .then((res) => { if (alive) setDoctorCount(Array.isArray(res.data) ? res.data.length : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

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
      <nav className="ccnav" aria-label="Primary">
        {TABS.map((t) => {
          const isActive = t.id === active || (t.id === 'more' && moreOpen);
          const showBadge = t.badge === 'doctors' && doctorCount != null && doctorCount > 0;
          const TabIcon = Icon[t.icon];
          return (
            <button
              key={t.id}
              type="button"
              className={`ccnav__btn${isActive ? ' is-active' : ''}`}
              onClick={() => handleTab(t)}
              aria-current={isActive && t.id !== 'more' ? 'page' : undefined}
              aria-haspopup={t.id === 'more' ? 'dialog' : undefined}
              aria-expanded={t.id === 'more' ? moreOpen : undefined}
            >
              <span className="ccnav__icon">
                <TabIcon size={22} strokeWidth={isActive ? 2.1 : 1.8} />
                {showBadge && (
                  <span className="ccnav__badge" aria-label={`${doctorCount} doctors available`}>
                    {doctorCount > 9 ? '9+' : doctorCount}
                  </span>
                )}
              </span>
              <span className="ccnav__label">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {moreOpen && (
        <>
          <div className="ccnav__overlay" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="ccnav__sheet" role="dialog" aria-modal="true" aria-labelledby="ccnav-more-title" ref={sheetRef}>
            <div className="ccnav__handle" aria-hidden="true" />
            <div className="ccnav__sheethead">
              <h2 id="ccnav-more-title">More</h2>
              <button type="button" className="ccnav__close" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                <Icon.Close size={18} />
              </button>
            </div>
            <ul className="ccnav__list">
              {MORE_ITEMS.map((item) => {
                const ItemIcon = Icon[item.icon];
                return (
                  <li key={item.title}>
                    <button
                      type="button"
                      className={`ccnav__item${item.danger ? ' is-danger' : ''}`}
                      onClick={() => handleMoreItem(item)}
                    >
                      <span className="ccnav__itemicon"><ItemIcon size={20} /></span>
                      <span className="ccnav__itemtext">
                        <span className="ccnav__itemtitle">{item.title}</span>
                        <span className="ccnav__itemsub">{item.sub}</span>
                      </span>
                      {!item.danger && <Icon.Chevron size={18} className="ccnav__chev" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <style>{`
        .ccnav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
          max-width: 520px; margin: 0 auto; width: 100%;
          display: flex; justify-content: space-around; align-items: stretch;
          background: var(--cc-glass);
          -webkit-backdrop-filter: var(--cc-blur);
          backdrop-filter: var(--cc-blur);
          border-top: 1px solid var(--cc-glass-border);
          box-shadow: var(--cc-glass-edge), 0 -10px 30px -12px rgba(16,36,64,0.18);
          padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
        }
        @media (min-width: 521px) {
          .ccnav { border-left: 1px solid var(--cc-border); border-right: 1px solid var(--cc-border); border-radius: 16px 16px 0 0; }
        }
        .ccnav__btn {
          flex: 1; min-width: 0; min-height: 52px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
          background: none; border: none; border-radius: 10px;
          color: var(--cc-faint); padding: 4px 2px;
          transition: color .15s ease, background .15s ease;
        }
        .ccnav__btn:hover { color: var(--cc-text-2); }
        .ccnav__btn.is-active { color: var(--cc-primary); }
        .ccnav__btn.is-active .ccnav__icon { filter: drop-shadow(0 4px 8px rgba(23,105,170,.35)); }
        .ccnav__icon { position: relative; display: inline-flex; }
        .ccnav__btn.is-active .ccnav__icon::after {
          content: ''; position: absolute; left: 50%; top: -7px; transform: translateX(-50%);
          width: 20px; height: 3px; border-radius: 0 0 3px 3px; background: var(--cc-primary);
        }
        .ccnav__label { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .ccnav__badge {
          position: absolute; top: -4px; right: -9px; min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 8px; background: var(--cc-success); color: #fff;
          font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
          border: 2px solid var(--cc-surface); box-sizing: content-box;
        }
        .ccnav__overlay { position: fixed; inset: 0; background: var(--cc-overlay); z-index: 200; animation: fadeIn .18s ease both; }
        .ccnav__sheet {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
          max-width: 520px; margin: 0 auto; max-height: 80vh; overflow-y: auto;
          background: var(--cc-glass-strong); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur);
          border: 1px solid var(--cc-glass-border); border-bottom: none;
          border-radius: 24px 24px 0 0; box-shadow: var(--cc-glass-edge), var(--cc-shadow-lg);
          padding: 10px 16px calc(20px + env(safe-area-inset-bottom));
          animation: ccSheetUp .24s cubic-bezier(0.2,0,0,1) both;
        }
        .ccnav__handle { width: 36px; height: 4px; border-radius: 2px; background: var(--cc-border-strong); margin: 0 auto 10px; }
        .ccnav__sheethead { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 8px; }
        .ccnav__sheethead h2 { font-size: 17px; font-weight: 700; color: var(--cc-text); }
        .ccnav__close {
          width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--cc-border);
          background: var(--cc-surface); color: var(--cc-muted);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .ccnav__close:hover { background: var(--cc-surface-2); color: var(--cc-text); }
        .ccnav__list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
        .ccnav__item {
          width: 100%; display: flex; align-items: center; gap: 12px; text-align: left;
          padding: 12px 8px; min-height: 60px; border: none; background: none; border-radius: 12px;
          color: var(--cc-text);
        }
        .ccnav__item:hover { background: var(--cc-surface-2); }
        .ccnav__itemicon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--cc-primary-soft); color: var(--cc-primary); box-shadow: var(--cc-clay);
        }
        .ccnav__item.is-danger .ccnav__itemicon { background: var(--cc-danger-soft); color: var(--cc-danger); }
        .ccnav__item.is-danger .ccnav__itemtitle { color: var(--cc-danger); }
        .ccnav__itemtext { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .ccnav__itemtitle { font-size: 15px; font-weight: 600; }
        .ccnav__itemsub { font-size: 13px; color: var(--cc-muted); }
        .ccnav__chev { color: var(--cc-faint); flex-shrink: 0; }
        @keyframes ccSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
