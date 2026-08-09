import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';
import BottomNav from '../../components/BottomNav';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

const SPEC = {
  'General Practitioner': { tint: color.blue,  tintDim: color.blueDim },
  'Internal Medicine':    { tint: color.violet, tintDim: 'rgba(139,108,246,0.12)' },
  'Emergency Medicine':   { tint: color.coral, tintDim: color.coralDim },
  'Paediatrics':          { tint: color.mint,  tintDim: color.mintDim },
  'Gynaecology':          { tint: color.pink,  tintDim: color.pinkDim },
  'Dermatology':          { tint: color.amber, tintDim: color.amberDim },
};
const specTint = (spec) => SPEC[spec] || SPEC['General Practitioner'];

const FILTERS = ['All', 'General', 'Internal', 'Emergency', 'Paediatrics'];
const FILTER_MAP = {
  All: null,
  General: 'General Practitioner',
  Internal: 'Internal Medicine',
  Emergency: 'Emergency Medicine',
  Paediatrics: 'Paediatrics',
};

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function Consultation() {
  const navigate  = useNavigate();

  const [doctors,  setDoctors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('All');
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchDoctors(); }, []);

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API}/doctors/available`);
      setDoctors(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Selecting a doctor always starts a fresh AI conversation first — the
  // patient describes their symptoms, the AI builds a report, and only
  // then (once the AI's triage routes to "consultation") does booking
  // actually happen, over in Chat.jsx's pre_consultation handling. This
  // must never be skipped, even if a session ID happens to be sitting in
  // storage from an unrelated earlier chat.
  const handleConsult = (doctor) => {
    setSelected(doctor.id);
    localStorage.setItem('civtech_selected_doctor', JSON.stringify(doctor));
    localStorage.removeItem('civtech_session_id');
    navigate('/chat', { state: { mode: 'pre_consultation' } });
  };

  const filtered = useMemo(() => {
    let list = FILTER_MAP[filter] ? doctors.filter((d) => d.specialisation === FILTER_MAP[filter]) : doctors;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) =>
        (d.full_name || d.name || '').toLowerCase().includes(q) ||
        (d.specialisation || '').toLowerCase().includes(q) ||
        (d.hospital_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [doctors, filter, query]);

  return (
    <div style={s.page}>
      <div style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <button style={s.back} className="cc-press" onClick={() => navigate('/dashboard')}>
            <span style={s.backEmoji}>←</span>
          </button>
          <div style={s.livePill}><span style={s.liveDot} />Live · {doctors.length} online</div>
        </div>
        <h1 style={s.title}>Find a Doctor</h1>
        <p style={s.sub}>Available doctors online now</p>

        {/* Search */}
        <div style={s.searchRow}>
          <div style={s.searchBar}>
            <span style={s.searchEmoji}>🔍</span>
            <input
              style={s.searchInput}
              placeholder="Search doctors, specialties..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button style={s.filterBtn} className="cc-press" aria-label="Filter">
            <span style={s.searchEmoji}>⚙️</span>
          </button>
        </div>

        {/* Filter chips */}
        <div style={s.filterRow}>
          {FILTERS.map((f) => (
            <button key={f} style={{ ...s.filterChip, ...(filter === f ? s.filterActive : {}) }} className="cc-press" onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {/* Doctor list */}
        <div style={s.list}>
          {loading && [1, 2, 3, 4].map((i) => <div key={i} style={s.skeleton} />)}

          {!loading && filtered.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: 34, margin: '0 0 8px' }}>🩺</p>
              <p style={{ color: color.inkFaint, fontSize: 13.5, margin: 0 }}>No doctors match right now.</p>
            </div>
          )}

          {!loading && filtered.map((doc, i) => {
            const spec = specTint(doc.specialisation);
            const busy = selected === doc.id;
            const name = doc.full_name || doc.name || 'Doctor';
            const rating = doc.ai_accuracy_rating ? doc.ai_accuracy_rating.toFixed(1) : '—';
            const accuracy = doc.ai_accuracy || Math.round((doc.ai_accuracy_rating || 4.8) * 20);
            return (
              <div key={doc.id} style={{ ...s.card, animationDelay: `${i * 0.06}s` }} className="cc-cardhover">
                <div style={s.avatarWrap}>
                  <div style={{ ...s.avatar, background: spec.tintDim, color: spec.tint }}>{initials(name)}</div>
                  <span style={s.onlineDot} />
                </div>

                <div style={s.info}>
                  <div style={s.nameRow}>
                    <p style={s.docName}>Dr. {name.replace(/^Dr\.?\s*/i, '')}</p>
                    <span style={s.ratingChip}>⭐ {rating}</span>
                  </div>
                  <p style={{ ...s.docSpec, color: spec.tint }}>{doc.specialisation || 'General Practitioner'}</p>
                  {doc.hospital_name && (
                    <p style={s.docHosp}>🏥 {doc.hospital_name}</p>
                  )}
                  <p style={s.docAccuracy}>✅ {accuracy}% AI Accuracy</p>
                </div>

                <button
                  style={{ ...s.feeBtn, background: busy ? color.surfaceMuted : spec.tint, color: busy ? color.inkFaint : '#fff' }}
                  className="cc-press"
                  onClick={() => handleConsult(doc)}
                  disabled={!!selected}
                >
                  {busy ? '···' : (
                    <>
                      <span style={s.feeCurrency}>KSh</span>
                      <span style={s.feeAmount}>{doc.consultation_fee?.toLocaleString() || '—'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ height: 100 }} />
      </div>

      <BottomNav active="doctor" />

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button, input { font-family: inherit; }
        input::placeholder { color: ${color.inkFaint}; }
        input:focus { outline: none; }
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        ${theme.motionCss}
        .cc-cardhover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .cc-cardhover:active { transform: scale(0.985); }
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:-400px 0}to{background-position:400px 0}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(22,179,120,0.4)}50%{box-shadow:0 0 0 6px rgba(22,179,120,0)}}
        .cc-filterrow::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', width: '100%', background: color.bgGradient, fontFamily: font.ui, color: color.ink, overflowX: 'hidden', boxSizing: 'border-box' },
  main: { width: '100%', maxWidth: 480, margin: '0 auto', padding: '18px 20px 40px', boxSizing: 'border-box' },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: {
    width: 38, height: 38, borderRadius: radius.md,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.embossOut,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  backEmoji: { fontSize: 17, lineHeight: 1, color: color.ink },
  livePill: {
    display: 'flex', alignItems: 'center', gap: 6, background: color.tealDim,
    border: '1px solid rgba(22,179,120,0.3)', borderRadius: radius.pill, padding: '6px 13px',
    fontSize: 12.5, color: color.teal, fontWeight: 700,
  },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: color.teal, animation: 'pulse 1.8s ease-in-out infinite' },

  title: { fontSize: 25, fontWeight: 800, margin: '0 0 3px', letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: color.inkFaint, margin: '0 0 18px' },

  searchRow: { display: 'flex', gap: 10, marginBottom: 14 },
  searchBar: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.glass, borderRadius: radius.pill, padding: '11px 16px',
  },
  searchEmoji: { fontSize: 14, lineHeight: 1, flexShrink: 0 },
  searchInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: color.ink },
  filterBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.embossOut,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },

  filterRow: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 },
  filterChip: {
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.card,
    borderRadius: radius.pill, color: color.inkDim, fontSize: 12.5, fontWeight: 600, padding: '8px 16px',
    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui, flexShrink: 0,
  },
  filterActive: { background: color.blue, color: '#fff', border: '1px solid transparent', boxShadow: '0 6px 14px rgba(76,111,255,0.35)' },

  list: {},
  card: {
    display: 'flex', alignItems: 'flex-start', gap: 13,
    background: color.glass, backdropFilter: color.blur, WebkitBackdropFilter: color.blur,
    border: `1px solid ${color.glassBorder}`, boxShadow: theme.shadow.glass,
    borderRadius: radius.lg, padding: '15px', marginBottom: 12, animation: 'fadeUp 0.45s ease both',
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, boxShadow: theme.shadow.embossOut },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: color.teal, border: `2.5px solid ${color.surface}`, animation: 'pulse 1.8s ease-in-out infinite' },

  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  docName: { fontSize: 14.5, fontWeight: 700, color: color.ink, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  ratingChip: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: color.ink, flexShrink: 0 },
  docSpec: { fontSize: 12.5, fontWeight: 600, margin: '2px 0' },
  docHosp: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: color.inkFaint, margin: '0 0 4px' },
  docAccuracy: { fontSize: 11.5, color: color.teal, fontWeight: 600, margin: 0 },

  feeBtn: { minWidth: 74, padding: '10px 8px', border: 'none', borderRadius: radius.md, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, boxShadow: '0 6px 14px rgba(76,111,255,0.22)' },
  feeCurrency: { fontSize: 10, opacity: 0.85, fontWeight: 600 },
  feeAmount: { fontSize: 14 },

  skeleton: { height: 84, borderRadius: radius.lg, marginBottom: 12, background: `linear-gradient(90deg, ${color.surfaceMuted} 25%, ${color.surfaceRaised} 50%, ${color.surfaceMuted} 75%)`, backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite' },
  empty: { textAlign: 'center', padding: '50px 0' },
};
