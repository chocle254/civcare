import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';
import { Icon } from '../../components/Icons';
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
  const patient   = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const sessionId = localStorage.getItem('civtech_session_id') || null;

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

  const handleConsult = (doctor) => {
    setSelected(doctor.id);
    localStorage.setItem('civtech_selected_doctor', JSON.stringify(doctor));
    if (sessionId) {
      axios.post(`${API}/consultation/initiate`, {
        patient_id: patient.id, doctor_id: doctor.id,
        session_id: sessionId, payment_method: 'mpesa', fee_amount: doctor.consultation_fee,
      }).then(res => {
        localStorage.setItem('civtech_consultation_id', res.data.consultation_id);
        navigate('/consultation/waiting');
      }).catch(() => {
        setSelected(null);
        alert('Could not book. Please try again.');
      });
    } else {
      navigate('/chat', { state: { mode: 'pre_consultation' } });
    }
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
          <button style={s.back} onClick={() => navigate('/dashboard')}>
            <Icon.ChevronLeft size={20} color={color.ink} />
          </button>
          <div style={s.livePill}><span style={s.liveDot} />Live</div>
        </div>
        <h1 style={s.title}>Find a Doctor</h1>
        <p style={s.sub}>Available doctors online now</p>

        {/* Search */}
        <div style={s.searchRow}>
          <div style={s.searchBar}>
            <Icon.Search size={16} color={color.inkFaint} />
            <input
              style={s.searchInput}
              placeholder="Search doctors, specialties..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button style={s.filterBtn} aria-label="Filter">
            <Icon.Filter size={17} color={color.ink} />
          </button>
        </div>

        {/* Filter chips */}
        <div style={s.filterRow}>
          {FILTERS.map((f) => (
            <button key={f} style={{ ...s.filterChip, ...(filter === f ? s.filterActive : {}) }} onClick={() => setFilter(f)}>
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
              <div key={doc.id} style={{ ...s.card, animationDelay: `${i * 0.06}s` }}>
                <div style={s.avatarWrap}>
                  <div style={{ ...s.avatar, background: spec.tintDim, color: spec.tint }}>{initials(name)}</div>
                  <span style={s.onlineDot} />
                </div>

                <div style={s.info}>
                  <div style={s.nameRow}>
                    <p style={s.docName}>Dr. {name.replace(/^Dr\.?\s*/i, '')}</p>
                    <span style={s.ratingChip}><Icon.Star size={11} filled /> {rating}</span>
                  </div>
                  <p style={{ ...s.docSpec, color: spec.tint }}>{doc.specialisation || 'General Practitioner'}</p>
                  {doc.hospital_name && (
                    <p style={s.docHosp}><Icon.Hospital size={12} color={color.inkFaint} /> {doc.hospital_name}</p>
                  )}
                  <p style={s.docAccuracy}>{accuracy}% AI Accuracy</p>
                </div>

                <button
                  style={{ ...s.feeBtn, background: busy ? color.surfaceMuted : spec.tint, color: busy ? color.inkFaint : '#fff' }}
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

      <BottomNav active="assistant" />

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button, input { font-family: inherit; }
        input::placeholder { color: ${color.inkFaint}; }
        input:focus { outline: none; }
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:-400px 0}to{background-position:400px 0}}
        .cc-filterrow::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', backgroundColor: color.bg, fontFamily: font.ui, color: color.ink },
  main: { maxWidth: 480, margin: '0 auto', padding: '18px 20px 40px' },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { width: 38, height: 38, borderRadius: radius.md, background: color.surfaceMuted, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  livePill: { display: 'flex', alignItems: 'center', gap: 6, background: color.tealDim, borderRadius: radius.pill, padding: '6px 13px', fontSize: 12.5, color: color.teal, fontWeight: 700 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: color.teal },

  title: { fontSize: 25, fontWeight: 800, margin: '0 0 3px', letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: color.inkFaint, margin: '0 0 18px' },

  searchRow: { display: 'flex', gap: 10, marginBottom: 14 },
  searchBar: { flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: color.surface, boxShadow: theme.shadow.card, borderRadius: radius.pill, padding: '11px 16px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: color.ink },
  filterBtn: { width: 42, height: 42, borderRadius: radius.md, background: color.surface, boxShadow: theme.shadow.card, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

  filterRow: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 },
  filterChip: { background: color.surface, boxShadow: theme.shadow.card, border: 'none', borderRadius: radius.pill, color: color.inkDim, fontSize: 12.5, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: font.ui },
  filterActive: { background: color.blue, color: '#fff', boxShadow: 'none' },

  list: {},
  card: { display: 'flex', alignItems: 'flex-start', gap: 13, background: color.surface, boxShadow: theme.shadow.card, borderRadius: radius.lg, padding: '15px', marginBottom: 12, animation: 'fadeUp 0.45s ease both' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: color.teal, border: `2.5px solid ${color.surface}` },

  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  docName: { fontSize: 14.5, fontWeight: 700, color: color.ink, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  ratingChip: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: color.ink, flexShrink: 0 },
  docSpec: { fontSize: 12.5, fontWeight: 600, margin: '2px 0' },
  docHosp: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: color.inkFaint, margin: '0 0 4px' },
  docAccuracy: { fontSize: 11.5, color: color.teal, fontWeight: 600, margin: 0 },

  feeBtn: { minWidth: 74, padding: '10px 8px', border: 'none', borderRadius: radius.md, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  feeCurrency: { fontSize: 10, opacity: 0.85, fontWeight: 600 },
  feeAmount: { fontSize: 14 },

  skeleton: { height: 84, borderRadius: radius.lg, marginBottom: 12, background: `linear-gradient(90deg, ${color.surfaceMuted} 25%, ${color.surfaceRaised} 50%, ${color.surfaceMuted} 75%)`, backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite' },
  empty: { textAlign: 'center', padding: '50px 0' },
};
