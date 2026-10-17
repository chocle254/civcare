import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmArrival, getSession } from '../../api/triage';
import ArrivalWaiting from './ArrivalWaiting';
import Icon from '../../components/Icons';

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

// Pinned versions: "@latest" can change under us and break the page.
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LRM_CSS = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
const LRM_JS = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';

const formatKm = (m) => (m >= 10000 ? `${Math.round(m / 1000)} km` : `${(m / 1000).toFixed(1)} km`);
const formatDuration = (sec) => {
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export default function ArrivalConfirm() {
  const navigate = useNavigate();
  const [hospital] = useState(() => readJSON('civtech_hospital', {}));
  const [patient] = useState(() => readJSON('civtech_patient', {}));
  const [patientCoords] = useState(() => readJSON('civtech_patient_coords', null));

  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const [sessionData, setSessionData] = useState(null);
  const [isReady, setIsReady] = useState(false); // Controls if map is shown

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [route, setRoute] = useState(null); // { distance, time } from the router

  const hasCoords = !!(patientCoords && hospital.lat && hospital.lon);
  const directionsUrl = hospital.lat && hospital.lon
    ? `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}` +
      (patientCoords ? `&origin=${patientCoords.lat},${patientCoords.lon}` : '') + '&travelmode=driving'
    : null;

  // Load session data
  useEffect(() => {
    const sessionId = localStorage.getItem('civtech_session_id');
    if (!sessionId) return;

    const loadSession = async () => {
      try {
        const res = await getSession(sessionId);
        setSessionData(res.data);
      } catch (err) {
        console.error('Failed to load session data');
      }
    };
    loadSession();
  }, []);

  // Load Leaflet and Routing Machine dynamically
  useEffect(() => {
    if (!isReady) return; // Only load when user asks for the map

    const added = [];
    const addCss = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = href;
      document.head.appendChild(el);
      added.push(el);
    };
    const addScript = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing && existing.dataset.loaded) { resolve(); return; }
      const el = existing || document.createElement('script');
      el.src = src;
      el.async = true;
      el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve(); });
      el.addEventListener('error', reject);
      if (!existing) document.head.appendChild(el);
    });

    let alive = true;
    addCss(LEAFLET_CSS);
    addCss(LRM_CSS);
    addScript(LEAFLET_JS)
      .then(() => addScript(LRM_JS))
      .then(() => { if (alive) setMapReady(true); })
      .catch(() => { if (alive) setMapError('The map could not load. Use the directions link instead.'); });

    return () => { alive = false; };
  }, [isReady]);

  // Initialize Map and Routing
  useEffect(() => {
    if (!mapReady || !mapRef.current || !hasCoords) return undefined;
    if (mapInstance.current) return undefined;
    const L = window.L;

    const map = L.map(mapRef.current, { scrollWheelZoom: false })
      .setView([patientCoords.lat, patientCoords.lon], 13);
    mapInstance.current = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Show the whole trip straight away, even before the road route arrives.
    map.fitBounds(
      [[patientCoords.lat, patientCoords.lon], [hospital.lat, hospital.lon]],
      { padding: [36, 36] },
    );

    const control = L.Routing.control({
      waypoints: [
        L.latLng(patientCoords.lat, patientCoords.lon),
        L.latLng(hospital.lat, hospital.lon),
      ],
      show: false,               // no turn-by-turn panel covering the map
      collapsible: false,
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: '#1769aa', opacity: 0.9, weight: 5 }],
      },
      createMarker: function (i, wp, nWps) {
        if (i === 0) return L.marker(wp.latLng).bindPopup('You are here');
        if (i === nWps - 1) return L.marker(wp.latLng).bindPopup(hospital.name || 'Hospital');
        return null;
      },
    }).addTo(map);

    control.on('routesfound', (e) => {
      const summary = e.routes?.[0]?.summary;
      if (summary) setRoute({ distance: summary.totalDistance, time: summary.totalTime });
    });
    control.on('routingerror', () => setRoute(null));

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [mapReady, hasCoords, patientCoords, hospital]);

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const sessionId = localStorage.getItem('civtech_session_id');
      const res = await confirmArrival({
        session_id: sessionId,
        hospital_id: hospital.id,
        patient_id: patient.id,
      });
      localStorage.setItem('civtech_appointment_id', res.data.appointment_id);
      setConfirmed(true);
    } catch (err) {
      setError('Could not confirm arrival. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return <ArrivalWaiting />;
  }

  const a = sessionData?.assessment;
  const summaryItems = a && typeof a === 'object'
    ? [
        ['Main symptom', a.symptom],
        ['How long', a.duration],
        ['How bad it feels (your rating)', a.severity != null && a.severity !== '' ? `${a.severity}/10` : null],
        ['Other symptoms', a.associated],
      ].filter(([, v]) => v)
    : [];

  const distanceText = route
    ? formatKm(route.distance)
    : hospital.distance_km != null ? `${hospital.distance_km} km` : '—';

  return (
    <div className="ac">
      <main className="ac__main">
        <header className="ac__header">
          <button
            type="button"
            className="ac__back"
            onClick={() => navigate('/hospitals')}
            aria-label="Back to hospital selection"
          >
            <Icon.ChevronLeft size={20} />
          </button>
          <div className="ac__headtext">
            <p className="ac__eyebrow">Next step</p>
            <h1 className="ac__title">Confirm your arrival</h1>
            <p className="ac__sub">Check your destination, then check in when you get there.</p>
          </div>
        </header>

        <section className="ac__card ac__dest">
          <div className="ac__desttop">
            <span className="ac__facility" aria-hidden="true"><Icon.Hospital size={22} /></span>
            <div className="ac__destmeta">
              <p className="ac__label">Your hospital</p>
              <h2 className="ac__name">{hospital.name || 'Selected hospital'}</h2>
              {(hospital.town || hospital.county) && (
                <p className="ac__muted">
                  {[hospital.town, hospital.county].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <dl className="ac__stats">
            <div>
              <dt>{route ? 'By road' : 'Distance'}</dt>
              <dd>{distanceText}</dd>
            </div>
            <div>
              <dt>Travel time</dt>
              <dd>{route ? formatDuration(route.time) : hospital.travel_time || '—'}</dd>
            </div>
          </dl>

          {hospital.phone && (
            <a className="ac__phone" href={`tel:${hospital.phone.replace(/\s+/g, '')}`}>
              <Icon.Phone size={16} /> {hospital.phone}
            </a>
          )}
        </section>

        {summaryItems.length > 0 && (
          <section className="ac__card">
            <div className="ac__sechead">
              <div>
                <p className="ac__label">Shared with the doctor</p>
                <h2 className="ac__sectitle">What you told us</h2>
              </div>
              <span className="ac__ok" aria-hidden="true"><Icon.Check size={18} /></span>
            </div>
            <p className="ac__muted ac__helper">
              The doctor will see this, so you won't need to repeat it.
            </p>
            <dl className="ac__summary">
              {summaryItems.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="ac__card">
          <div className="ac__sechead">
            <div>
              <p className="ac__label">Route</p>
              <h2 className="ac__sectitle">Getting there</h2>
            </div>
          </div>

          {!isReady ? (
            <button
              type="button"
              className="ac__mapbtn"
              onClick={() => setIsReady(true)}
              disabled={!hasCoords}
            >
              <span className="ac__mapbtnicon" aria-hidden="true"><Icon.MapPin size={20} /></span>
              <span className="ac__mapbtntext">
                <strong>Show route on map</strong>
                <small>{hasCoords ? 'Loads a map from your location' : 'Your location is not available'}</small>
              </span>
              <Icon.Chevron size={18} className="ac__chev" />
            </button>
          ) : (
            <div className="ac__map">
              {!mapReady && !mapError && (
                <div className="ac__maploading">
                  <span className="ac__spinner" aria-hidden="true" />
                  <p>Loading map…</p>
                </div>
              )}
              {mapError && <div className="ac__maploading"><p>{mapError}</p></div>}
              <div ref={mapRef} className="ac__mapcanvas" />
            </div>
          )}

          {directionsUrl && (
            <a className="ac__directions" href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <Icon.ArrowRight size={16} /> Turn-by-turn directions in Google Maps
            </a>
          )}
        </section>

        {error && <div className="ac__error" role="alert">{error}</div>}
      </main>

      <div className="ac__bar">
        <div className="ac__barinner">
          <p className="ac__barcopy">
            <strong>Arrived at the hospital?</strong>
            <span>Check in so staff know you're here.</span>
          </p>
          <button type="button" className="ac__confirm" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <><span className="ac__spinner ac__spinner--btn" aria-hidden="true" /> Checking in…</>
            ) : (
              <>I've arrived, check me in <Icon.ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .ac {
          min-height: 100vh; min-height: 100dvh;
          background: var(--cc-canvas); background-attachment: fixed;
          color: var(--cc-text); font-family: var(--cc-font);
          padding-bottom: calc(150px + env(safe-area-inset-bottom));
        }
        .ac__main { width: min(760px, calc(100% - 32px)); margin: 0 auto; display: grid; gap: 14px; }
        .ac__header { display: flex; align-items: flex-start; gap: 12px; padding: 22px 0 6px; }
        .ac__back {
          width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px;
          display: grid; place-items: center; cursor: pointer;
          background: var(--cc-glass); border: 1px solid var(--cc-glass-border);
          box-shadow: var(--cc-glass-edge), var(--cc-shadow-sm); color: var(--cc-text-2);
        }
        .ac__headtext { min-width: 0; }
        .ac__eyebrow {
          margin: 2px 0 6px; color: var(--cc-primary);
          font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
        }
        .ac__title { margin: 0; font-size: clamp(26px, 6vw, 34px); line-height: 1.1; letter-spacing: -.02em; font-weight: 800; color: var(--cc-text); }
        .ac__sub { margin: 8px 0 0; color: var(--cc-muted); font-size: 14px; line-height: 1.5; }

        .ac__card {
          background: var(--cc-glass-strong); border: 1px solid var(--cc-glass-border);
          border-radius: 20px; padding: 18px;
          box-shadow: var(--cc-glass-edge), var(--cc-shadow);
        }
        .ac__label { margin: 0; color: var(--cc-muted); font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
        .ac__muted { margin: 0; color: var(--cc-muted); font-size: 13px; line-height: 1.5; }

        .ac__desttop { display: flex; align-items: center; gap: 14px; }
        .ac__facility {
          width: 48px; height: 48px; flex-shrink: 0; border-radius: 14px; display: grid; place-items: center;
          background: var(--cc-primary-soft); color: var(--cc-primary); box-shadow: var(--cc-clay);
        }
        .ac__destmeta { min-width: 0; }
        .ac__name { margin: 4px 0 2px; font-size: 18px; line-height: 1.3; font-weight: 800; color: var(--cc-text); overflow-wrap: anywhere; }
        .ac__stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0 0;
        }
        .ac__stats > div, .ac__summary > div {
          min-width: 0; padding: 12px; border-radius: 14px;
          background: var(--cc-surface-2); border: 1px solid var(--cc-border);
        }
        .ac__stats dt, .ac__summary dt { color: var(--cc-muted); font-size: 12px; font-weight: 600; }
        .ac__stats dd { margin: 4px 0 0; font-size: 18px; font-weight: 800; color: var(--cc-text); }
        .ac__phone, .ac__directions {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 14px;
          color: var(--cc-primary); font-size: 14px; font-weight: 700; text-decoration: none;
          min-height: 44px;
        }

        .ac__sechead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .ac__sectitle { margin: 4px 0 0; font-size: 18px; font-weight: 800; color: var(--cc-text); }
        .ac__ok {
          width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0;
          background: var(--cc-success-soft); color: var(--cc-success);
        }
        .ac__helper { margin: -4px 0 12px; }
        .ac__summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0; }
        .ac__summary dd { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: var(--cc-text); overflow-wrap: anywhere; }

        .ac__mapbtn {
          width: 100%; min-height: 68px; display: flex; align-items: center; gap: 12px; text-align: left;
          padding: 12px 14px; border-radius: 16px; cursor: pointer;
          background: var(--cc-surface-2); border: 1px solid var(--cc-border); color: var(--cc-text);
        }
        .ac__mapbtn:disabled { opacity: .6; cursor: not-allowed; }
        .ac__mapbtnicon {
          width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center;
          background: var(--cc-primary-soft); color: var(--cc-primary); box-shadow: var(--cc-clay);
        }
        .ac__mapbtntext { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ac__mapbtntext strong { font-size: 15px; }
        .ac__mapbtntext small { font-size: 13px; color: var(--cc-muted); }
        .ac__chev { margin-left: auto; color: var(--cc-faint); flex-shrink: 0; }

        /* isolation keeps Leaflet's high z-index panes from painting over the
           fixed check-in bar */
        .ac__map {
          position: relative; isolation: isolate; z-index: 0;
          height: clamp(260px, 45vh, 380px); border-radius: 16px; overflow: hidden;
          border: 1px solid var(--cc-border); background: var(--cc-surface-2);
        }
        .ac__mapcanvas { width: 100%; height: 100%; }
        .ac__maploading {
          position: absolute; inset: 0; z-index: 1000; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px; padding: 16px; text-align: center;
          background: var(--cc-surface-solid); color: var(--cc-muted); font-size: 14px;
        }
        .ac .leaflet-routing-container { display: none; }

        .ac__error {
          padding: 12px 14px; border-radius: 14px; font-size: 14px; font-weight: 600;
          background: var(--cc-danger-soft); border: 1px solid var(--cc-danger-border); color: var(--cc-danger);
        }

        .ac__bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 1100;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          background: var(--cc-glass-strong);
          -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur);
          border-top: 1px solid var(--cc-glass-border);
          box-shadow: var(--cc-glass-edge), 0 -10px 30px -12px rgba(16,36,64,.25);
        }
        .ac__barinner {
          width: min(760px, 100%); margin: 0 auto;
          display: flex; align-items: center; gap: 16px;
        }
        .ac__barcopy { margin: 0; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ac__barcopy strong { font-size: 15px; color: var(--cc-text); }
        .ac__barcopy span { font-size: 13px; color: var(--cc-muted); }
        .ac__confirm {
          flex-shrink: 0; min-height: 50px; padding: 0 20px; border: 0; border-radius: 14px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--cc-primary-grad); color: var(--cc-on-primary);
          font-size: 15px; font-weight: 700; box-shadow: var(--cc-primary-glow);
        }
        .ac__confirm:disabled { opacity: .65; cursor: wait; }

        .ac__spinner {
          display: inline-block; width: 26px; height: 26px; border-radius: 50%;
          border: 3px solid var(--cc-border); border-top-color: var(--cc-primary);
          animation: acSpin .8s linear infinite;
        }
        .ac__spinner--btn { width: 16px; height: 16px; border-width: 2px; border-color: rgba(255,255,255,.35); border-top-color: #fff; }
        @keyframes acSpin { to { transform: rotate(360deg); } }

        @media (max-width: 560px) {
          .ac__barinner { flex-direction: column; align-items: stretch; gap: 10px; }
          .ac__barcopy { flex-direction: row; flex-wrap: wrap; column-gap: 6px; }
          .ac__barcopy span { font-size: 13px; }
          .ac__confirm { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) { .ac__spinner { animation: none; } }
      `}</style>
    </div>
  );
}
