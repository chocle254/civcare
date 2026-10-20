import { useState } from 'react';

// Public form for a hospital to join CivCare. The CivCare team checks the
// facility code against the Kenya Master Health Facility List and calls
// the person who applied before the hospital appears to patients.

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];
const LEVELS = ['Level 2 (dispensary)', 'Level 3 (health centre)', 'Level 4 (sub-county hospital)', 'Level 5 (county referral)', 'Level 6 (national referral)'];
const OWNERSHIP = ['Public (county or national)', 'Private', 'Faith-based', 'NGO'];

const EMPTY = {
  name: '', facility_code: '', level: '', ownership: '', county: '', town: '', address: '',
  phone_number: '', email: '', contact_name: '', contact_role: '', contact_phone: '', contact_email: '',
};

export default function HospitalRegister() {
  const [f, setF] = useState(EMPTY);
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const locate = () => {
    setLocError('');
    if (!navigator.geolocation) { setLocError("This browser can't share its location."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }); setLocating(false); },
      () => { setLocError('Location was blocked. Allow it in the browser settings, or skip this and the team will add it.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/hospitals/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, agree, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not send the application. Please try again.');
      setDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="hr">
        <Styles />
        <main className="hr-main">
          <section className="hr-card hr-done" role="status">
            <p className="hr-eyebrow">Application sent</p>
            <h1 className="hr-h1">Thank you. We'll call {f.contact_name.split(' ')[0] || 'you'} to confirm.</h1>
            <p>Your reference is <strong className="hr-ref">{done.reference}</strong>. Keep it in case you need to call us.</p>
            <ol className="hr-steps">
              <li>The CivCare team checks your facility code on the Kenya Master Health Facility List.</li>
              <li>We call {f.contact_phone || 'the number you gave'} to confirm and agree the pilot.</li>
              <li>Once approved, your doctors can create their accounts at <strong>/doctor</strong> by choosing your hospital, and patients nearby will see it.</li>
            </ol>
            <a className="btn btn--outline" href="/doctor">Go to doctor sign-in</a>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="hr">
      <Styles />
      <main className="hr-main">
        <header className="hr-head">
          <p className="hr-eyebrow">CivCare for hospitals</p>
          <h1 className="hr-h1">Register your hospital</h1>
          <p className="hr-lead">Patients describe their symptoms to CivCare before they arrive, so your doctors see a case summary when the patient walks in. Fill this in and the CivCare team will call you before anything goes live.</p>
        </header>

        <form className="hr-card" onSubmit={submit} noValidate>
          <fieldset className="hr-set">
            <legend>The facility</legend>
            <Field id="h-name" label="Hospital name" req><input id="h-name" className="input" value={f.name} onChange={set('name')} placeholder="e.g. Kisumu County Referral Hospital" required /></Field>
            <div className="hr-two">
              <Field id="h-code" label="KMHFL facility code" req hint="The code on the Kenya Master Health Facility List.">
                <input id="h-code" className="input" value={f.facility_code} onChange={set('facility_code')} inputMode="numeric" placeholder="e.g. 13023" required />
              </Field>
              <Field id="h-level" label="Level">
                <select id="h-level" className="input" value={f.level} onChange={set('level')}>
                  <option value="">Choose</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field id="h-own" label="Ownership">
              <select id="h-own" className="input" value={f.ownership} onChange={set('ownership')}>
                <option value="">Choose</option>{OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </fieldset>

          <fieldset className="hr-set">
            <legend>Where it is</legend>
            <div className="hr-two">
              <Field id="h-county" label="County" req>
                <select id="h-county" className="input" value={f.county} onChange={set('county')} required>
                  <option value="">Choose</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field id="h-town" label="Town" req><input id="h-town" className="input" value={f.town} onChange={set('town')} required /></Field>
            </div>
            <Field id="h-addr" label="Street or landmark"><input id="h-addr" className="input" value={f.address} onChange={set('address')} placeholder="e.g. Off Jomo Kenyatta Highway" /></Field>
            <div className="hr-loc">
              <div>
                <p className="hr-loc__t">Pin the hospital on the map</p>
                <p className="hr-hint">Do this while you're at the hospital, so nearby patients find it. You can skip it.</p>
                {pos && <p className="hr-ok">Pinned: {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)} (within about {Math.round(pos.accuracy)} m)</p>}
                {locError && <p className="hr-err">{locError}</p>}
              </div>
              <button type="button" className="btn btn--outline btn--sm" onClick={locate} disabled={locating}>{locating ? 'Finding…' : pos ? 'Pin again' : 'Use my location'}</button>
            </div>
            <div className="hr-two">
              <Field id="h-phone" label="Hospital phone"><input id="h-phone" className="input" type="tel" value={f.phone_number} onChange={set('phone_number')} /></Field>
              <Field id="h-email" label="Hospital email"><input id="h-email" className="input" type="email" value={f.email} onChange={set('email')} /></Field>
            </div>
          </fieldset>

          <fieldset className="hr-set">
            <legend>You</legend>
            <p className="hr-hint">The person we'll call to confirm. Usually the medical superintendent, hospital administrator or ICT lead.</p>
            <div className="hr-two">
              <Field id="c-name" label="Your name" req><input id="c-name" className="input" autoComplete="name" value={f.contact_name} onChange={set('contact_name')} required /></Field>
              <Field id="c-role" label="Your role" req><input id="c-role" className="input" value={f.contact_role} onChange={set('contact_role')} placeholder="e.g. Medical superintendent" required /></Field>
            </div>
            <div className="hr-two">
              <Field id="c-phone" label="Your phone" req><input id="c-phone" className="input" type="tel" autoComplete="tel" value={f.contact_phone} onChange={set('contact_phone')} placeholder="0712 345 678" required /></Field>
              <Field id="c-email" label="Your email"><input id="c-email" className="input" type="email" autoComplete="email" value={f.contact_email} onChange={set('contact_email')} /></Field>
            </div>
          </fieldset>

          <label className="hr-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I'm allowed to apply for this hospital. I understand CivCare will process patient data for the hospital, and that we'll sign a data processing agreement before real patients use it (Data Protection Act 2019).</span>
          </label>

          {error && <p className="hr-err" role="alert">{error}</p>}
          <button className="btn btn--primary hr-submit" disabled={busy || !agree}>{busy ? 'Sending…' : 'Send application'}</button>
          <p className="hr-hint">Already approved? Doctors sign up at <a href="/doctor">/doctor</a>.</p>
        </form>
      </main>
    </div>
  );
}

function Field({ id, label, req, hint, children }) {
  return (
    <div className="hr-field">
      <label className="label" htmlFor={id}>{label}{req && <span className="hr-req" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && <p className="hr-hint">{hint}</p>}
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .hr { min-height: 100vh; background: var(--cc-canvas); color: var(--cc-text); font-family: Inter, system-ui, sans-serif; }
      .hr a { color: var(--cc-primary); }
      .hr-main { max-width: 680px; margin: 0 auto; padding-block: 36px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 20px; }
      .hr-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--cc-primary); }
      .hr-h1 { font-size: 26px; font-weight: 700; line-height: 1.2; text-wrap: balance; margin-top: 6px; }
      .hr-lead { color: var(--cc-text-2); line-height: 1.6; margin-top: 10px; max-width: 62ch; }
      .hr-card { background: var(--cc-surface-solid); border: 1px solid var(--cc-border); border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
      .hr-set { border: 0; display: flex; flex-direction: column; gap: 12px; }
      .hr-set legend { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--cc-muted); margin-bottom: 4px; }
      .hr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 520px) { .hr-two { grid-template-columns: 1fr; } }
      .hr-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .hr-req { color: var(--cc-danger); }
      .hr-hint { font-size: 12.5px; color: var(--cc-muted); line-height: 1.45; }
      .hr-loc { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; background: var(--cc-surface-2); border: 1px solid var(--cc-border); border-radius: 12px; padding: 12px 14px; flex-wrap: wrap; }
      .hr-loc__t { font-size: 14px; font-weight: 600; }
      .hr-ok { font-size: 13px; color: var(--cc-success); margin-top: 6px; }
      .hr-err { font-size: 13.5px; color: var(--cc-danger); margin-top: 6px; }
      .hr-agree { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.5; color: var(--cc-text-2); }
      .hr-agree input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
      .hr-submit { width: 100%; }
      .hr-done { gap: 14px; }
      .hr-ref { font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: .06em; }
      .hr-steps { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; line-height: 1.55; color: var(--cc-text-2); }
      .hr-done .btn { align-self: flex-start; }
    `}</style>
  );
}
