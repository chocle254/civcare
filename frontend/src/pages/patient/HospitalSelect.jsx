import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNearbyHospitals } from '../../api/hospitals';
import useLocation from '../../hooks/useLocation';
import { confirmArrival } from '../../api/triage';
import { theme } from '../../styles/theme';
import { Icon } from '../../components/Icons';
import BottomNav from '../../components/BottomNav';

const { color, font, radius } = theme;

// Tints cycled across the hospital list, matching the reference card icons
const TINTS = [
  { tint: color.blue,  dim: color.blueDim },
  { tint: color.violet, dim: 'rgba(139,108,246,0.12)' },
  { tint: color.mint,  dim: color.mintDim },
  { tint: color.coral, dim: color.coralDim },
];

// Deterministic decorative pin layout for the stylised map header
const MAP_PINS = [
  { top: '18%', left: '12%' },
  { top: '10%', left: '58%' },
  { top: '14%', left: '88%' },
  { top: '68%', left: '10%' },
  { top: '72%', left: '80%' },
];

function StaticMap() {
  return (
    <div style={s.map}>
      <div style={s.mapGrid} />
      <div style={s.mapRoadV} />
      <div style={s.mapRoadH} />
      <div style={{ ...s.mapPatch, top: '8%', left: '4%', width: 70, height: 46 }} />
      <div style={{ ...s.mapPatch, bottom: '10%', right: '8%', width: 90, height: 54 }} />
      {MAP_PINS.map((p, i) => (
        <div key={i} style={{ ...s.mapPin, top: p.top, left: p.left }}>
          <Icon.Hospital size={13} color="#fff" />
        </div>
      ))}
      <div style={s.mapUserWrap}>
        <div style={s.mapUserRing} />
        <div style={s.mapUserDot} />
      </div>
    </div>
  );
}

export default function HospitalSelect() {
  const navigate = useNavigate();
  const { coords, error: locError, loading: locLoading, getLocation } = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSelect = async (hospital) => {
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
      }
    } else {
      navigate('/chat', { state: { mode: 'pre_hospital' } });
    }
  };

  return (
    <div style={s.page}>
      <div style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <button style={s.back} onClick={() => navigate('/dashboard')}>
            <Icon.ChevronLeft size={20} color={color.ink} />
          </button>
        </div>
        <h1 style={s.title}>Hospitals Nearby</h1>
        <p style={s.sub}>Within 50km of your location</p>

        <StaticMap />

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
            <button style={s.retryBtn} onClick={getLocation}>Try Again</button>
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
              return (
                <div
                  key={h.id}
                  style={{ ...s.card, animationDelay: `${i * 0.06}s` }}
                  onClick={() => handleSelect(h)}
                >
                  {h.is_testing && <div style={s.testBadge}>Test Mode</div>}

                  <div style={{ ...s.hospitalIcon, background: tint.dim, color: tint.tint }}>
                    <Icon.Building size={20} color={tint.tint} />
                  </div>

                  <div style={s.cardInfo}>
                    <p style={s.hosName}>{h.name}</p>
                    <p style={s.hosMeta}>{h.town}{h.county ? `, ${h.county}` : ''}</p>
                    {h.phone && (
                      <p style={s.hosPhone}><Icon.Phone size={11} color={color.inkFaint} /> {h.phone}</p>
                    )}
                  </div>

                  <div style={s.cardRight}>
                    <p style={{ ...s.distKm, color: tint.tint }}>{h.distance_km} km</p>
                    <p style={s.distTime}><Icon.Clock size={11} color={color.inkFaint} /> {h.travel_time}</p>
                    <Icon.Chevron size={16} color={color.inkFaint} />
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
            <button style={s.retryBtn} onClick={() => navigate('/consultation')}>Consult a Doctor Online</button>
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      <BottomNav active="home" />

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulseRing{0%{transform:scale(0.6);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', backgroundColor: color.bg, fontFamily: font.ui, color: color.ink },
  main: { maxWidth: 480, margin: '0 auto', padding: '18px 20px 40px' },

  header: { display: 'flex', alignItems: 'center', marginBottom: 14 },
  back: { width: 38, height: 38, borderRadius: radius.md, background: color.surfaceMuted, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  title: { fontSize: 25, fontWeight: 800, margin: '0 0 3px', letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: color.inkFaint, margin: '0 0 16px' },

  map: {
    position: 'relative', width: '100%', height: 190, borderRadius: radius.lg, overflow: 'hidden',
    background: `linear-gradient(160deg, ${color.surfaceRaised}, ${color.surfaceMuted})`,
    marginBottom: 20, boxShadow: theme.shadow.card,
  },
  mapGrid: {
    position: 'absolute', inset: 0,
    backgroundImage: `linear-gradient(${color.hairline} 1px, transparent 1px), linear-gradient(90deg, ${color.hairline} 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  },
  mapRoadV: { position: 'absolute', top: 0, bottom: 0, left: '46%', width: 10, background: 'rgba(255,255,255,0.65)' },
  mapRoadH: { position: 'absolute', left: 0, right: 0, top: '54%', height: 8, background: 'rgba(255,255,255,0.65)' },
  mapPatch: { position: 'absolute', borderRadius: 10, background: color.mintDim },
  mapPin: {
    position: 'absolute', width: 26, height: 26, borderRadius: '50% 50% 50% 4px', transform: 'rotate(-45deg) translate(-50%,-100%)',
    background: color.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(76,111,255,0.4)',
  },
  mapUserWrap: { position: 'absolute', top: '50%', left: '46%', width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mapUserRing: { position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'rgba(76,111,255,0.35)', animation: 'pulseRing 2.2s ease-out infinite' },
  mapUserDot: { position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: color.blue, border: '3px solid #fff', boxShadow: '0 2px 6px rgba(76,111,255,0.5)' },

  countText: { fontSize: 12.5, color: color.inkFaint, marginBottom: 12 },
  card: {
    position: 'relative', display: 'flex', alignItems: 'center', gap: 13,
    background: color.surface, boxShadow: theme.shadow.card, borderRadius: radius.lg, padding: '15px',
    marginBottom: 10, cursor: 'pointer', animation: 'fadeUp 0.45s ease both',
  },
  testBadge: { position: 'absolute', top: -8, right: 12, fontSize: 9.5, fontWeight: 700, color: color.amber, background: color.amberDim, borderRadius: radius.pill, padding: '2px 8px' },
  hospitalIcon: { width: 46, height: 46, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
  alertBox: { background: color.coralDim, borderRadius: radius.lg, padding: '20px', textAlign: 'center', marginBottom: 16 },
  alertText: { fontSize: 13, color: color.inkDim, margin: '0 0 14px' },
  retryBtn: { background: color.blue, border: 'none', borderRadius: radius.md, color: '#fff', fontSize: 13, fontWeight: 700, padding: '11px 22px', cursor: 'pointer', fontFamily: font.ui },
};
