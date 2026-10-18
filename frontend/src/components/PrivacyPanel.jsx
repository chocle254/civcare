import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

// Profile → Your privacy. Each control maps to a right under the Kenya Data
// Protection Act 2019: correct (s. 40), copy (ss. 26, 38), see who opened
// the record (s. 26), withdraw consent (s. 32), delete (s. 40).

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function PrivacyPanel({ patient, onPatient }) {
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [logErr, setLogErr] = useState('');
  const [form, setForm] = useState({
    full_name: patient.name || '',
    date_of_birth: patient.date_of_birth || '',
    location: patient.location || '',
    allergies: patient.allergies || '',
  });
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState('');
  const [pin, setPin] = useState({ current_pin: '', pin: '', pin2: '' });
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  useEffect(() => {
    client.get('/privacy/access-log')
      .then((r) => setLog(r.data.entries || []))
      .catch(() => setLogErr('Could not load the record. Pull to refresh or try again later.'));
  }, []);

  const note = (key, text, ok = true) => setMsg((m) => ({ ...m, [key]: { text, ok } }));
  const fail = (key, e, fallback) => note(key, e.response?.data?.detail || fallback, false);

  const saveDetails = async (e) => {
    e.preventDefault();
    setBusy('details');
    try {
      const res = await client.patch('/auth/patient/profile/update', form);
      onPatient({ ...patient, ...(res.data.patient || {}) });
      note('details', 'Saved.');
    } catch (err) { fail('details', err, 'Could not save. Try again.'); }
    finally { setBusy(''); }
  };

  const download = async () => {
    setBusy('download');
    try {
      const res = await client.get('/privacy/my-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civcare-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      note('download', 'Your file has downloaded.');
    } catch (err) { fail('download', err, 'Could not prepare your file. Try again.'); }
    finally { setBusy(''); }
  };

  const savePin = async (e) => {
    e.preventDefault();
    if (pin.pin !== pin.pin2) { note('pin', 'The two new PINs don\'t match.', false); return; }
    setBusy('pin');
    try {
      await client.post('/auth/patient/set-pin', { pin: pin.pin, current_pin: pin.current_pin });
      setPin({ current_pin: '', pin: '', pin2: '' });
      note('pin', 'PIN changed.');
    } catch (err) { fail('pin', err, 'Could not change your PIN.'); }
    finally { setBusy(''); }
  };

  const withdraw = async () => {
    setBusy('withdraw');
    try {
      await client.post('/privacy/withdraw-consent');
      onPatient({ ...patient, consent_version: null, needs_consent: true });
      window.dispatchEvent(new Event('civcare:patient'));
    } catch (err) { fail('withdraw', err, 'Could not withdraw. Try again.'); }
    finally { setBusy(''); }
  };

  const erase = async () => {
    setBusy('delete');
    try {
      await client.post('/privacy/delete-account', { confirm: deleteText });
      localStorage.clear();
      navigate('/', { replace: true });
    } catch (err) { fail('delete', err, 'Could not delete your account. Try again.'); setBusy(''); }
  };

  const Msg = ({ k }) => msg[k] ? <p className={`ppv-msg ${msg[k].ok ? '' : 'is-err'}`} role="status">{msg[k].text}</p> : null;

  return (
    <div className="ppv">
      <style>{`
        .ppv { display: grid; gap: 14px; }
        .ppv-card { background: var(--cc-surface-solid); border: 1px solid var(--cc-border); border-radius: 14px; padding: 16px; display: grid; gap: 10px; }
        .ppv-card h3 { margin: 0; font-size: 15px; color: var(--cc-text); }
        .ppv-card p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--cc-text-2); }
        .ppv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ppv-field { display: grid; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--cc-text); }
        .ppv-field.full { grid-column: 1 / -1; }
        .ppv input { height: 42px; border: 1px solid var(--cc-border-strong); border-radius: 10px; padding: 0 11px; font: inherit; font-size: 14px; background: var(--cc-surface-solid); color: var(--cc-text); min-width: 0; }
        .ppv-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .ppv-btn { min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--cc-primary); background: var(--cc-primary); color: var(--cc-on-primary); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .ppv-btn.ghost { background: transparent; color: var(--cc-primary); }
        .ppv-btn.danger { background: var(--cc-danger); border-color: var(--cc-danger); color: #fff; }
        .ppv-btn.danger-ghost { background: transparent; border-color: var(--cc-danger-border); color: var(--cc-danger); }
        .ppv-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ppv-btn:focus-visible, .ppv input:focus-visible { outline: 3px solid var(--cc-primary-border); outline-offset: 2px; }
        .ppv-msg { font-size: 13px; color: var(--cc-success); margin: 0; }
        .ppv-msg.is-err { color: var(--cc-danger); }
        .ppv-log { list-style: none; margin: 0; padding: 0; display: grid; max-height: 280px; overflow-y: auto; }
        .ppv-log li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 9px 0; border-top: 1px solid var(--cc-border); font-size: 13px; }
        .ppv-log li:first-child { border-top: 0; }
        .ppv-log .who { font-weight: 600; color: var(--cc-text); }
        .ppv-log .what { color: var(--cc-text-2); grid-column: 1; }
        .ppv-log .at { color: var(--cc-muted); font-variant-numeric: tabular-nums; grid-row: 1 / span 2; grid-column: 2; align-self: center; font-size: 12px; text-align: right; }
        .ppv-danger { border-color: var(--cc-danger-border); }
        .ppv a { color: var(--cc-primary); font-weight: 600; }
        @media (max-width: 420px) { .ppv-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section className="ppv-card">
        <h3>Who has opened your record</h3>
        <p>Every time a doctor opens your file, or you change your details, it's listed here.</p>
        {logErr && <p className="ppv-msg is-err">{logErr}</p>}
        {log && log.length === 0 && <p>No one has opened your record yet.</p>}
        {log && log.length > 0 && (
          <ul className="ppv-log">
            {log.map((r, i) => (
              <li key={i}>
                <span className="who">{r.role === 'doctor' ? r.who : r.who === 'You' ? 'You' : r.who}</span>
                <span className="what">{r.what}</span>
                <span className="at">{when(r.when)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="ppv-card" onSubmit={saveDetails}>
        <h3>Correct your details</h3>
        <div className="ppv-grid">
          <label className="ppv-field full" htmlFor="ppv-name">Full name
            <input id="ppv-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </label>
          <label className="ppv-field" htmlFor="ppv-dob">Date of birth
            <input id="ppv-dob" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </label>
          <label className="ppv-field" htmlFor="ppv-loc">Area / town
            <input id="ppv-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label className="ppv-field full" htmlFor="ppv-all">Allergies
            <input id="ppv-all" value={form.allergies} placeholder="None" onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          </label>
        </div>
        <p>To change your phone or ID number, contact the CivCare team.</p>
        <div className="ppv-row">
          <button className="ppv-btn" type="submit" disabled={busy === 'details'}>{busy === 'details' ? 'Saving…' : 'Save changes'}</button>
          <Msg k="details" />
        </div>
      </form>

      <section className="ppv-card">
        <h3>Download your information</h3>
        <p>A file with everything CivCare holds about you: your details, conversations, diagnoses, medicines, check-ins and who opened your record.</p>
        <div className="ppv-row">
          <button className="ppv-btn ghost" type="button" onClick={download} disabled={busy === 'download'}>{busy === 'download' ? 'Preparing…' : 'Download my data'}</button>
          <Msg k="download" />
        </div>
      </section>

      <form className="ppv-card" onSubmit={savePin}>
        <h3>Change your PIN</h3>
        <div className="ppv-grid">
          <label className="ppv-field full" htmlFor="ppv-cur">Current PIN
            <input id="ppv-cur" type="password" inputMode="numeric" maxLength={4} autoComplete="current-password" value={pin.current_pin} onChange={(e) => setPin({ ...pin, current_pin: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="ppv-field" htmlFor="ppv-new">New PIN
            <input id="ppv-new" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="ppv-field" htmlFor="ppv-new2">Repeat new PIN
            <input id="ppv-new2" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" value={pin.pin2} onChange={(e) => setPin({ ...pin, pin2: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
        <div className="ppv-row">
          <button className="ppv-btn" type="submit" disabled={busy === 'pin' || pin.pin.length !== 4}>{busy === 'pin' ? 'Saving…' : 'Change PIN'}</button>
          <Msg k="pin" />
        </div>
      </form>

      <section className="ppv-card">
        <h3>Withdraw consent</h3>
        <p>The health assistant stops using your information, and you won't be able to use it until you agree again. Records doctors have already written stay in your file.</p>
        {!confirmWithdraw ? (
          <div className="ppv-row">
            <button className="ppv-btn danger-ghost" type="button" onClick={() => setConfirmWithdraw(true)}>Withdraw consent</button>
          </div>
        ) : (
          <div className="ppv-row">
            <button className="ppv-btn danger" type="button" onClick={withdraw} disabled={busy === 'withdraw'}>{busy === 'withdraw' ? 'Withdrawing…' : 'Yes, withdraw'}</button>
            <button className="ppv-btn ghost" type="button" onClick={() => setConfirmWithdraw(false)}>Keep using CivCare</button>
            <Msg k="withdraw" />
          </div>
        )}
      </section>

      <section className="ppv-card ppv-danger">
        <h3>Delete your account</h3>
        <p>Your name, phone, ID number, date of birth, allergies and everything you told the assistant are erased. Diagnoses and prescriptions are health records the hospital must keep, so they stay, but without anything that identifies you. This can't be undone.</p>
        <label className="ppv-field" htmlFor="ppv-del">Type DELETE to confirm
          <input id="ppv-del" value={deleteText} autoComplete="off" onChange={(e) => setDeleteText(e.target.value)} />
        </label>
        <div className="ppv-row">
          <button className="ppv-btn danger" type="button" onClick={erase} disabled={deleteText.trim().toUpperCase() !== 'DELETE' || busy === 'delete'}>
            {busy === 'delete' ? 'Deleting…' : 'Delete my account'}
          </button>
          <Msg k="delete" />
        </div>
      </section>

      <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: 0 }}>
        Read the full <a href="/privacy">privacy notice</a>. Unhappy with how your information is handled? You can complain to the Office of the Data Protection Commissioner at www.odpc.go.ke.
      </p>
    </div>
  );
}
