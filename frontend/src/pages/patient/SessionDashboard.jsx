import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

/* ── Inline SVG icons (16-24px, stroke-based, professional) ── */
const Icon = {
  brain: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  pill: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  ),
  hospital: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M12 7v4" /><path d="M10 9h4" /><path d="M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    </svg>
  ),
  stethoscope: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" />
    </svg>
  ),
  home: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  history: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
    </svg>
  ),
  chevron: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  arrowRight: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  ),
  video: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  ),
  activity: (p) => (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  ),
  logout: (p) => (
    <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

/* ── Med timers hook — same interval logic as before ── */
function useMedTimers(prescriptions) {
  const [timers, setTimers] = useState([]);
  const [alertIdx, setAlertIdx] = useState(null);

  useEffect(() => {
    if (!prescriptions?.length) { setTimers([]); return; }

    const calcTimers = () =>
      prescriptions.map((p) => {
        const timesPerDay = parseInt((p.dosage_notation || '1x1').split('x')[1]) || 1;
        const intervalMs = (24 / timesPerDay) * 60 * 60 * 1000;
        const startMs = p.reminders_start_at ? new Date(p.reminders_start_at).getTime() : Date.now();
        const elapsed = (Date.now() - startMs) % intervalMs;
        const remaining = intervalMs - elapsed;
        return { ...p, remaining, intervalMs };
      });

    setTimers(calcTimers());
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

  return { timers, alertIdx };
}

const fmtCountdown = (ms) => {
  const tot = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(tot / 3600)).padStart(2, '0');
  const m = String(Math.floor((tot % 3600) / 60)).padStart(2, '0');
  const s = String(tot % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

/* ── Next-dose hero with SVG countdown ring ── */
function DoseHero({ timers, alertIdx, onOpenMeds }) {
  if (!timers.length) return null;

  let nextIdx = 0;
  timers.forEach((t, i) => { if (t.remaining < timers[nextIdx].remaining) nextIdx = i; });
  const next = timers[nextIdx];
  const isAlert = alertIdx === nextIdx;
  const progress = 1 - next.remaining / next.intervalMs;
  const R = 52;
  const CIRC = 2 * Math.PI * R;

  return (
    <section className="pd-card pd-dose" style={{ animationDelay: '0.1s' }} aria-label="Next medication dose">
      <div className="pd-dose-ring-wrap" aria-hidden="true">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="64" cy="64" r={R} fill="none"
            stroke={isAlert ? 'var(--red)' : 'var(--green)'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div className="pd-dose-ring-center">
          <span className={`pd-dose-timer ${isAlert ? 'alert' : ''}`}>
            {isAlert ? 'NOW' : fmtCountdown(next.remaining)}
          </span>
          <span className="pd-dose-timer-label">{isAlert ? 'take dose' : 'next dose'}</span>
        </div>
      </div>
      <div className="pd-dose-info">
        <p className="pd-eyebrow">MEDICATION</p>
        <h2 className="pd-dose-name">{next.medication_name}</h2>
        <p className="pd-dose-meta">
          {next.dosage_notation || '—'}
          {next.duration_days ? ` · ${next.duration_days} days` : ''}
        </p>
        {timers.length > 1 && (
          <p className="pd-dose-more">{`+${timers.length - 1} more medication${timers.length > 2 ? 's' : ''}`}</p>
        )}
        <button className="pd-btn-ghost" onClick={onOpenMeds}>
          View schedule <Icon.arrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

/* ── Main Dashboard ── */
export default function SessionDashboard() {
  const navigate = useNavigate();
  const patient = (() => { try { return JSON.parse(localStorage.getItem('civtech_patient') || '{}'); } catch { return {}; } })();
  const [sessions, setSessions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeSheet, setResumeSheet] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const { timers, alertIdx } = useMedTimers(prescriptions);

  const firstName = (patient.name || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const fetchData = useCallback(async () => {
    if (!patient.id) return;
    try {
      const [sessRes, presRes] = await Promise.allSettled([
        axios.get(`${API}/triage/sessions/${patient.id}`),
        axios.get(`${API}/prescriptions/active/${patient.id}`),
      ]);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data || []);
      if (presRes.status === 'fulfilled') setPrescriptions(presRes.value.data || []);
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

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

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

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.started_at) - new Date(a.started_at)),
    [sessions]
  );
  const activeSession = sortedSessions.find((se) => se.status === 'active') || null;
  const lastSession = sortedSessions[0] || null;

  const stats = [
    { label: 'Sessions', value: sessions.length, color: 'var(--accent)', icon: <Icon.activity size={16} /> },
    { label: 'Active meds', value: prescriptions.length, color: 'var(--green)', icon: <Icon.pill size={16} /> },
    { label: 'Last check-in', value: lastSession ? formatDate(lastSession.started_at) : '—', color: 'var(--amber)', icon: <Icon.history size={16} /> },
  ];

  const navItems = [
    { id: 'home', icon: <Icon.home size={20} />, label: 'Home', action: () => setActiveTab('home') },
    { id: 'doctors', icon: <Icon.stethoscope size={20} />, label: 'Doctors', action: () => navigate('/consultation') },
    { id: 'hospitals', icon: <Icon.hospital size={20} />, label: 'Nearby', action: () => navigate('/hospitals') },
    ...(prescriptions.length > 0
      ? [{ id: 'meds', icon: <Icon.pill size={20} />, label: 'Meds', action: () => navigate('/medications') }]
      : []),
    { id: 'historyTab', icon: <Icon.history size={20} />, label: 'History', action: () => navigate('/diagnosis-history') },
  ];

  return (
    <div className="pd-page">
      <div className="pd-orb pd-orb-1" aria-hidden="true" />
      <div className="pd-orb pd-orb-2" aria-hidden="true" />

      {/* ── Sticky glass header ── */}
      <header className="pd-header">
        <div className="pd-brand" aria-hidden="true">C</div>
        <div className="pd-header-mid">
          <p className="pd-greeting-sub">{greeting}</p>
          <p className="pd-greeting-name">{firstName}</p>
        </div>
        <button className="pd-avatar" onClick={handleLogout} aria-label="Log out">
          <span className="pd-avatar-initial">{(patient.name || 'U')[0].toUpperCase()}</span>
          <span className="pd-avatar-logout"><Icon.logout size={14} /></span>
        </button>
      </header>

      <div className="pd-layout">
        <main className="pd-main">

          {/* ── Active consultation (highest priority) ── */}
          {activeSession && (
            <section
              className="pd-card pd-live"
              style={{ animationDelay: '0.05s' }}
              onClick={() => setResumeSheet(activeSession)}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setResumeSheet(activeSession)}
              aria-label="Resume active consultation"
            >
              <div className="pd-live-icon"><Icon.video size={22} /></div>
              <div className="pd-live-body">
                <div className="pd-live-top">
                  <span className="pd-live-dot" aria-hidden="true" />
                  <span className="pd-live-tag">CONSULTATION IN PROGRESS</span>
                </div>
                <p className="pd-live-title">
                  {activeSession.symptoms_summary || activeSession.ai_assessment?.slice(0, 60) || 'Active consultation'}
                </p>
              </div>
              <span className="pd-live-cta">Rejoin <Icon.arrowRight size={14} /></span>
            </section>
          )}

          {/* ── Next dose hero ── */}
          <DoseHero timers={timers} alertIdx={alertIdx} onOpenMeds={() => navigate('/medications')} />

          {/* ── Start AI Triage CTA ── */}
          <section
            className="pd-card pd-triage"
            style={{ animationDelay: '0.15s' }}
            onClick={() => { localStorage.removeItem('civtech_session_id'); navigate('/chat'); }}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && (localStorage.removeItem('civtech_session_id'), navigate('/chat'))}
            aria-label="Start an AI triage session"
          >
            <div className="pd-triage-icon"><Icon.brain size={24} /></div>
            <div className="pd-triage-body">
              <h2 className="pd-triage-title">How are you feeling today?</h2>
              <p className="pd-triage-sub">Describe your symptoms and get guided to the right care.</p>
            </div>
            <span className="pd-triage-arrow"><Icon.arrowRight size={20} /></span>
          </section>

          {/* ── Stats row (mobile: horizontal scroll / desktop: in right rail) ── */}
          <div className="pd-stats pd-stats-inline" role="list" aria-label="Health stats">
            {stats.map((st, i) => (
              <div key={st.label} role="listitem" className="pd-stat" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                <span className="pd-stat-icon" style={{ color: st.color }}>{st.icon}</span>
                <span className="pd-stat-value">{st.value}</span>
                <span className="pd-stat-label">{st.label}</span>
              </div>
            ))}
          </div>

          {/* ── Recent sessions ── */}
          <section className="pd-section" style={{ animationDelay: '0.25s' }}>
            <div className="pd-section-head">
              <h3 className="pd-section-title">Health history</h3>
              <span className="pd-section-count">{sessions.length}</span>
            </div>

            {loading && (
              <div className="pd-skeletons">
                {[1, 2, 3].map((i) => <div key={i} className="pd-skeleton" />)}
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="pd-empty">
                <span className="pd-empty-icon"><Icon.stethoscope size={28} /></span>
                <p className="pd-empty-title">No consultations yet</p>
                <p className="pd-empty-sub">Start your first symptom check above.</p>
              </div>
            )}

            {!loading && sortedSessions.map((session, i) => {
              const isActive = session.status === 'active';
              return (
                <div
                  key={session.id}
                  className="pd-session"
                  style={{ animationDelay: `${0.28 + i * 0.05}s` }}
                  onClick={() => handleCardTap(session)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleCardTap(session)}
                >
                  <span className={`pd-session-dot ${isActive ? 'active' : ''}`} aria-hidden="true" />
                  <div className="pd-session-body">
                    <div className="pd-session-top">
                      <p className="pd-session-title">
                        {session.symptoms_summary || session.ai_assessment?.slice(0, 50) || 'Health Consultation'}
                        {(session.ai_assessment || '').length > 50 ? '…' : ''}
                      </p>
                      {isActive && <span className="pd-session-pill">ACTIVE</span>}
                    </div>
                    <span className="pd-session-date">{formatDate(session.started_at)}</span>
                  </div>
                  <span className="pd-session-chevron"><Icon.chevron size={18} /></span>
                </div>
              );
            })}
          </section>
        </main>

        {/* ── Right rail (desktop only) ── */}
        <aside className="pd-rail">
          <div className="pd-stats pd-stats-rail" role="list" aria-label="Health stats">
            {stats.map((st, i) => (
              <div key={st.label} role="listitem" className="pd-stat" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                <span className="pd-stat-icon" style={{ color: st.color }}>{st.icon}</span>
                <span className="pd-stat-value">{st.value}</span>
                <span className="pd-stat-label">{st.label}</span>
              </div>
            ))}
          </div>

          <div className="pd-quick" style={{ animationDelay: '0.3s' }}>
            <h3 className="pd-section-title">Quick actions</h3>
            <div className="pd-quick-grid">
              {[
                { label: 'See a doctor', icon: <Icon.stethoscope size={20} />, to: '/consultation' },
                { label: 'Hospitals', icon: <Icon.hospital size={20} />, to: '/hospitals' },
                { label: 'Medications', icon: <Icon.pill size={20} />, to: '/medications' },
                { label: 'Diagnosis history', icon: <Icon.history size={20} />, to: '/diagnosis-history' },
              ].map((q) => (
                <button key={q.label} className="pd-quick-tile" onClick={() => { localStorage.removeItem('civtech_session_id'); navigate(q.to); }}>
                  <span className="pd-quick-icon">{q.icon}</span>
                  <span className="pd-quick-label">{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Floating glass bottom nav (mobile) ── */}
      <nav className="pd-nav" aria-label="Primary">
        {navItems.map((tab) => (
          <button
            key={tab.id}
            className={`pd-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={tab.action}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="pd-nav-icon">{tab.icon}</span>
            <span className="pd-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Resume sheet ── */}
      {resumeSheet && (
        <>
          <div className="pd-overlay" onClick={() => setResumeSheet(null)} />
          <div className="pd-sheet" role="dialog" aria-modal="true" aria-label="Resume session">
            <div className="pd-sheet-pill" aria-hidden="true" />
            <p className="pd-eyebrow" style={{ color: 'var(--accent)' }}>CONTINUING SESSION</p>
            <h2 className="pd-sheet-title">
              {resumeSheet.ai_assessment?.slice(0, 55) || 'Active Consultation'}
              {(resumeSheet.ai_assessment || '').length > 55 ? '…' : ''}
            </h2>
            <p className="pd-sheet-sub">The AI has full context and will continue from where you left off.</p>
            {resumeSheet.last_message && (
              <div className="pd-sheet-preview">
                <p className="pd-sheet-preview-label">LAST MESSAGE</p>
                <p className="pd-sheet-preview-text">{`"${resumeSheet.last_message}"`}</p>
              </div>
            )}
            <button className="pd-sheet-btn" onClick={handleResume}>
              Resume conversation <Icon.arrowRight size={16} />
            </button>
            <button className="pd-sheet-cancel" onClick={() => setResumeSheet(null)}>Not now</button>
          </div>
        </>
      )}

      <style>{PD_CSS}</style>
    </div>
  );
}

/* ── Scoped styles — dark premium fitness-app system ── */
const PD_CSS = `
  .pd-page {
    min-height: 100vh;
    background: var(--bg, #080810);
    color: var(--text, #f0f0ff);
    font-family: 'Outfit', -apple-system, sans-serif;
    position: relative;
    overflow-x: hidden;
    padding-bottom: 104px;
  }

  .pd-orb {
    position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
    filter: blur(70px);
  }
  .pd-orb-1 {
    top: -140px; left: 10%; width: 380px; height: 380px;
    background: radial-gradient(circle, rgba(79,70,229,0.35) 0%, transparent 70%);
    animation: pdOrb 9s ease-in-out infinite;
  }
  .pd-orb-2 {
    top: 30%; right: -120px; width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(6,214,160,0.18) 0%, transparent 70%);
    animation: pdOrb 12s ease-in-out 3s infinite;
  }
  @keyframes pdOrb {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.1); opacity: 0.9; }
  }

  /* ── Header ── */
  .pd-header {
    position: sticky; top: 0; z-index: 90;
    display: flex; align-items: center; gap: 12px;
    padding: 18px 20px 14px;
    background: rgba(8,8,16,0.68);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .pd-header { background: rgba(8,8,16,0.94); }
  }
  .pd-brand {
    width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, #4f46e5, #6382ff);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px; color: #fff;
    box-shadow: 0 4px 20px rgba(79,70,229,0.45);
  }
  .pd-header-mid { flex: 1; min-width: 0; }
  .pd-greeting-sub { font-size: 11px; color: rgba(255,255,255,0.45); margin: 0; letter-spacing: 0.4px; }
  .pd-greeting-name { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .pd-avatar {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #4f46e5, #06d6a0);
    border: none; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    transition: transform 0.2s var(--ease, ease);
  }
  .pd-avatar:active { transform: scale(0.92); }
  .pd-avatar-logout {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(255,77,109,0.9); opacity: 0; transition: opacity 0.2s;
  }
  .pd-avatar:hover .pd-avatar-logout, .pd-avatar:focus-visible .pd-avatar-logout { opacity: 1; }

  /* ── Layout ── */
  .pd-layout {
    position: relative; z-index: 1;
    max-width: 1080px; margin: 0 auto;
    display: flex; flex-direction: column;
    padding: 16px 20px 0;
    gap: 0;
  }
  .pd-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .pd-rail { display: none; }

  /* ── Cards ── */
  .pd-card {
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 22px;
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
  }

  /* ── Active consultation ── */
  .pd-live {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 18px; cursor: pointer;
    border-color: rgba(6,214,160,0.3);
    background: linear-gradient(135deg, rgba(6,214,160,0.12), rgba(255,255,255,0.03));
  }
  .pd-live:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(6,214,160,0.15); }
  .pd-live-icon {
    width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
    background: rgba(6,214,160,0.15); color: #06d6a0;
    display: flex; align-items: center; justify-content: center;
  }
  .pd-live-body { flex: 1; min-width: 0; }
  .pd-live-top { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
  .pd-live-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #06d6a0;
    box-shadow: 0 0 10px #06d6a0; animation: softPulse 1.8s infinite;
  }
  .pd-live-tag { font-size: 9px; font-weight: 700; letter-spacing: 1.8px; color: #06d6a0; }
  .pd-live-title {
    font-size: 14px; font-weight: 600; margin: 0;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .pd-live-cta {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-size: 12px; font-weight: 700; color: #06d6a0;
  }

  /* ── Dose hero ── */
  .pd-dose { display: flex; align-items: center; gap: 18px; padding: 20px; }
  .pd-dose-ring-wrap { position: relative; flex-shrink: 0; width: 128px; height: 128px; }
  .pd-dose-ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  }
  .pd-dose-timer {
    font-family: 'DM Mono', monospace; font-size: 17px; font-weight: 500; letter-spacing: 0.5px;
    color: var(--green, #06d6a0); font-variant-numeric: tabular-nums;
  }
  .pd-dose-timer.alert { color: var(--red, #ff4d6d); animation: softPulse 0.8s infinite; }
  .pd-dose-timer-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.35); }
  .pd-dose-info { flex: 1; min-width: 0; }
  .pd-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 2.5px; color: rgba(255,255,255,0.35); margin: 0 0 6px; }
  .pd-dose-name { font-size: 19px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.2px; }
  .pd-dose-meta { font-size: 12px; color: rgba(255,255,255,0.45); margin: 0; }
  .pd-dose-more { font-size: 11px; color: rgba(255,255,255,0.3); margin: 6px 0 0; }
  .pd-btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 12px; padding: 8px 14px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; color: rgba(255,255,255,0.85);
    font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }
  .pd-btn-ghost:hover { background: rgba(255,255,255,0.1); }
  .pd-btn-ghost:active { transform: scale(0.96); }

  /* ── Triage CTA ── */
  .pd-triage {
    display: flex; align-items: center; gap: 16px;
    padding: 20px; cursor: pointer; border: none;
    background: linear-gradient(135deg, #4f46e5 0%, #6382ff 100%);
    box-shadow: 0 10px 36px rgba(79,70,229,0.4);
  }
  .pd-triage:hover { transform: translateY(-2px); box-shadow: 0 14px 44px rgba(79,70,229,0.5); }
  .pd-triage:active { transform: scale(0.985); }
  .pd-triage-icon {
    width: 48px; height: 48px; border-radius: 15px; flex-shrink: 0;
    background: rgba(255,255,255,0.16); color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .pd-triage-body { flex: 1; min-width: 0; }
  .pd-triage-title { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 3px; letter-spacing: -0.2px; }
  .pd-triage-sub { font-size: 12px; color: rgba(255,255,255,0.75); margin: 0; line-height: 1.5; }
  .pd-triage-arrow { color: #fff; flex-shrink: 0; transition: transform 0.25s; }
  .pd-triage:hover .pd-triage-arrow { transform: translateX(4px); }

  /* ── Stats ── */
  .pd-stats { display: flex; gap: 10px; }
  .pd-stats-inline { overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .pd-stats-inline::-webkit-scrollbar { display: none; }
  .pd-stat {
    flex: 1; min-width: 104px;
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px; padding: 14px 16px;
    animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: border-color 0.25s, transform 0.25s;
  }
  .pd-stat:hover { border-color: rgba(255,255,255,0.16); transform: translateY(-2px); }
  .pd-stat-icon { display: flex; }
  .pd-stat-value {
    font-size: 22px; font-weight: 800; letter-spacing: -0.4px;
    font-variant-numeric: tabular-nums;
  }
  .pd-stat-label { font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.4); }

  /* ── Sections & sessions ── */
  .pd-section { animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .pd-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .pd-section-title { font-size: 14px; font-weight: 700; margin: 0; letter-spacing: -0.1px; }
  .pd-section-count {
    font-size: 11px; color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.07); border-radius: 20px; padding: 2px 10px;
    font-variant-numeric: tabular-nums;
  }
  .pd-session {
    display: flex; align-items: center; gap: 13px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px; padding: 14px;
    margin-bottom: 10px; cursor: pointer;
    animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: border-color 0.2s, transform 0.2s, background 0.2s;
  }
  .pd-session:hover { border-color: rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); transform: translateY(-1px); }
  .pd-session:active { transform: scale(0.99); }
  .pd-session-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.22); flex-shrink: 0; }
  .pd-session-dot.active { background: #06d6a0; box-shadow: 0 0 8px #06d6a0; }
  .pd-session-body { flex: 1; min-width: 0; }
  .pd-session-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .pd-session-title {
    font-size: 14px; font-weight: 600; margin: 0; flex: 1;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .pd-session-pill {
    font-size: 9px; font-weight: 700; letter-spacing: 1.5px; flex-shrink: 0;
    color: #06d6a0; background: rgba(6,214,160,0.14);
    border: 1px solid rgba(6,214,160,0.3); border-radius: 20px; padding: 2px 8px;
  }
  .pd-session-date { font-size: 11px; color: rgba(255,255,255,0.35); }
  .pd-session-chevron { color: rgba(255,255,255,0.25); flex-shrink: 0; display: flex; }

  .pd-skeletons { display: flex; flex-direction: column; gap: 10px; }
  .pd-skeleton {
    height: 66px; border-radius: 18px;
    background: linear-gradient(90deg, #111118 25%, #1a1a28 50%, #111118 75%);
    background-size: 400px 100%; animation: pdShimmer 1.6s infinite;
  }
  @keyframes pdShimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }

  .pd-empty { text-align: center; padding: 48px 0; }
  .pd-empty-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 56px; height: 56px; border-radius: 18px; margin-bottom: 12px;
    background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);
  }
  .pd-empty-title { color: rgba(255,255,255,0.65); font-size: 14px; font-weight: 600; margin: 0 0 4px; }
  .pd-empty-sub { color: rgba(255,255,255,0.3); font-size: 12px; margin: 0; }

  /* ── Quick actions (rail) ── */
  .pd-quick { animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .pd-quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .pd-quick-tile {
    display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
    background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 16px 14px; cursor: pointer;
    color: inherit; font-family: inherit; text-align: left;
    transition: border-color 0.2s, transform 0.2s, background 0.2s;
  }
  .pd-quick-tile:hover { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.07); transform: translateY(-2px); }
  .pd-quick-tile:active { transform: scale(0.97); }
  .pd-quick-icon {
    width: 36px; height: 36px; border-radius: 11px;
    background: rgba(79,70,229,0.16); color: #a5b4fc;
    display: flex; align-items: center; justify-content: center;
  }
  .pd-quick-label { font-size: 12px; font-weight: 600; }

  /* ── Bottom nav ── */
  .pd-nav {
    position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
    width: calc(100% - 28px); max-width: 440px;
    display: flex; justify-content: space-around; align-items: center;
    padding: 8px 6px;
    background: rgba(12,12,24,0.72);
    backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55);
    z-index: 100;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .pd-nav { background: rgba(12,12,24,0.96); }
  }
  .pd-nav-btn {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: none; border: none; cursor: pointer;
    padding: 7px 12px; border-radius: 16px; position: relative;
    color: rgba(255,255,255,0.4); font-family: inherit;
    transition: color 0.2s, background 0.2s, transform 0.15s;
  }
  .pd-nav-btn:active { transform: scale(0.92); }
  .pd-nav-btn.active { color: #a5b4fc; background: rgba(79,70,229,0.16); }
  .pd-nav-icon { display: flex; }
  .pd-nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.3px; }

  /* ── Overlay & sheet ── */
  .pd-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    animation: pdFadeIn 0.25s ease both;
  }
  @keyframes pdFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .pd-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    max-width: 560px; margin: 0 auto;
    background: rgba(14,14,26,0.92);
    backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255,255,255,0.1); border-bottom: none;
    border-radius: 28px 28px 0 0; padding: 20px 24px 42px;
    animation: pdSheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .pd-sheet { background: rgba(14,14,26,0.98); }
  }
  @keyframes pdSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .pd-sheet-pill { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.16); margin: 0 auto 20px; }
  .pd-sheet-title { font-size: 21px; font-weight: 800; margin: 0 0 10px; line-height: 1.3; letter-spacing: -0.3px; }
  .pd-sheet-sub { font-size: 13px; color: rgba(255,255,255,0.45); margin: 0 0 18px; line-height: 1.6; }
  .pd-sheet-preview {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 12px 14px; margin-bottom: 18px;
  }
  .pd-sheet-preview-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.3); margin: 0 0 6px; }
  .pd-sheet-preview-text { font-size: 13px; color: rgba(255,255,255,0.6); margin: 0; font-style: italic; line-height: 1.5; }
  .pd-sheet-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 15px 0;
    background: linear-gradient(135deg, #4f46e5, #6382ff);
    border: none; border-radius: 16px; color: #fff;
    font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
    margin-bottom: 10px;
    box-shadow: 0 8px 28px rgba(79,70,229,0.4);
    transition: transform 0.15s, box-shadow 0.2s;
  }
  .pd-sheet-btn:hover { box-shadow: 0 10px 36px rgba(79,70,229,0.55); }
  .pd-sheet-btn:active { transform: scale(0.98); }
  .pd-sheet-cancel {
    width: 100%; padding: 13px 0;
    background: none; border: none;
    color: rgba(255,255,255,0.4); font-size: 13px; font-weight: 500;
    font-family: inherit; cursor: pointer;
  }

  /* ── Desktop layout ── */
  @media (min-width: 900px) {
    .pd-page { padding-bottom: 40px; }
    .pd-layout {
      flex-direction: row; gap: 24px;
      padding: 28px 32px 0; align-items: flex-start;
    }
    .pd-main { flex: 1; gap: 16px; }
    .pd-rail {
      display: flex; flex-direction: column; gap: 20px;
      width: 300px; flex-shrink: 0;
      position: sticky; top: 92px;
    }
    .pd-stats-inline { display: none; }
    .pd-stats-rail { flex-direction: column; }
    .pd-stats-rail .pd-stat { flex-direction: row; align-items: center; gap: 12px; min-width: 0; }
    .pd-stats-rail .pd-stat-value { margin-left: auto; font-size: 20px; }
    .pd-nav { display: none; }
    .pd-header { padding: 18px 32px 14px; }
    .pd-dose-name { font-size: 22px; }
    .pd-triage-title { font-size: 18px; }
    .pd-sheet { border-radius: 24px; bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  }
`;
