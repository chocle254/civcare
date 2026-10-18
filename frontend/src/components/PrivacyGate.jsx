import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { PRIVACY_VERSION } from '../utils/privacy';

// Patients who signed up before consent and PINs existed (or who withdrew
// consent) are asked once, before anything else, to agree to the privacy
// notice and to choose a PIN. Data Protection Act 2019, ss. 30, 32, 41.

const readPatient = () => {
  try { return JSON.parse(localStorage.getItem('civtech_patient') || 'null'); } catch { return null; }
};
const WEAK = ['0000', '1234', '1111'];
const OPEN_PATHS = ['/', '/privacy'];

export default function PrivacyGate() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(readPatient);
  const [agree, setAgree] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPatient(readPatient());
    const sync = () => setPatient(readPatient());
    window.addEventListener('civcare:patient', sync);
    return () => window.removeEventListener('civcare:patient', sync);
  }, [pathname]);

  if (!patient || !localStorage.getItem('civtech_token')) return null;
  if (OPEN_PATHS.includes(pathname) || pathname.startsWith('/doctor')) return null;

  const needsConsent = patient.consent_version !== PRIVACY_VERSION || patient.needs_consent;
  const needsPin = patient.needs_pin === true;
  if (!needsConsent && !needsPin) return null;

  const save = (next) => {
    localStorage.setItem('civtech_patient', JSON.stringify(next));
    setPatient(next);
    setError('');
  };

  const submitConsent = async () => {
    if (!agree) { setError('Tick the box to agree, or sign out.'); return; }
    setBusy(true);
    try {
      const res = await client.post('/privacy/consent', { version: PRIVACY_VERSION, agree: true });
      save({ ...patient, consent_version: res.data.consent_version, needs_consent: false });
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not save your choice. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  const submitPin = async () => {
    if (!/^\d{4}$/.test(pin) || WEAK.includes(pin)) { setError('Choose 4 digits that aren\'t easy to guess, like 1234 or 0000.'); return; }
    if (pin !== pin2) { setError('The two PINs don\'t match.'); return; }
    setBusy(true);
    try {
      const res = await client.post('/auth/patient/set-pin', { pin });
      save({ ...patient, ...(res.data.patient || {}), needs_pin: false });
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not save your PIN. Try again.');
    } finally { setBusy(false); }
  };

  const signOut = () => { localStorage.clear(); navigate('/', { replace: true }); };

  return (
    <div className="pg" role="dialog" aria-modal="true" aria-labelledby="pg-title">
      <style>{`
        .pg { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px max(16px, env(safe-area-inset-left, 0px)); background: rgba(10, 18, 32, 0.55); backdrop-filter: blur(4px); overflow-y: auto; }
        .pg__card { width: min(460px, 100%); background: var(--cc-surface-solid); color: var(--cc-text); border: 1px solid var(--cc-border); border-radius: 18px; padding: 24px 22px; box-shadow: var(--cc-shadow); display: grid; gap: 14px; }
        .pg h2 { margin: 0; font-size: 20px; letter-spacing: -0.01em; text-wrap: balance; }
        .pg p, .pg li { margin: 0; font-size: 14px; line-height: 1.6; color: var(--cc-text-2); }
        .pg ul { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
        .pg a { color: var(--cc-primary); font-weight: 600; }
        .pg__check { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.5; cursor: pointer; }
        .pg__check input { width: 18px; height: 18px; margin-top: 2px; flex: 0 0 18px; accent-color: var(--cc-primary); }
        .pg__pins { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pg label.pg__lbl { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
        .pg input[type=password] { height: 46px; border: 1px solid var(--cc-border-strong); border-radius: 10px; padding: 0 12px; font: inherit; font-size: 18px; letter-spacing: 0.3em; background: var(--cc-surface-solid); color: var(--cc-text); }
        .pg__err { color: var(--cc-danger); background: var(--cc-danger-soft); border: 1px solid var(--cc-danger-border); border-radius: 10px; padding: 9px 12px; font-size: 13px; }
        .pg__row { display: flex; gap: 10px; flex-wrap: wrap; }
        .pg__btn { flex: 1 1 auto; min-height: 46px; border-radius: 11px; border: 0; background: var(--cc-primary); color: var(--cc-on-primary); font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; padding: 0 16px; }
        .pg__btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .pg__ghost { background: transparent; color: var(--cc-text); border: 1px solid var(--cc-border-strong); }
        .pg__btn:focus-visible, .pg input:focus-visible { outline: 3px solid var(--cc-primary-border); outline-offset: 2px; }
        @media (max-width: 400px) { .pg__pins { grid-template-columns: 1fr; } }
      `}</style>
      <div className="pg__card">
        {needsConsent ? (
          <>
            <h2 id="pg-title">Before you continue</h2>
            <p>CivCare has a privacy notice that explains how your health information is used. In short:</p>
            <ul>
              <li>The health assistant uses what you tell it to guide you. It doesn't diagnose you or decide for you.</li>
              <li>Only the doctors caring for you can open your file, and every time they do is recorded.</li>
              <li>What you type is sent to an AI service in the USA. Your phone and ID number are not.</li>
              <li>You can download, correct or delete your information at any time from Profile.</li>
            </ul>
            <p><a href="/privacy" target="_blank" rel="noopener noreferrer">Read the full privacy notice</a></p>
            <label className="pg__check" htmlFor="pg-agree">
              <input id="pg-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I have read the privacy notice and agree to CivCare using my health information this way.</span>
            </label>
            {error && <div className="pg__err" role="alert">{error}</div>}
            <div className="pg__row">
              <button type="button" className="pg__btn pg__ghost" onClick={signOut}>Sign out</button>
              <button type="button" className="pg__btn" onClick={submitConsent} disabled={busy}>{busy ? 'Saving…' : 'Agree and continue'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="pg-title">Choose a PIN</h2>
            <p>Your ID number alone isn't enough to keep your health records safe, so you'll now sign in with a 4-digit PIN as well. Don't reuse your M-Pesa PIN.</p>
            <div className="pg__pins">
              <label className="pg__lbl" htmlFor="pg-pin">New PIN
                <input id="pg-pin" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
              </label>
              <label className="pg__lbl" htmlFor="pg-pin2">Repeat PIN
                <input id="pg-pin2" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
              </label>
            </div>
            {error && <div className="pg__err" role="alert">{error}</div>}
            <div className="pg__row">
              <button type="button" className="pg__btn" onClick={submitPin} disabled={busy}>{busy ? 'Saving…' : 'Save PIN'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
