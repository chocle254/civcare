import { useState, useRef, useEffect, useCallback } from 'react';

// Getting a fix on phones is two different problems:
//   1. A high-accuracy GPS fix right after Location is switched on can take
//      20–40s (cold start). Asking only for that, with a short timeout, makes
//      the page give up before the phone is ready.
//   2. A quick network (Wi-Fi / cell tower) fix usually arrives in 1–3s and is
//      accurate enough to list nearby hospitals.
// So we ask for the quick fix first and only fall back to GPS if that fails.
// We also retry automatically when the user returns from their settings, so
// turning Location on doesn't require hunting for a "Try again" button.

const QUICK = { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 };
const PRECISE = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };
const FAILSAFE_MS = 50000; // covers both attempts; some devices ignore `timeout`

const MESSAGES = {
  unsupported: 'Location is not supported on this device or browser.',
  insecure: 'Location only works on a secure (https) connection.',
  denied:
    'Location is blocked for CivCare in your browser. Tap the lock or ⓘ icon next to the web address, ' +
    'set Location to Allow, then tap Try again.',
  unavailable:
    "We couldn't find your position. Make sure your phone's Location is on, then tap Try again.",
  timeout:
    'Finding your location is taking too long. Moving near a window or turning on Wi-Fi can help. Tap Try again.',
};

export default function useLocation() {
  const [coords,  setCoords]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const failsafeRef = useRef(null);
  const requestRef  = useRef(0);   // ignores callbacks from superseded attempts
  const coordsRef   = useRef(null);
  const loadingRef  = useRef(false);

  const finish = useCallback((id, next) => {
    if (id !== requestRef.current) return;
    clearTimeout(failsafeRef.current);
    loadingRef.current = false;
    setLoading(false);
    if (next.coords) {
      coordsRef.current = next.coords;
      setCoords(next.coords);
      setError('');
    } else {
      setError(next.error);
    }
  }, []);

  const getLocation = useCallback(() => {
    const id = ++requestRef.current;
    clearTimeout(failsafeRef.current);
    setError('');

    if (!window.isSecureContext) { setError(MESSAGES.insecure); return; }
    if (!navigator.geolocation)  { setError(MESSAGES.unsupported); return; }

    loadingRef.current = true;
    setLoading(true);
    failsafeRef.current = setTimeout(() => finish(id, { error: MESSAGES.timeout }), FAILSAFE_MS);

    const ok = (pos) => finish(id, {
      coords: { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy },
    });
    const fail = (err) => finish(id, {
      error: err?.code === 1 ? MESSAGES.denied : err?.code === 3 ? MESSAGES.timeout : MESSAGES.unavailable,
    });

    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (id !== requestRef.current) return;
        if (err?.code === 1) { fail(err); return; } // denied: GPS won't help
        navigator.geolocation.getCurrentPosition(ok, fail, PRECISE);
      },
      QUICK,
    );
  }, [finish]);

  // Retry automatically when the user comes back from Settings, or when the
  // browser reports the permission was just granted.
  useEffect(() => {
    const retryIfNeeded = () => {
      if (document.visibilityState === 'visible' && !coordsRef.current && !loadingRef.current) {
        getLocation();
      }
    };
    document.addEventListener('visibilitychange', retryIfNeeded);

    let status;
    const onPermChange = () => { if (status?.state === 'granted') retryIfNeeded(); };
    navigator.permissions?.query({ name: 'geolocation' })
      .then((s) => { status = s; s.addEventListener?.('change', onPermChange); })
      .catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', retryIfNeeded);
      status?.removeEventListener?.('change', onPermChange);
      clearTimeout(failsafeRef.current);
      requestRef.current += 1; // drop any in-flight callbacks after unmount
    };
  }, [getLocation]);

  return { coords, error, loading, getLocation };
}
