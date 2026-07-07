import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

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
];

export default function Profile() {
  const navigate = useNavigate();
  const patient = (() => { try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; } })();
  const [tab, setTab] = useState('diagnoses');
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
      if (vRes.status === 'fulfilled') setVerdicts(vRes.value.data || []);
      if (pRes.status === 'fulfilled') setPrescriptions(pRes.value.data || []);
      if (sRes.status === 'fulfilled') setSessions(sRes.value.data || []);
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

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  // Snapshot chips — allergies and location are real patient fields today.
  // Blood type / height / weight aren't collected at registration yet;
  // shown as "Not recorded" rather than invented placeholder data.
  const chips = [
    { label: 'Age', value: patient.age || '—' },
    { label: 'Blood type', value: patient.blood_type || 'Not recorded' },
    { label: 'Allergies', value: patient.allergies || 'None recorded' },
    { label: 'Location', value: patient.location || '—' },
  ];

  return (
    <div style={s.page}>
      <div style={s.main}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate('/dashboard')}><BackIcon /></button>
          <p style={s.headerTitle}>Profile</p>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>

        <div style={s.snapshot}>
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
        </div>

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

        {loading && <p style={{ color: color.inkFaint, fontSize: 13, padding: '20px 0' }}>Loading…</p>}

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

        <div style={{ height: 60 }} />
      </div>

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:focus-visible { outline: 2px solid ${color.gold}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: color.bg, color: color.ink, fontFamily: font.ui },
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
    background: color.surface, border: `1px solid ${color.hairline}`, borderRadius: radius.lg,
    padding: 20, marginBottom: 20,
  },
  snapshotTop: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarLg: {
    width: 52, height: 52, borderRadius: '50%', background: color.gold, color: color.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: font.display, fontWeight: 600, fontSize: 20, flexShrink: 0,
  },
  name: { fontSize: 17, fontWeight: 600, margin: 0, fontFamily: font.display },
  phone: { fontSize: 13, color: color.inkFaint, margin: '2px 0 0' },
  chipsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  chip: { background: color.surfaceRaised, borderRadius: radius.sm, padding: '10px 12px' },
  chipLabel: { fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: color.inkFaint, margin: '0 0 4px' },
  chipValue: { fontSize: 14, fontWeight: 500, color: color.ink, margin: 0 },

  tabRow: { display: 'flex', gap: 8, marginBottom: 18, borderBottom: `1px solid ${color.hairline}`, paddingBottom: 2 },
  tabBtn: {
    background: 'none', border: 'none', color: color.inkFaint, fontSize: 13.5, fontWeight: 500,
    padding: '8px 4px', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabBtnActive: { color: color.gold, borderBottom: `2px solid ${color.gold}` },

  emptyText: { fontSize: 13, color: color.inkFaint, padding: '20px 0' },
  entryCard: {
    background: color.surface, border: `1px solid ${color.hairline}`, borderRadius: radius.md,
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
