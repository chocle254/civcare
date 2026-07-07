
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

// ── Icons — small inline SVGs, no icon library dependency ─────────────────
const Icon = {
  Home: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.5V20h5v-6h1v6h5V9.5" />
    </svg>
  ),
  Pulse: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l2 7 4-16 2 9h8" />
    </svg>
  ),
  Doctor: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-4.2 3.1-7 7-7s7 2.8 7 7" />
    </svg>
  ),
  Hospital: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V8l8-4 8 4v13" />
      <path d="M9 21v-5h6v5" />
      <path d="M12 9v4M10 11h4" />
    </svg>
  ),
  Pill: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(45 12 12)">
        <rect x="5" y="9" width="14" height="6" rx="3" />
        <line x1="12" y1="9" x2="12" y2="15" />
      </g>
    </svg>
  ),
  History: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
};

// ── Helpers ─────────────────────────────────────────────────────────────
const isUrlLike = (str) => /^https?:\/\//i.test((str || '').trim());

const cardTitle = (session) => {
  const raw = session.symptoms_summary || session.ai_assessment || '';
  if (!raw || isUrlLike(raw)) return 'Health consultation';
  return raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
};

const fmtClock = (ms) => {
  const tot = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(tot / 3600)).padStart(2, '0');
  const m = String(Math.floor((tot % 3600) / 60)).padStart(2, '0');
  const sec = String(tot % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

// ── Dose ring — replaces the plain digital countdown with a radial visual ──
function DoseRing({ label, dose, remaining, intervalMs, isAlert }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const pct = intervalMs > 0 ? Math.max(0, Math.min(1, 1 - remaining / intervalMs)) : 0;
  const ringColor = isAlert ? color.coral : color.teal;

  return (
    <div style={s.doseRow}>
      <div style={s.doseRingWrap}>
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} fill="none" stroke={color.hairline} strokeWidth="4" />
          <circle
            cx="28" cy="28" r={R} fill="none" stroke={ringColor} strokeWidth="4"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} strokeLinecap="round"
            transform="rotate(-90 28 28)" style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span style={{ ...s.doseRingLabel, color: ringColor }}>{isAlert ? 'NOW' : ''}</span>
      </div>
      <div style={s.doseInfo}>
        <p style={s.doseName}>{label}</p>
        <p style={s.doseMeta}>{dose}</p>
      </div>
      <div style={{ ...s.doseTime, color: isAlert ? color.coral : color.inkDim }}>
        {isAlert ? 'Take now' : fmtClock(remaining)}
      </div>
    </div>
  );
}

function DoseProgress({ dayIndex, totalDays }) {
  if (!totalDays) return null;
  const pct = Math.min(1, dayIndex / totalDays);
  return (
    <div style={s.courseWrap}>
      <div style={s.courseTrack}>
        <div style={{ ...s.courseFill, width: `${pct * 100}%` }} />
      </div>
      <span style={s.courseLabel}>Day {Math.min(dayIndex, totalDays)} of {totalDays}</span>
    </div>
  );
}

function MedCard({ prescriptions }) {
  const [timers, setTimers] = useState([]);
  const [alertIdx, setAlertIdx] = useState(null);

  useEffect(() => {
    if (!prescriptions?.length) return;

    const calc = () =>
      prescriptions.map((p) => {
        const timesPerDay = parseInt((p.dosage_notation || '1x1').split('x')[1]) || 1;
        const intervalMs = (24 / timesPerDay) * 60 * 60 * 1000;
        const startMs = p.reminders_start_at ? new Date(p.reminders_start_at).getTime() : Date.now();
        const elapsed = (Date.now() - startMs) % intervalMs;
        return { ...p, remaining: intervalMs - elapsed, intervalMs };
      });

    setTimers(calc());
    const iv = setInterval(() => {
      setTimers((prev) =>
        prev.map((t, i) => {
          const next = t.remaining - 1000;
          if (next <= 0) {
            setAlertIdx(i);
            setTimeout(() => setAlertIdx(null), 5000);
            return { ...t, remaining: t.intervalMs };
          }
          return { ...t, remaining: next };
        })
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [prescriptions]);

  if (!timers.length) return null;

  return (
    <div style={s.medCard}>
      <p style={s.eyebrow}>Medication reminders</p>
      {timers.map((t, i) => {
        const startMs = t.reminders_start_at ? new Date(t.reminders_start_at).getTime() : Date.now();
        const dayIndex = Math.floor((Date.now() - startMs) / 86400000) + 1;
        return (
          <div key={t.id}>
            <DoseRing
              label={t.medication_name}
              dose={t.dosage_notation || '—'}
              remaining={t.remaining}
              intervalMs={t.intervalMs}
              isAlert={alertIdx === i}
            />
            <DoseProgress dayIndex={dayIndex} totalDays={t.duration_days} />
          </div>
        );
      })}
    </div>
  );
}

// ── Nav config — single source of truth for both sidebar and tab bar ──────
const navItems = (prescriptionsLen, doctorsAvailable) => [
  { id: 'home', label: 'Home', Icon: Icon.Home },
  { id: 'doctors', label: 'Doctors', Icon: Icon.Doctor, path: '/consultation', badge: doctorsAvailable > 0 ? doctorsAvailable : null },
  { id: 'hospitals', label: 'Hospitals', Icon: Icon.Hospital, path: '/hospitals' },
  ...(prescriptionsLen > 0 ? [{ id: 'medications', label: 'Medications', Icon: Icon.Pill, path: '/medications' }] : []),
  { id: 'history', label: 'History', Icon: Icon.History, path: '/diagnosis-history' },
];

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function SessionDashboard() {
  const navigate = useNavigate();
  const patient = (() => { try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; } })();
  const [sessions, setSessions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeSheet, setResumeSheet] = useState(null);
  const [doctorsAvailable, setDoctorsAvailable] = useState(0);
  const [pendingConsult, setPendingConsult] = useState(null);

  const firstName = (patient.name || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fetchData = useCallback(async () => {
    if (!patient.id) return;
    try {
      const [sessRes, presRes, docRes, pendRes] = await Promise.allSettled([
        axios.get(`${API}/triage/sessions/${patient.id}`),
        axios.get(`${API}/prescriptions/active/${patient.id}`),
        axios.get(`${API}/doctors/available`),
        axios.get(`${API}/consultation/pending`, { params: { patient_id: patient.id } }),
      ]);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data || []);
      if (presRes.status === 'fulfilled') setPrescriptions(presRes.value.data || []);
      if (docRes.status === 'fulfilled') setDoctorsAvailable((docRes.value.data || []).length);
      if (pendRes.status === 'fulfilled') setPendingConsult(pendRes.value.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    if (!patient.id) { navigate('/'); return; }
    fetchData();
  }, [fetchData, navigate, patient.id]);

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const handleCardTap = (session) => {
    if (session.status === 'active') setResumeSheet(session);
    else { localStorage.setItem('civtech_session_id', session.id); navigate('/chat'); }
  };

  const handleResume = () => {
    localStorage.setItem('civtech_session_id', resumeSheet.id);
    setResumeSheet(null);
    navigate('/chat');
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

  const nav = navItems(prescriptions.length, doctorsAvailable);

  const NavButton = ({ item, onSidebar }) => (
    <button
      style={{ ...s.navBtn, ...(onSidebar ? s.navBtnSidebar : {}), position: 'relative' }}
      onClick={() => (item.path ? navigate(item.path) : window.scrollTo({ top: 0, behavior: 'smooth' }))}
    >
      <span style={{ position: 'relative' }}>
        <item.Icon size={onSidebar ? 19 : 21} />
        {item.badge && <span style={s.navBadge}>{item.badge}</span>}
      </span>
      <span style={onSidebar ? s.navLabelSidebar : s.navLabel}>{item.label}</span>
    </button>
  );

  return (
    <div style={s.page}>
      {/* ── SIDEBAR (desktop) ── */}
      <aside className="cc-sidebar" style={s.sidebar}>
        <div style={s.sidebarBrand}>
          <div style={s.brandMark}>C</div>
          <span style={s.brandName}>CivCare</span>
        </div>
        <nav style={s.sidebarNav}>
          {nav.map((item) => <NavButton key={item.id} item={item} onSidebar />)}
        </nav>
        <button style={s.sidebarLogout} onClick={handleLogout}>Sign out</button>
      </aside>

      {/* ── MAIN COLUMN ── */}
      <div className="cc-main" style={s.main}>
        <div style={s.header}>
          <div>
            <p style={s.greetingText}>{greeting},</p>
            <p style={s.greetingName}>{firstName}</p>
          </div>
          <button className="cc-avatar" style={s.avatarBtn} onClick={() => navigate('/profile')}>
            {(patient.name || 'U')[0].toUpperCase()}
          </button>
        </div>

        <MedCard prescriptions={prescriptions} />

        {/* ── PENDING CONSULTATION — takes priority over the triage CTA when live ── */}
        {pendingConsult && (
          <div style={s.pendingBanner} onClick={() => navigate('/consultation/waiting')}>
            <div style={s.pendingDot} />
            <div style={{ flex: 1 }}>
              <p style={s.pendingTitle}>
                {pendingConsult.doctor_name ? `Waiting for Dr. ${pendingConsult.doctor_name}` : 'Consultation in progress'}
              </p>
              <p style={s.pendingSub}>Tap to view status</p>
            </div>
            <Icon.Chevron size={18} />
          </div>
        )}

        {/* ── PRIMARY ACTION — the one CTA, not three duplicate buttons ── */}
        <button style={s.heroCta} onClick={() => { localStorage.removeItem('civtech_session_id'); navigate('/chat'); }}>
          <div style={s.heroCtaIcon}><Icon.Pulse size={22} /></div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={s.heroCtaTitle}>Not feeling well?</p>
            <p style={s.heroCtaSub}>Start with AI triage — takes about 2 minutes</p>
          </div>
          <Icon.Chevron size={18} />
        </button>

        {/* ── HEALTH HISTORY ── */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <p style={s.eyebrow}>Health history</p>
            <span style={s.sessionCount}>{sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
          </div>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => <div key={i} style={s.skeleton} />)}
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: 15, color: color.inkDim, margin: 0 }}>No consultations yet.</p>
              <p style={{ fontSize: 13, color: color.inkFaint, marginTop: 4 }}>Start your first one above.</p>
            </div>
          )}

          {!loading && [...sessions]
            .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
            .map((session, i) => {
              const isActive = session.status === 'active';
              return (
                <div key={session.id} style={{ ...s.card, animationDelay: `${i * 0.05}s` }} onClick={() => handleCardTap(session)}>
                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <p style={s.cardTitle}>{cardTitle(session)}</p>
                      {isActive && <span style={s.activePill}>Active</span>}
                    </div>
                    <span style={s.cardDate}>{formatDate(session.started_at)}</span>
                  </div>
                  <Icon.Chevron />
                </div>
              );
            })}
        </div>

        <div style={{ height: 90 }} />
      </div>

      {/* ── BOTTOM TAB BAR (mobile) ── */}
      <div className="cc-bottomnav" style={s.bottomNav}>
        {nav.map((item) => <NavButton key={item.id} item={item} />)}
      </div>

      {/* ── RESUME SHEET ── */}
      {resumeSheet && (
        <>
          <div style={s.overlay} onClick={() => setResumeSheet(null)} />
          <div style={s.sheet}>
            <div style={s.sheetPill} />
            <p style={s.eyebrow}>Continuing session</p>
            <h2 style={s.sheetTitle}>{cardTitle(resumeSheet)}</h2>
            <p style={s.sheetSub}>The AI has full context and will continue from where you left off.</p>
            {resumeSheet.last_message && !isUrlLike(resumeSheet.last_message) && (
              <div style={s.sheetPreview}>
                <p style={s.eyebrow}>Last message</p>
                <p style={s.sheetPreviewText}>&ldquo;{resumeSheet.last_message}&rdquo;</p>
              </div>
            )}
            <button style={s.sheetBtn} onClick={handleResume}>Resume conversation</button>
            <button style={s.sheetCancel} onClick={() => setResumeSheet(null)}>Not now</button>
          </div>
        </>
      )}

      <style>{`
        ${theme.fontImport}
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:focus-visible, .cc-avatar:focus-visible { outline: 2px solid ${color.gold}; outline-offset: 2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

        .cc-sidebar { display: none; }
        .cc-bottomnav { display: flex; }
        .cc-main { padding-bottom: 100px; }

        @media (min-width: 900px) {
          .cc-sidebar { display: flex !important; }
          .cc-bottomnav { display: none !important; }
          .cc-main { padding-bottom: 48px !important; margin-left: 240px; max-width: 720px; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh', backgroundColor: color.bg,
    fontFamily: font.ui, color: color.ink,
    position: 'relative',
  },
  sidebar: {
    position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
    background: color.bgElevated, borderRight: `1px solid ${color.hairline}`,
    flexDirection: 'column', padding: '28px 16px', zIndex: 20,
  },
  sidebarBrand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 32 },
  brandMark: {
    width: 34, height: 34, borderRadius: radius.sm, flexShrink: 0,
    background: color.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: font.display, fontWeight: 600, fontSize: 17, color: color.bg,
  },
  brandName: { fontFamily: font.display, fontWeight: 600, fontSize: 17, color: color.ink },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  sidebarLogout: {
    background: 'none', border: 'none', color: color.inkFaint, fontSize: 13,
    textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontFamily: font.ui,
  },
  main: { position: 'relative', zIndex: 10, maxWidth: 560, margin: '0 auto', padding: '44px 20px 0' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  greetingText: { fontSize: 13, color: color.inkFaint, margin: 0, fontFamily: font.ui },
  greetingName: { fontSize: 26, fontWeight: 600, color: color.ink, margin: '2px 0 0', fontFamily: font.display },
  avatarBtn: {
    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
    background: color.surfaceRaised, border: `1px solid ${color.hairlineStrong}`,
    color: color.ink, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: font.ui,
  },

  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: color.inkFaint, margin: '0 0 12px' },

  medCard: {
    background: color.surface, border: `1px solid ${color.hairline}`, borderRadius: radius.lg,
    padding: '18px 18px 6px', marginBottom: 16, animation: 'fadeUp 0.5s ease both',
  },
  doseRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 14px' },
  doseRingWrap: { position: 'relative', width: 56, height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  doseRingLabel: { position: 'absolute', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 14.5, fontWeight: 600, color: color.ink, margin: 0 },
  doseMeta: { fontSize: 12, color: color.inkFaint, margin: '2px 0 0' },
  doseTime: { fontSize: 14, fontWeight: 600, fontFamily: font.mono, flexShrink: 0 },

  courseWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 12px 70px', marginTop: -8 },
  courseTrack: { flex: 1, height: 4, borderRadius: 2, background: color.hairlineStrong, overflow: 'hidden' },
  courseFill: { height: '100%', background: color.teal, borderRadius: 2, transition: 'width 0.6s ease' },
  courseLabel: { fontSize: 11, color: color.inkFaint, flexShrink: 0, fontFamily: font.mono },

  navBadge: {
    position: 'absolute', top: -5, right: -8, minWidth: 15, height: 15, borderRadius: radius.pill,
    background: color.teal, color: color.bg, fontSize: 9.5, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },

  pendingBanner: {
    display: 'flex', alignItems: 'center', gap: 12, background: color.tealDim,
    border: `1px solid rgba(52,184,166,0.3)`, borderRadius: radius.lg, padding: '14px 16px',
    marginBottom: 16, cursor: 'pointer', animation: 'fadeUp 0.5s ease both',
  },
  pendingDot: { width: 9, height: 9, borderRadius: '50%', background: color.teal, flexShrink: 0 },
  pendingTitle: { fontSize: 14, fontWeight: 600, color: color.ink, margin: 0 },
  pendingSub: { fontSize: 12, color: color.inkDim, margin: '2px 0 0' },

  heroCta: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    background: color.goldDim, border: `1px solid rgba(224,164,88,0.3)`, borderRadius: radius.lg,
    padding: '18px 18px', cursor: 'pointer', marginBottom: 28, textAlign: 'left',
    animation: 'fadeUp 0.5s ease 0.05s both', color: color.ink,
  },
  heroCtaIcon: {
    width: 42, height: 42, borderRadius: radius.md, flexShrink: 0,
    background: color.gold, color: color.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  heroCtaTitle: { fontSize: 16, fontWeight: 600, margin: 0, color: color.ink, fontFamily: font.display },
  heroCtaSub: { fontSize: 12.5, color: color.inkDim, margin: '3px 0 0' },

  section: { animation: 'fadeUp 0.5s ease 0.1s both' },
  sectionHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  sessionCount: { fontSize: 12, color: color.inkFaint },

  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: color.surface, border: `1px solid ${color.hairline}`, borderRadius: radius.md,
    padding: '14px 16px', marginBottom: 8, cursor: 'pointer', animation: 'fadeUp 0.45s ease both',
    color: color.inkFaint,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: color.ink, margin: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  activePill: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: color.teal,
    background: color.tealDim, borderRadius: radius.pill, padding: '2px 8px', flexShrink: 0,
  },
  cardDate: { fontSize: 12, color: color.inkFaint },

  empty: { textAlign: 'center', padding: '40px 0' },
  skeleton: {
    height: 58, borderRadius: radius.md,
    background: `linear-gradient(90deg, ${color.surface} 25%, ${color.surfaceRaised} 50%, ${color.surface} 75%)`,
    backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite',
  },

  bottomNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: color.bgElevated, borderTop: `1px solid ${color.hairline}`,
    justifyContent: 'space-around', alignItems: 'center', padding: '10px 8px calc(10px + env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  navBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px',
    color: color.inkFaint, minWidth: 56,
  },
  navLabel: { fontSize: 10.5, fontWeight: 500 },
  navBtnSidebar: { flexDirection: 'row', justifyContent: 'flex-start', width: '100%', padding: '10px 12px', borderRadius: radius.sm, gap: 12 },
  navLabelSidebar: { fontSize: 13.5, fontWeight: 500 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: color.bgElevated, borderTop: `1px solid ${color.hairlineStrong}`,
    borderRadius: '22px 22px 0 0', padding: '20px 24px 40px',
    zIndex: 201, animation: 'sheetUp 0.3s ease both', maxWidth: 560, margin: '0 auto',
  },
  sheetPill: { width: 36, height: 4, borderRadius: 2, background: color.hairlineStrong, margin: '0 auto 18px' },
  sheetTitle: { fontFamily: font.display, fontSize: 20, fontWeight: 600, color: color.ink, margin: '0 0 8px' },
  sheetSub: { fontSize: 13, color: color.inkDim, margin: '0 0 16px', lineHeight: 1.6 },
  sheetPreview: { background: color.surface, border: `1px solid ${color.hairline}`, borderRadius: radius.sm, padding: '10px 14px', marginBottom: 18 },
  sheetPreviewText: { fontSize: 13, color: color.inkDim, margin: 0, fontStyle: 'italic' },
  sheetBtn: {
    width: '100%', padding: '15px 0', background: color.gold, border: 'none', borderRadius: radius.md,
    color: color.bg, fontSize: 14.5, fontWeight: 600, fontFamily: font.ui, cursor: 'pointer', marginBottom: 8,
  },
  sheetCancel: { width: '100%', padding: '12px 0', background: 'none', border: 'none', color: color.inkFaint, fontSize: 13.5, cursor: 'pointer', fontFamily: font.ui },
};
