// Patient app languages: English, Kiswahili (sanifu, plain words) and Sheng
// (the Nairobi / Gen Z mix). Doctor and admin screens stay in English.
//
// Two ways text gets translated:
// - t('English text') in code, for sentences that wrap a link or need
//   their words in a different order (consent wording, for example);
// - translateDom() swaps every other known interface string as the page
//   draws, from the phrase list in ./phrases.js. Anything not in the list
//   (names, symptoms, what the assistant or a doctor wrote) is left alone.

import { useEffect, useState } from 'react';
import { PHRASES, PATTERNS, KEYED } from './phrases';

export const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'sw', label: 'Kiswahili' },
  { id: 'sheng', label: 'Sheng' },
];
const KEY = 'civcare_lang';
const COL = { sw: 0, sheng: 1 };

const valid = (l) => LANGS.some((x) => x.id === l);

export function getLang() {
  try {
    const l = localStorage.getItem(KEY);
    if (valid(l)) return l;
    const p = JSON.parse(localStorage.getItem('civtech_patient') || 'null');
    if (p && valid(p.language)) return p.language;
  } catch { /* private mode */ }
  return 'en';
}

export function lookup(text, lang = getLang()) {
  if (lang === 'en' || !text) return null;
  const col = COL[lang];
  const hit = KEYED[text] ? null : PHRASES[text];
  if (hit) return hit[col] ?? hit[0];
  for (const [re, out] of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const tpl = out[col] ?? out[0];
      return tpl.replace(/\$(\d)/g, (_, i) => {
        const v = m[Number(i)] || '';
        return lookup(v, lang) ?? v;
      });
    }
  }
  return null;
}

export function t(text, vars) {
  const keyed = KEYED[text];
  let out = keyed ? keyed[{ en: 0, sw: 1, sheng: 2 }[getLang()]] : (lookup(text) ?? text);
  if (vars) Object.entries(vars).forEach(([k, v]) => { out = out.split(`{${k}}`).join(v); });
  return out;
}

// Switching language reloads the page, so everything redraws cleanly.
export async function setLang(lang, { save } = {}) {
  if (!valid(lang)) return;
  try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  try {
    const p = JSON.parse(localStorage.getItem('civtech_patient') || 'null');
    if (p) localStorage.setItem('civtech_patient', JSON.stringify({ ...p, language: lang }));
  } catch { /* ignore */ }
  if (save) { try { await save(lang); } catch { /* keep the local choice */ } }
  window.location.reload();
}

export function useLang() {
  const [lang] = useState(getLang);
  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'sw'; }, [lang]);
  return lang;
}
