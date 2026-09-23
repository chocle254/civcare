import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

// Inject pulse keyframe animation for timer dot
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

// ── Form-aware wording so we never call an injection or syrup a "pill" ──
const FORM_META = {
  tablet:    { unit: 'tablet',   units: 'tablets',   verb: 'Take',     icon: '💊' },
  capsule:   { unit: 'capsule',  units: 'capsules',  verb: 'Take',     icon: '💊' },
  liquid:    { unit: 'dose',     units: 'doses',     verb: 'Take',     icon: '🧴' },
  injection: { unit: 'injection',units: 'injections',verb: 'Administer',icon: '💉' },
  drops:     { unit: 'dose',     units: 'doses',     verb: 'Apply',    icon: '💧' },
};
const formMeta = (form) => FORM_META[form] || FORM_META.tablet;

// Live "next dose in Xh Ym" countdown shown on each scheduled medication.
function NextDoseTimer({ nextDoseAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!nextDoseAt) return null;

  const diff = new Date(nextDoseAt).getTime() - now;
  if (diff <= 0) {
    return <span style={styles.timerDue}>Dose due now</span>;
  }
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return (
    <span style={styles.timer}>
      <span aria-hidden="true" style={styles.timerDot} />
      Next dose in {label}
    </span>
  );
}

export default function Medications() {
  const navigate = useNavigate();
  const patient = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // per-med setup form inputs, keyed by prescription id
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState({});

  // ── Carer loop state ──
  const [dose, setDose] = useState(null);
  const [step, setStep] = useState('confirm');   // confirm -> feel (feel only when ask_checkin)
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [followup, setFollowup] = useState(null);
  const pollRef = useRef(null);

  const loadCourses = useCallback(async () => {
    try {
      const res = await client.get(`/reminders/courses?patient_id=${patient.id}`);
      setCourses(res.data || []);
      // default any unscheduled meds into edit mode
      const ed = {};
      (res.data || []).forEach((c) =>
        c.meds.forEach((m) => { if (!m.reminders_active) ed[m.id] = true; })
      );
      setEditing((prev) => ({ ...ed, ...prev }));
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  const checkDue = useCallback(async () => {
    if (!patient.id) return;
    try {
      const res = await client.get(`/reminders/due?patient_id=${patient.id}`);
      if (res.data?.due) setDose((prev) => prev || res.data);
    } catch { /* silent — polling */ }
  }, [patient.id]);

  useEffect(() => {
    loadCourses();
    checkDue();
    pollRef.current = setInterval(checkDue, 20000);
    return () => clearInterval(pollRef.current);
  }, [loadCourses, checkDue]);

  const setDraft = (id, field, value) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleSetReminder = async (med) => {
    const d = drafts[med.id] || {};
    if (!d.dosageInput || !d.firstDose) return;
    setSaving(true);
    try {
      await client.post('/reminders/set', {
        prescription_id: med.id,
        dosage_notation: d.dosageInput,
        first_dose_time: d.firstDose,
        pills_dispensed: d.pillsInput ? parseInt(d.pillsInput, 10) : null,
        patient_id: patient.id,
      });
      setEditing((prev) => ({ ...prev, [med.id]: false }));
      loadCourses();
    } catch {
      alert('Could not set reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit a dose check-in ──
  const submitDose = async ({ taken, skipReason }) => {
    if (!dose) return;
    setSubmitting(true);
    try {
      const res = await client.post('/reminders/checkin', {
        prescription_id: dose.prescription_id,
        patient_id: patient.id,
        reminder_id: dose.reminder_id,
        taken,
        pills_taken: taken ? dose.units_per_dose : null,
        skip_reason: skipReason || null,
        checkin_question: dose.checkin_question,
        answer: taken && dose.ask_checkin ? answer : null,
      });
      const data = res.data || {};
      setDose(null);
      setStep('confirm');
      setAnswer('');
      loadCourses();
      if (data.offer_followup) {
        setFollowup({ message: data.message, course_outcome_id: data.course_outcome_id || null });
      }
    } catch {
      alert('Could not save your check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // When the patient confirms intake: if it's the evening check-in, go ask how
  // they feel; otherwise just log the dose and close.
  const handleTaken = () => {
    if (dose?.ask_checkin) setStep('feel');
    else submitDose({ taken: true });
  };

  const reRoute = (destination) => {
    if (followup?.course_outcome_id) {
      localStorage.setItem('civtech_followup_course', followup.course_outcome_id);
    }
    localStorage.setItem('civtech_followup_active', 'true');
    setFollowup(null);
    navigate(destination === 'hospital' ? '/hospitals' : '/consultation');
  };

  const meta = dose ? formMeta(dose.med_form) : formMeta('tablet');

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="header__logo">CivTech Care</div>
          <div className="header__sub">My Treatment Plan</div>
        </div>
      </div>

      <div className="container">
        <div style={styles.tip}>
          After visiting the pharmacy, enter how you were told to take each
          medication. We&apos;ll remind you for every dose and check in once each
          evening to see how you&apos;re doing.
        </div>

        {loading && <div className="loader"><div className="spinner" /></div>}

        {!loading && courses.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>💊</p>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>No treatment plan yet</p>
            <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>
              Your medications will appear here, grouped by diagnosis, after your
              doctor submits their verdict.
            </p>
          </div>
        )}

        {/* ── One card per diagnosis (course) ── */}
        {courses.map((course) => (
          <div key={course.verdict_id || course.diagnosis} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={styles.courseHead}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={styles.courseKicker}>Treatment for</p>
                  <p style={styles.courseTitle}>{course.diagnosis}</p>
                </div>
                <div style={styles.pct}>{course.progress}%</div>
              </div>
              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${course.progress}%` }} />
              </div>
              <p style={styles.progressMeta}>
                {course.doses_done} of {course.doses_total} doses taken across {course.meds.length}{' '}
                medication{course.meds.length > 1 ? 's' : ''}
              </p>
            </div>

            <div style={{ padding: 16 }}>
              {course.meds.map((med) => {
                const m = formMeta(med.med_form);
                const isEditing = editing[med.id];
                const d = drafts[med.id] || {};
                return (
                  <div key={med.id} style={styles.medRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={styles.medIcon} aria-hidden="true">{m.icon}</span>
                        <div>
                          <p style={{ fontWeight: 700 }}>{med.medication_name}</p>
                          <p style={{ fontSize: 12, color: 'var(--gray-400)', textTransform: 'capitalize' }}>
                            {med.med_form}{med.dosage_notation ? ` · ${med.dosage_notation}` : ''}
                          </p>
                        </div>
                      </div>
                      {med.reminders_active && (
                        <span style={styles.onBadge}>On track</span>
                      )}
                    </div>

                    {isEditing && (
                      <div style={{ marginTop: 12 }}>
                        <div className="form-group">
                          <label className="label">How were you told to take it?</label>
                          <select
                            className="input"
                            value={d.dosageInput || ''}
                            onChange={(e) => setDraft(med.id, 'dosageInput', e.target.value)}
                            style={{ appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                          >
                            <option value="">Select schedule</option>
                            <option value="1x1">1 {m.unit} once a day</option>
                            <option value="1x2">1 {m.unit} twice a day</option>
                            <option value="1x3">1 {m.unit} three times a day</option>
                            <option value="2x2">2 {m.units} twice a day</option>
                            <option value="2x3">2 {m.units} three times a day</option>
                            <option value="1x4">1 {m.unit} four times a day</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="label">How many {m.units} were you given?</label>
                          <input
                            className="input"
                            type="number"
                            min="1"
                            placeholder="e.g. 21"
                            value={d.pillsInput || ''}
                            onChange={(e) => setDraft(med.id, 'pillsInput', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="label">Time of your first dose</label>
                          <input
                            className="input"
                            type="time"
                            value={d.firstDose || ''}
                            onChange={(e) => setDraft(med.id, 'firstDose', e.target.value)}
                          />
                        </div>
                        <button
                          className="btn btn--success btn--sm"
                          onClick={() => handleSetReminder(med)}
                          disabled={saving || !d.dosageInput || !d.firstDose}
                        >
                          {saving ? 'Setting…' : 'Set Reminders'}
                        </button>
                      </div>
                    )}

                    {!isEditing && med.reminders_active && (
                      <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8 }}>
                        <NextDoseTimer nextDoseAt={med.next_dose_at} />
                        <p>Every {med.reminder_interval_hours} hours, from {med.first_dose_time}</p>
                        {med.pills_dispensed && (
                          <p>{med.pills_dispensed} {m.units} · {med.duration_days}-day course</p>
                        )}
                        {med.reminders_end_at && (
                          <p style={{ color: 'var(--blue)', fontWeight: 600 }}>
                            Finishes {new Date(med.reminders_end_at).toLocaleDateString()}
                          </p>
                        )}
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ marginTop: 8 }}
                          onClick={() => setEditing((prev) => ({ ...prev, [med.id]: true }))}
                        >
                          Edit schedule
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button className="btn btn--outline" style={{ marginTop: 8 }} onClick={() => navigate('/chat')}>
          Back to Chat
        </button>
      </div>

      {/* ── DOSE CHECK-IN POP-UP ── */}
      {dose && (
        <div style={modalStyles.overlay} role="dialog" aria-modal="true" aria-label="Medication reminder">
          <div style={modalStyles.sheet}>
            {step === 'confirm' && (
              <>
                <p style={modalStyles.kicker}>Time for your dose</p>
                <h3 style={modalStyles.title}>{meta.icon} {dose.medication_name}</h3>
                <p style={modalStyles.body}>
                  {meta.verb} <strong>{dose.units_per_dose}</strong>{' '}
                  {dose.units_per_dose > 1 ? meta.units : meta.unit} now.
                </p>
                <button
                  className="btn btn--success"
                  style={{ width: '100%' }}
                  disabled={submitting}
                  onClick={handleTaken}
                >
                  {`Done — I've taken my ${dose.units_per_dose} ${dose.units_per_dose > 1 ? meta.units : meta.unit}`}
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={submitting}
                  onClick={() => submitDose({ taken: false, skipReason: 'forgot' })}
                >
                  I can&apos;t take it right now
                </button>
              </>
            )}

            {step === 'feel' && (
              <>
                <p style={modalStyles.kicker}>Your evening check-in</p>
                <h3 style={modalStyles.title}>
                  {dose.checkin_question ||
                    "Evening — well done for staying on track today. How are you feeling tonight?"}
                </h3>
                <p style={modalStyles.body}>
                  Take your time. There&apos;s no right or wrong answer — I just want to know
                  how you&apos;re really doing tonight.
                </p>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Tell me in your own words how you feel…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  style={{
                    resize: 'none',
                    marginBottom: 12,
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    borderColor: 'var(--border-hi)',
                  }}
                />
                <button
                  className="btn btn--success"
                  style={{ width: '100%' }}
                  disabled={submitting || !answer.trim()}
                  onClick={() => submitDose({ taken: true })}
                >
                  {submitting ? 'Saving…' : 'Send'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STILL-UNWELL FOLLOW-UP MODAL ── */}
      {followup && (
        <div style={modalStyles.overlay} role="dialog" aria-modal="true" aria-label="Follow-up options">
          <div style={modalStyles.sheet}>
            <p style={modalStyles.kicker}>Let&apos;s get you reviewed</p>
            <h3 style={modalStyles.title}>{followup.message}</h3>
            <p style={modalStyles.body}>
              I&apos;ll pass your previous diagnosis, the medication you took, and what has
              and hasn&apos;t improved straight to the doctor — you won&apos;t need to start over.
            </p>
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => reRoute('hospital')}>
              Go to a nearby hospital
            </button>
            <button className="btn btn--success" style={{ width: '100%', marginTop: 8 }} onClick={() => reRoute('consultation')}>
              Talk to a doctor online
            </button>
            <button className="btn btn--ghost btn--sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setFollowup(null)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  timer: {
    fontSize: 12,
    color: 'var(--blue-600)',
    fontWeight: 500,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--blue-600)',
    animation: 'pulse 2s infinite',
  },
  timerDue: {
    fontSize: 12,
    color: 'var(--red-600)',
    fontWeight: 700,
    marginBottom: 6,
  },
  tip: {
    background: 'var(--blue-light)',
    borderRadius: 'var(--radius)',
    padding: 14,
    marginTop: 20,
    marginBottom: 20,
    fontSize: 14,
    color: 'var(--gray-600)',
  },
  courseHead: {
    background: 'var(--blue, #1d4ed8)',
    color: '#fff',
    padding: 16,
  },
  courseKicker: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  courseTitle: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  pct: { fontSize: 22, fontWeight: 800 },
  barTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 20,
    background: '#fff',
    transition: 'width 0.4s ease',
  },
  progressMeta: { fontSize: 12, marginTop: 8, opacity: 0.9 },
  medRow: { paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--gray-100, #eee)' },
  medIcon: { fontSize: 22, lineHeight: 1 },
  onBadge: {
    background: '#d4edda',
    color: 'var(--green)',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  sheet: {
    background: 'var(--surface-hi)',
    border: '1px solid var(--border-hi)',
    borderRadius: 'var(--radius-lg, 22px)',
    padding: 22,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
    animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  kicker: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'var(--accent-light)',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.4,
    marginBottom: 10,
    color: 'var(--text)',
  },
  body: {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    marginBottom: 16,
  },
};
