import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { updateDoctorStatus, redirectPatients, pingDoctor, updateSettings } from "../../api/doctors";
import { callPatient } from "../../api/triage";
import useWebSocket from "../../hooks/useWebSocket";
import client from "../../api/client";
import Icon from "../../components/Icons";

// Clinical priority — doctor-facing only. Colour is always paired with a text label.
const RISK = {
  critical: { tone: "danger", label: "Critical" },
  moderate: { tone: "warning", label: "Moderate" },
  low: { tone: "success", label: "Low" },
};

const STATUS_CFG = {
  available: { tone: "success", label: "Available" },
  on_break: { tone: "warning", label: "On break" },
  offline: { tone: "neutral", label: "Offline" },
  with_patient: { tone: "info", label: "With patient" },
};

const STATUS_OPTIONS = ["available", "on_break", "offline"];

const VIEWS = [
  { id: "queue", label: "Patient queue", title: "Patient queue", icon: "Users" },
  { id: "consults", label: "Consultations", title: "Online consultations", icon: "Video" },
  { id: "settings", label: "Shift settings", title: "Shift & breaks", icon: "Settings" },
];

function timeSince(date) {
  const m = Math.floor((Date.now() - new Date(date)) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`;
}

function minutesSince(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date)) / 60000));
}

function formatWait(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function excerpt(text, n = 140) {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;
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
  const [toast, setToast] = useState(null);
  const notify = useCallback((type, text) => setToast({ type, text, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.type === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
      notify("success", "Settings saved. Applying your schedule…");
      setTimeout(() => window.location.reload(), 900); // Quick refresh to re-apply timers and state
    } catch {
      notify("error", "Couldn't save settings. Check your connection and try again.");
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

  // Signed out, or still on the old National ID login: back to sign-in.
  useEffect(() => {
    if (!doctor.id || !localStorage.getItem("civtech_token") || doctor.must_set_password) {
      navigate("/doctor", { replace: true });
    }
  }, [doctor.id, doctor.must_set_password, navigate]);

  // ── Ping ──
  // Keeps the doctor marked active and shows the status the server actually
  // has: opening a case file or a long time away can change it.
  useEffect(() => {
    if (!doctor.id) return;
    const ping = async () => {
      try {
        const res = await pingDoctor(doctor.id);
        const serverStatus = res.data?.doctor_status;
        if (serverStatus) {
          setStatus(serverStatus);
          const saved = JSON.parse(localStorage.getItem("civtech_doctor") || "{}");
          localStorage.setItem("civtech_doctor", JSON.stringify({ ...saved, status: serverStatus }));
        }
      } catch { }
    };
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    ping();
    const t = setInterval(ping, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
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
      notify("error", "Couldn't update your availability. Please try again.");
    }
  };

  // ── Call patient ──
  const handleCall = async (appt) => {
    setCalling(appt.id);
    try {
      await callPatient({ appointment_id: appt.id, doctor_id: doctor.id });
      await loadQueue(); // ← refreshes queue AND triggers WebSocket broadcast to all doctors
    } catch {
      notify("error", "Couldn't notify the patient. Please try again.");
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
  const sCfg = STATUS_CFG[status] || STATUS_CFG.available;
  const doctorName = doctor.full_name || doctor.name || "Doctor";
  const initials = doctorName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // ── Derived, display-only values ──
  const waitingList = sortedQueue.filter((a) => a.status !== "called");
  const calledCount = queue.filter((a) => a.status === "called").length;
  const lowCount = queue.filter((a) => a.risk_score === "low").length;
  const arrivedWaits = waitingList.filter((a) => a.arrived_at).map((a) => minutesSince(a.arrived_at));
  const longestWait = arrivedWaits.length ? Math.max(...arrivedWaits) : null;
  const nextUp = waitingList[0] || null;
  const activeView = VIEWS.find((v) => v.id === view) || VIEWS[0];
  const todayLabel = new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const breakdown = [
    { label: "Critical", value: critical, tone: "danger" },
    { label: "Moderate", value: moderate, tone: "warning" },
    { label: "Low", value: lowCount, tone: "success" },
  ];

  const updateBreak = (idx, key, value) => {
    const newB = [...settingsForm.breaks];
    newB[idx] = { ...newB[idx], [key]: value };
    setSettingsForm({ ...settingsForm, breaks: newB });
  };

  const renderRisk = (appt, withScore = true) => {
    const r = RISK[appt.risk_score] || RISK.moderate;
    return (
      <span className="dd-risk">
        <span className={`dd-pill dd-pill--${r.tone}`}>
          <span className="dd-dot" aria-hidden="true" />
          {r.label}
        </span>
        {withScore && appt.risk_numeric != null && (
          <span className="dd-score" title="AI triage score">{appt.risk_numeric}/100</span>
        )}
      </span>
    );
  };

  const renderCallButton = (appt, size = "sm") => {
    const isCalling = calling === appt.id;
    const called = appt.status === "called";
    return (
      <button
        type="button"
        className={`dd-btn dd-btn--${called ? "done" : "primary"} dd-btn--${size}`}
        disabled={isCalling || called}
        onClick={(e) => { e.stopPropagation(); handleCall(appt); }}
        aria-label={called ? `${appt.patient_name} has been called` : `Call ${appt.patient_name} in`}
      >
        {isCalling ? <span className="dd-spinner" aria-hidden="true" /> : called ? <Icon.Check size={16} /> : <Icon.Bell size={16} />}
        {isCalling ? "Calling…" : called ? "Called" : "Call in"}
      </button>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="dd">

        {/* ════════ SIDEBAR (desktop) / TOP BAR (mobile) ════════ */}
        <aside className="dd-side" aria-label="Doctor workspace">
          <div className="dd-brand">
            <span className="dd-brandmark" aria-hidden="true"><Icon.Heart size={18} /></span>
            <div>
              <div className="dd-brandname">CivCare</div>
              <div className="dd-brandsub">Clinician portal</div>
            </div>
          </div>

          <nav className="dd-nav" aria-label="Sections">
            {VIEWS.map((v) => {
              const NavIcon = Icon[v.icon];
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`dd-navbtn${view === v.id ? " is-active" : ""}`}
                  onClick={() => setView(v.id)}
                  aria-current={view === v.id ? "page" : undefined}
                >
                  <NavIcon size={18} />
                  <span>{v.label}</span>
                  {v.id === "queue" && queue.length > 0 && <span className="dd-count">{queue.length}</span>}
                </button>
              );
            })}
          </nav>

          <div className="dd-me">
            <div className="dd-meid">
              <div className="dd-avatar" aria-hidden="true">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="dd-mename">Dr. {doctorName}</div>
                <div className="dd-mesub">{doctor.specialisation || "General Practitioner"}</div>
              </div>
            </div>

            <fieldset className="dd-status">
              <legend>Availability</legend>
              <div className="dd-seg" role="radiogroup" aria-label="Availability">
                {STATUS_OPTIONS.map((id) => {
                  const c = STATUS_CFG[id];
                  const on = status === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`dd-segbtn dd-segbtn--${c.tone}${on ? " is-on" : ""}`}
                      onClick={() => (!on || id === "available") && handleStatusChange(id)}
                    >
                      <span className="dd-dot" aria-hidden="true" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {countdown && <p className="dd-countdown"><Icon.Clock size={14} /> {countdown}</p>}
              {status !== "available" && (
                <p className="dd-hint">Waiting patients are redirected to available colleagues while you are away.</p>
              )}
            </fieldset>

            <button type="button" className="dd-navbtn dd-logout" onClick={() => { localStorage.clear(); navigate("/doctor"); }}>
              <Icon.Logout size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ════════ MAIN ════════ */}
        <main className="dd-main">
          <header className="dd-head">
            <div style={{ minWidth: 0 }}>
              <p className="dd-crumb">{doctor.hospital_name || "Hospital"} · {todayLabel}</p>
              <h1 className="dd-title">{activeView.title}</h1>
            </div>
            <span className={`dd-pill dd-pill--${sCfg.tone} dd-pill--lg`}>
              <span className="dd-dot" aria-hidden="true" />
              {sCfg.label}
            </span>
          </header>

          {toast && (
            <div className={`dd-toast dd-toast--${toast.type}`} role={toast.type === "error" ? "alert" : "status"} key={toast.id}>
              {toast.type === "error" ? <Icon.Alert size={18} /> : <Icon.CheckCircle size={18} />}
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss"><Icon.Close size={16} /></button>
            </div>
          )}

          <div className="dd-content">

            {/* ── QUEUE ── */}
            {view === "queue" && (
              <>
                <section className="dd-stats" aria-label="Queue overview">
                  <div className="dd-stat">
                    <span className="dd-statlabel">Waiting</span>
                    <span className="dd-statvalue">{loading ? "—" : waitingList.length}</span>
                    <span className="dd-statsub">{calledCount} called in</span>
                  </div>
                  <div className={`dd-stat${critical > 0 ? " dd-stat--danger" : ""}`}>
                    <span className="dd-statlabel">Critical</span>
                    <span className="dd-statvalue">{loading ? "—" : critical}</span>
                    <span className="dd-statsub">{critical > 0 ? "See first" : "None in queue"}</span>
                  </div>
                  <div className="dd-stat">
                    <span className="dd-statlabel">Moderate</span>
                    <span className="dd-statvalue">{loading ? "—" : moderate}</span>
                    <span className="dd-statsub">Monitor closely</span>
                  </div>
                  <div className="dd-stat">
                    <span className="dd-statlabel">Longest wait</span>
                    <span className="dd-statvalue">{loading ? "—" : formatWait(longestWait)}</span>
                    <span className="dd-statsub">Since arrival</span>
                  </div>
                </section>

                <div className="dd-grid">
                  <section className="dd-panel" aria-labelledby="dd-queue-title">
                    <div className="dd-panelhead">
                      <h2 id="dd-queue-title">
                        <span className="dd-live" aria-hidden="true" />
                        Live queue
                      </h2>
                      <span className="dd-panelmeta">Sorted by clinical priority</span>
                    </div>

                    {loading ? (
                      <div className="dd-skel" aria-busy="true" aria-label="Loading queue">
                        {[0, 1, 2].map((i) => <div key={i} className="cc-skeleton" style={{ height: 56 }} />)}
                      </div>
                    ) : queue.length === 0 ? (
                      <div className="dd-empty">
                        <span className="dd-emptyicon"><Icon.CheckCircle size={26} /></span>
                        <h3>Queue is clear</h3>
                        <p>No patients are waiting. New arrivals appear here automatically.</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop table */}
                        <div className="dd-tablewrap">
                          <table className="dd-table">
                            <thead>
                              <tr>
                                <th scope="col" style={{ width: 44 }}>#</th>
                                <th scope="col">Patient</th>
                                <th scope="col">Priority</th>
                                <th scope="col">Presenting symptoms</th>
                                <th scope="col">Waiting</th>
                                <th scope="col"><span className="cc-visually-hidden">Actions</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedQueue.map((appt, idx) => {
                                const r = RISK[appt.risk_score] || RISK.moderate;
                                return (
                                  <tr key={appt.id} className={`dd-row dd-row--${r.tone}${appt.status === "called" ? " is-called" : ""}`}
                                    onClick={() => navigate(`/doctor/patient/${appt.id}`)}>
                                    <td className="dd-idx">{idx + 1}</td>
                                    <td>
                                      <div className="dd-pname">{appt.patient_name}</div>
                                      <div className="dd-mono">{appt.patient_phone}</div>
                                    </td>
                                    <td>{renderRisk(appt)}</td>
                                    <td className="dd-sym">{appt.symptoms_summary || excerpt(appt.ai_assessment, 90) || "—"}</td>
                                    <td className="dd-mono dd-nowrap">{appt.arrived_at ? timeSince(appt.arrived_at) : "En route"}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div className="dd-actions">
                                        {renderCallButton(appt)}
                                        <button type="button" className="dd-btn dd-btn--ghost dd-btn--sm"
                                          onClick={() => navigate(`/doctor/patient/${appt.id}`)}
                                          aria-label={`Open ${appt.patient_name}'s profile`}>
                                          Open
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile list */}
                        <ul className="dd-cards">
                          {sortedQueue.map((appt, idx) => {
                            const r = RISK[appt.risk_score] || RISK.moderate;
                            return (
                              <li key={appt.id} className={`dd-card dd-row--${r.tone}${appt.status === "called" ? " is-called" : ""}`}>
                                <div className="dd-cardtop">
                                  <span className="dd-idx">{idx + 1}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="dd-pname">{appt.patient_name}</div>
                                    <div className="dd-mono">{appt.arrived_at ? `Waiting ${timeSince(appt.arrived_at)}` : "En route"}</div>
                                  </div>
                                  {renderRisk(appt)}
                                </div>
                                {(appt.symptoms_summary || appt.ai_assessment) && (
                                  <p className="dd-sym">{appt.symptoms_summary || excerpt(appt.ai_assessment, 110)}</p>
                                )}
                                <div className="dd-actions">
                                  {renderCallButton(appt, "md")}
                                  <button type="button" className="dd-btn dd-btn--ghost dd-btn--md"
                                    onClick={() => navigate(`/doctor/patient/${appt.id}`)}>
                                    Open profile
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </section>

                  <div className="dd-aside">
                    <section className="dd-panel" aria-labelledby="dd-next-title">
                      <div className="dd-panelhead">
                        <h2 id="dd-next-title">Next up</h2>
                        {nextUp && renderRisk(nextUp, false)}
                      </div>
                      {nextUp ? (
                        <div className="dd-next">
                          <div className="dd-pname dd-pname--lg">{nextUp.patient_name}</div>
                          <div className="dd-mono">{nextUp.arrived_at ? `Arrived ${timeSince(nextUp.arrived_at)}` : "En route to hospital"}</div>
                          {(nextUp.ai_assessment || nextUp.symptoms_summary) && (
                            <div className="dd-assess">
                              <span className="dd-assesslabel"><Icon.Sparkle size={14} /> AI pre-assessment</span>
                              <p>{excerpt(nextUp.ai_assessment || nextUp.symptoms_summary, 220)}</p>
                            </div>
                          )}
                          <div className="dd-actions dd-actions--full">
                            {renderCallButton(nextUp, "md")}
                            <button type="button" className="dd-btn dd-btn--ghost dd-btn--md"
                              onClick={() => navigate(`/doctor/patient/${nextUp.id}`)}>
                              Review
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="dd-muted dd-pad">{loading ? "Loading…" : "Nobody waiting to be called."}</p>
                      )}
                    </section>

                    <section className="dd-panel" aria-labelledby="dd-mix-title">
                      <div className="dd-panelhead">
                        <h2 id="dd-mix-title">Priority mix</h2>
                        <span className="dd-panelmeta">{queue.length} total</span>
                      </div>
                      <div className="dd-mix">
                        {breakdown.map((b) => (
                          <div key={b.label} className="dd-mixrow">
                            <span className={`dd-mixlabel dd-tone--${b.tone}`}><span className="dd-dot" aria-hidden="true" />{b.label}</span>
                            <span className="dd-mixbar" aria-hidden="true">
                              <span className={`dd-mixfill dd-bg--${b.tone}`} style={{ width: queue.length ? `${(b.value / queue.length) * 100}%` : 0 }} />
                            </span>
                            <span className="dd-mixval">{b.value}</span>
                          </div>
                        ))}
                        <div className="dd-mixrow dd-mixrow--sep">
                          <span className="dd-mixlabel dd-tone--info"><span className="dd-dot" aria-hidden="true" />Called in</span>
                          <span />
                          <span className="dd-mixval">{calledCount}</span>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </>
            )}

            {/* ── CONSULTATIONS ── */}
            {view === "consults" && (
              <section aria-labelledby="dd-consult-title">
                <div className="dd-sectionhead">
                  <h2 id="dd-consult-title">Pending consultations</h2>
                  <span className="dd-panelmeta">{consultsLoading ? "Loading…" : `${consults.length} waiting`}</span>
                </div>

                {consultsLoading && (
                  <div className="dd-skel" aria-busy="true">
                    {[0, 1].map((i) => <div key={i} className="cc-skeleton" style={{ height: 96 }} />)}
                  </div>
                )}

                {!consultsLoading && consults.length === 0 && (
                  <div className="dd-panel dd-empty">
                    <span className="dd-emptyicon"><Icon.Video size={24} /></span>
                    <h3>No pending consultations</h3>
                    <p>Patients who book and pay for an online consultation will appear here.</p>
                  </div>
                )}

                {!consultsLoading && consults.length > 0 && (
                  <ul className="dd-consults">
                    {consults.map((c) => (
                      <li key={c.id} className="dd-panel dd-consult">
                        <div className="dd-consultmain">
                          <div className="dd-pname">{c.patient_name}</div>
                          <div className="dd-mono">{c.patient_phone}</div>
                          {c.symptoms_summary && <p className="dd-sym">{c.symptoms_summary}</p>}
                        </div>
                        <div className="dd-consultside">
                          <div className="dd-fee">KES {c.fee_amount?.toLocaleString()}</div>
                          <div className="dd-mono">{c.started ? `Requested ${timeSince(c.started)}` : "—"}</div>
                          <div className="dd-actions">
                            <a href={`tel:${c.patient_phone}`} className="dd-btn dd-btn--ghost dd-btn--sm">
                              <Icon.Phone size={15} /> Call
                            </a>
                            <button type="button" className="dd-btn dd-btn--primary dd-btn--sm" onClick={() => navigate(`/doctor/consult/${c.id}`)}>
                              Start consult <Icon.ArrowRight size={15} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* ── SETTINGS ── */}
            {view === "settings" && (
              <section className="dd-panel dd-settings" aria-labelledby="dd-settings-title">
                <div className="dd-panelhead">
                  <h2 id="dd-settings-title">Working hours</h2>
                </div>
                <div className="dd-pad">
                  <p className="dd-muted" style={{ marginBottom: 16 }}>
                    Your shift and breaks drive the availability countdown and when waiting patients are redirected.
                  </p>
                  <div className="dd-fields">
                    <label className="dd-field">
                      <span>Shift start</span>
                      <input type="time" className="input" value={settingsForm.shift_start}
                        onChange={(e) => setSettingsForm({ ...settingsForm, shift_start: e.target.value })} />
                    </label>
                    <label className="dd-field">
                      <span>Shift end</span>
                      <input type="time" className="input" value={settingsForm.shift_end}
                        onChange={(e) => setSettingsForm({ ...settingsForm, shift_end: e.target.value })} />
                    </label>
                  </div>

                  <h3 className="dd-subhead">Breaks</h3>
                  {settingsForm.breaks.length === 0 && <p className="dd-muted" style={{ marginBottom: 12 }}>No breaks scheduled.</p>}
                  <div className="dd-breaks">
                    {settingsForm.breaks.map((b, idx) => (
                      <div key={idx} className="dd-break">
                        <label className="dd-field dd-field--grow">
                          <span>Label</span>
                          <input type="text" className="input" placeholder="e.g. Lunch" value={b.title}
                            onChange={(e) => updateBreak(idx, "title", e.target.value)} />
                        </label>
                        <label className="dd-field">
                          <span>Starts</span>
                          <input type="time" className="input" value={b.start}
                            onChange={(e) => updateBreak(idx, "start", e.target.value)} />
                        </label>
                        <label className="dd-field dd-field--narrow">
                          <span>Minutes</span>
                          <input type="number" min="1" inputMode="numeric" className="input" placeholder="30" value={b.duration_minutes}
                            onChange={(e) => updateBreak(idx, "duration_minutes", e.target.value)} />
                        </label>
                        <button type="button" className="dd-iconbtn" aria-label={`Remove break ${b.title || idx + 1}`}
                          onClick={() => setSettingsForm({ ...settingsForm, breaks: settingsForm.breaks.filter((_, i) => i !== idx) })}>
                          <Icon.Trash size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="dd-btn dd-btn--ghost dd-btn--sm"
                    onClick={() => setSettingsForm({ ...settingsForm, breaks: [...settingsForm.breaks, { title: "", start: "", duration_minutes: "" }] })}>
                    <Icon.Plus size={16} /> Add break
                  </button>
                </div>
                <div className="dd-panelfoot">
                  <button type="button" onClick={handleSaveSettings} disabled={savingSettings} className="dd-btn dd-btn--primary dd-btn--md">
                    {savingSettings && <span className="dd-spinner" aria-hidden="true" />}
                    {savingSettings ? "Saving…" : "Save settings"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────
const CSS = `
  .dd { display: flex; min-height: 100vh; background: var(--cc-canvas); background-attachment: fixed; color: var(--cc-text); }

  /* Sidebar */
  .dd-side {
    width: 248px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto;
    background: var(--cc-glass); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur); border-right: 1px solid var(--cc-glass-border); box-shadow: 1px 0 0 var(--cc-border);
    display: flex; flex-direction: column; gap: 24px; padding: 20px 14px;
  }
  .dd-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
  .dd-brandmark { width: 36px; height: 36px; border-radius: 11px; background: var(--cc-primary-grad); box-shadow: inset 0 1px 0 rgba(255,255,255,.25), var(--cc-primary-glow); color: var(--cc-on-primary); display: inline-flex; align-items: center; justify-content: center; }
  .dd-brandname { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
  .dd-brandsub { font-size: 12px; color: var(--cc-muted); }
  .dd-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .dd-navbtn {
    display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px;
    padding: 8px 10px; border-radius: 8px; border: none; background: none; text-align: left;
    color: var(--cc-text-2); font-size: 14px; font-weight: 500;
  }
  .dd-navbtn:hover { background: var(--cc-surface-2); color: var(--cc-text); }
  .dd-navbtn.is-active { background: var(--cc-primary-soft); color: var(--cc-primary); font-weight: 600; box-shadow: var(--cc-clay); }
  .dd-count { margin-left: auto; min-width: 22px; padding: 1px 7px; border-radius: 999px; font-size: 12px; font-weight: 600; text-align: center; background: var(--cc-surface-3); color: var(--cc-text-2); }
  .dd-navbtn.is-active .dd-count { background: var(--cc-primary); color: var(--cc-on-primary); }
  .dd-me { border-top: 1px solid var(--cc-border); padding-top: 16px; display: flex; flex-direction: column; gap: 14px; }
  .dd-meid { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
  .dd-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--cc-primary-soft); color: var(--cc-primary); box-shadow: var(--cc-clay); font-weight: 700; font-size: 13px; }
  .dd-mename { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dd-mesub { font-size: 12px; color: var(--cc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dd-status { border: none; padding: 0 6px; }
  .dd-status legend { font-size: 12px; font-weight: 600; color: var(--cc-muted); margin-bottom: 6px; }
  .dd-seg { display: flex; flex-direction: column; gap: 4px; }
  .dd-segbtn {
    display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 10px;
    border-radius: 8px; border: 1px solid var(--cc-border); background: var(--cc-surface);
    color: var(--cc-muted); font-size: 13px; font-weight: 600; text-align: left;
  }
  .dd-segbtn:hover { border-color: var(--cc-border-strong); color: var(--cc-text); }
  .dd-segbtn .dd-dot { opacity: .45; }
  .dd-segbtn.is-on .dd-dot { opacity: 1; }
  .dd-segbtn--success .dd-dot { background: var(--cc-success); }
  .dd-segbtn--warning .dd-dot { background: var(--cc-warning); }
  .dd-segbtn--neutral .dd-dot { background: var(--cc-faint); }
  .dd-segbtn--success.is-on { background: var(--cc-success-soft); border-color: var(--cc-success-border); color: var(--cc-success); }
  .dd-segbtn--warning.is-on { background: var(--cc-warning-soft); border-color: var(--cc-warning-border); color: var(--cc-warning); }
  .dd-segbtn--neutral.is-on { background: var(--cc-surface-3); border-color: var(--cc-border-strong); color: var(--cc-text); }
  .dd-countdown { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12.5px; color: var(--cc-text-2); }
  .dd-hint { margin-top: 6px; font-size: 12px; color: var(--cc-muted); line-height: 1.45; }
  .dd-logout { color: var(--cc-muted); }
  .dd-logout:hover { color: var(--cc-danger); background: var(--cc-danger-soft); }

  /* Main */
  .dd-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .dd-head {
    position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 16px 28px; background: var(--cc-glass); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur); border-bottom: 1px solid var(--cc-border);
  }
  .dd-crumb { font-size: 13px; color: var(--cc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dd-title { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; }
  .dd-content { padding: 24px 28px 48px; max-width: 1280px; width: 100%; }

  /* Pills & tones */
  .dd-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; display: inline-block; }
  .dd-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
  .dd-pill--lg { padding: 5px 12px; font-size: 13px; }
  .dd-pill--danger { background: var(--cc-danger-soft); color: var(--cc-danger); border-color: var(--cc-danger-border); }
  .dd-pill--warning { background: var(--cc-warning-soft); color: var(--cc-warning); border-color: var(--cc-warning-border); }
  .dd-pill--success { background: var(--cc-success-soft); color: var(--cc-success); border-color: var(--cc-success-border); }
  .dd-pill--info { background: var(--cc-info-soft); color: var(--cc-info); border-color: var(--cc-info-border); }
  .dd-pill--neutral { background: var(--cc-surface-3); color: var(--cc-muted); border-color: var(--cc-border-strong); }
  .dd-tone--danger { color: var(--cc-danger); } .dd-tone--warning { color: var(--cc-warning); }
  .dd-tone--success { color: var(--cc-success); } .dd-tone--info { color: var(--cc-info); }
  .dd-bg--danger { background: var(--cc-danger); } .dd-bg--warning { background: var(--cc-warning); } .dd-bg--success { background: var(--cc-success); }
  .dd-risk { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dd-score { font-family: var(--cc-mono); font-size: 12px; color: var(--cc-muted); }

  /* Stats */
  .dd-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
  .dd-stat { background: var(--cc-surface); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 2px; position: relative; overflow: hidden; }
  .dd-stat::after { content: ''; position: absolute; right: -24px; top: -24px; width: 88px; height: 88px; border-radius: 50%; background: radial-gradient(circle, var(--cc-primary-soft), transparent 70%); pointer-events: none; }
  .dd-stat--danger { border-color: var(--cc-danger-border); background: var(--cc-danger-soft); }
  .dd-stat--danger .dd-statvalue, .dd-stat--danger .dd-statlabel { color: var(--cc-danger); }
  .dd-statlabel { font-size: 13px; font-weight: 600; color: var(--cc-muted); }
  .dd-statvalue { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .dd-statsub { font-size: 12.5px; color: var(--cc-muted); }

  /* Panels */
  .dd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  .dd-aside { display: flex; flex-direction: column; gap: 16px; }
  .dd-panel { background: var(--cc-surface); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 18px; overflow: hidden; }
  .dd-panelhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--cc-border); }
  .dd-panelhead h2, .dd-sectionhead h2 { font-size: 15px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
  .dd-panelmeta { font-size: 12.5px; color: var(--cc-muted); }
  .dd-panelfoot { padding: 14px 18px; border-top: 1px solid var(--cc-border); display: flex; justify-content: flex-end; background: var(--cc-surface-2); }
  .dd-sectionhead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .dd-pad { padding: 16px 18px; }
  .dd-muted { color: var(--cc-muted); font-size: 14px; }
  .dd-live { width: 8px; height: 8px; border-radius: 50%; background: var(--cc-success); box-shadow: 0 0 0 3px var(--cc-success-soft); animation: pulse-glow 2s ease-in-out infinite; }
  .dd-skel { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; }
  .dd-empty { text-align: center; padding: 40px 20px; }
  .dd-empty h3 { font-size: 15px; font-weight: 650; margin: 10px 0 4px; }
  .dd-empty p { font-size: 14px; color: var(--cc-muted); max-width: 320px; margin: 0 auto; }
  .dd-emptyicon { box-shadow: var(--cc-clay); display: inline-flex; width: 52px; height: 52px; border-radius: 50%; align-items: center; justify-content: center; background: var(--cc-success-soft); color: var(--cc-success); }

  /* Table */
  .dd-tablewrap { overflow-x: auto; }
  .dd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .dd-table th { text-align: left; font-size: 12px; font-weight: 600; color: var(--cc-muted); padding: 10px 14px; background: var(--cc-surface-2); border-bottom: 1px solid var(--cc-border); white-space: nowrap; }
  .dd-table td { padding: 12px 14px; border-bottom: 1px solid var(--cc-border); vertical-align: middle; }
  .dd-table tr:last-child td { border-bottom: none; }
  .dd-row { cursor: pointer; transition: background .12s ease; }
  .dd-row:hover { background: var(--cc-primary-soft); }
  .dd-row td:first-child { box-shadow: inset 3px 0 0 var(--dd-edge, transparent); }
  .dd-row--danger { --dd-edge: var(--cc-danger); }
  .dd-row--warning { --dd-edge: var(--cc-warning); }
  .dd-row--success { --dd-edge: var(--cc-success); }
  .dd-row.is-called { opacity: .72; }
  .dd-idx { font-family: var(--cc-mono); font-size: 12.5px; color: var(--cc-faint); }
  .dd-pname { font-weight: 600; font-size: 14.5px; color: var(--cc-text); }
  .dd-pname--lg { font-size: 17px; }
  .dd-mono { font-family: var(--cc-mono); font-size: 12.5px; color: var(--cc-muted); }
  .dd-nowrap { white-space: nowrap; }
  .dd-sym { color: var(--cc-text-2); font-size: 13.5px; line-height: 1.45; max-width: 300px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dd-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .dd-actions--full > * { flex: 1; }

  /* Mobile cards */
  .dd-cards { display: none; list-style: none; }
  .dd-card { padding: 14px 16px; border-bottom: 1px solid var(--cc-border); box-shadow: inset 3px 0 0 var(--dd-edge, transparent); display: flex; flex-direction: column; gap: 10px; }
  .dd-card:last-child { border-bottom: none; }
  .dd-card.is-called { opacity: .72; }
  .dd-cardtop { display: flex; align-items: flex-start; gap: 10px; }
  .dd-cardtop .dd-idx { padding-top: 2px; }
  .dd-card .dd-sym { max-width: none; }

  /* Next up / mix */
  .dd-next { padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
  .dd-assess { margin: 10px 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--cc-surface-2); border: 1px solid var(--cc-border); }
  .dd-assesslabel { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--cc-muted); margin-bottom: 4px; }
  .dd-assess p { font-size: 13.5px; line-height: 1.5; color: var(--cc-text-2); }
  .dd-mix { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
  .dd-mixrow { display: grid; grid-template-columns: 96px 1fr 28px; align-items: center; gap: 10px; }
  .dd-mixrow--sep { border-top: 1px solid var(--cc-border); padding-top: 10px; }
  .dd-mixlabel { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 500; }
  .dd-mixbar { height: 6px; border-radius: 3px; background: var(--cc-surface-3); overflow: hidden; }
  .dd-mixfill { display: block; height: 100%; border-radius: 3px; transition: width .3s ease; }
  .dd-mixval { text-align: right; font-weight: 650; font-variant-numeric: tabular-nums; }

  /* Consultations */
  .dd-consults { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .dd-consult { display: flex; gap: 16px; padding: 16px 18px; align-items: flex-start; }
  .dd-consultmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .dd-consultmain .dd-sym { margin-top: 6px; max-width: 560px; }
  .dd-consultside { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .dd-consultside .dd-actions { margin-top: 8px; }
  .dd-fee { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Settings */
  .dd-settings { max-width: 720px; }
  .dd-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .dd-field { display: flex; flex-direction: column; gap: 6px; }
  .dd-field > span { font-size: 13px; font-weight: 600; color: var(--cc-text-2); }
  .dd-field--grow { flex: 1; min-width: 140px; }
  .dd-field--narrow { width: 104px; }
  .dd-subhead { font-size: 14px; font-weight: 650; margin-bottom: 10px; }
  .dd-breaks { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
  .dd-break { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; padding: 12px; border: 1px solid var(--cc-border); border-radius: 10px; background: var(--cc-surface-2); }
  .dd-iconbtn { width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--cc-border); background: var(--cc-surface); color: var(--cc-muted); display: inline-flex; align-items: center; justify-content: center; }
  .dd-iconbtn:hover { color: var(--cc-danger); border-color: var(--cc-danger-border); background: var(--cc-danger-soft); }

  /* Buttons */
  .dd-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: 8px; border: 1px solid transparent; font-weight: 600; white-space: nowrap; text-decoration: none;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  .dd-btn--sm { min-height: 34px; padding: 6px 12px; font-size: 13px; }
  .dd-btn--md { min-height: 42px; padding: 9px 16px; font-size: 14px; }
  .dd-btn--primary { background: var(--cc-primary-grad); color: var(--cc-on-primary); box-shadow: inset 0 1px 0 rgba(255,255,255,.22), var(--cc-primary-glow); }
  .dd-btn--primary:hover:not(:disabled) { background: var(--cc-primary-hover); }
  .dd-btn--ghost { background: var(--cc-glass-strong); color: var(--cc-text-2); border-color: var(--cc-border-strong); box-shadow: var(--cc-clay); }
  .dd-btn--ghost:hover:not(:disabled) { background: var(--cc-surface-2); color: var(--cc-text); }
  .dd-btn--done { background: var(--cc-success-soft); color: var(--cc-success); border-color: var(--cc-success-border); }
  .dd-btn:disabled { cursor: default; }
  .dd-btn--primary:disabled { opacity: .6; }
  .dd-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .7s linear infinite; }

  /* Toast */
  .dd-toast {
    margin: 16px 28px 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 14px;
    border-radius: 10px; border: 1px solid; font-size: 14px; animation: fadeUp .2s ease both;
  }
  .dd-toast span { flex: 1; }
  .dd-toast button { border: none; background: none; color: inherit; width: 32px; height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
  .dd-toast--error { background: var(--cc-danger-soft); color: var(--cc-danger); border-color: var(--cc-danger-border); }
  .dd-toast--success { background: var(--cc-success-soft); color: var(--cc-success); border-color: var(--cc-success-border); }

  /* ── Responsive ── */
  @media (max-width: 1180px) {
    .dd-grid { grid-template-columns: 1fr; }
    .dd-aside { display: grid; grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 960px) {
    .dd { flex-direction: column; }
    .dd-side {
      position: static; width: 100%; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center;
      gap: 12px; padding: 12px 16px; border-right: none; border-bottom: 1px solid var(--cc-border);
    }
    .dd-brand { padding: 0; flex: 1; }
    .dd-nav { order: 3; flex: 1 0 100%; flex-direction: row; overflow-x: auto; gap: 4px; margin: 0 -4px; padding: 0 4px; }
    .dd-navbtn { width: auto; flex-shrink: 0; }
    .dd-me { order: 2; border-top: none; padding-top: 0; flex-direction: row; align-items: center; gap: 8px; }
    .dd-meid, .dd-hint, .dd-countdown, .dd-status legend { display: none; }
    .dd-status { padding: 0; }
    .dd-seg { flex-direction: row; }
    .dd-segbtn { min-height: 34px; padding: 4px 10px; font-size: 12.5px; }
    .dd-logout span { display: none; }
    .dd-logout { width: 36px; min-height: 36px; justify-content: center; padding: 0; }
    .dd-head { position: static; padding: 14px 16px; }
    .dd-content { padding: 16px 16px 40px; }
    .dd-toast { margin: 12px 16px 0; }
  }
  @media (max-width: 760px) {
    .dd-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
    .dd-statvalue { font-size: 24px; }
    .dd-tablewrap { display: none; }
    .dd-cards { display: block; }
    .dd-aside { grid-template-columns: 1fr; }
    .dd-consult { flex-direction: column; }
    .dd-consultside { align-items: flex-start; width: 100%; }
    .dd-consultside .dd-actions { width: 100%; }
    .dd-consultside .dd-actions > * { flex: 1; min-height: 42px; }
    .dd-fields { grid-template-columns: 1fr; }
    .dd-title { font-size: 19px; }
  }
  @media (max-width: 520px) {
    .dd-segbtn { padding: 4px 8px; }
    .dd-brandsub { display: none; }
    .dd-card .dd-actions > * { flex: 1; }
  }
`;
