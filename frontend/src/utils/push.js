// Phone notifications (Web Push), the same way Fedha does it: the browser
// subscribes with its maker's push service and CivCare's server sends dose
// reminders to it, so they arrive while the app is closed.

import axios from 'axios';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const toBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhones only allow notifications once CivCare is added to the home screen.
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const permission = () => (pushSupported() ? Notification.permission : 'unsupported');

async function registration() {
  return navigator.serviceWorker.register('/push-sw.js');
}

async function save(sub) {
  await axios.post(`${API}/push/subscribe`, sub.toJSON());
}

// Ask once (must follow a tap), subscribe and register this phone.
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser can’t show notifications.');
  const result = await Notification.requestPermission();
  if (result !== 'granted') throw new Error(result === 'denied'
    ? 'Notifications are blocked. Allow them for this site in your browser settings.'
    : 'Notifications weren’t turned on.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await axios.get(`${API}/push/public-key`);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(data.key) });
  }
  await save(sub);
  return sub;
}

// On every app load: if already allowed, make sure the server has this phone
// linked to whoever is signed in now.
export async function refreshPush() {
  if (permission() !== 'granted' || !localStorage.getItem('civtech_token')) return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch { /* offline or blocked; try next time */ }
}

export async function sendTestPush() {
  const { data } = await axios.post(`${API}/push/test`);
  return data.message;
}

// Before signing out: stop this phone getting the person's reminders.
export async function pushSignOut() {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await axios.post(`${API}/push/unsubscribe`, { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* signing out must never fail */ }
}

export function listenForRotation() {
  if (!pushSupported()) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') refreshPush();
  });
}
