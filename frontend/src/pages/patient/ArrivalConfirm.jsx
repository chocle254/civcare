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
        styles: [{ color: '#1769aa', opacity: 0.85, weight: 5 }]
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
                    <span style={s.summaryKey}>How bad it feels (your rating)</span>
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
    background: 'var(--cc-canvas)', backgroundAttachment: 'fixed',
    color: '#162033',
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: 118,
  },

  main: {
    width: 'min(1080px, calc(100% - 32px))',
    margin: '0 auto',
  },

  header: {
    padding: '24px 0 22px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },

  back: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    border: '1px solid #e5e9f0',
    background: '#ffffff',
    color: '#65748b',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 2px 8px rgba(25,42,70,.04)',
  },

  backIcon: {
    fontSize: 27,
    lineHeight: 1,
    marginTop: -2,
  },

  headerText: {
    minWidth: 0,
    flex: 1,
  },

  eyebrow: {
    margin: '1px 0 6px',
    color: '#1769e0',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  title: {
    margin: 0,
    fontSize: 'clamp(27px, 5vw, 38px)',
    lineHeight: 1.08,
    letterSpacing: '-.9px',
    fontWeight: 800,
    color: '#162033',
  },

  sub: {
    margin: '9px 0 0',
    maxWidth: 620,
    color: '#68778d',
    fontSize: 13,
    lineHeight: 1.6,
  },

  content: {
    display: 'grid',
    gap: 14,
    paddingBottom: 20,
  },

  destinationCard: {
    background: '#ffffff',
    border: '1px solid #e5e9f0',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 5px 18px rgba(25,42,70,.035)',
  },

  destinationTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
  },

  facilityIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: '#edf5ff',
    color: '#1769e0',
    fontSize: 25,
    fontWeight: 500,
  },

  destinationMeta: {
    flex: 1,
    minWidth: 0,
  },

  cardLabel: {
    margin: 0,
    color: '#748196',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: .85,
    textTransform: 'uppercase',
  },

  hospitalName: {
    margin: '5px 0 3px',
    color: '#162033',
    fontSize: 17,
    lineHeight: 1.3,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },

  location: {
    margin: 0,
    color: '#748196',
    fontSize: 12,
    lineHeight: 1.45,
  },

  readyPill: {
    flexShrink: 0,
    padding: '5px 9px',
    borderRadius: 999,
    background: '#e8f7f1',
    color: '#168463',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: .7,
  },

  destinationDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    alignItems: 'stretch',
    gap: 18,
    marginTop: 18,
    paddingTop: 16,
    borderTop: '1px solid #edf0f4',
  },

  detail: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  detailDivider: {
    width: 1,
    background: '#e5e9f0',
  },

  detailLabel: {
    color: '#748196',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: .55,
  },

  detailValue: {
    color: '#26344a',
    fontSize: 13,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },

  summaryCard: {
    background: '#ffffff',
    border: '1px solid #e5e9f0',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 5px 18px rgba(25,42,70,.035)',
  },

  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },

  sectionTitle: {
    margin: '5px 0 0',
    color: '#162033',
    fontSize: 17,
    lineHeight: 1.25,
    fontWeight: 800,
    letterSpacing: '-.2px',
  },

  summaryIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: '#e8f7f1',
    color: '#168463',
    fontSize: 15,
    fontWeight: 800,
  },

  helper: {
    margin: '10px 0 16px',
    color: '#748196',
    fontSize: 12,
    lineHeight: 1.6,
  },

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },

  summaryItem: {
    minWidth: 0,
    padding: '12px 13px',
    background: '#f7f9fc',
    border: '1px solid #edf0f4',
    borderRadius: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  summaryKey: {
    color: '#748196',
    fontSize: 10.5,
    fontWeight: 700,
  },

  summaryVal: {
    color: '#26344a',
    fontSize: 12.5,
    lineHeight: 1.45,
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },

  mapCard: {
    background: '#ffffff',
    border: '1px solid #e5e9f0',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 5px 18px rgba(25,42,70,.035)',
  },

  mapHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },

  mapStatus: {
    flexShrink: 0,
    padding: '5px 8px',
    borderRadius: 999,
    background: '#f1f4f8',
    color: '#748196',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: .6,
  },

  mapButton: {
    width: '100%',
    minHeight: 68,
    border: '1px solid #e5e9f0',
    borderRadius: 15,
    background: '#f7f9fc',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#26344a',
    textAlign: 'left',
    cursor: 'pointer',
  },

  mapButtonIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: '#edf5ff',
    color: '#1769e0',
    fontSize: 20,
  },

  chevron: {
    marginLeft: 'auto',
    color: '#8a97a8',
    fontSize: 24,
    lineHeight: 1,
  },

  mapViewport: {
    height: 330,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    background: '#e9eef3',
    border: '1px solid #e1e7ee',
  },

  map: {
    width: '100%',
    height: '100%',
  },

  mapLoader: {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    background: 'rgba(255,255,255,.9)',
    color: '#68778d',
    fontSize: 12,
  },

  errorBox: {
    padding: '12px 14px',
    borderRadius: 13,
    background: '#fff3f3',
    border: '1px solid #f0cccc',
    color: '#b43a3a',
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 600,
  },

  actionBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    padding: '12px 16px 16px',
    background: 'rgba(255,255,255,.96)',
    borderTop: '1px solid #e5e9f0',
    boxShadow: '0 -6px 22px rgba(25,42,70,.06)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },

  actionInner: {
    width: 'min(1080px, 100%)',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },

  actionCopy: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },

  actionDot: {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRadius: '50%',
    background: '#1769e0',
  },

  btnPrimary: {
    minWidth: 205,
    minHeight: 44,
    border: 0,
    borderRadius: 11,
    padding: '0 16px',
    background: '#1769e0',
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 7px 18px rgba(23,105,224,.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  btnDisabled: {
    opacity: .6,
    cursor: 'wait',
  },

  buttonArrow: {
    fontSize: 17,
    lineHeight: 1,
  },
};

