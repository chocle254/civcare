import { useState, useRef, useEffect } from 'react';

// getCurrentPosition has no default timeout — on a weak GPS/network fix it
// can hang forever with no feedback to the user. This adds a real timeout
// to the browser call plus a manual failsafe in case a device ignores it.
const GEO_TIMEOUT_MS = 8000;
const FAILSAFE_MS = 10000;

export default function useLocation() {
  const [coords,  setCoords]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const failsafeRef = useRef(null);

  useEffect(() => () => clearTimeout(failsafeRef.current), []);

  const getLocation = () => {
    setLoading(true);
    setError('');
    clearTimeout(failsafeRef.current);

    if (!navigator.geolocation) {
      setError('Location is not supported on this device.');
      setLoading(false);
      return;
    }

    // Failsafe: some browsers/devices don't honor the API's own timeout
    // option reliably, so this guarantees the spinner never hangs forever.
    failsafeRef.current = setTimeout(() => {
      setLoading(false);
      setError('Location is taking too long. Check your GPS/network and try again.');
    }, FAILSAFE_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(failsafeRef.current);
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        clearTimeout(failsafeRef.current);
        setError(
          err?.code === 1
            ? 'Location access denied. Please allow location access and try again.'
            : 'Could not get your location. Please allow location access.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 60000 }
    );
  };

  return { coords, error, loading, getLocation };
}
