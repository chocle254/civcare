import { useState } from 'react';
import { enablePush, isInstalled, isIos, permission, pushSupported, sendTestPush } from '../utils/push';

// Dashboard card that turns on dose reminders for this phone.

export default function PushPrompt() {
  const [state, setState] = useState(permission);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('civcare_push_hide') === '1'; } catch { return false; } });

  const needsInstall = isIos() && !isInstalled();
  if (hidden || (state === 'granted' && !msg)) return null;
  if (!pushSupported() && !needsInstall) return null;

  const turnOn = async () => {
    setBusy(true); setError('');
    try {
      await enablePush();
      setState('granted');
      setMsg(await sendTestPush().catch(() => 'Notifications are on.'));
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
      setState(permission());
    } finally { setBusy(false); }
  };

  const hide = () => { try { localStorage.setItem('civcare_push_hide', '1'); } catch { /* private mode */ } setHidden(true); };

  return (
    <section className="pp2">
      <style>{`
        .pp2 { display: flex; gap: 14px; align-items: flex-start; background: var(--cc-primary-soft); border: 1px solid var(--cc-primary-border);
          border-radius: 18px; padding: 14px 16px; margin-bottom: 24px; }
        .pp2-icon { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          background: var(--cc-surface-solid); color: var(--cc-primary); box-shadow: var(--cc-clay); }
        .pp2-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .pp2-title { font-size: 15px; font-weight: 700; color: var(--cc-text); margin: 0; }
        .pp2-sub { font-size: 13px; color: var(--cc-text-2); margin: 0; line-height: 1.5; }
        .pp2-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
        .pp2-btn { min-height: 38px; padding: 0 14px; border-radius: 11px; border: 1px solid var(--cc-primary); background: var(--cc-primary-grad);
          color: var(--cc-on-primary); font: inherit; font-size: 13.5px; font-weight: 650; cursor: pointer; }
        .pp2-btn--quiet { background: none; border-color: transparent; color: var(--cc-muted); }
        .pp2-btn:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
        .pp2-err { font-size: 13px; color: var(--cc-danger); margin: 4px 0 0; }
        .pp2-ok { font-size: 13px; color: var(--cc-success); margin: 4px 0 0; }
      `}</style>
      <span className="pp2-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </span>
      <div className="pp2-text">
        {msg ? (
          <>
            <p className="pp2-title">Notifications are on</p>
            <p className="pp2-ok" role="status">{msg}</p>
            <div className="pp2-row"><button className="pp2-btn pp2-btn--quiet" onClick={() => setMsg('')}>Done</button></div>
          </>
        ) : needsInstall ? (
          <>
            <p className="pp2-title">Get dose reminders on this iPhone</p>
            <p className="pp2-sub">Tap the Share button, then “Add to Home Screen”. Open CivCare from the new icon and turn notifications on here.</p>
            <div className="pp2-row"><button className="pp2-btn pp2-btn--quiet" onClick={hide}>Not now</button></div>
          </>
        ) : state === 'denied' ? (
          <>
            <p className="pp2-title">Notifications are blocked</p>
            <p className="pp2-sub">To get dose reminders, allow notifications for this site in your browser’s settings, then reload. You’ll still get SMS reminders.</p>
            <div className="pp2-row"><button className="pp2-btn pp2-btn--quiet" onClick={hide}>Hide</button></div>
          </>
        ) : (
          <>
            <p className="pp2-title">Never miss a dose</p>
            <p className="pp2-sub">Turn on notifications and this phone will remind you when each dose is due, even when CivCare is closed. They never show your medicine’s name on the lock screen.</p>
            {error && <p className="pp2-err" role="alert">{error}</p>}
            <div className="pp2-row">
              <button className="pp2-btn" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on notifications'}</button>
              <button className="pp2-btn pp2-btn--quiet" onClick={hide}>Not now</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
