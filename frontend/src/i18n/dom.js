// Swaps known English interface strings for the chosen language as React
// draws the page. Only exact matches from the phrase list change, so a
// patient's own words, names and AI replies are never touched. It changes
// text content only (never the page structure), which React tolerates.

import { getLang, lookup } from './index';

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = 'script,style,textarea,input,code,pre,[contenteditable="true"],[data-i18n-skip]';
const done = new WeakMap();   // text node -> the translation we wrote
const ENGLISH_ONLY = /^\/(doctor|admin|hospital)(\/|$)/;

const active = () => getLang() !== 'en' && !ENGLISH_ONLY.test(window.location.pathname);

function swap(raw) {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const key = m[2].replace(/\s+/g, ' ');
  if (!key) return null;
  const out = lookup(key);
  return out == null ? null : m[1] + out + m[3];
}

function textNode(n) {
  if (done.get(n) === n.nodeValue) return;
  const el = n.parentElement;
  if (!el || el.closest(SKIP)) return;
  const out = swap(n.nodeValue);
  if (out != null && out !== n.nodeValue) {
    n.nodeValue = out;
    done.set(n, out);
  }
}

function element(el) {
  if (el.closest(SKIP) && !el.matches('input,textarea')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const mark = `data-i18n-${a}`;
    if (el.getAttribute(mark) === v) continue;
    const out = swap(v);
    if (out != null) { el.setAttribute(a, out); el.setAttribute(mark, out); }
  }
}

function walk(root) {
  if (root.nodeType === 3) { textNode(root); return; }
  if (root.nodeType !== 1) return;
  element(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === 3) textNode(n); else element(n);
  }
}

export function translateDom() {
  if (getLang() === 'en') return;
  let queued = new Set();
  let timer = null;
  const flush = () => {
    timer = null;
    if (!active()) { queued = new Set(); return; }
    const batch = queued; queued = new Set();
    batch.forEach((n) => n.isConnected && walk(n));
  };
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') queued.add(m.target);
      else if (m.type === 'attributes') queued.add(m.target);
      else m.addedNodes.forEach((n) => queued.add(n));
    }
    if (!timer) timer = requestAnimationFrame(flush);
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Route changes in a single-page app don't reload; recheck on navigation.
  const recheck = () => { if (active()) walk(document.body); };
  window.addEventListener('popstate', recheck);
  recheck();
}
