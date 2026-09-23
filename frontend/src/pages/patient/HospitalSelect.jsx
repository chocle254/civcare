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
import { theme } from '../../styles/theme';
import BottomNav from '../../components/BottomNav';

const { color, font, radius } = theme;

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

  useEffect(() => {
    getLocation();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!coords) return;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await getNearbyHospitals(coords.lat, coords.lon);
        setHospitals(Array.isArray(res.data) ? res.data : []);
      } catch {
        setError('Could not load hospitals. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [coords]);

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
    if (!coords) return;

    setSelected(hospital);

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

    if (!coords) return [];

    return [
      [coords.lat, coords.lon],
      ...orderedHospitals
        .filter((hospital) => hospital.lat && hospital.lon)
        .map((hospital) => [hospital.lat, hospital.lon]),
    ];
  }, [selected, routeCoords, coords, orderedHospitals]);

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
              {coords ? 'Your location' : 'Locating you…'}
            </span>
          </div>
        </section>

        {/* ───────────── Map ───────────── */}

        {coords && (
          <section className="map-card">
            <MapContainer
              center={[coords.lat, coords.lon]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={false}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker
                position={[coords.lat, coords.lon]}
                icon={userIcon}
              />

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
                Live location
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

        {locError && !coords && (
          <section className="error-card">
            <div className="error-icon">
              <Icon name="pin" size={20} />
            </div>

            <div>
              <strong>Location unavailable</strong>
              <p>{locError}</p>
            </div>

            <button onClick={getLocation}>
              <Icon name="refresh" size={16} />
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
                <h2>Hospitals near you</h2>
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
          coords &&
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

      <BottomNav active="home" />

      <style>{`
        ${theme.fontImport}

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
          outline: 2px solid ${color.blue};
          outline-offset: 3px;
        }

        .hospital-page {
          min-height: 100vh;
          width: 100%;
          background:
            radial-gradient(
              circle at 85% -10%,
              rgba(37, 99, 235, 0.08),
              transparent 32%
            ),
            #F6F8FC;
          color: #142033;
          font-family: ${font.ui};
          overflow-x: hidden;
        }

        .hospital-main {
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 24px 45px;
        }

        /* Header */

        .hospital-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 30px;
        }

        .icon-button {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #1E293B;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.05);
          transition:
            transform .18s ease,
            border-color .18s ease;
        }

        .icon-button:hover {
          border-color: #CBD5E1;
          transform: translateY(-1px);
        }

        .header-context {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .header-context span {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.3px;
          color: #64748B;
        }

        .header-context strong {
          font-size: 14px;
          font-weight: 750;
          color: #172033;
        }

        /* Intro */

        .intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 24px;
        }

        .intro > div:first-child {
          max-width: 690px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #2563EB;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 1.3px;
          margin-bottom: 9px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2563EB;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, .10);
        }

        .intro h1 {
          margin: 0 0 9px;
          font-size: clamp(28px, 4vw, 39px);
          line-height: 1.08;
          letter-spacing: -1.15px;
          font-weight: 820;
          color: #101828;
        }

        .intro p {
          margin: 0;
          max-width: 620px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748B;
        }

        .location-chip {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 12px 0 8px;
          border-radius: 999px;
          border: 1px solid #DCE5F2;
          background: #FFFFFF;
          color: #475569;
          font-size: 11.5px;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(15, 23, 42, .04);
        }

        .location-chip-icon {
          width: 25px;
          height: 25px;
          border-radius: 50%;
          background: #EFF6FF;
          color: #2563EB;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Map */

        .map-card {
          position: relative;
          width: 100%;
          height: 360px;
          overflow: hidden;
          border-radius: 20px;
          border: 1px solid #DDE5EF;
          background: #E9EEF5;
          box-shadow:
            0 10px 30px rgba(15, 23, 42, .08),
            0 2px 7px rgba(15, 23, 42, .04);
          margin-bottom: 30px;
        }

        .map-overlay-top {
          position: absolute;
          top: 13px;
          left: 13px;
          right: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 500;
          pointer-events: none;
        }

        .map-live,
        .map-count {
          display: flex;
          align-items: center;
          gap: 7px;
          height: 31px;
          padding: 0 10px;
          border: 1px solid rgba(255,255,255,.7);
          border-radius: 999px;
          background: rgba(255,255,255,.91);
          backdrop-filter: blur(10px);
          color: #334155;
          font-size: 10.5px;
          font-weight: 750;
          box-shadow: 0 4px 12px rgba(15,23,42,.10);
        }

        .map-live span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 0 4px rgba(16,185,129,.12);
        }

        .route-banner {
          position: absolute;
          left: 13px;
          bottom: 13px;
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 220px;
          max-width: calc(100% - 26px);
          padding: 9px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,.8);
          box-shadow: 0 7px 20px rgba(15,23,42,.14);
          z-index: 500;
        }

        .route-banner-icon {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 9px;
          background: #EFF6FF;
          color: #2563EB;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .route-banner div:last-child {
          min-width: 0;
        }

        .route-banner small {
          display: block;
          margin-bottom: 2px;
          color: #64748B;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 1px;
        }

        .route-banner strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #172033;
          font-size: 11.5px;
        }

        /* Map marker */

        .civ-user-marker {
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .civ-user-pulse {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(37,99,235,.22);
          animation: civPulse 2s ease-out infinite;
        }

        .civ-user-core {
          position: relative;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #2563EB;
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 8px rgba(37,99,235,.45);
        }

        .civ-map-marker {
          width: 34px;
          height: 34px;
          border-radius: 50% 50% 50% 4px;
          transform: rotate(-45deg);
          background: #2563EB;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 5px 12px rgba(15,23,42,.22);
          transition: transform .2s ease;
        }

        .civ-map-marker.selected {
          width: 42px;
          height: 42px;
          background: #173B8F;
          box-shadow:
            0 7px 18px rgba(37,99,235,.35),
            0 0 0 4px rgba(255,255,255,.9);
        }

        .civ-map-marker-inner {
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Results */

        .results-section {
          width: 100%;
        }

        .results-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .section-kicker {
          display: block;
          color: #64748B;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 1.15px;
          margin-bottom: 4px;
        }

        .results-heading h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -.35px;
          color: #172033;
          font-weight: 800;
        }

        .result-count {
          min-width: 29px;
          height: 29px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #EAF2FF;
          color: #2563EB;
          font-size: 11px;
          font-weight: 850;
        }

        .care-note {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 14px;
          margin-bottom: 14px;
          border: 1px solid #DDE7F4;
          border-radius: 14px;
          background: #F8FBFF;
        }

        .care-note-icon {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #EAF2FF;
          color: #2563EB;
        }

        .care-note strong {
          display: block;
          margin-bottom: 3px;
          font-size: 11.5px;
          color: #1E3A5F;
        }

        .care-note p {
          margin: 0;
          font-size: 10.5px;
          line-height: 1.5;
          color: #64748B;
        }

        .hospital-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .hospital-card {
          position: relative;
          min-width: 0;
          padding: 17px;
          border: 1px solid #E0E7F0;
          border-radius: 17px;
          background: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(15,23,42,.045);
          animation: civFadeUp .4s ease both;
          transition:
            transform .18s ease,
            border-color .18s ease,
            box-shadow .18s ease;
        }

        .hospital-card:hover {
          transform: translateY(-2px);
          border-color: #C8D7EC;
          box-shadow: 0 10px 26px rgba(15,23,42,.08);
        }

        .hospital-card.selected {
          border-color: #2563EB;
          box-shadow:
            0 9px 25px rgba(37,99,235,.11),
            inset 0 0 0 1px rgba(37,99,235,.08);
        }

        .hospital-card-top {
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }

        .facility-icon {
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #EFF6FF;
          color: #2563EB;
        }

        .facility-main {
          min-width: 0;
          flex: 1;
        }

        .facility-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .facility-name-row h3 {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0;
          color: #172033;
          font-size: 14px;
          font-weight: 780;
          letter-spacing: -.1px;
        }

        .selected-mark {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #2563EB;
          color: #FFFFFF;
        }

        .facility-location {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 4px 0 0;
          color: #718096;
          font-size: 10.5px;
        }

        .distance-block {
          flex-shrink: 0;
          text-align: right;
        }

        .distance-block strong {
          display: block;
          color: #1D4ED8;
          font-size: 13px;
          font-weight: 850;
        }

        .distance-block span {
          display: block;
          margin-top: 3px;
          color: #94A3B8;
          font-size: 9px;
          font-weight: 650;
        }

        .facility-divider {
          height: 1px;
          margin: 14px 0 11px;
          background: #EDF1F6;
        }

        .facility-details {
          min-width: 0;
        }

        .detail-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 8px;
          padding: 5px 8px;
          border-radius: 7px;
          background: #F0FDF8;
          color: #047857;
          font-size: 9px;
          font-weight: 750;
        }

        .detail-dot {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #10B981;
        }

        .specialty-row {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .specialty-pill {
          padding: 4px 7px;
          border-radius: 6px;
          background: #F5F7FA;
          color: #475569;
          font-size: 8.5px;
          font-weight: 700;
          border: 1px solid #E9EDF2;
        }

        .specialty-more {
          color: #64748B;
          font-size: 8.5px;
          font-weight: 700;
        }

        .facility-meta-row {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .status,
        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          color: #64748B;
          font-size: 9px;
          font-weight: 650;
        }

        .status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #94A3B8;
        }

        .status.open {
          color: #047857;
        }

        .status.open span {
          background: #10B981;
        }

        .status.closed {
          color: #B45309;
        }

        .status.closed span {
          background: #F59E0B;
        }

        .select-hint {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin-left: auto;
          color: #64748B;
          font-size: 9px;
          font-weight: 750;
        }

        .hospital-card.selected .select-hint {
          color: #2563EB;
        }

        .testing-badge {
          position: absolute;
          top: -7px;
          right: 13px;
          padding: 3px 7px;
          border-radius: 999px;
          background: #FFF7ED;
          color: #C2410C;
          border: 1px solid #FED7AA;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: .6px;
        }

        /* States */

        .state-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 170px;
          padding: 30px;
          margin-bottom: 20px;
          border: 1px solid #E0E7F0;
          border-radius: 17px;
          background: #FFFFFF;
          text-align: center;
        }

        .state-card.compact {
          min-height: 135px;
        }

        .state-card strong {
          margin-top: 13px;
          color: #172033;
          font-size: 13px;
        }

        .state-card p {
          margin: 5px 0 0;
          color: #718096;
          font-size: 11px;
        }

        .loader {
          width: 27px;
          height: 27px;
          border: 3px solid #E5EAF1;
          border-top-color: #2563EB;
          border-radius: 50%;
          animation: civSpin .75s linear infinite;
        }

        .error-card {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 20px;
          padding: 14px;
          border: 1px solid #FECACA;
          border-radius: 14px;
          background: #FFF7F7;
        }

        .error-icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FEE2E2;
          color: #DC2626;
        }

        .error-card > div:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        .error-card strong {
          display: block;
          margin-bottom: 3px;
          color: #991B1B;
          font-size: 11.5px;
        }

        .error-card p {
          margin: 0;
          color: #7F1D1D;
          font-size: 10px;
          line-height: 1.45;
        }

        .error-card button {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: #B91C1C;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .inline-error {
          padding: 12px 14px;
          margin-bottom: 16px;
          border-radius: 11px;
          background: #FFF7F7;
          border: 1px solid #FECACA;
          color: #B91C1C;
          font-size: 10.5px;
          font-weight: 650;
        }

        .empty-card {
          padding: 38px 24px;
          margin-top: 8px;
          border: 1px solid #E0E7F0;
          border-radius: 18px;
          background: #FFFFFF;
          text-align: center;
        }

        .empty-icon {
          width: 54px;
          height: 54px;
          margin: 0 auto 13px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #EFF6FF;
          color: #2563EB;
        }

        .empty-card h2 {
          margin: 0 0 7px;
          color: #172033;
          font-size: 16px;
        }

        .empty-card p {
          max-width: 410px;
          margin: 0 auto 18px;
          color: #718096;
          font-size: 11.5px;
          line-height: 1.6;
        }

        .secondary-action {
          padding: 10px 15px;
          border: 1px solid #CBD5E1;
          border-radius: 10px;
          background: #FFFFFF;
          color: #334155;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        /* Bottom selection bar */

        .selection-shell {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 72px;
          z-index: 900;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .selection-bar {
          width: min(760px, calc(100% - 32px));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 13px 12px 16px;
          border: 1px solid rgba(203,213,225,.9);
          border-radius: 15px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(18px) saturate(140%);
          box-shadow:
            0 14px 35px rgba(15,23,42,.14),
            0 3px 8px rgba(15,23,42,.06);
          pointer-events: auto;
          animation: civBarUp .28s cubic-bezier(.22,1,.36,1) both;
        }

        .selection-info {
          min-width: 0;
        }

        .selection-info > span {
          display: block;
          margin-bottom: 2px;
          color: #64748B;
          font-size: 7.5px;
          font-weight: 850;
          letter-spacing: 1px;
        }

        .selection-info strong {
          display: block;
          max-width: 390px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #172033;
          font-size: 12px;
        }

        .selection-info > div {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          color: #64748B;
          font-size: 9px;
          font-weight: 650;
        }

        .continue-button {
          min-width: 120px;
          height: 42px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: 0;
          border-radius: 11px;
          background: #2563EB;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 6px 15px rgba(37,99,235,.25);
          transition:
            transform .18s ease,
            background .18s ease;
        }

        .continue-button:hover {
          background: #1D4ED8;
          transform: translateY(-1px);
        }

        .continue-button:disabled {
          opacity: .75;
          cursor: wait;
          transform: none;
        }

        .button-loader {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: civSpin .7s linear infinite;
        }

        /* Leaflet */

        .leaflet-container {
          font-family: ${font.ui};
          background: #E9EEF5;
        }

        .leaflet-control-attribution {
          font-size: 8px !important;
          background: rgba(255,255,255,.78) !important;
        }

        .leaflet-control-zoom {
          display: none;
        }

        /* Animations */

        @keyframes civFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
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
            transform: scale(2.25);
            opacity: 0;
          }
        }

        @keyframes civBarUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ───────────── Tablet / desktop ───────────── */

        @media (min-width: 900px) {
          .hospital-main {
            padding-top: 30px;
          }

          .hospital-header {
            margin-bottom: 38px;
          }

          .map-card {
            height: 390px;
          }
        }

        /* ───────────── Mobile ───────────── */

        @media (max-width: 700px) {
          .hospital-main {
            max-width: 560px;
            padding: 17px 16px 30px;
          }

          .hospital-header {
            margin-bottom: 24px;
          }

          .intro {
            display: block;
            margin-bottom: 18px;
          }

          .intro h1 {
            font-size: 28px;
            letter-spacing: -.8px;
          }

          .intro p {
            font-size: 12.5px;
            line-height: 1.55;
          }

          .location-chip {
            width: max-content;
            margin-top: 13px;
          }

          .map-card {
            height: 275px;
            border-radius: 17px;
            margin-bottom: 24px;
          }

          .hospital-list {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .hospital-card {
            padding: 14px;
            border-radius: 15px;
          }

          .care-note {
            padding: 12px;
          }

          .selection-shell {
            bottom: 69px;
          }

          .selection-bar {
            width: calc(100% - 20px);
            gap: 9px;
            padding: 10px;
            border-radius: 14px;
          }

          .selection-info {
            min-width: 0;
          }

          .selection-info strong {
            max-width: 190px;
            font-size: 11px;
          }

          .continue-button {
            min-width: 104px;
            height: 40px;
          }
        }

        @media (max-width: 390px) {
          .hospital-main {
            padding-left: 13px;
            padding-right: 13px;
          }

          .intro h1 {
            font-size: 25px;
          }

          .facility-icon {
            width: 40px;
            height: 40px;
          }

          .distance-block strong {
            font-size: 12px;
          }

          .selection-info strong {
            max-width: 145px;
          }

          .continue-button {
            min-width: 94px;
            padding: 0 10px;
          }
        }
      `}</style>
    </div>
  );
}
