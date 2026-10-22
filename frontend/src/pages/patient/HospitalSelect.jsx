import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { getNearbyHospitals } from '../../api/hospitals';
import useLocation from '../../hooks/useLocation';
import { confirmArrival } from '../../api/triage';

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */

const Icon = ({ name, size = 20, stroke = 'currentColor' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    hospital: (
      <>
        <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V21" />
        <path d="M2 21h20" />
        <path d="M9 9h6" />
        <path d="M12 6v6" />
        <path d="M8 15h2" />
        <path d="M14 15h2" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18c4 0 4-6 8-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    phone: (
      <>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10" />
        <path d="M3 4v6h6" />
        <path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14" />
        <path d="M21 20v-6h-6" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
};

/* ─────────────────────────────────────────────
   Leaflet markers
───────────────────────────────────────────── */

const userIcon = L.divIcon({
  className: '',
  html: `
    <div class="civ-user-marker">
      <div class="civ-user-pulse"></div>
      <div class="civ-user-core"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const hospitalIcon = (selected = false) =>
  L.divIcon({
    className: '',
    html: `
      <div class="civ-map-marker ${selected ? 'selected' : ''}">
        <div class="civ-map-marker-inner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="white" stroke-width="2.2" stroke-linecap="round">
            <path d="M12 6v12M6 12h12"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [selected ? 42 : 34, selected ? 42 : 34],
    iconAnchor: [selected ? 21 : 17, selected ? 42 : 34],
  });

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return;

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [42, 42],
      maxZoom: 14,
    });
  }, [points, map]);

  return null;
}

/* ─────────────────────────────────────────────
   Routing
───────────────────────────────────────────── */

async function fetchRoute(from, to) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.routes?.[0]?.geometry?.coordinates;

    if (!coords?.length) throw new Error('No route');

    return coords.map(([lon, lat]) => [lat, lon]);
  } catch {
    return [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ];
  }
}

/* ─────────────────────────────────────────────
   Data helpers
───────────────────────────────────────────── */

function getSpecialties(hospital) {
  const values =
    hospital.specialties ||
    hospital.specializations ||
    hospital.available_specialties ||
    hospital.services ||
    [];

  if (Array.isArray(values)) return values.filter(Boolean);
  if (typeof values === 'string') {
    return values
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getCareReason(hospital) {
  return (
    hospital.match_reason ||
    hospital.recommendation_reason ||
    hospital.care_reason ||
    ''
  );
}

function getStatus(hospital) {
  if (
    hospital.is_open === true ||
    hospital.open === true ||
    hospital.operating === true
  ) {
    return 'Open';
  }

  if (
    hospital.is_open === false ||
    hospital.open === false ||
    hospital.operating === false
  ) {
    return 'Closed';
  }

  return '';
}

function getDistance(hospital) {
  const value = Number(hospital.distance_km);

  return Number.isFinite(value)
    ? `${value.toFixed(value < 10 ? 1 : 0)} km`
    : 'Distance unavailable';
}

const SAVED_LOCATION_KEY = 'civcare_last_location';

function readSavedLocation() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_LOCATION_KEY) || 'null');
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lon) ? v : null;
  } catch {
    return null;
  }
}

// " today" / " yesterday" / " on 12 Oct", for the "near where you were" note
function savedWhen(at) {
  if (!at) return '';
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return ' earlier today';
  if (d.toDateString() === yesterday.toDateString()) return ' yesterday';
  return ` on ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`;
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */

export default function HospitalSelect() {
  const navigate = useNavigate();

  const {
    coords,
    error: locError,
    loading: locLoading,
    getLocation,
  } = useLocation();

  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // The last position this phone gave us. The first visit needs Location
  // on; after that, if it's off, we search from where they last were.
  const [saved, setSaved] = useState(readSavedLocation);
  const fallback = locError && !coords ? saved : null;
  // Where we search from: the live position, else the saved one.
  const origin = coords || fallback;

  useEffect(() => {
    if (!coords) return;
    const next = { lat: coords.lat, lon: coords.lon, at: Date.now() };
    try { localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setSaved(next);
  }, [coords]);

  useEffect(() => {
    getLocation();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!origin) return;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await getNearbyHospitals(origin.lat, origin.lon);
        setHospitals(Array.isArray(res.data) ? res.data : []);
      } catch {
        setError('Could not load hospitals. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [origin]);

  const orderedHospitals = useMemo(() => {
    /*
      If the backend eventually supplies a recommendation_score,
      relevance_score, or care_match field, the UI can use it here.

      For now we preserve the backend's ordering rather than pretending
      that CivCare knows a clinical recommendation that it does not yet
      receive from the API.
    */
    return hospitals;
  }, [hospitals]);

  const handlePick = (hospital) => {
    if (!origin) return;

    setSelected(hospital);

    // A saved position may be stale, so don't draw a route from it.
    if (!coords) {
      setRouteCoords(null);
      return;
    }

    setRouteCoords([
      [coords.lat, coords.lon],
      [hospital.lat, hospital.lon],
    ]);

    fetchRoute(coords, hospital).then(setRouteCoords);
  };

  const handleConfirm = async () => {
    if (!selected || confirming) return;

    setConfirming(true);

    const hospital = selected;

    localStorage.setItem(
      'civtech_hospital',
      JSON.stringify(hospital)
    );

    if (coords) {
      localStorage.setItem(
        'civtech_patient_coords',
        JSON.stringify(coords)
      );
    }

    const sessionId = localStorage.getItem('civtech_session_id');
    const patient = JSON.parse(
      localStorage.getItem('civtech_patient') || '{}'
    );

    if (sessionId) {
      try {
        const { selectHospital } = await import('../../api/triage');

        await selectHospital({
          session_id: sessionId,
          hospital_id: hospital.id,
          patient_id: patient.id,
          hospital_name: hospital.name,
        });

        const apptRes = await confirmArrival({
          patient_id: patient.id,
          hospital_id: hospital.id,
          session_id: sessionId,
        });

        localStorage.setItem(
          'civtech_appointment_id',
          apptRes.data.appointment_id
        );

        navigate('/arrival');
      } catch {
        setError(
          'Could not confirm hospital selection. Please try again.'
        );
        setConfirming(false);
      }
    } else {
      navigate('/chat', {
        state: { mode: 'pre_hospital' },
      });
    }
  };

  const boundsPoints = useMemo(() => {
    if (selected && routeCoords) return routeCoords;

    if (!origin) return [];

    return [
      [origin.lat, origin.lon],
      ...orderedHospitals
        .filter((hospital) => hospital.lat && hospital.lon)
        .map((hospital) => [hospital.lat, hospital.lon]),
    ];
  }, [selected, routeCoords, origin, orderedHospitals]);

  return (
    <div className="hospital-page">
      <main className="hospital-main">

        {/* ───────────── Top navigation ───────────── */}

        <header className="hospital-header">
          <button
            className="icon-button"
            onClick={() => navigate('/dashboard')}
            aria-label="Go back"
          >
            <Icon name="back" size={19} />
          </button>

          <div className="header-context">
            <span>CARE LOCATION</span>
            <strong>Choose a hospital</strong>
          </div>
        </header>

        {/* ───────────── Intro ───────────── */}

        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot"></span>
              NEARBY CARE
            </div>

            <h1>Find the right place for care.</h1>

            <p>
              We found hospitals near your current location.
              Review the distance and available information before
              choosing where you want to go.
            </p>
          </div>

          <div className="location-chip">
            <span className="location-chip-icon">
              <Icon name="pin" size={15} />
            </span>

            <span>
              {coords ? 'Your location' : fallback ? 'Last known location' : 'Locating you…'}
            </span>
          </div>
        </section>

        {/* ───────────── Map ───────────── */}

        {origin && (
          <section className="map-card">
            <MapContainer
              center={[origin.lat, origin.lon]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={false}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {coords && (
                <Marker
                  position={[coords.lat, coords.lon]}
                  icon={userIcon}
                />
              )}

              {orderedHospitals.map((hospital) => (
                <Marker
                  key={hospital.id}
                  position={[hospital.lat, hospital.lon]}
                  icon={hospitalIcon(selected?.id === hospital.id)}
                  eventHandlers={{
                    click: () => handlePick(hospital),
                  }}
                />
              ))}

              {routeCoords && (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: '#2563EB',
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '1 9',
                    lineCap: 'round',
                  }}
                />
              )}

              <FitBounds points={boundsPoints} />
            </MapContainer>

            <div className="map-overlay-top">
              <div className="map-live">
                <span></span>
                {coords ? 'Live location' : 'Last known location'}
              </div>

              <div className="map-count">
                {orderedHospitals.length} nearby
              </div>
            </div>

            {selected && (
              <div className="route-banner">
                <div className="route-banner-icon">
                  <Icon name="route" size={16} />
                </div>

                <div>
                  <small>ROUTE PREVIEW</small>
                  <strong>{selected.name}</strong>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ───────────── Location states ───────────── */}

        {locLoading && (
          <section className="state-card">
            <div className="loader"></div>

            <strong>Finding your location</strong>

            <p>
              We need your location to show nearby hospitals.
            </p>
          </section>
        )}

        {locError && !coords && !fallback && (
          <section className="error-card">
            <div className="error-icon">
              <Icon name="pin" size={20} />
            </div>

            <div>
              <strong>Turn on Location to find hospitals</strong>
              <p>{locError}</p>
            </div>

            <button onClick={getLocation}>
              <Icon name="refresh" size={16} />
              Try again
            </button>
          </section>
        )}

        {fallback && (
          <section className="fallback-note">
            <Icon name="pin" size={16} />
            <p>
              Location is off, so these are hospitals near where you were
              {savedWhen(fallback.at)}. Turn Location on for results from where you are now.
            </p>
            <button onClick={getLocation}>
              <Icon name="refresh" size={14} />
              Try again
            </button>
          </section>
        )}

        {/* ───────────── Hospital results ───────────── */}

        {loading && (
          <section className="state-card compact">
            <div className="loader"></div>

            <strong>Finding nearby hospitals</strong>

            <p>
              Checking facilities around your location…
            </p>
          </section>
        )}

        {error && !loading && (
          <div className="inline-error">
            {error}
          </div>
        )}

        {!loading && orderedHospitals.length > 0 && (
          <section className="results-section">

            <div className="results-heading">
              <div>
                <span className="section-kicker">AVAILABLE FACILITIES</span>
                <h2>{fallback ? 'Hospitals near your last location' : 'Hospitals near you'}</h2>
              </div>

              <span className="result-count">
                {orderedHospitals.length}
              </span>
            </div>

            <div className="care-note">
              <div className="care-note-icon">
                <Icon name="hospital" size={18} />
              </div>

              <div>
                <strong>How to choose</strong>
                <p>
                  Consider the care available, distance and travel
                  time. Your doctor will make the clinical decisions
                  after you arrive.
                </p>
              </div>
            </div>

            <div className="hospital-list">
              {orderedHospitals.map((hospital, index) => {
                const isSelected =
                  selected?.id === hospital.id;

                const specialties = getSpecialties(hospital);
                const careReason = getCareReason(hospital);
                const status = getStatus(hospital);

                return (
                  <article
                    key={hospital.id}
                    className={`hospital-card ${
                      isSelected ? 'selected' : ''
                    }`}
                    style={{
                      animationDelay: `${index * 45}ms`,
                    }}
                    onClick={() => handlePick(hospital)}
                  >
                    {hospital.is_testing && (
                      <span className="testing-badge">
                        TEST MODE
                      </span>
                    )}

                    <div className="hospital-card-top">

                      <div className="facility-icon">
                        <Icon name="hospital" size={23} />
                      </div>

                      <div className="facility-main">
                        <div className="facility-name-row">
                          <h3>{hospital.name}</h3>

                          {isSelected && (
                            <span className="selected-mark">
                              <Icon name="check" size={12} />
                            </span>
                          )}
                        </div>

                        <p className="facility-location">
                          {hospital.town || 'Nearby facility'}
                          {hospital.county
                            ? `, ${hospital.county}`
                            : ''}
                        </p>
                      </div>

                      <div className="distance-block">
                        <strong>{getDistance(hospital)}</strong>

                        {hospital.travel_time && (
                          <span>
                            {hospital.travel_time}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="facility-divider"></div>

                    <div className="facility-details">

                      {careReason && (
                        <div className="detail-pill primary">
                          <span className="detail-dot"></span>
                          {careReason}
                        </div>
                      )}

                      {specialties.length > 0 && (
                        <div className="specialty-row">
                          {specialties.slice(0, 3).map(
                            (specialty) => (
                              <span
                                className="specialty-pill"
                                key={specialty}
                              >
                                {specialty}
                              </span>
                            )
                          )}

                          {specialties.length > 3 && (
                            <span className="specialty-more">
                              +{specialties.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="facility-meta-row">

                        {status && (
                          <span
                            className={`status ${
                              status === 'Open'
                                ? 'open'
                                : 'closed'
                            }`}
                          >
                            <span></span>
                            {status}
                          </span>
                        )}

                        {hospital.phone && (
                          <span className="meta-item">
                            <Icon name="phone" size={13} />
                            {hospital.phone}
                          </span>
                        )}

                        {!status &&
                          !hospital.phone && (
                            <span className="meta-item">
                              <Icon name="route" size={13} />
                              Nearby facility
                            </span>
                          )}

                        <span className="select-hint">
                          {isSelected
                            ? 'Selected'
                            : 'View route'}
                          <Icon
                            name={
                              isSelected
                                ? 'check'
                                : 'chevron'
                            }
                            size={14}
                          />
                        </span>

                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ───────────── Empty state ───────────── */}

        {!loading &&
          origin &&
          orderedHospitals.length === 0 && (
            <section className="empty-card">
              <div className="empty-icon">
                <Icon name="hospital" size={26} />
              </div>

              <h2>No hospitals found nearby</h2>

              <p>
                We couldn't find a facility within the available
                search area. You can still speak with a doctor
                online.
              </p>

              <button
                className="secondary-action"
                onClick={() => navigate('/consultation')}
              >
                Consult a doctor online
              </button>
            </section>
          )}

        <div
          style={{
            height: selected ? 155 : 105,
          }}
        />
      </main>

      {/* ───────────── Selected hospital action ───────────── */}

      {selected && (
        <div className="selection-shell">
          <div className="selection-bar">

            <div className="selection-info">
              <span>HOSPITAL SELECTED</span>
              <strong>{selected.name}</strong>

              <div>
                <Icon name="route" size={13} />
                {getDistance(selected)}
                {selected.travel_time
                  ? ` · ${selected.travel_time}`
                  : ''}
              </div>
            </div>

            <button
              className="continue-button"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <span className="button-loader"></span>
              ) : (
                <>
                  Continue
                  <Icon name="chevron" size={17} />
                </>
              )}
            </button>

          </div>
        </div>
      )}

      

      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        button {
          font-family: inherit;
        }

        button:focus-visible {
          outline: 3px solid rgba(37, 99, 235, .16);
          outline-offset: 2px;
        }

        .hospital-page {
          --hs-bg: #f5f7fa;
          --hs-surface: #ffffff;
          --hs-surface-soft: #f7f9fb;
          --hs-border: #e1e6ed;
          --hs-border-strong: #d5dce5;
          --hs-text: #172033;
          --hs-text-soft: #344157;
          --hs-muted: #6d788a;
          --hs-faint: #8993a3;
          --hs-primary: #1769aa;
          --hs-primary-strong: #12578e;
          --hs-primary-soft: #edf6fb;
          --hs-success: #258457;
          --hs-success-bg: #eaf7f0;
          --hs-warning: #9a6a15;
          --hs-warning-bg: #fff4df;
          --hs-danger: #bb4646;
          --hs-danger-bg: #fdecec;

          min-height: 100vh;
          width: 100%;
          background: var(--cc-canvas); background-attachment: fixed;
          color: var(--hs-text);
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
          padding-bottom: 105px;
        }

        .hospital-main {
          width: min(1180px, calc(100% - 56px));
          margin: 0 auto;
          padding: 28px 0 40px;
        }

        /* ───────────── Header ───────────── */

        .hospital-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 27px;
        }

        .icon-button {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 1px solid var(--hs-border);
          background: var(--hs-surface);
          color: var(--hs-text-soft);
          border-radius: 12px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: border-color .16s ease, transform .16s ease;
        }

        .icon-button:hover {
          border-color: #c8d3df;
          transform: translateY(-1px);
        }

        .header-context {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .header-context span {
          color: var(--hs-faint);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .8px;
        }

        .header-context strong {
          color: var(--hs-text);
          font-size: 14px;
          font-weight: 750;
        }

        /* ───────────── Intro ───────────── */

        .intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 23px;
        }

        .intro > div:first-child {
          max-width: 700px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
          color: var(--hs-primary);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .8px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--hs-primary);
        }

        .intro h1 {
          margin: 0;
          color: var(--hs-text);
          font-size: clamp(28px, 4vw, 34px);
          line-height: 1.12;
          letter-spacing: -.7px;
          font-weight: 800;
        }

        .intro p {
          max-width: 650px;
          margin: 8px 0 0;
          color: var(--hs-muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .location-chip {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 13px 0 8px;
          border: 1px solid var(--hs-border);
          border-radius: 999px;
          background: var(--hs-surface);
          color: var(--hs-text-soft);
          font-size: 12px;
          font-weight: 700;
        }

        .location-chip-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--hs-primary-soft);
          color: var(--hs-primary);
        }

        /* ───────────── Map ───────────── */

        .map-card {
          position: relative;
          width: 100%;
          height: 365px;
          overflow: hidden;
          margin-bottom: 25px;
          border: 1px solid var(--hs-border);
          border-radius: 18px;
          background: #e9eef4;
          box-shadow: 0 5px 18px rgba(31, 51, 75, .045);
        }

        .map-overlay-top {
          position: absolute;
          top: 14px;
          left: 14px;
          right: 14px;
          z-index: 500;
          display: flex;
          justify-content: space-between;
          pointer-events: none;
        }

        .map-live,
        .map-count {
          display: flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 11px;
          border: 1px solid rgba(220, 226, 234, .95);
          border-radius: 10px;
          background: rgba(255, 255, 255, .94);
          color: var(--hs-text-soft);
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 13px rgba(20, 40, 70, .09);
        }

        .map-live span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a374;
        }

        .route-banner {
          position: absolute;
          left: 14px;
          bottom: 14px;
          z-index: 500;
          display: flex;
          align-items: center;
          gap: 10px;
          width: min(340px, calc(100% - 28px));
          padding: 10px 12px;
          border: 1px solid rgba(220, 226, 234, .95);
          border-radius: 13px;
          background: rgba(255, 255, 255, .95);
          box-shadow: 0 7px 20px rgba(20, 40, 70, .12);
        }

        .route-banner-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: var(--hs-primary-soft);
          color: var(--hs-primary);
        }

        .route-banner small {
          display: block;
          margin-bottom: 2px;
          color: var(--hs-faint);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .7px;
        }

        .route-banner strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--hs-text);
          font-size: 12px;
        }

        .leaflet-container {
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #e9eef4;
        }

        .leaflet-control-attribution {
          font-size: 8px !important;
          background: rgba(255,255,255,.82) !important;
        }

        .leaflet-control-zoom {
          display: none;
        }

        /* ───────────── Results ───────────── */

        .results-section {
          width: 100%;
        }

        .results-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 13px;
        }

        .section-kicker {
          display: block;
          margin-bottom: 4px;
          color: var(--hs-faint);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .8px;
        }

        .results-heading h2 {
          margin: 0;
          color: var(--hs-text);
          font-size: 20px;
          letter-spacing: -.3px;
          font-weight: 800;
        }

        .result-count {
          min-width: 30px;
          height: 30px;
          padding: 0 9px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: var(--hs-primary-soft);
          color: var(--hs-primary);
          font-size: 12px;
          font-weight: 800;
        }

        .care-note {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 15px;
          padding: 13px 14px;
          border: 1px solid #cfe7f4;
          border-radius: 13px;
          background: #eef7fc;
        }

        .care-note-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #dff0f8;
          color: var(--hs-primary);
        }

        .care-note strong {
          display: block;
          margin-bottom: 3px;
          color: #28617e;
          font-size: 12px;
          font-weight: 750;
        }

        .care-note p {
          margin: 0;
          color: #5d7485;
          font-size: 12px;
          line-height: 1.5;
        }

        .hospital-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .hospital-card {
          position: relative;
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--hs-border);
          border-radius: 18px;
          background: var(--hs-surface);
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(31, 51, 75, .04);
          animation: civFadeUp .35s ease both;
          transition:
            transform .16s ease,
            border-color .16s ease,
            box-shadow .16s ease;
        }

        .hospital-card:hover {
          transform: translateY(-2px);
          border-color: #c7d7e5;
          box-shadow: 0 9px 25px rgba(31, 51, 75, .07);
        }

        .hospital-card.selected {
          border-color: #5b91bd;
          box-shadow:
            0 8px 24px rgba(23, 105, 170, .09),
            inset 0 0 0 1px rgba(23, 105, 170, .08);
        }

        .hospital-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .facility-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: var(--hs-primary-soft);
          color: var(--hs-primary);
        }

        .facility-main {
          min-width: 0;
          flex: 1;
        }

        .facility-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .facility-name-row h3 {
          min-width: 0;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--hs-text);
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -.15px;
        }

        .selected-mark {
          width: 19px;
          height: 19px;
          flex: 0 0 19px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--hs-primary);
          color: #fff;
        }

        .facility-location {
          margin: 5px 0 0;
          color: var(--hs-muted);
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .distance-block {
          flex: 0 0 auto;
          text-align: right;
        }

        .distance-block strong {
          display: block;
          color: var(--hs-primary);
          font-size: 13px;
          font-weight: 800;
        }

        .distance-block span {
          display: block;
          margin-top: 3px;
          color: var(--hs-faint);
          font-size: 10px;
        }

        .facility-divider {
          height: 1px;
          margin: 16px 0 13px;
          background: #edf0f4;
        }

        .facility-details {
          min-width: 0;
        }

        .detail-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: 100%;
          margin-bottom: 9px;
          padding: 6px 9px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border-radius: 8px;
          background: var(--hs-success-bg);
          color: var(--hs-success);
          font-size: 10px;
          font-weight: 750;
        }

        .detail-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 6px;
          border-radius: 50%;
          background: #258457;
        }

        .specialty-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 11px;
        }

        .specialty-pill {
          padding: 5px 8px;
          border: 1px solid #e1e6ed;
          border-radius: 7px;
          background: #f7f9fb;
          color: #5e6b7d;
          font-size: 10px;
          font-weight: 650;
        }

        .specialty-more {
          align-self: center;
          color: var(--hs-muted);
          font-size: 10px;
          font-weight: 700;
        }

        .facility-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .status,
        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          color: var(--hs-muted);
          font-size: 10px;
          font-weight: 650;
        }

        .status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9aa5b4;
        }

        .status.open {
          color: var(--hs-success);
        }

        .status.open span {
          background: #258457;
        }

        .status.closed {
          color: var(--hs-warning);
        }

        .status.closed span {
          background: #d89b2b;
        }

        .select-hint {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-left: auto;
          color: var(--hs-muted);
          font-size: 10px;
          font-weight: 750;
        }

        .hospital-card.selected .select-hint {
          color: var(--hs-primary);
        }

        .testing-badge {
          position: absolute;
          top: -7px;
          right: 14px;
          padding: 4px 8px;
          border: 1px solid #fed7aa;
          border-radius: 999px;
          background: #fff7ed;
          color: #c2410c;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .5px;
        }

        /* ───────────── States ───────────── */

        .state-card {
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          padding: 30px 25px;
          border: 1px solid var(--hs-border);
          border-radius: 18px;
          background: var(--hs-surface);
          text-align: center;
        }

        .state-card.compact {
          min-height: 135px;
        }

        .state-card strong {
          margin-top: 13px;
          color: var(--hs-text);
          font-size: 14px;
          font-weight: 750;
        }

        .state-card p {
          margin: 5px 0 0;
          color: var(--hs-muted);
          font-size: 12px;
        }

        .loader {
          width: 28px;
          height: 28px;
          border: 3px solid #e3e8ee;
          border-top-color: var(--hs-primary);
          border-radius: 50%;
          animation: civSpin .75s linear infinite;
        }

        .error-card {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 14px;
          border: 1px solid #f3caca;
          border-radius: 14px;
          background: #fff7f7;
        }

        .error-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: var(--hs-danger-bg);
          color: var(--hs-danger);
        }

        .error-card > div:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        .error-card strong {
          display: block;
          margin-bottom: 3px;
          color: #a63d3d;
          font-size: 12px;
        }

        .error-card p {
          margin: 0;
          color: #7d5151;
          font-size: 11px;
          line-height: 1.5;
        }

        .error-card button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: #a63d3d;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .inline-error {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #f3caca;
          border-radius: 11px;
          background: #fff7f7;
          color: #a63d3d;
          font-size: 11px;
          font-weight: 650;
        }

        .fallback-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 10px;
          padding: 12px 14px;
          border: 1px solid var(--hs-border);
          border-radius: 14px;
          background: var(--hs-surface);
          color: var(--hs-text-soft);
        }

        .fallback-note p {
          flex: 1;
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
        }

        .fallback-note button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .empty-card {
          margin-top: 8px;
          padding: 44px 25px;
          border: 1px solid var(--hs-border);
          border-radius: 18px;
          background: var(--hs-surface);
          text-align: center;
        }

        .empty-icon {
          width: 55px;
          height: 55px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: var(--hs-primary-soft);
          color: var(--hs-primary);
        }

        .empty-card h2 {
          margin: 0 0 7px;
          color: var(--hs-text);
          font-size: 19px;
        }

        .empty-card p {
          max-width: 430px;
          margin: 0 auto 19px;
          color: var(--hs-muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .secondary-action {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid var(--hs-border-strong);
          border-radius: 11px;
          background: var(--hs-surface);
          color: var(--hs-text-soft);
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        /* ───────────── Selected hospital bar ───────────── */

        .selection-shell {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 72px;
          z-index: 900;
          display: flex;
          justify-content: center;
          padding: 0 16px;
          pointer-events: none;
        }

        .selection-bar {
          width: min(720px, 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 13px 12px 16px;
          border: 1px solid #dfe5eb;
          border-radius: 16px;
          background: var(--hs-surface);
          box-shadow: 0 15px 40px rgba(20, 40, 70, .15);
          pointer-events: auto;
          animation: civBarUp .25s ease both;
        }

        .selection-info {
          min-width: 0;
        }

        .selection-info > span {
          display: block;
          margin-bottom: 3px;
          color: var(--hs-faint);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .7px;
        }

        .selection-info strong {
          display: block;
          max-width: 390px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--hs-text);
          font-size: 13px;
          font-weight: 750;
        }

        .selection-info > div {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          color: var(--hs-muted);
          font-size: 10px;
        }

        .continue-button {
          min-width: 124px;
          height: 43px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: 0;
          border-radius: 11px;
          background: var(--hs-primary);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 7px 17px rgba(23, 105, 170, .2);
          transition: background .16s ease, transform .16s ease;
        }

        .continue-button:hover {
          background: var(--hs-primary-strong);
          transform: translateY(-1px);
        }

        .continue-button:disabled {
          opacity: .65;
          cursor: wait;
          transform: none;
        }

        .button-loader {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: civSpin .7s linear infinite;
        }

        /* ───────────── Map markers ───────────── */

        .civ-user-marker {
          position: relative;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
        }

        .civ-user-pulse {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(23, 105, 170, .2);
          animation: civPulse 2s ease-out infinite;
        }

        .civ-user-core {
          position: relative;
          width: 13px;
          height: 13px;
          border: 3px solid #fff;
          border-radius: 50%;
          background: var(--hs-primary);
          box-shadow: 0 2px 7px rgba(23, 105, 170, .35);
        }

        .civ-map-marker {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50% 50% 50% 4px;
          background: var(--hs-primary);
          transform: rotate(-45deg);
          box-shadow: 0 5px 12px rgba(15, 23, 42, .2);
        }

        .civ-map-marker.selected {
          width: 42px;
          height: 42px;
          background: #12578e;
          box-shadow:
            0 7px 18px rgba(23, 105, 170, .3),
            0 0 0 4px rgba(255,255,255,.9);
        }

        .civ-map-marker-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(45deg);
        }

        /* ───────────── Animation ───────────── */

        @keyframes civFadeUp {
          from {
            opacity: 0;
            transform: translateY(7px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes civSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes civPulse {
          0% {
            transform: scale(.65);
            opacity: .65;
          }

          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }

        @keyframes civBarUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ───────────── Dark mode ───────────── */

        @media (prefers-color-scheme: dark) {
          .hospital-page {
            --hs-bg: #0e151d;
            --hs-surface: #151e28;
            --hs-surface-soft: #101820;
            --hs-border: #263443;
            --hs-border-strong: #314253;
            --hs-text: #eef3f8;
            --hs-text-soft: #d2dae4;
            --hs-muted: #8e9aaa;
            --hs-faint: #748194;
            --hs-primary: #69b7e5;
            --hs-primary-strong: #54a7d8;
            --hs-primary-soft: #102a38;
            --hs-success: #67c797;
            --hs-success-bg: #102a20;
            --hs-warning: #e0ad55;
            --hs-warning-bg: #302616;
            --hs-danger: #e98787;
            --hs-danger-bg: #321c1f;
          }

          .facility-divider,
          .hospital-card .facility-divider {
            background: #263442;
          }

          .specialty-pill {
            border-color: #2a3948;
            background: #101820;
            color: #9ba9b8;
          }

          .care-note {
            border-color: #1f4558;
            background: #102530;
          }

          .care-note-icon {
            background: #163849;
          }

          .care-note strong {
            color: #8cc7e5;
          }

          .care-note p {
            color: #8da7b7;
          }

          .map-live,
          .map-count,
          .route-banner {
            border-color: #2b3948;
            background: rgba(21, 30, 40, .94);
            color: #d6dee7;
          }

          .route-banner small {
            color: #8492a3;
          }

          .route-banner strong {
            color: #edf3f8;
          }

          .leaflet-container {
            background: #17212b;
          }

          .leaflet-control-attribution {
            background: rgba(21,30,40,.88) !important;
            color: #8e9aaa !important;
          }

          .selection-bar {
            border-color: #30404f;
            background: #151e28;
          }

          .error-card,
          .inline-error {
            border-color: #573035;
            background: #28191c;
          }

          .error-card strong,
          .error-card button,
          .inline-error {
            color: #e98787;
          }

          .error-card p {
            color: #b98d92;
          }

          .testing-badge {
            border-color: #6b4722;
            background: #302116;
            color: #e9a261;
          }

          .loader {
            border-color: #293744;
            border-top-color: var(--hs-primary);
          }
        }

        /* ───────────── Responsive ───────────── */

        @media (max-width: 850px) {
          .hospital-main {
            width: min(100% - 32px, 620px);
          }

          .hospital-list {
            grid-template-columns: 1fr;
          }

          .intro {
            display: block;
          }

          .location-chip {
            margin-top: 13px;
          }
        }

        @media (max-width: 700px) {
          .hospital-page {
            padding-bottom: 100px;
          }

          .hospital-main {
            width: calc(100% - 28px);
            padding: 18px 0 30px;
          }

          .hospital-header {
            margin-bottom: 22px;
          }

          .intro h1 {
            font-size: 28px;
          }

          .intro p {
            font-size: 13px;
          }

          .map-card {
            height: 285px;
            border-radius: 16px;
            margin-bottom: 22px;
          }

          .results-heading h2 {
            font-size: 19px;
          }

          .hospital-card {
            padding: 16px;
            border-radius: 16px;
          }

          .care-note {
            padding: 12px;
          }

          .selection-shell {
            bottom: 68px;
            padding: 0 10px;
          }

          .selection-bar {
            gap: 10px;
            padding: 10px;
            border-radius: 14px;
          }

          .selection-info strong {
            max-width: 190px;
            font-size: 12px;
          }

          .continue-button {
            min-width: 106px;
            height: 41px;
          }
        }

        @media (max-width: 430px) {
          .hospital-main {
            width: calc(100% - 22px);
          }

          .intro h1 {
            font-size: 25px;
          }

          .intro p {
            font-size: 12.5px;
          }

          .map-card {
            height: 260px;
          }

          .facility-icon {
            width: 41px;
            height: 41px;
            flex-basis: 41px;
          }

          .facility-name-row h3 {
            font-size: 14px;
          }

          .distance-block strong {
            font-size: 12px;
          }

          .facility-meta-row {
            gap: 7px;
          }

          .selection-info strong {
            max-width: 145px;
          }

          .continue-button {
            min-width: 96px;
            padding: 0 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
