import axios from 'axios';
import { LANGS, getLang, setLang } from '../i18n';

// English / Kiswahili / Sheng. Signed-in patients also save the choice on
// the server, so the assistant, SMS and notifications use it too.

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const saveOnServer = async (lang) => {
  if (!localStorage.getItem('civtech_token') || !localStorage.getItem('civtech_patient')) return;
  await axios.patch(`${API}/auth/patient/profile/update`, { language: lang });
};

export default function LanguagePicker({ compact = false }) {
  const current = getLang();
  return (
    <div className={`lp ${compact ? 'lp--compact' : ''}`} role="radiogroup" aria-label="Language / Lugha">
      <style>{`
        .lp { display: inline-flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--cc-surface-3); border: 1px solid var(--cc-border); flex-wrap: wrap; }
        .lp button { border: 0; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--cc-text-2);
          padding: 6px 12px; border-radius: 9px; cursor: pointer; min-height: 32px; }
        .lp button.is-on { background: var(--cc-surface-solid); color: var(--cc-primary); box-shadow: 0 1px 2px rgba(16,24,40,.12); }
        .lp button:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
        .lp--compact button { padding: 5px 10px; font-size: 12.5px; }
      `}</style>
      {LANGS.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={current === l.id}
          className={current === l.id ? 'is-on' : ''} data-i18n-skip=""
          onClick={() => current !== l.id && setLang(l.id, { save: saveOnServer })}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
