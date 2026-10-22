import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDueDose } from '../api/reminders';
import { PATIENT_SHELL_ROUTES } from './PatientSidebar';

// App-wide "time for your medicine" banner. The Medications page has the
// full check-in pop-up; this makes sure a due dose is noticed on any other
// page too, and sends the patient there to log it.

const POLL_MS = 30000;
const DISMISSED_KEY = 'civcare_dose_dismissed';

const readPatientId = () => {
  try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}').id || null; } catch { return null; }
};
const isDismissed = (id) => {
  try { return sessionStorage.getItem(DISMISSED_KEY) === id; } catch { return false; }
};

export default function DoseReminder() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dose, setDose] = useState(null);

  const active = PATIENT_SHELL_ROUTES.includes(pathname) && pathname !== '/medications';

  const check = useCallback(async () => {
    const patientId = readPatientId();
    if (!patientId || !localStorage.getItem('civtech_token')) return;
    try {
      const res = await getDueDose(patientId, { brief: true });
      const d = res.data;
      setDose(d?.due && !isDismissed(d.reminder_id) ? d : null);
    } catch {
      // Quiet: the banner is a nudge; SMS and push reminders still go out.
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    check();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, check]);

  if (!active || !dose) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, dose.reminder_id); } catch { /* private mode */ }
    setDose(null);
  };

  const units = dose.units_per_dose || 1;
  const form = dose.med_form || 'tablet';
  const amount = form === 'syrup' || form === 'liquid'
    ? `${units * 5} ml`
    : `${units} ${form}${units > 1 ? 's' : ''}`;

  return (
    <div className="dose-banner" role="alert">
      <style>{STYLES}</style>
      <span className="dose-banner-dot" aria-hidden="true" />
      <div className="dose-banner-text">
        <strong>Time for your {dose.medication_name}</strong>
        <span>Take {amount}, then log it.</span>
      </div>
      <button type="button" className="dose-banner-go" onClick={() => navigate('/medications')}>
        Log dose
      </button>
      <button type="button" className="dose-banner-close" onClick={dismiss} aria-label="Remind me later">
        ×
      </button>
    </div>
  );
}

const STYLES = `
  .dose-banner {
    position: fixed;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 1200;
    width: min(560px, calc(100% - 32px));
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 14px;
    border: 1px solid var(--cc-danger-border);
    border-radius: 14px;
    background: var(--cc-surface-solid, #fff);
    color: var(--cc-text);
    box-shadow: 0 12px 32px rgba(15, 35, 65, 0.16);
  }
  .dose-banner-dot {
    flex: 0 0 auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--cc-danger);
    animation: doseBannerPulse 1.6s infinite;
  }
  .dose-banner-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  .dose-banner-text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dose-banner-text span {
    color: var(--cc-muted);
    font-size: 12px;
  }
  .dose-banner-go {
    flex: 0 0 auto;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: var(--cc-primary);
    color: var(--cc-on-primary);
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }
  .dose-banner-close {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--cc-muted);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  @keyframes doseBannerPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
`;
