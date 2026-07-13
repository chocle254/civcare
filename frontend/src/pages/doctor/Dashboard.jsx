import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { updateDoctorStatus, redirectPatients, pingDoctor, updateSettings } from "../../api/doctors";
import { callPatient } from "../../api/triage";
import useWebSocket from "../../hooks/useWebSocket";
import client from "../../api/client";

/* ── Risk / status configs (token-based, light theme) ── */
const RISK = {
  critical: { color: "#dc2626", bg: "rgba(220,38,38,0.09)", label: "Critical" },
  moderate: { color: "#d97706", bg: "rgba(217,119,6,0.1)", label: "Moderate" },
  low: { color: "#059669", bg: "rgba(5,150,105,0.1)", label: "Low" },
};

const STATUS_CFG = {
  available: { color: "#059669", bg: "rgba(5,150,105,0.1)", label: "Available" },
  on_break: { color: "#d97706", bg: "rgba(217,119,6,0.1)", label: "On Break" },
  offline: { color: "#dc2626", bg: "rgba(220,38,38,0.09)", label: "Offline" },
  with_patient: { color: "#2563eb", bg: "rgba(37,99,235,0.09)", label: "With Patient" },
};

function timeSince(date) {
  const m = Math.floor((Date.now() - new Date(date)) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`;
}

/* ── Inline SVG icons ── */
const Ic = {
  grid: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  users: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  video: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  settings: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  logout: (p) => (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  phone: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  check: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  eye: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  arrowRight: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  ),
  x: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
  plus: (p) => (
    <svg width={p.size || 14} height={p.size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  ),
};

/* ── Donut chart — risk distribution (inline SVG, animated) ── */
function RiskDonut({ queue }) {
  const counts = {
    critical: queue.filter((a) => a.risk_score === "critical").length,
    moderate: queue.filter((a) => a.risk_score === "moderate").length,
    low: queue.filter((a) => a.risk_score === "low").length,
  };
  const total = counts.critical + counts.moderate + counts.low;
  const R = 52;
  const CIRC = 2 * Math.PI * R;

  let offset = 0;
  const segments = total > 0
    ? ["critical", "moderate", "low"].map((k) => {
        const frac = counts[k] / total;
        const seg = { key: k, color: RISK[k].color, dash: frac * CIRC, offset };
        offset += frac * CIRC;
        return seg;
      })
    : [];

  return (
    <div className="dd-panel dd-donut-card">
      <div className="dd-panel-head">
        <h3 className="dd-panel-title">Risk distribution</h3>
        <span className="dd-panel-sub">today&apos;s queue</span>
      </div>
      <div className="dd-donut-body">
        <div className="dd-donut-wrap">
          <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Risk distribution: ${counts.critical} critical, ${counts.moderate} moderate, ${counts.low} low`}>
            <circle cx="66" cy="66" r={R} fill="none" stroke="#eef1f7" strokeWidth="14" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx="66" cy="66" r={R} fill="none"
                stroke={s.color} strokeWidth="14"
                strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 66 66)"
                style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1), stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
              />
            ))}
          </svg>
          <div className="dd-donut-center">
            <span className="dd-donut-total">{total}</span>
            <span className="dd-donut-total-label">in queue</span>
          </div>
        </div>
        <div className="dd-donut-legend">
          {["critical", "moderate", "low"].map((k) => (
            <div key={k} className="dd-legend-row">
              <span className="dd-legend-dot" style={{ background: RISK[k].color }} />
              <span className="dd-legend-label">{RISK[k].label}</span>
              <span className="dd-legend-value">{counts[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Bar chart — queue arrivals by hour (last 6 hours) ── */
function ArrivalsBars({ queue }) {
  const buckets = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 5; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 3600000);
      const label = h.toLocaleTimeString("en-KE", { hour: "numeric" });
      const count = queue.filter((a) => {
        if (!a.arrived_at) return false;
        const diff = now - new Date(a.arrived_at);
        return diff >= i * 3600000 && diff < (i + 1) * 3600000;
      }).length;
      list.push({ label, count });
    }
    return list;
  }, [queue]);

  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="dd-panel">
      <div className="dd-panel-head">
        <h3 className="dd-panel-title">Arrivals</h3>
        <span className="dd-panel-sub">last 6 hours</span>
      </div>
      <div className="dd-bars">
        {buckets.map((b, i) => (
          <div key={i} className="dd-bar-col">
            <span className="dd-bar-count">{b.count > 0 ? b.count : ""}</span>
            <div
              className="dd-bar"
              style={{
                height: `${Math.max(6, (b.count / max) * 72)}px`,
                background: b.count > 0 ? "#2563eb" : "#e6eaf2",
                animationDelay: `${i * 0.06}s`,
              }}
            />
            <span className="dd-bar-label">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem("civtech_doctor") || "{}");

  const [view, setView] = useState("queue");
  const [settingsForm, setSettingsForm] = useState({
    shift_start: doctor.shift_start || "",
    shift_end: doctor.shift_end || "",
    breaks: doctor.breaks ? JSON.parse(doctor.breaks) : [],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState(doctor.status || "available");
  const [calling, setCalling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consults, setConsults] = useState([]);
  const [consultsLoading, setConsultsLoading] = useState(false);

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentTotalM = currentH * 60 + currentM;

      let nextEventM = Infinity;
      let nextEventText = "";

      const breaksList = doctor.breaks ? JSON.parse(doctor.breaks) : [];
      let onBreakUntil = null;

      for (const b of breaksList) {
        if (!b.start || !b.duration_minutes) continue;
        const [bh, bm] = b.start.split(":").map(Number);
        const breakStartM = bh * 60 + bm;
        const breakEndM = breakStartM + parseInt(b.duration_minutes);

        if (currentTotalM >= breakStartM && currentTotalM < breakEndM) {
          onBreakUntil = breakEndM;
          break;
        }

        if (breakStartM > currentTotalM && breakStartM < nextEventM) {
          nextEventM = breakStartM;
          nextEventText = "Break";
        }
      }

      if (status === "on_break") {
        if (onBreakUntil) {
          const diff = onBreakUntil - currentTotalM;
          setCountdown(`${diff} min${diff !== 1 ? 's' : ''} left on break`);
        } else {
          setCountdown("On break");
        }
        return;
      }

      if (status === "offline") {
        setCountdown("Currently offline");
        return;
      }

      if (doctor.shift_end) {
        const [sh, sm] = doctor.shift_end.split(":").map(Number);
        const shiftEndM = sh * 60 + sm;
        if (currentTotalM >= shiftEndM) {
          setCountdown("Shift ended");
          return;
        } else if (shiftEndM < nextEventM) {
          nextEventM = shiftEndM;
          nextEventText = "Shift end";
        }
      }

      if (nextEventM !== Infinity) {
        const diffM = nextEventM - currentTotalM;
        const h = Math.floor(diffM / 60);
        const m = diffM % 60;
        let str = "";
        if (h > 0) str += `${h}h `;
        str += `${m}m until ${nextEventText}`;
        setCountdown(str);
      } else {
        setCountdown("Available");
      }
    };

    calcCountdown();
    const t = setInterval(calcCountdown, 60000);
    return () => clearInterval(t);
  }, [status, doctor.shift_end, doctor.breaks]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        doctor_id: doctor.id,
        shift_start: settingsForm.shift_start,
        shift_end: settingsForm.shift_end,
        breaks: JSON.stringify(settingsForm.breaks)
      });
      const newDoc = { ...doctor, ...settingsForm, breaks: JSON.stringify(settingsForm.breaks) };
      localStorage.setItem("civtech_doctor", JSON.stringify(newDoc));
      alert("Settings saved successfully.");
      window.location.reload();
    } catch {
      alert("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Load queue ──
  const loadQueue = useCallback(async () => {
    try {
      const res = await client.get(
        `/triage/queue?hospital_id=${doctor.hospital_id}&doctor_id=${doctor.id}`
      );
      setQueue(res.data);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [doctor.hospital_id, doctor.id]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const loadConsults = useCallback(async () => {
    setConsultsLoading(true);
    try {
      const res = await client.get(`/consultation/pending?doctor_id=${doctor.id}`);
      setConsults(res.data);
    } catch {
      setConsults([]);
    } finally {
      setConsultsLoading(false);
    }
  }, [doctor.id]);

  useEffect(() => {
    if (view === "consults") loadConsults();
  }, [view, loadConsults]);

  // ── WebSocket ──
  useWebSocket(doctor.hospital_id, (data) => {
    if (data.type === "refresh_queue") {
      loadQueue();
      if (view === "consults") loadConsults();
    }
  });

  // ── Ping ──
  useEffect(() => {
    const t = setInterval(() => pingDoctor(doctor.id).catch(() => { }), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [doctor.id]);

  // ── Status change ──
  const handleStatusChange = async (newStatus) => {
    try {
      await updateDoctorStatus({ doctor_id: doctor.id, status: newStatus });
      setStatus(newStatus);
      localStorage.setItem("civtech_doctor", JSON.stringify({ ...doctor, status: newStatus }));
      if (newStatus === "on_break" || newStatus === "offline") {
        await redirectPatients({
          doctor_id: doctor.id,
          hospital_id: doctor.hospital_id,
          reason: newStatus === "on_break" ? "break" : "shift_end",
        });
        await loadQueue();
      }
    } catch {
      alert("Could not update status. Please try again.");
    }
  };

  // ── Call patient ──
  const handleCall = async (appt) => {
    setCalling(appt.id);
    try {
      await callPatient({ appointment_id: appt.id, doctor_id: doctor.id });
      await loadQueue();
    } catch {
      alert("Could not notify patient. Please try again.");
    } finally {
      setCalling(null);
    }
  };

  const sortedQueue = [...queue].sort((a, b) => {
    const ord = { critical: 0, moderate: 1, low: 2 };
    return (ord[a.risk_score] ?? 3) - (ord[b.risk_score] ?? 3);
  });

  const critical = queue.filter((a) => a.risk_score === "critical").length;
  const moderate = queue.filter((a) => a.risk_score === "moderate").length;
  const called = queue.filter((a) => a.status === "called").length;
  const sCfg = STATUS_CFG[status] || STATUS_CFG.available;
  const doctorName = doctor.full_name || doctor.name || "Doctor";
  const initials = doctorName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const firstName = doctorName.split(" ")[0];

  const patientInitials = (name) =>
    (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const navItems = [
    { id: "queue", label: "Patient Queue", icon: <Ic.users size={19} />, badge: queue.length },
    { id: "consults", label: "Consultations", icon: <Ic.video size={19} /> },
    { id: "settings", label: "Settings", icon: <Ic.settings size={19} /> },
  ];

  return (
    <div className="theme-light dd-root">
      <style>{DD_CSS}</style>

      {/* ════ Slim icon sidebar (desktop) / bottom nav (mobile) ════ */}
      <aside className="dd-sidebar" aria-label="Navigation">
        <div className="dd-sidebar-logo" aria-hidden="true">C</div>
        <nav className="dd-sidebar-nav">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={`dd-side-btn ${view === n.id ? "active" : ""}`}
              onClick={() => setView(n.id)}
              title={n.label}
              aria-label={n.label}
              aria-current={view === n.id ? "page" : undefined}
            >
              {n.icon}
              {n.badge > 0 && <span className="dd-side-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <button
          className="dd-side-btn dd-side-logout"
          onClick={() => { localStorage.clear(); navigate("/doctor"); }}
          title="Logout" aria-label="Logout"
        >
          <Ic.logout size={19} />
        </button>
      </aside>

      {/* ════ Main ════ */}
      <div className="dd-main">

        {/* Header */}
        <header className="dd-header">
          <div className="dd-header-left">
            <h1 className="dd-hello">Hello, Dr. {firstName}</h1>
            <p className="dd-hello-sub">
              {doctor.hospital_name || "Hospital"} · {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
          <div className="dd-header-right">
            <div className="dd-status-group" role="group" aria-label="Set availability status">
              {[
                { id: "available", label: "Available" },
                { id: "on_break", label: "Break" },
                { id: "offline", label: "Offline" },
              ].map((s) => {
                const cfg = STATUS_CFG[s.id];
                const active = status === s.id;
                return (
                  <button
                    key={s.id}
                    className={`dd-status-btn ${active ? "active" : ""}`}
                    onClick={() => handleStatusChange(s.id)}
                    style={active ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
                    aria-pressed={active}
                  >
                    <span className="dd-status-dot" style={{ background: cfg.color, opacity: active ? 1 : 0.3 }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="dd-avatar" title={`Dr. ${doctorName} — ${doctor.specialisation || "General Practitioner"}`}>
              {initials}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="dd-content">

          {/* ── Blue insights hero ── */}
          <section className="dd-hero" aria-label="Daily insights">
            <div className="dd-hero-glass" aria-hidden="true" />
            <div className="dd-hero-top">
              <div>
                <h2 className="dd-hero-title">Insights and summary</h2>
                <p className="dd-hero-sub">{countdown || "Your live workload overview"}</p>
              </div>
              <span className="dd-hero-chip">
                <span className="dd-hero-chip-dot" style={{ background: sCfg.color === "#dc2626" ? "#fca5a5" : "#86efac" }} />
                {sCfg.label}
              </span>
            </div>
            <div className="dd-hero-stats">
              {[
                { label: "In queue", value: queue.length },
                { label: "Critical", value: critical },
                { label: "Moderate", value: moderate },
                { label: "Called", value: called },
              ].map((st) => (
                <div key={st.label} className="dd-hero-stat">
                  <span className="dd-hero-stat-value">{st.value}</span>
                  <span className="dd-hero-stat-label">{st.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Queue view ── */}
          {view === "queue" && (
            <div className="dd-grid">
              {/* Left: queue list */}
              <div className="dd-panel dd-queue-panel">
                <div className="dd-panel-head">
                  <div className="dd-panel-title-wrap">
                    <span className="dd-live-dot" aria-hidden="true" />
                    <h3 className="dd-panel-title">Patient queue</h3>
                  </div>
                  <span className="dd-panel-sub">sorted by risk · {queue.length} patient{queue.length !== 1 ? "s" : ""}</span>
                </div>

                {loading ? (
                  <div className="dd-empty">Loading queue…</div>
                ) : queue.length === 0 ? (
                  <div className="dd-empty">
                    <p className="dd-empty-title">Queue is clear</p>
                    <p className="dd-empty-sub">No patients waiting right now.</p>
                  </div>
                ) : (
                  <div className="dd-rows" role="list">
                    {sortedQueue.map((appt, idx) => {
                      const r = RISK[appt.risk_score] || RISK.moderate;
                      const isCalling = calling === appt.id;
                      const wasCalled = appt.status === "called";
                      return (
                        <div
                          key={appt.id}
                          role="listitem"
                          className="dd-row"
                          style={{ animationDelay: `${idx * 0.04}s` }}
                          onClick={() => navigate(`/doctor/patient/${appt.id}`)}
                        >
                          <div className="dd-row-avatar" style={{ background: r.bg, color: r.color }}>
                            {patientInitials(appt.patient_name)}
                          </div>
                          <div className="dd-row-who">
                            <span className="dd-row-name">{appt.patient_name}</span>
                            <span className="dd-row-sub">{appt.symptoms_summary || appt.ai_assessment?.slice(0, 70) || appt.patient_phone || "—"}</span>
                          </div>
                          <span className="dd-badge" style={{ background: r.bg, color: r.color }}>
                            <span className="dd-badge-dot" style={{ background: r.color }} />
                            {r.label}
                          </span>
                          <span className="dd-row-time">{appt.arrived_at ? timeSince(appt.arrived_at) : "Pending"}</span>
                          <div className="dd-row-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`dd-action ${wasCalled ? "done" : "primary"}`}
                              disabled={isCalling || wasCalled}
                              onClick={() => handleCall(appt)}
                            >
                              {isCalling ? "…" : wasCalled ? <><Ic.check size={13} /> Called</> : <><Ic.phone size={13} /> Call</>}
                            </button>
                            <button className="dd-action" onClick={() => navigate(`/doctor/patient/${appt.id}`)} aria-label={`View ${appt.patient_name}`}>
                              <Ic.eye size={13} /> View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: charts */}
              <div className="dd-side-col">
                <RiskDonut queue={queue} />
                <ArrivalsBars queue={queue} />
              </div>
            </div>
          )}

          {/* ── Consultations view ── */}
          {view === "consults" && (
            <div className="dd-consults">
              <div className="dd-panel-head dd-consults-head">
                <div className="dd-panel-title-wrap">
                  <span className="dd-live-dot" aria-hidden="true" />
                  <h3 className="dd-panel-title">Pending consultations</h3>
                </div>
                <span className="dd-panel-sub">{consults.length} waiting</span>
              </div>

              {consultsLoading && <div className="dd-panel dd-empty">Loading consultations…</div>}

              {!consultsLoading && consults.length === 0 && (
                <div className="dd-panel dd-empty">
                  <p className="dd-empty-title">No pending consultations</p>
                  <p className="dd-empty-sub">Patients who book online will appear here.</p>
                </div>
              )}

              {!consultsLoading && consults.map((c, i) => (
                <div key={c.id} className="dd-panel dd-consult" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="dd-row-avatar dd-consult-avatar">{patientInitials(c.patient_name)}</div>
                  <div className="dd-consult-body">
                    <span className="dd-row-name">{c.patient_name}</span>
                    <span className="dd-consult-phone">{c.patient_phone}</span>
                    <span className="dd-row-sub">{c.symptoms_summary}</span>
                  </div>
                  <div className="dd-consult-right">
                    <span className="dd-consult-fee">KES {c.fee_amount?.toLocaleString()}</span>
                    <span className="dd-consult-time">{c.started ? timeSince(c.started) : "—"}</span>
                    <div className="dd-row-actions">
                      <a href={`tel:${c.patient_phone}`} style={{ textDecoration: "none" }}>
                        <button className="dd-action"><Ic.phone size={13} /> Call</button>
                      </a>
                      <button className="dd-action primary" onClick={() => navigate(`/doctor/consult/${c.id}`)}>
                        Open <Ic.arrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings view ── */}
          {view === "settings" && (
            <div className="dd-panel dd-settings">
              <h3 className="dd-settings-title">Shift &amp; breaks configuration</h3>

              <div className="dd-settings-grid">
                <div>
                  <label className="dd-label" htmlFor="shift-start">Shift start</label>
                  <input id="shift-start" className="dd-input" type="time" value={settingsForm.shift_start}
                    onChange={e => setSettingsForm({ ...settingsForm, shift_start: e.target.value })} />
                </div>
                <div>
                  <label className="dd-label" htmlFor="shift-end">Shift end</label>
                  <input id="shift-end" className="dd-input" type="time" value={settingsForm.shift_end}
                    onChange={e => setSettingsForm({ ...settingsForm, shift_end: e.target.value })} />
                </div>
              </div>

              <h4 className="dd-settings-subtitle">Breaks</h4>
              {settingsForm.breaks.map((b, idx) => (
                <div key={idx} className="dd-break-row">
                  <input className="dd-input" type="text" placeholder="e.g. Lunch" value={b.title} onChange={e => {
                    const newB = [...settingsForm.breaks];
                    newB[idx].title = e.target.value;
                    setSettingsForm({ ...settingsForm, breaks: newB });
                  }} style={{ flex: 1 }} />
                  <input className="dd-input" type="time" value={b.start} onChange={e => {
                    const newB = [...settingsForm.breaks];
                    newB[idx].start = e.target.value;
                    setSettingsForm({ ...settingsForm, breaks: newB });
                  }} style={{ width: 120 }} />
                  <div className="dd-break-mins">
                    <input className="dd-input" type="number" placeholder="Mins" value={b.duration_minutes} onChange={e => {
                      const newB = [...settingsForm.breaks];
                      newB[idx].duration_minutes = e.target.value;
                      setSettingsForm({ ...settingsForm, breaks: newB });
                    }} style={{ width: 74 }} />
                    <span className="dd-break-mins-label">mins</span>
                  </div>
                  <button className="dd-break-remove" aria-label="Remove break" onClick={() => {
                    const newB = settingsForm.breaks.filter((_, i) => i !== idx);
                    setSettingsForm({ ...settingsForm, breaks: newB });
                  }}><Ic.x size={15} /></button>
                </div>
              ))}

              <button className="dd-add-break"
                onClick={() => setSettingsForm({ ...settingsForm, breaks: [...settingsForm.breaks, { title: "", start: "", duration_minutes: "" }] })}>
                <Ic.plus size={14} /> Add break
              </button>

              <div className="dd-settings-footer">
                <button className="dd-save" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Scoped styles — light clinical admin system ── */
const DD_CSS = `
  .dd-root {
    display: flex; min-height: 100vh;
    background: var(--bg); color: var(--text);
    font-family: 'Outfit', -apple-system, sans-serif;
  }

  /* ── Sidebar ── */
  .dd-sidebar {
    width: 72px; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center;
    padding: 20px 0 18px; gap: 8px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    position: sticky; top: 0; height: 100vh; z-index: 50;
  }
  .dd-sidebar-logo {
    width: 40px; height: 40px; border-radius: 13px; margin-bottom: 18px;
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 19px;
    box-shadow: 0 6px 20px rgba(37,99,235,0.3);
  }
  .dd-sidebar-nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .dd-side-btn {
    width: 44px; height: 44px; border-radius: 13px; position: relative;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted);
    transition: background 0.2s, color 0.2s, transform 0.15s;
  }
  .dd-side-btn:hover { background: var(--accent-bg); color: var(--accent); }
  .dd-side-btn:active { transform: scale(0.92); }
  .dd-side-btn.active { background: var(--accent-bg); color: var(--accent); }
  .dd-side-btn.active::before {
    content: ''; position: absolute; left: -14px; top: 50%; transform: translateY(-50%);
    width: 3px; height: 22px; border-radius: 2px; background: var(--accent);
  }
  .dd-side-badge {
    position: absolute; top: 4px; right: 4px;
    min-width: 16px; height: 16px; border-radius: 8px; padding: 0 4px;
    background: #dc2626; color: #fff;
    font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .dd-side-logout:hover { background: var(--red-bg); color: var(--red); }

  /* ── Main ── */
  .dd-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .dd-header {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 18px 28px;
    position: sticky; top: 0; z-index: 40;
    background: var(--surface-glass);
    backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--border);
  }
  @supports not (backdrop-filter: blur(1px)) {
    .dd-header { background: var(--surface); }
  }
  .dd-hello { font-size: 21px; font-weight: 800; margin: 0; letter-spacing: -0.4px; }
  .dd-hello-sub { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
  .dd-header-right { display: flex; align-items: center; gap: 14px; }
  .dd-status-group { display: flex; gap: 6px; }
  .dd-status-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 20px;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text-muted); font-size: 12px; font-weight: 600;
    font-family: inherit; cursor: pointer;
    transition: all 0.2s;
  }
  .dd-status-btn:hover { border-color: var(--border-hi); }
  .dd-status-btn:active { transform: scale(0.96); }
  .dd-status-dot { width: 7px; height: 7px; border-radius: 50%; }
  .dd-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 13px; font-weight: 700;
    box-shadow: 0 4px 14px rgba(37,99,235,0.28);
  }

  .dd-content { flex: 1; padding: 22px 28px 90px; max-width: 1200px; width: 100%; margin: 0 auto; }

  /* ── Hero ── */
  .dd-hero {
    position: relative; overflow: hidden;
    border-radius: 22px; padding: 24px 26px;
    background: linear-gradient(120deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%);
    color: #fff; margin-bottom: 20px;
    box-shadow: 0 16px 44px rgba(37,99,235,0.28);
    animation: riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .dd-hero-glass {
    position: absolute; top: -60px; right: -40px;
    width: 260px; height: 260px; border-radius: 50%;
    background: rgba(255,255,255,0.1); filter: blur(2px);
    pointer-events: none;
  }
  .dd-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; position: relative; }
  .dd-hero-title { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .dd-hero-sub { font-size: 12px; color: rgba(255,255,255,0.75); margin: 4px 0 0; }
  .dd-hero-chip {
    display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
    padding: 6px 13px; border-radius: 20px;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22);
    font-size: 12px; font-weight: 600; color: #fff;
    backdrop-filter: blur(8px);
  }
  .dd-hero-chip-dot { width: 7px; height: 7px; border-radius: 50%; animation: softPulse 2s infinite; }
  .dd-hero-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    margin-top: 22px; position: relative;
  }
  .dd-hero-stat {
    display: flex; flex-direction: column; gap: 2px;
    padding: 12px 16px; border-radius: 14px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.14);
  }
  .dd-hero-stat-value {
    font-size: 26px; font-weight: 800; letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
  }
  .dd-hero-stat-label { font-size: 11px; color: rgba(255,255,255,0.72); font-weight: 500; }

  /* ── Grid ── */
  .dd-grid { display: grid; grid-template-columns: 1fr 300px; gap: 18px; align-items: start; }
  .dd-side-col { display: flex; flex-direction: column; gap: 18px; }

  /* ── Panels ── */
  .dd-panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: var(--shadow-sm);
    animation: riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
    transition: box-shadow 0.25s, border-color 0.25s;
  }
  .dd-panel:hover { box-shadow: var(--shadow); }
  .dd-panel-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 16px 20px 12px;
  }
  .dd-panel-title-wrap { display: flex; align-items: center; gap: 9px; }
  .dd-panel-title { font-size: 14px; font-weight: 700; margin: 0; letter-spacing: -0.1px; }
  .dd-panel-sub { font-size: 11px; color: var(--text-muted); }
  .dd-live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #059669; box-shadow: 0 0 8px rgba(5,150,105,0.5);
    animation: softPulse 2s infinite;
  }

  /* ── Queue rows ── */
  .dd-rows { padding: 0 8px 8px; }
  .dd-row {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 100px 76px auto;
    align-items: center; gap: 14px;
    padding: 12px; border-radius: 14px; cursor: pointer;
    animation: riseIn 0.45s cubic-bezier(0.22,1,0.36,1) both;
    transition: background 0.15s;
  }
  .dd-row:hover { background: var(--surface-hi); }
  .dd-row-avatar {
    width: 42px; height: 42px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .dd-row-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dd-row-name { font-size: 13px; font-weight: 700; }
  .dd-row-sub {
    font-size: 11.5px; color: var(--text-muted); line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
  }
  .dd-badge {
    display: inline-flex; align-items: center; gap: 6px; justify-self: start;
    padding: 4px 11px; border-radius: 20px;
    font-size: 11px; font-weight: 700;
  }
  .dd-badge-dot { width: 6px; height: 6px; border-radius: 50%; }
  .dd-row-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .dd-row-actions { display: flex; gap: 6px; }
  .dd-action {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 13px; border-radius: 10px;
    background: var(--surface-hi); border: 1px solid var(--border);
    color: var(--text-secondary); font-size: 12px; font-weight: 600;
    font-family: inherit; cursor: pointer;
    transition: all 0.18s;
  }
  .dd-action:hover:not(:disabled) { border-color: var(--border-hi); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,40,0.07); }
  .dd-action:active:not(:disabled) { transform: scale(0.96); }
  .dd-action:disabled { opacity: 0.55; cursor: default; }
  .dd-action.primary { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
  .dd-action.primary:hover:not(:disabled) { box-shadow: 0 6px 18px rgba(37,99,235,0.35); }
  .dd-action.done { background: var(--green-bg); border-color: transparent; color: var(--green); }

  .dd-empty { padding: 44px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .dd-empty-title { font-weight: 700; color: var(--text-secondary); font-size: 14px; margin: 0 0 4px; }
  .dd-empty-sub { font-size: 12px; color: var(--text-muted); margin: 0; }

  /* ── Donut ── */
  .dd-donut-body { display: flex; align-items: center; gap: 18px; padding: 6px 20px 20px; }
  .dd-donut-wrap { position: relative; flex-shrink: 0; }
  .dd-donut-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .dd-donut-total { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
  .dd-donut-total-label { font-size: 9px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--text-muted); }
  .dd-donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; }
  .dd-legend-row { display: flex; align-items: center; gap: 8px; }
  .dd-legend-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
  .dd-legend-label { font-size: 12px; color: var(--text-secondary); }
  .dd-legend-value { margin-left: auto; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ── Bars ── */
  .dd-bars {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 8px; padding: 10px 20px 18px; min-height: 120px;
  }
  .dd-bar-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
  .dd-bar-count { font-size: 10px; font-weight: 700; color: var(--accent); height: 13px; font-variant-numeric: tabular-nums; }
  .dd-bar {
    width: 100%; max-width: 26px; border-radius: 7px 7px 3px 3px;
    transform-origin: bottom;
    animation: growBar 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }
  .dd-bar-label { font-size: 9.5px; color: var(--text-muted); white-space: nowrap; }

  /* ── Consults ── */
  .dd-consults { display: flex; flex-direction: column; gap: 12px; }
  .dd-consults-head { padding: 0 4px; }
  .dd-consult { display: flex; align-items: center; gap: 16px; padding: 16px 18px; }
  .dd-consult-avatar { background: var(--accent-bg); color: var(--accent); }
  .dd-consult-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .dd-consult-phone { font-size: 11.5px; color: var(--accent); font-weight: 600; }
  .dd-consult-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .dd-consult-fee { font-size: 16px; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; }
  .dd-consult-time { font-size: 10.5px; color: var(--text-muted); }

  /* ── Settings ── */
  .dd-settings { padding: 24px; max-width: 620px; }
  .dd-settings-title { font-size: 16px; font-weight: 800; margin: 0 0 20px; letter-spacing: -0.2px; }
  .dd-settings-subtitle { font-size: 13px; font-weight: 700; margin: 0 0 12px; }
  .dd-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .dd-label {
    display: block; font-size: 11px; font-weight: 700;
    letter-spacing: 0.6px; text-transform: uppercase;
    color: var(--text-muted); margin-bottom: 6px;
  }
  .dd-input {
    width: 100%; padding: 10px 14px; border-radius: 10px;
    border: 1px solid var(--border-hi); background: var(--surface-hi);
    color: var(--text); font-size: 13px; font-family: inherit; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .dd-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
  .dd-break-row { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
  .dd-break-mins { display: flex; align-items: center; gap: 6px; }
  .dd-break-mins-label { font-size: 11px; color: var(--text-muted); }
  .dd-break-remove {
    background: none; border: none; color: var(--red); cursor: pointer;
    padding: 8px; border-radius: 8px; display: flex;
    transition: background 0.15s;
  }
  .dd-break-remove:hover { background: var(--red-bg); }
  .dd-add-break {
    display: inline-flex; align-items: center; gap: 6px;
    margin-bottom: 24px; padding: 8px 14px;
    font-size: 12px; font-weight: 700; color: var(--accent);
    background: var(--accent-bg); border: none; border-radius: 10px;
    font-family: inherit; cursor: pointer;
    transition: transform 0.15s;
  }
  .dd-add-break:active { transform: scale(0.96); }
  .dd-settings-footer { border-top: 1px solid var(--border); padding-top: 16px; text-align: right; }
  .dd-save {
    padding: 11px 26px; border-radius: 11px;
    background: var(--accent); border: none; color: #fff;
    font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    box-shadow: 0 6px 18px rgba(37,99,235,0.28);
    transition: box-shadow 0.2s, transform 0.15s;
  }
  .dd-save:hover:not(:disabled) { box-shadow: 0 8px 24px rgba(37,99,235,0.38); }
  .dd-save:active:not(:disabled) { transform: scale(0.97); }
  .dd-save:disabled { opacity: 0.6; cursor: default; }

  /* ── Mobile ── */
  @media (max-width: 860px) {
    .dd-grid { grid-template-columns: 1fr; }
    .dd-side-col { flex-direction: column; }
    .dd-hero-stats { grid-template-columns: repeat(2, 1fr); }
    .dd-content { padding: 18px 16px 96px; }
    .dd-header { padding: 14px 16px; flex-wrap: wrap; }
    .dd-hello { font-size: 18px; }
    .dd-status-group { order: 3; width: 100%; }
    .dd-status-btn { flex: 1; justify-content: center; }

    .dd-sidebar {
      position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
      top: auto; width: auto; height: auto;
      flex-direction: row; padding: 8px 12px; gap: 4px;
      border: 1px solid var(--border); border-radius: 22px;
      background: var(--surface-glass);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 12px 36px rgba(15,23,40,0.16);
      z-index: 100;
    }
    @supports not (backdrop-filter: blur(1px)) {
      .dd-sidebar { background: var(--surface); }
    }
    .dd-sidebar-logo { display: none; }
    .dd-sidebar-nav { flex-direction: row; flex: initial; }
    .dd-side-btn.active::before { display: none; }

    .dd-row {
      grid-template-columns: 42px minmax(0, 1fr);
      grid-template-areas:
        "avatar who"
        "avatar meta"
        "actions actions";
      row-gap: 8px;
    }
    .dd-row-avatar { grid-area: avatar; align-self: start; }
    .dd-row-who { grid-area: who; }
    .dd-badge { grid-area: meta; }
    .dd-row-time { display: none; }
    .dd-row-actions { grid-area: actions; }
    .dd-row-actions .dd-action { flex: 1; justify-content: center; }

    .dd-consult { flex-wrap: wrap; }
    .dd-consult-right { width: 100%; flex-direction: row; align-items: center; justify-content: space-between; }
    .dd-settings-grid { grid-template-columns: 1fr; }
    .dd-break-row { flex-wrap: wrap; }
  }
`;
