import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmArrival, getSession } from '../../api/triage';
import ArrivalWaiting from './ArrivalWaiting';

export default function ArrivalConfirm() {
  const navigate = useNavigate();
  const hospital = JSON.parse(localStorage.getItem('civtech_hospital') || '{}');
  const patient = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const patientCoords = JSON.parse(localStorage.getItem('civtech_patient_coords') || 'null');

  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const [sessionData, setSessionData] = useState(null);
  const [isReady, setIsReady] = useState(false); // Controls if map is shown

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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
    if (!isReady) return; // Only load when user clicks to show map

    const link1 = document.createElement('link');
    link1.rel = 'stylesheet';
    link1.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link1);

    const link2 = document.createElement('link');
    link2.rel = 'stylesheet';
    link2.href = 'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css';
    document.head.appendChild(link2);

    const script1 = document.createElement('script');
    script1.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script1.async = true;

    const script2 = document.createElement('script');
    script2.src = 'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js';
    script2.async = true;

    script1.onload = () => {
      document.head.appendChild(script2);
    };

    script2.onload = () => setMapReady(true);
    document.head.appendChild(script1);

    return () => {
      document.head.removeChild(link1);
      document.head.removeChild(link2);
      document.head.removeChild(script1);
      if (document.head.contains(script2)) document.head.removeChild(script2);
    };
  }, [isReady]);

  // Initialize Map and Routing
  useEffect(() => {
    if (!mapReady || !mapRef.current || !patientCoords || !hospital.lat || !hospital.lon) return;
    if (mapInstance.current) return;

    mapInstance.current = window.L.map(mapRef.current).setView([patientCoords.lat, patientCoords.lon], 13);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance.current);

    window.L.Routing.control({
      waypoints: [
        window.L.latLng(patientCoords.lat, patientCoords.lon),
        window.L.latLng(hospital.lat, hospital.lon)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: '#00d4aa', opacity: 0.8, weight: 5 }]
      },
      createMarker: function (i, wp, nWps) {
        if (i === 0) return window.L.marker(wp.latLng).bindPopup("You are here");
        else if (i === nWps - 1) return window.L.marker(wp.latLng).bindPopup(hospital.name);
      }
    }).addTo(mapInstance.current);

  }, [mapReady, patientCoords, hospital]);

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

  return (
    <div style={s.page}>
      <main style={s.main}>
        <header style={s.header}>
          <button
            type="button"
            style={s.back}
            onClick={() => navigate('/hospitals')}
            aria-label="Back to hospital selection"
          >
            <span style={s.backIcon}>‹</span>
          </button>

          <div style={s.headerText}>
            <p style={s.eyebrow}>CIVCARE • NEXT STEP</p>
            <h1 style={s.title}>Confirm your arrival</h1>
            <p style={s.sub}>Review your destination before checking in.</p>
          </div>
        </header>

        <section style={s.content}>
          <div style={s.destinationCard}>
            <div style={s.destinationTop}>
              <div style={s.facilityIcon}>
                <span>+</span>
              </div>
              <div style={s.destinationMeta}>
                <p style={s.cardLabel}>SELECTED FACILITY</p>
                <h2 style={s.hospitalName}>{hospital.name || 'Selected hospital'}</h2>
                <p style={s.location}>
                  {hospital.town || 'Location'}{hospital.county ? `, ${hospital.county}` : ''}
                </p>
              </div>
              <span style={s.readyPill}>READY</span>
            </div>

            <div style={s.destinationDetails}>
              <div style={s.detail}>
                <span style={s.detailLabel}>DISTANCE</span>
                <strong style={s.detailValue}>
                  {hospital.distance_km != null ? `${hospital.distance_km} km` : '—'}
                </strong>
              </div>
              <div style={s.detailDivider} />
              <div style={s.detail}>
                <span style={s.detailLabel}>NEXT STEP</span>
                <strong style={s.detailValue}>Confirm arrival</strong>
              </div>
            </div>
          </div>

          {sessionData?.assessment && (
            <section style={s.summaryCard}>
              <div style={s.sectionHeading}>
                <div>
                  <p style={s.cardLabel}>CARE SUMMARY</p>
                  <h2 style={s.sectionTitle}>Your triage information</h2>
                </div>
                <div style={s.summaryIcon}>✓</div>
              </div>

              <p style={s.helper}>
                This information will be available to the doctor so you do not have to repeat the same details.
              </p>

              <div style={s.summaryGrid}>
                {sessionData.assessment.symptom && (
                  <div style={s.summaryItem}>
                    <span style={s.summaryKey}>Primary symptom</span>
                    <span style={s.summaryVal}>{sessionData.assessment.symptom}</span>
                  </div>
                )}
                {sessionData.assessment.duration && (
                  <div style={s.summaryItem}>
                    <span style={s.summaryKey}>Duration</span>
                    <span style={s.summaryVal}>{sessionData.assessment.duration}</span>
                  </div>
                )}
                {sessionData.assessment.severity && (
                  <div style={s.summaryItem}>
                    <span style={s.summaryKey}>Severity</span>
                    <span style={s.summaryVal}>{sessionData.assessment.severity}/10</span>
                  </div>
                )}
                {sessionData.assessment.associated && (
                  <div style={s.summaryItem}>
                    <span style={s.summaryKey}>Other symptoms</span>
                    <span style={s.summaryVal}>{sessionData.assessment.associated}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section style={s.mapCard}>
            <div style={s.mapHeader}>
              <div>
                <p style={s.cardLabel}>ROUTE</p>
                <h2 style={s.sectionTitle}>Getting there</h2>
              </div>
              {!isReady && <span style={s.mapStatus}>MAP OPTIONAL</span>}
            </div>

            <p style={s.helper}>
              View the route from your current location to the selected facility.
            </p>

            {!isReady ? (
              <button type="button" style={s.mapButton} onClick={() => setIsReady(true)}>
                <span style={s.mapButtonIcon}>⌖</span>
                <span>
                  <strong>View route</strong>
                  <small>Load the map when you need directions</small>
                </span>
                <span style={s.chevron}>›</span>
              </button>
            ) : (
              <div style={s.mapViewport}>
                {!mapReady && (
                  <div style={s.mapLoader}>
                    <div className="spinner" />
                    <p>Loading route…</p>
                  </div>
                )}
                <div ref={mapRef} style={s.map} />
              </div>
            )}
          </section>

          {error && <div style={s.errorBox}>{error}</div>}
        </section>
      </main>

      <div style={s.actionBar}>
        <div style={s.actionInner}>
          <div style={s.actionCopy}>
            <span style={s.actionDot} />
            <div>
              <strong>Ready to check in?</strong>
              <span>Confirm once you have arrived at the facility.</span>
            </div>
          </div>

          <button
            type="button"
            style={{ ...s.btnPrimary, ...(loading ? s.btnDisabled : {}) }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="buttonSpinner" />
                Checking in…
              </>
            ) : (
              <>
                Confirm arrival
                <span style={s.buttonArrow}>→</span>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        .spinner,
        .buttonSpinner {
          display: inline-block;
          border-radius: 50%;
          animation: spin .8s linear infinite;
        }

        .spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #dbe5ef;
          border-top-color: #1769aa;
        }

        .buttonSpinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 700px) {
          .leaflet-control-container .leaflet-routing-container {
            max-width: 220px;
            font-size: 11px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .spinner, .buttonSpinner { animation: none; }
        }
      `}</style>
    </div>
  );
}
const s = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    color: '#14212f',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: 132
  },
  main: { maxWidth: 980, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '34px 24px 20px',
    background: '#f5f7fa'
  },
  back: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 14,
    border: '1px solid #dce4ec',
    background: '#fff',
    color: '#203040',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(25,45,65,.05)'
  },
  backIcon: { fontSize: 29, lineHeight: .8, marginTop: -3 },
  headerText: { flex: 1 },
  eyebrow: {
    margin: '2px 0 6px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.35,
    color: '#1769aa'
  },
  title: {
    margin: 0,
    fontSize: 'clamp(24px, 4vw, 32px)',
    lineHeight: 1.15,
    letterSpacing: -.7,
    fontWeight: 800,
    color: '#14212f'
  },
  sub: { margin: '7px 0 0', color: '#6b7b8c', fontSize: 14, lineHeight: 1.5 },
  content: { padding: '4px 24px 28px' },

  destinationCard: {
    background: '#fff',
    border: '1px solid #e2e8ef',
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 28px rgba(30,55,80,.06)',
    marginBottom: 16
  },
  destinationTop: { display: 'flex', alignItems: 'center', gap: 14 },
  facilityIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    flexShrink: 0,
    background: '#eaf4fb',
    color: '#1769aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 500
  },
  destinationMeta: { minWidth: 0, flex: 1 },
  cardLabel: {
    margin: 0,
    fontSize: 10,
    lineHeight: 1.2,
    letterSpacing: 1.25,
    fontWeight: 800,
    color: '#8291a0',
    textTransform: 'uppercase'
  },
  hospitalName: {
    margin: '5px 0 3px',
    fontSize: 19,
    lineHeight: 1.3,
    fontWeight: 750,
    color: '#182635'
  },
  location: { margin: 0, color: '#738292', fontSize: 13 },
  readyPill: {
    flexShrink: 0,
    padding: '6px 9px',
    borderRadius: 999,
    background: '#edf8f3',
    color: '#187653',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: .8
  },
  destinationDetails: {
    display: 'flex',
    alignItems: 'stretch',
    marginTop: 20,
    paddingTop: 17,
    borderTop: '1px solid #edf0f3'
  },
  detail: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 },
  detailDivider: { width: 1, background: '#e7edf2', margin: '0 18px' },
  detailLabel: { fontSize: 9, letterSpacing: 1, fontWeight: 800, color: '#93a0ad' },
  detailValue: { fontSize: 13, fontWeight: 700, color: '#334454' },

  summaryCard: {
    background: '#fff',
    border: '1px solid #e2e8ef',
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 28px rgba(30,55,80,.05)',
    marginBottom: 16
  },
  sectionHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { margin: '5px 0 0', fontSize: 17, fontWeight: 750, color: '#1c2a38' },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    background: '#edf8f3',
    color: '#187653',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800
  },
  helper: { margin: '11px 0 17px', color: '#7b8997', fontSize: 12.5, lineHeight: 1.55 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  summaryItem: {
    minWidth: 0,
    padding: '12px 13px',
    background: '#f7f9fb',
    border: '1px solid #edf1f4',
    borderRadius: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 5
  },
  summaryKey: { color: '#8996a3', fontSize: 10.5, fontWeight: 600 },
  summaryVal: { color: '#263746', fontSize: 13, fontWeight: 650, overflowWrap: 'anywhere' },

  mapCard: {
    background: '#fff',
    border: '1px solid #e2e8ef',
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 8px 28px rgba(30,55,80,.05)'
  },
  mapHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  mapStatus: {
    padding: '6px 9px',
    borderRadius: 999,
    background: '#f1f5f8',
    color: '#718090',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: .7
  },
  mapButton: {
    width: '100%',
    border: '1px solid #dfe7ee',
    background: '#f8fafc',
    borderRadius: 15,
    padding: '14px 15px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#263746',
    textAlign: 'left',
    cursor: 'pointer'
  },
  mapButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: '#eaf4fb',
    color: '#1769aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 21,
    flexShrink: 0
  },
  chevron: { marginLeft: 'auto', fontSize: 24, color: '#8291a0' },
  mapViewport: { height: 330, borderRadius: 16, overflow: 'hidden', position: 'relative', background: '#e9eef2', border: '1px solid #dfe7ee' },
  map: { width: '100%', height: '100%' },
  mapLoader: { position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.88)', color: '#687887', fontSize: 12 },
  errorBox: { marginTop: 16, padding: '12px 14px', borderRadius: 13, background: '#fff2f2', border: '1px solid #f3cccc', color: '#b43a3a', fontSize: 12.5, fontWeight: 600 },

  actionBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    padding: '14px 24px 20px',
    background: 'rgba(255,255,255,.94)',
    borderTop: '1px solid #dfe6ed',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)'
  },
  actionInner: {
    maxWidth: 980,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 22
  },
  actionCopy: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 },
  actionDot: { width: 9, height: 9, borderRadius: '50%', background: '#1769aa', flexShrink: 0 },
  actionCopy: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 },
  btnPrimary: {
    minWidth: 210,
    border: 0,
    borderRadius: 13,
    padding: '14px 18px',
    background: '#1769aa',
    color: '#fff',
    fontSize: 14,
    fontWeight: 750,
    cursor: 'pointer',
    boxShadow: '0 7px 18px rgba(23,105,170,.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  btnDisabled: { opacity: .65, cursor: 'wait' },
  buttonArrow: { fontSize: 18, lineHeight: 1 },
  actionCopy: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 },
  actionCopyText: { minWidth: 0 },
};
