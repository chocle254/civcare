import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icons';

// Desktop-only navigation for the patient app (≥1024px). On phones the
// BottomNav handles navigation and this renders nothing visible. Mounted once
// in App so every main patient page gets the same shell as the clinician
// dashboard.

export const PATIENT_SHELL_ROUTES = [
  '/dashboard', '/chat', '/medications', '/consultation',
  '/hospitals', '/diagnosis-history', '/profile',
];

const NAV = [
  { path: '/dashboard',         label: 'Home',              icon: 'Home' },
  { path: '/chat',              label: 'Health assistant',  icon: 'Sparkle', fresh: true },
  { path: '/medications',       label: 'Medications',       icon: 'Pill' },
  { path: '/consultation',      label: 'Doctors',           icon: 'Stethoscope' },
  { path: '/hospitals',         label: 'Hospitals nearby',  icon: 'Hospital' },
  { path: '/diagnosis-history', label: 'Medical history',   icon: 'History' },
  { path: '/profile',           label: 'Profile',           icon: 'Profile' },
];

const readPatient = () => {
  try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; }
};

export default function PatientSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = PATIENT_SHELL_ROUTES.includes(pathname);

  useEffect(() => {
    document.body.classList.toggle('cc-pside', active);
    return () => document.body.classList.remove('cc-pside');
  }, [active]);

  if (!active) return null;

  const patient = readPatient();
  const name = patient.name || 'Patient';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';

  const go = (item) => {
    // A fresh check-in from the sidebar starts a new conversation, matching
    // the dashboard's "Start health check" button.
    if (item.fresh && pathname !== '/chat') localStorage.removeItem('civtech_session_id');
    navigate(item.path);
  };

  const logout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  return (
    <aside className="ccps" aria-label="Patient navigation">
      <div className="ccps__brand">
        <span className="ccps__mark" aria-hidden="true"><Icon.Heart size={18} /></span>
        <div>
          <div className="ccps__name">CivCare</div>
          <div className="ccps__sub">Your health, guided</div>
        </div>
      </div>

      <nav className="ccps__nav">
        {NAV.map((item) => {
          const NavIcon = Icon[item.icon];
          const on = pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              className={`ccps__btn${on ? ' is-active' : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={() => go(item)}
            >
              <NavIcon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="ccps__me">
        <div className="ccps__id">
          <span className="ccps__avatar" aria-hidden="true">{initials}</span>
          <div style={{ minWidth: 0 }}>
            <div className="ccps__mename">{name}</div>
            {(patient.phone_number || patient.phone) && (
              <div className="ccps__mesub">{patient.phone_number || patient.phone}</div>
            )}
          </div>
        </div>
        <button type="button" className="ccps__btn ccps__logout" onClick={logout}>
          <Icon.Logout size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
