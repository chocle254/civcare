import { useEffect, useState } from 'react';
import axios from 'axios';

// Home-screen card for the patient's own medical records (Profile → Records).

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export default function RecordsShortcut({ onOpen }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    axios.get(`${API}/documents/mine`)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows(null));
  }, []);

  if (rows === null) return null;
  const latest = rows[0];

  return (
    <section className="rs">
      <style>{`
        .rs { display: flex; gap: 14px; align-items: center; background: var(--cc-glass); border: 1px solid var(--cc-glass-border);
          border-radius: 18px; box-shadow: var(--cc-shadow-sm); padding: 14px 16px; margin-bottom: 24px; }
        .rs-icon { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          background: var(--cc-info-soft); color: var(--cc-info); box-shadow: var(--cc-clay); }
        .rs-text { flex: 1; min-width: 0; }
        .rs-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; color: var(--cc-muted); margin: 0 0 3px; }
        .rs-title { font-size: 15px; font-weight: 700; color: var(--cc-text); margin: 0; }
        .rs-sub { font-size: 12.5px; color: var(--cc-muted); margin: 3px 0 0; line-height: 1.45; overflow-wrap: anywhere; }
        .rs-btn { min-height: 38px; padding: 0 14px; border-radius: 11px; border: 1px solid var(--cc-primary-border); background: var(--cc-surface-solid);
          color: var(--cc-primary); font: inherit; font-size: 13.5px; font-weight: 650; cursor: pointer; flex-shrink: 0; }
        .rs-btn:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
        @media (max-width: 380px) { .rs { flex-wrap: wrap; } .rs-btn { width: 100%; } }
      `}</style>
      <span className="rs-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" />
        </svg>
      </span>
      <div className="rs-text">
        <p className="rs-eyebrow">Your records</p>
        {rows.length === 0 ? (
          <>
            <p className="rs-title">Keep your X-rays and reports here</p>
            <p className="rs-sub">Add past scans, surgery and discharge reports so your doctor sees your history.</p>
          </>
        ) : (
          <>
            <p className="rs-title">{rows.length} record{rows.length === 1 ? '' : 's'} saved</p>
            <p className="rs-sub">Latest: {latest.title}</p>
          </>
        )}
      </div>
      <button className="rs-btn" onClick={onOpen}>{rows.length ? 'Open' : 'Add'}</button>
    </section>
  );
}
