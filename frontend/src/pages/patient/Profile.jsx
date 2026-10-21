import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';
import PrivacyPanel from '../../components/PrivacyPanel';
import MedicalRecords from '../../components/MedicalRecords';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

// Endpoints return either a bare list or a wrapper object ({ verdicts: [...] }).
// Always hand the UI an array so a shape change can never crash the page.
const asList = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  return [];
};

const isUrlLike = (str) => /^https?:\/\//i.test((str || '').trim());
const cardTitle = (session) => {
  const raw = session.symptoms_summary || session.ai_assessment || '';
  if (!raw || isUrlLike(raw)) return 'Health consultation';
  return raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
};
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
};

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

const TABS = [
  { id: 'diagnoses', label: 'Diagnoses' },
  { id: 'medications', label: 'Medications' },
  { id: 'history', label: 'History' },
  { id: 'records', label: 'Records' },
  { id: 'privacy', label: 'Your privacy' },
];

export default function Profile() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(() => { try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; } });
  const [savingSex, setSavingSex] = useState(false);
  const [sexError, setSexError] = useState('');

  // Patients registered before sex was collected can set it once here; the
  // assistant uses it to avoid questions that can't apply to them.
  const saveSex = async (sex) => {
    setSavingSex(true);
    setSexError('');
    try {
      const res = await axios.patch(`${API}/auth/patient/profile/update`, { patient_id: patient.id, sex });
      const next = { ...patient, sex: res.data.sex || sex };
      localStorage.setItem('civtech_patient', JSON.stringify(next));
      setPatient(next);
    } catch {
      setSexError('Could not save. Please try again.');
    } finally {
      setSavingSex(false);
    }
  };
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((x) => x.id === t) ? t : 'diagnoses';
  });
  const [verdicts, setVerdicts] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!patient.id) return;
    try {
      const [vRes, pRes, sRes] = await Promise.allSettled([
        axios.get(`${API}/verdict/history/${patient.id}`),
        axios.get(`${API}/prescriptions/active/${patient.id}`),
        axios.get(`${API}/triage/sessions/${patient.id}`),
      ]);
      if (vRes.status === 'fulfilled') setVerdicts(asList(vRes.value.data, 'verdicts'));
      if (pRes.status === 'fulfilled') setPrescriptions(asList(pRes.value.data, 'prescriptions'));
      if (sRes.status === 'fulfilled') setSessions(asList(sRes.value.data, 'sessions'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    if (!patient.id) { navigate('/'); return; }
    fetchAll();
  }, [fetchAll, navigate, patient.id]);

  const handleLogout = () => { localStorage.clear(); navigate('/', { replace: true }); };

  // Snapshot chips — allergies and location are real patient fields today.
  // Blood type / height / weight aren't collected at registration yet;
  // shown as "Not recorded" rather than invented placeholder data.
  const chips = [
    { label: 'Age', value: patient.age || '—' },
    { label: 'Sex', value: patient.sex ? patient.sex[0].toUpperCase() + patient.sex.slice(1) : 'Not set' },
    { label: 'Blood type', value: patient.blood_type || 'Not recorded' },
    { label: 'Allergies', value: patient.allergies || 'None recorded' },
    { label: 'Location', value: patient.location || '—' },
  ];

  return (
    <div style={s.page}>
      <div style={s.main} className="cc-pg-wide">
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate('/dashboard')}><BackIcon /></button>
          <p style={s.headerTitle}>Profile</p>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>

        <div className="cc-prof-grid">
        <div style={s.snapshot} className="cc-prof-card">
          <div style={s.snapshotTop}>
            <div style={s.avatarLg}>{(patient.name || patient.full_name || 'U')[0].toUpperCase()}</div>
            <div>
              <p style={s.name}>{patient.name || patient.full_name || 'Patient'}</p>
              <p style={s.phone}>{patient.phone_number || ''}</p>
            </div>
          </div>
          <div style={s.chipsGrid}>
            {chips.map((c) => (
              <div key={c.label} style={s.chip}>
                <p style={s.chipLabel}>{c.label}</p>
                <p style={s.chipValue}>{c.value}</p>
              </div>
            ))}
          </div>
          {!patient.sex && (
            <div style={s.sexBox} role="group" aria-labelledby="prof-sex-q">
              <p id="prof-sex-q" style={s.sexQ}>What is your sex? It helps the assistant ask the right questions.</p>
              <div style={s.sexRow}>
                {['female', 'male'].map((v) => (
                  <button key={v} type="button" style={s.sexBtn} disabled={savingSex} onClick={() => saveSex(v)}>
                    {v === 'female' ? 'Female' : 'Male'}
                  </button>
                ))}
              </div>
              {sexError && <p role="alert" style={s.sexErr}>{sexError}</p>}
            </div>
          )}
        </div>

        <div className="cc-prof-body">
        <div style={s.tabRow}>
          {TABS.map((t) => (
            <button
              key={t.id}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && tab !== 'privacy' && tab !== 'records' && <p style={{ color: color.inkFaint, fontSize: 13, padding: '20px 0' }}>Loading…</p>}

        {!loading && tab === 'diagnoses' && (
          <div>
            {verdicts.length === 0 && <p style={s.emptyText}>No diagnoses on record yet.</p>}
            {verdicts.map((v) => (
              <div key={v.id} style={s.entryCard}>
                <div style={s.entryTop}>
                  <p style={s.entryTitle}>{v.diagnosis}</p>
                  {v.severity && <span style={s.severityPill}>{v.severity}</span>}
                </div>
                <p style={s.entryMeta}>{v.doctor_name} · {formatDate(v.date)}</p>
                {v.notes && <p style={s.entryNotes}>{v.notes}</p>}
                {v.prescriptions?.length > 0 && (
                  <div style={s.entryRx}>
                    {v.prescriptions.map((p, i) => (
                      <span key={i} style={s.rxTag}>{p.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'medications' && (
          <div>
            {prescriptions.length === 0 && <p style={s.emptyText}>No active medications.</p>}
            {prescriptions.map((p) => (
              <div key={p.id} style={s.entryCard}>
                <p style={s.entryTitle}>{p.medication_name}</p>
                <p style={s.entryMeta}>
                  {p.dosage_notation || '—'}{p.duration_days ? ` · ${p.duration_days} days` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'records' && <MedicalRecords />}

        {tab === 'privacy' && (
          <PrivacyPanel
            patient={patient}
            onPatient={(next) => { localStorage.setItem('civtech_patient', JSON.stringify(next)); setPatient(next); }}
          />
        )}

        {!loading && tab === 'history' && (
          <div>
            {sessions.length === 0 && <p style={s.emptyText}>No consultations yet.</p>}
            {[...sessions].sort((a, b) => new Date(b.started_at) - new Date(a.started_at)).map((sess) => (
              <div key={sess.id} style={s.entryCard}>
                <p style={s.entryTitle}>{cardTitle(sess)}</p>
                <p style={s.entryMeta}>{formatDate(sess.started_at)}</p>
              </div>
            ))}
          </div>
        )}

        </div>
        </div>

        <div style={{ height: 60 }} />
      </div>

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: color.bgGradient, backgroundAttachment: 'fixed', color: color.ink, fontFamily: font.ui },
  main: { maxWidth: 560, margin: '0 auto', padding: '44px 20px 0' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.sm, background: color.surface,
    border: `1px solid ${color.hairline}`, color: color.ink, display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  headerTitle: { fontFamily: font.display, fontSize: 20, fontWeight: 600, margin: 0, flex: 1 },
  logoutBtn: { background: 'none', border: 'none', color: color.inkFaint, fontSize: 13, cursor: 'pointer' },

  snapshot: {
    background: color.glassStrong, border: `1px solid ${color.glassBorder}`, borderRadius: radius.xl,
    boxShadow: theme.shadow.glass, padding: 20, marginBottom: 20,
  },
  snapshotTop: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarLg: {
    width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(160deg, ${color.heroFrom}, ${color.heroTo})`, color: '#fff', boxShadow: theme.shadow.embossOut,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: font.display, fontWeight: 600, fontSize: 20, flexShrink: 0,
  },
  name: { fontSize: 17, fontWeight: 600, margin: 0, fontFamily: font.display },
  phone: { fontSize: 13, color: color.inkFaint, margin: '2px 0 0' },
  chipsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  chip: { background: color.surfaceMuted, borderRadius: radius.md, padding: '10px 12px', boxShadow: theme.shadow.embossOut },
  chipLabel: { fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: color.inkFaint, margin: '0 0 4px' },
  chipValue: { fontSize: 14, fontWeight: 500, color: color.ink, margin: 0 },
  sexBox: { marginTop: 12, padding: '12px 14px', borderRadius: radius.md, background: 'var(--cc-primary-soft)', border: '1px solid var(--cc-primary-border)' },
  sexQ: { fontSize: 13.5, color: color.ink, margin: '0 0 10px', lineHeight: 1.45 },
  sexRow: { display: 'flex', gap: 8 },
  sexBtn: { flex: 1, minHeight: 40, borderRadius: radius.md, border: '1px solid var(--cc-primary-border)', background: 'var(--cc-surface)', color: 'var(--cc-primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  sexErr: { fontSize: 13, color: 'var(--cc-danger)', margin: '8px 0 0' },

  tabRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, borderBottom: `1px solid ${color.hairline}`, paddingBottom: 2 },
  tabBtn: {
    background: 'none', border: 'none', color: color.inkFaint, fontSize: 13.5, fontWeight: 500,
    padding: '8px 4px', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabBtnActive: { color: color.blue, borderBottom: `2px solid ${color.blue}` },

  emptyText: { fontSize: 13, color: color.inkFaint, padding: '20px 0' },
  entryCard: {
    background: color.surface, border: `1px solid ${color.glassBorder}`, borderRadius: radius.lg, boxShadow: theme.shadow.glass,
    padding: '14px 16px', marginBottom: 10,
  },
  entryTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryTitle: { fontSize: 14.5, fontWeight: 600, color: color.ink, margin: 0 },
  entryMeta: { fontSize: 12, color: color.inkFaint, margin: '4px 0 0' },
  entryNotes: { fontSize: 13, color: color.inkDim, margin: '8px 0 0', lineHeight: 1.5 },
  entryRx: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  rxTag: {
    fontSize: 11.5, background: color.tealDim, color: color.teal, borderRadius: radius.pill,
    padding: '3px 9px',
  },
  severityPill: {
    fontSize: 10.5, fontWeight: 700, color: color.coral, background: color.coralDim,
    borderRadius: radius.pill, padding: '2px 8px', flexShrink: 0,
  },
};
