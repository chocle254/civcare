import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getNearbyHospitals } from '../../api/hospitals';
import useLocation from '../../hooks/useLocation';
import { confirmArrival } from '../../api/triage';
import { theme } from '../../styles/theme';
import BottomNav from '../../components/BottomNav';

const { color, font, radius } = theme;

const TINTS = [
  { tint: color.blue,  dim: color.blueDim,  hex: '#4C6FFF' },
  { tint: color.violet, dim: 'rgba(139,108,246,0.12)', hex: '#8B6CF6' },
  { tint: color.mint,  dim: color.mintDim,  hex: '#22C79A' },
  { tint: color.coral, dim: color.coralDim, hex: '#FF6584' },
];

// ── Leaflet icon builders (divIcon — no external image assets needed) ──
const userIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
           <div style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(76,111,255,0.35);animation:pulseRing 2.2s ease-out infinite;"></div>
           <div style="position:relative;width:14px;height:14px;border-radius:50%;background:#4C6FFF;border:3px solid #fff;box-shadow:0 2px 6px rgba(76,111,255,0.5);"></div>
         </div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const hospitalIcon = (hex, selected) => L.divIcon({
  className: '',
  html: `<div style="width:${selected ? 34 : 28}px;height:${selected ? 34 : 28}px;border-radius:50% 50% 50% 4px;
           transform:rotate(-45deg);background:${hex};display:flex;align-items:center;justify-content:center;
           box-shadow:0 3px 8px rgba(0,0,0,0.3);${selected ? 'outline:3px solid rgba(255,255,255,0.9);' : ''}">
           <span style="transform:rotate(45deg);font-size:${selected ? 15 : 12}px;">🏥</span>
         </div>`,
  iconSize: [selected ? 34 : 28, selected ? 34 : 28],
  iconAnchor: [selected ? 17 : 14, selected ? 34 : 28],
});

// Keeps the map framed around whatever points currently matter (all
// hospitals, or the active route) — re-fits whenever they change.
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
  }, [points, map]); // eslint-disable-line
  return null;
}

// Real road route via OSRM's public routing service; falls back to a
// straight line (drawn instantly) if the network call fails.
async function fetchRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) throw new Error('no route');
    return coords.map(([lon, lat]) => [lat, lon]);
  } catch {
    return [[from.lat, from.lon], [to.lat, to.lon]];
  }
}

export default function HospitalSelect() {
  const navigate = useNavigate();
  const { coords, error: locError, loading: locLoading, getLocation } = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { getLocation(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!coords) return;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const res = await getNearbyHospitals(coords.lat, coords.lon);
        setHospitals(res.data);
      } catch { setError('Could not load hospitals. Please try again.'); }
      finally { setLoading(false); }
    };
    load();
  }, [coords]);

  const handlePick = (h) => {
    setSelected(h);
    // Draw the path immediately (straight line), then upgrade to the real
    // road route once OSRM responds.
    setRouteCoords([[coords.lat, coords.lon], [h.lat, h.lon]]);
    fetchRoute(coords, h).then(setRouteCoords);
  };

  const handleConfirm = async () => {
    if (!selected || confirming) return;
    setConfirming(true);
    const hospital = selected;
    localStorage.setItem('civtech_hospital', JSON.stringify(hospital));
    if (coords) localStorage.setItem('civtech_patient_coords', JSON.stringify(coords));

    const sessionId = localStorage.getItem('civtech_session_id');
    const patient = JSON.parse(localStorage.getItem('civtech_patient') || '{}');

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
        localStorage.setItem('civtech_appointment_id', apptRes.data.appointment_id);
        navigate('/arrival');
      } catch {
        setError('Could not confirm hospital selection. Please try again.');
        setConfirming(false);
      }
    } else {
      navigate('/chat', { state: { mode: 'pre_hospital' } });
    }
  };

  const boundsPoints = useMemo(() => {
    if (selected && routeCoords) return routeCoords;
    if (!coords) return [];
    const pts = [[coords.lat, coords.lon]];
    hospitals.forEach((h) => pts.push([h.lat, h.lon]));
    return pts;
  }, [selected, routeCoords, coords, hospitals]);

  return (
    <div style={s.page}>
      <div style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <button style={s.back} className="cc-press" onClick={() => navigate('/dashboard')}>
            <span style={s.backEmoji}>←</span>
          </button>
        </div>
        <h1 style={s.title}>Hospitals Nearby</h1>
        <p style={s.sub}>Within 50km of your location</p>

        {/* Real map */}
        {coords && (
          <div style={s.mapWrap}>
            <MapContainer
              center={[coords.lat, coords.lon]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[coords.lat, coords.lon]} icon={userIcon} />
              {hospitals.map((h, i) => (
                <Marker
                  key={h.id}
                  position={[h.lat, h.lon]}
                  icon={hospitalIcon(TINTS[i % TINTS.length].hex, selected?.id === h.id)}
                  eventHandlers={{ click: () => handlePick(h) }}
                />
              ))}
              {routeCoords && (
                <Polyline positions={routeCoords} pathOptions={{ color: '#4C6FFF', weight: 4, opacity: 0.85, dashArray: '1 10', lineCap: 'round' }} />
              )}
              <FitBounds points={boundsPoints} />
            </MapContainer>
            {selected && (
              <div style={s.mapBanner}>
                <span style={s.mapBannerDot} />
                Route to {selected.name}
              </div>
            )}
          </div>
        )}

        {/* Loading location */}
        {locLoading && (
          <div style={s.stateWrap}>
            <div style={s.spinner} />
            <p style={s.stateText}>Finding your location...</p>
            <p style={s.stateSubText}>This takes just a moment</p>
          </div>
        )}

        {/* Location error */}
        {locError && !coords && (
          <div style={s.alertBox}>
            <p style={{ fontSize: 30, margin: '0 0 8px' }}>📍</p>
            <p style={s.alertText}>{locError}</p>
            <button style={s.retryBtn} className="cc-press" onClick={getLocation}>Try Again</button>
          </div>
        )}

        {/* Fetching hospitals */}
        {loading && (
          <div style={s.stateWrap}>
            <div style={s.spinner} />
            <p style={s.stateText}>Searching for hospitals...</p>
          </div>
        )}

        {error && <div style={s.alertBox}><p style={s.alertText}>{error}</p></div>}

        {/* Hospital list */}
        {!loading && hospitals.length > 0 && (
          <>
            <p style={s.countText}>{hospitals.length} facilities found near you</p>
            {hospitals.map((h, i) => {
              const tint = TINTS[i % TINTS.length];
              const isSelected = selected?.id === h.id;
              return (
                <div
                  key={h.id}
                  style={{ ...s.card, animationDelay: `${i * 0.06}s`, ...(isSelected ? s.cardSelected : {}) }}
                  className="cc-cardhover"
                  onClick={() => handlePick(h)}
                >
                  {h.is_testing && <div style={s.testBadge}>Test Mode</div>}

                  <div style={{ ...s.hospitalIconWrap, background: tint.dim }}>
                    <span style={{ fontSize: 20 }}>🏢</span>
                  </div>

                  <div style={s.cardInfo}>
                    <p style={s.hosName}>{h.name}</p>
                    <p style={s.hosMeta}>{h.town}{h.county ? `, ${h.county}` : ''}</p>
                    {h.phone && <p style={s.hosPhone}>📞 {h.phone}</p>}
                  </div>

                  <div style={s.cardRight}>
                    <p style={{ ...s.distKm, color: tint.tint }}>{h.distance_km} km</p>
                    <p style={s.distTime}>🕐 {h.travel_time}</p>
                    <span style={{ color: isSelected ? color.blue : color.inkFaint, fontSize: 16 }}>{isSelected ? '✓' : '›'}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* No hospitals */}
        {!loading && coords && hospitals.length === 0 && (
          <div style={s.stateWrap}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🏥</p>
            <p style={s.stateText}>No hospitals found nearby</p>
            <p style={s.stateSubText}>Try speaking to a doctor online instead.</p>
            <button style={s.retryBtn} className="cc-press" onClick={() => navigate('/consultation')}>Consult a Doctor Online</button>
          </div>
        )}

        <div style={{ height: selected ? 150 : 100 }} />
      </div>

      {/* Sticky confirm bar */}
      {selected && (
        <div style={s.confirmBar}>
          <div style={{ minWidth: 0 }}>
            <p style={s.confirmLabel}>Selected hospital</p>
            <p style={s.confirmName}>{selected.name}</p>
          </div>
          <button style={s.confirmBtn} className="cc-press" onClick={handleConfirm} disabled={confirming}>
            {confirming ? '···' : 'Continue →'}
          </button>
        </div>
      )}

      <BottomNav active="home" />

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        ${theme.motionCss}
        .cc-cardhover { transition: transform 0.2s ease; }
        .cc-cardhover:active { transform: scale(0.985); }
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulseRing{0%{transform:scale(0.6);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes barUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .leaflet-container { font-family: ${font.ui}; background: ${color.surfaceMuted}; }
        .leaflet-control-attribution { font-size: 9px !important; }
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', width: '100%', background: color.bgGradient, fontFamily: font.ui, color: color.ink, overflowX: 'hidden', boxSizing: 'border-box' },
  main: { width: '100%', maxWidth: 480, margin: '0 auto', padding: '18px 20px 40px', boxSizing: 'border-box' },

  header: { display: 'flex', alignItems: 'center', marginBottom: 14 },
  back: {
    width: 38, height: 38, borderRadius: radius.md,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.embossOut,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  backEmoji: { fontSize: 17, lineHeight: 1, color: color.ink },
  title: { fontSize: 25, fontWeight: 800, margin: '0 0 3px', letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: color.inkFaint, margin: '0 0 16px' },

  mapWrap: {
    position: 'relative', width: '100%', height: 240, borderRadius: radius.lg, overflow: 'hidden',
    border: `1px solid ${color.glassBorder}`, marginBottom: 20, boxShadow: theme.shadow.glass, zIndex: 0,
  },
  mapBanner: {
    position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', gap: 7,
    background: color.glassStrong, backdropFilter: 'blur(10px)', border: `1px solid ${color.glassBorder}`,
    borderRadius: radius.pill, padding: '7px 12px', fontSize: 11.5, fontWeight: 600, color: color.ink,
    boxShadow: theme.shadow.card, zIndex: 1000,
  },
  mapBannerDot: { width: 7, height: 7, borderRadius: '50%', background: color.blue, flexShrink: 0 },

  countText: { fontSize: 12.5, color: color.inkFaint, marginBottom: 12 },
  card: {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 13,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.glass,
    borderRadius: radius.lg, padding: '15px',
    marginBottom: 10, cursor: 'pointer', animation: 'fadeUp 0.45s ease both',
  },
  cardSelected: { border: `1.5px solid ${color.blue}`, boxShadow: '0 6px 18px rgba(76,111,255,0.22)' },
  testBadge: { position: 'absolute', top: -8, right: 12, fontSize: 9.5, fontWeight: 700, color: color.amber, background: color.amberDim, borderRadius: radius.pill, padding: '2px 8px' },
  hospitalIconWrap: { width: 46, height: 46, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: theme.shadow.embossOut },
  cardInfo: { flex: 1, minWidth: 0 },
  hosName: { fontSize: 14, fontWeight: 700, color: color.ink, margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  hosMeta: { fontSize: 12, color: color.inkFaint, margin: '0 0 3px' },
  hosPhone: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: color.inkFaint, margin: 0 },
  cardRight: { textAlign: 'right', flexShrink: 0, marginLeft: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  distKm: { fontSize: 14.5, fontWeight: 800, margin: 0 },
  distTime: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: color.inkFaint, margin: 0 },

  stateWrap: { textAlign: 'center', padding: '50px 20px 30px' },
  stateText: { fontSize: 15, fontWeight: 600, color: color.ink, margin: '12px 0 6px' },
  stateSubText: { fontSize: 13, color: color.inkFaint, marginBottom: 20 },
  spinner: { width: 34, height: 34, borderRadius: '50%', border: `3px solid ${color.hairlineStrong}`, borderTop: `3px solid ${color.blue}`, animation: 'spin 0.8s linear infinite', margin: '0 auto' },
  alertBox: { background: color.coralDim, borderRadius: radius.lg, padding: '20px', textAlign: 'center', marginBottom: 16, border: '1px solid rgba(255,101,132,0.25)' },
  alertText: { fontSize: 13, color: color.inkDim, margin: '0 0 14px' },
  retryBtn: { background: color.blue, border: 'none', borderRadius: radius.md, color: '#fff', fontSize: 13, fontWeight: 700, padding: '11px 22px', cursor: 'pointer', fontFamily: font.ui, boxShadow: '0 6px 16px rgba(76,111,255,0.35)' },

  confirmBar: {
    position: 'fixed', left: 0, right: 0, bottom: 74, maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: color.glassStrong, backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: `1px solid ${color.glassBorder}`, borderRadius: radius.lg, padding: '12px 14px',
    boxShadow: '0 10px 30px rgba(31,38,80,0.18)', zIndex: 99, animation: 'barUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
    width: 'calc(100% - 40px)',
  },
  confirmLabel: { fontSize: 10.5, color: color.inkFaint, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmName: { fontSize: 13.5, fontWeight: 700, color: color.ink, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  confirmBtn: {
    flexShrink: 0, background: color.blue, border: 'none', borderRadius: radius.md, color: '#fff',
    fontSize: 13, fontWeight: 700, padding: '11px 18px', cursor: 'pointer', fontFamily: font.ui,
    boxShadow: '0 6px 16px rgba(76,111,255,0.35)',
  },
};
