import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { theme } from '../../styles/theme';
import { Icon } from '../../components/Icons';
import BottomNav from '../../components/BottomNav';

const API = process.env.REACT_APP_API_URL;
const { color, font, radius } = theme;

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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
};

// Sparkline used inside the vital stat tiles
function Sparkline({ points, color: stroke }) {
  const w = 64, h = 22;
  const max = Math.max(...points), min = Math.min(...points);
  const norm = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={norm.join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VitalTile({ label, value, unit, IconEl, tint, tintBg, points }) {
  return (
    <div style={s.vitalTile}>
      <div style={{ ...s.vitalIconWrap, background: tintBg, color: tint }}>
        <IconEl size={16} color={tint} />
      </div>
      <p style={s.vitalValue}>{value}<span style={s.vitalUnit}>{unit}</span></p>
      <p style={s.vitalLabel}>{label}</p>
      <Sparkline points={points} color={tint} />
    </div>
  );
}

// ── Dose ring — medication reminder visual ─────────────────────────────
function DoseRing({ label, dose, remaining, intervalMs, isAlert }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const pct = intervalMs > 0 ? Math.max(0, Math.min(1, 1 - remaining / intervalMs)) : 0;
  const ringColor = isAlert ? color.coral : color.blue;

  return (
    <div style={s.doseRow}>
      <div style={s.doseRingWrap}>
        <svg width="52" height="52" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} fill="none" stroke={color.hairlineStrong} strokeWidth="4" />
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
      <div style={{ ...s.doseTime, color: isAlert ? color.coral : color.inkFaint }}>
        {isAlert ? 'Take now' : fmtClock(remaining)}
      </div>
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
            {t.duration_days ? (
              <div style={s.courseWrap}>
                <div style={s.courseTrack}>
                  <div style={{ ...s.courseFill, width: `${Math.min(1, dayIndex / t.duration_days) * 100}%` }} />
                </div>
                <span style={s.courseLabel}>Day {Math.min(dayIndex, t.duration_days)} of {t.duration_days}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function SessionDashboard() {
  const navigate = useNavigate();
  const patient = (() => { try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; } })();
  const [sessions, setSessions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeSheet, setResumeSheet] = useState(null);
  const [pendingConsult, setPendingConsult] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName = (patient.name || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const fetchData = useCallback(async () => {
    if (!patient.id) return;
    try {
      const [sessRes, presRes, pendRes] = await Promise.allSettled([
        axios.get(`${API}/triage/sessions/${patient.id}`),
        axios.get(`${API}/prescriptions/active/${patient.id}`),
        axios.get(`${API}/consultation/pending`, { params: { patient_id: patient.id } }),
      ]);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data || []);
      if (presRes.status === 'fulfilled') setPrescriptions(presRes.value.data || []);
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

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, 4);

  return (
    <div style={s.page}>
      <div className="cc-main" style={s.main}>
        {/* ── HEADER ── */}
        <div style={s.header}>
          <button style={s.iconBtn} onClick={() => setMenuOpen(true)} aria-label="Menu">
            <Icon.Home size={0} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button style={s.iconBtn} onClick={() => navigate('/diagnosis-history')} aria-label="Notifications">
            <span style={{ position: 'relative' }}>
              <Icon.Bell size={20} color={color.ink} />
              <span style={s.bellDot} />
            </span>
          </button>
        </div>

        <p style={s.greetingText}>{greeting}</p>
        <h1 style={s.greetingName}>{firstName} <span style={s.wave}>👋</span></h1>
        <p style={s.greetingSub}>Your health looks great today</p>

        {/* ── AI HEALTH ASSISTANT HERO ── */}
        <button
          style={s.heroCard}
          onClick={() => { localStorage.removeItem('civtech_session_id'); navigate('/chat'); }}
        >
          <div style={s.heroGlowA} />
          <div style={s.heroGlowB} />
          <span style={s.heroPill}>AI HEALTH ASSISTANT</span>
          <p style={s.heroTitle}>How are you<br />feeling today?</p>
          <p style={s.heroSub}>Tell me how you feel and<br />I'll guide you.</p>
          <span style={s.heroCta}>
            Start AI Checkup
            <Icon.ArrowRight size={15} color={color.ink} />
          </span>
          <div style={s.heroAvatar}>
            <div style={s.avatarBlobA} />
            <div style={s.avatarBlobB} />
            <Icon.Sparkle size={30} color="#fff" />
          </div>
        </button>

        {/* ── PENDING CONSULTATION ── */}
        {pendingConsult && (
          <div style={s.pendingBanner} onClick={() => navigate('/consultation/waiting')}>
            <div style={s.pendingDot} />
            <div style={{ flex: 1 }}>
              <p style={s.pendingTitle}>
                {pendingConsult.doctor_name ? `Waiting for Dr. ${pendingConsult.doctor_name}` : 'Consultation in progress'}
              </p>
              <p style={s.pendingSub}>Tap to view status</p>
            </div>
            <Icon.Chevron size={18} color={color.inkFaint} />
          </div>
        )}

        {/* ── HEALTH OVERVIEW ── */}
        <div style={s.sectionHeader}>
          <p style={s.sectionTitle}>Health Overview</p>
          <button style={s.seeAll} onClick={() => navigate('/diagnosis-history')}>See all</button>
        </div>
        <div style={s.vitalsGrid}>
          <VitalTile label="Heart Rate" value="72" unit=" BPM" IconEl={Icon.Heart} tint={color.coral} tintBg={color.coralDim} points={[60, 66, 58, 70, 64, 72, 68]} />
          <VitalTile label="Steps" value="7,240" unit="" IconEl={Icon.Footprint} tint={color.mint} tintBg={color.mintDim} points={[10, 30, 25, 45, 40, 60, 72]} />
          <VitalTile label="Sleep" value="8.2" unit=" h" IconEl={Icon.Moon} tint={color.blue} tintBg={color.blueDim} points={[6, 7, 5, 8, 6.5, 7.5, 8.2]} />
          <VitalTile label="Oxygen" value="98" unit="%" IconEl={Icon.Droplet} tint={color.sky} tintBg={color.skyDim} points={[95, 96, 97, 95, 98, 97, 98]} />
        </div>

        {/* ── HEALTH SCORE ── */}
        <div style={s.scoreCard}>
          <div>
            <p style={s.scoreLabel}>Health Score</p>
            <p style={s.scoreValue}>96 <span style={s.scoreExcellent}>Excellent</span></p>
            <p style={s.scoreSub}>AI Confidence 98%</p>
          </div>
          <div style={s.scoreRingWrap}>
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r="32" fill="none" stroke={color.blueDim} strokeWidth="8" />
              <circle
                cx="38" cy="38" r="32" fill="none" stroke={color.blue} strokeWidth="8"
                strokeDasharray={2 * Math.PI * 32} strokeDashoffset={2 * Math.PI * 32 * 0.04}
                strokeLinecap="round" transform="rotate(-90 38 38)"
              />
            </svg>
            <span style={s.scoreRingIcon}><Icon.Shield size={22} color={color.blue} /></span>
          </div>
        </div>

        <MedCard prescriptions={prescriptions} />

        {/* ── RECENT HEALTH HISTORY ── */}
        <div style={s.sectionHeader}>
          <p style={s.sectionTitle}>Recent Activity</p>
          <span style={s.sessionCount}>{sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => <div key={i} style={s.skeleton} />)}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={s.empty}>
            <p style={{ fontSize: 14.5, color: color.inkDim, margin: 0 }}>No consultations yet.</p>
            <p style={{ fontSize: 12.5, color: color.inkFaint, marginTop: 4 }}>Start your first one above.</p>
          </div>
        )}

        {!loading && recentSessions.map((session, i) => {
          const isActive = session.status === 'active';
          return (
            <div key={session.id} style={{ ...s.histCard, animationDelay: `${i * 0.05}s` }} onClick={() => handleCardTap(session)}>
              <div style={s.histIcon}><Icon.Records size={17} color={color.violet} /></div>
              <div style={s.cardBody}>
                <div style={s.cardTop}>
                  <p style={s.cardTitle}>{cardTitle(session)}</p>
                  {isActive && <span style={s.activePill}>Active</span>}
                </div>
                <span style={s.cardDate}>{formatDate(session.started_at)}</span>
              </div>
              <Icon.Chevron size={16} color={color.inkFaint} />
            </div>
          );
        })}

        <div style={{ height: 100 }} />
      </div>

      <BottomNav active="home" />

      {/* ── SIDE MENU ── */}
      {menuOpen && (
        <>
          <div style={s.overlay} onClick={() => setMenuOpen(false)} />
          <div style={s.menuSheet}>
            <div style={s.sheetPill} />
            <p style={s.menuName}>{patient.name || 'Patient'}</p>
            <p style={s.menuSub}>{patient.phone || ''}</p>
            <button style={s.menuItem} onClick={() => { setMenuOpen(false); navigate('/profile'); }}>Profile</button>
            <button style={s.menuItem} onClick={() => { setMenuOpen(false); navigate('/diagnosis-history'); }}>Diagnosis history</button>
            <button style={s.menuItem} onClick={() => { setMenuOpen(false); navigate('/medications'); }}>Medications</button>
            <button style={{ ...s.menuItem, color: color.coral }} onClick={handleLogout}>Sign out</button>
          </div>
        </>
      )}

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
        button:focus-visible { outline: 2px solid ${color.blue}; outline-offset: 2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh', backgroundColor: color.bg,
    fontFamily: font.ui, color: color.ink,
  },
  main: { position: 'relative', maxWidth: 480, margin: '0 auto', padding: '18px 20px 0' },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: color.surfaceMuted, border: 'none', cursor: 'pointer',
  },
  bellDot: { position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: color.blue, border: `1.5px solid ${color.bgElevated}` },

  greetingText: { fontSize: 15, color: color.inkDim, margin: 0, fontFamily: font.ui },
  greetingName: { fontSize: 30, fontWeight: 800, color: color.ink, margin: '2px 0 4px', letterSpacing: -0.5 },
  wave: { display: 'inline-block' },
  greetingSub: { fontSize: 14, color: color.inkFaint, margin: '0 0 20px' },

  heroCard: {
    position: 'relative', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
    borderRadius: radius.xl, padding: '22px 108px 24px 22px', marginBottom: 22, overflow: 'hidden',
    background: `linear-gradient(135deg, ${color.heroFrom}, ${color.heroTo})`,
    boxShadow: theme.shadow.raised, animation: 'fadeUp 0.5s ease both',
  },
  heroGlowA: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.14)' },
  heroGlowB: { position: 'absolute', bottom: -50, right: 40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' },
  heroPill: {
    position: 'relative', display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
    color: '#fff', background: 'rgba(255,255,255,0.22)', borderRadius: radius.pill, padding: '5px 10px', marginBottom: 12,
  },
  heroTitle: { position: 'relative', fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px', lineHeight: 1.2 },
  heroSub: { position: 'relative', fontSize: 12.5, color: 'rgba(255,255,255,0.82)', margin: '0 0 18px', lineHeight: 1.5 },
  heroCta: {
    position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(22,24,38,0.88)', color: '#fff', fontSize: 13, fontWeight: 700,
    borderRadius: radius.pill, padding: '11px 16px',
  },
  heroAvatar: {
    position: 'absolute', right: 8, bottom: 0, top: 0, width: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarBlobA: { position: 'absolute', width: 78, height: 78, borderRadius: '46% 54% 60% 40% / 50% 45% 55% 50%', background: 'rgba(255,255,255,0.20)' },
  avatarBlobB: { position: 'absolute', width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.16)' },

  pendingBanner: {
    display: 'flex', alignItems: 'center', gap: 12, background: color.tealDim,
    border: `1px solid rgba(22,179,120,0.25)`, borderRadius: radius.lg, padding: '14px 16px',
    marginBottom: 18, cursor: 'pointer', animation: 'fadeUp 0.5s ease both',
  },
  pendingDot: { width: 9, height: 9, borderRadius: '50%', background: color.teal, flexShrink: 0 },
  pendingTitle: { fontSize: 13.5, fontWeight: 600, color: color.ink, margin: 0 },
  pendingSub: { fontSize: 12, color: color.inkDim, margin: '2px 0 0' },

  sectionHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: color.ink, margin: 0 },
  seeAll: { background: 'none', border: 'none', color: color.blue, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: font.ui },
  sessionCount: { fontSize: 12, color: color.inkFaint },

  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 },
  vitalTile: {
    background: color.surface, borderRadius: radius.md, padding: '12px 10px',
    boxShadow: theme.shadow.card, animation: 'fadeUp 0.5s ease both',
  },
  vitalIconWrap: { width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  vitalValue: { fontSize: 16, fontWeight: 800, color: color.ink, margin: 0, lineHeight: 1.1 },
  vitalUnit: { fontSize: 10, fontWeight: 600, color: color.inkFaint, marginLeft: 2 },
  vitalLabel: { fontSize: 10.5, color: color.inkFaint, margin: '2px 0 8px' },

  scoreCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: color.surface, borderRadius: radius.lg, padding: '18px 20px', marginBottom: 18,
    boxShadow: theme.shadow.card, animation: 'fadeUp 0.5s ease both',
  },
  scoreLabel: { fontSize: 12.5, color: color.inkFaint, margin: '0 0 4px' },
  scoreValue: { fontSize: 30, fontWeight: 800, color: color.ink, margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 },
  scoreExcellent: { fontSize: 13, fontWeight: 700, color: color.teal },
  scoreSub: { fontSize: 12, color: color.inkFaint, margin: '4px 0 0' },
  scoreRingWrap: { position: 'relative', width: 76, height: 76, flexShrink: 0 },
  scoreRingIcon: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: color.inkFaint, margin: '0 0 12px' },
  medCard: {
    background: color.surface, borderRadius: radius.lg,
    padding: '18px 18px 6px', marginBottom: 18, boxShadow: theme.shadow.card, animation: 'fadeUp 0.5s ease both',
  },
  doseRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 14px' },
  doseRingWrap: { position: 'relative', width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  doseRingLabel: { position: 'absolute', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 14, fontWeight: 600, color: color.ink, margin: 0 },
  doseMeta: { fontSize: 12, color: color.inkFaint, margin: '2px 0 0' },
  doseTime: { fontSize: 13.5, fontWeight: 700, fontFamily: font.mono, flexShrink: 0 },
  courseWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 12px 66px', marginTop: -8 },
  courseTrack: { flex: 1, height: 4, borderRadius: 2, background: color.hairlineStrong, overflow: 'hidden' },
  courseFill: { height: '100%', background: color.blue, borderRadius: 2, transition: 'width 0.6s ease' },
  courseLabel: { fontSize: 11, color: color.inkFaint, flexShrink: 0, fontFamily: font.mono },

  histCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: color.surface, borderRadius: radius.md,
    padding: '13px 14px', marginBottom: 8, cursor: 'pointer', animation: 'fadeUp 0.45s ease both',
    boxShadow: theme.shadow.card,
  },
  histIcon: { width: 36, height: 36, borderRadius: 10, background: 'rgba(139,108,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardTitle: { fontSize: 13.5, fontWeight: 600, color: color.ink, margin: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  activePill: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: color.teal,
    background: color.tealDim, borderRadius: radius.pill, padding: '2px 8px', flexShrink: 0,
  },
  cardDate: { fontSize: 11.5, color: color.inkFaint },

  empty: { textAlign: 'center', padding: '30px 0' },
  skeleton: {
    height: 56, borderRadius: radius.md,
    background: `linear-gradient(90deg, ${color.surfaceMuted} 25%, ${color.surfaceRaised} 50%, ${color.surfaceMuted} 75%)`,
    backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite',
  },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(16,18,32,0.45)', zIndex: 200 },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: color.bgElevated, borderRadius: '24px 24px 0 0', padding: '20px 24px 40px',
    zIndex: 201, animation: 'sheetUp 0.3s ease both', maxWidth: 480, margin: '0 auto',
  },
  sheetPill: { width: 36, height: 4, borderRadius: 2, background: color.hairlineStrong, margin: '0 auto 18px' },
  sheetTitle: { fontSize: 19, fontWeight: 700, color: color.ink, margin: '0 0 8px' },
  sheetSub: { fontSize: 13, color: color.inkDim, margin: '0 0 16px', lineHeight: 1.6 },
  sheetPreview: { background: color.surfaceMuted, borderRadius: radius.sm, padding: '10px 14px', marginBottom: 18 },
  sheetPreviewText: { fontSize: 13, color: color.inkDim, margin: 0, fontStyle: 'italic' },
  sheetBtn: {
    width: '100%', padding: '15px 0', background: color.blue, border: 'none', borderRadius: radius.md,
    color: '#fff', fontSize: 14.5, fontWeight: 700, fontFamily: font.ui, cursor: 'pointer', marginBottom: 8,
  },
  sheetCancel: { width: '100%', padding: '12px 0', background: 'none', border: 'none', color: color.inkFaint, fontSize: 13.5, cursor: 'pointer', fontFamily: font.ui },

  menuSheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: color.bgElevated, borderRadius: '24px 24px 0 0', padding: '20px 24px 40px',
    zIndex: 201, animation: 'sheetUp 0.3s ease both', maxWidth: 480, margin: '0 auto',
  },
  menuName: { fontSize: 18, fontWeight: 700, color: color.ink, margin: '0 0 2px' },
  menuSub: { fontSize: 13, color: color.inkFaint, margin: '0 0 18px' },
  menuItem: {
    display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    borderTop: `1px solid ${color.hairline}`, padding: '14px 2px', fontSize: 14.5, fontWeight: 500,
    color: color.ink, cursor: 'pointer', fontFamily: font.ui,
  },
};
