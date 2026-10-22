import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

const FORM_META = {
  tablet: {
    unit: 'tablet',
    units: 'tablets',
    verb: 'Take',
    icon: 'pill',
  },
  capsule: {
    unit: 'capsule',
    units: 'capsules',
    verb: 'Take',
    icon: 'capsule',
  },
  liquid: {
    unit: 'dose',
    units: 'doses',
    verb: 'Take',
    icon: 'liquid',
  },
  injection: {
    unit: 'injection',
    units: 'injections',
    verb: 'Administer',
    icon: 'injection',
  },
  drops: {
    unit: 'dose',
    units: 'doses',
    verb: 'Apply',
    icon: 'drops',
  },
};

const formMeta = (form) => FORM_META[form] || FORM_META.tablet;

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    pill: (
      <>
        <rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-45 12 12)" />
        <path d="m8.5 15.5 7-7" />
      </>
    ),
    capsule: (
      <>
        <rect x="5" y="7" width="14" height="10" rx="5" transform="rotate(-45 12 12)" />
        <path d="m8.5 15.5 7-7" />
      </>
    ),
    liquid: (
      <>
        <path d="M9 3h6" />
        <path d="M10 3v5l-4.5 8.2A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.6-4.8L14 8V3" />
        <path d="M8 16h8" />
      </>
    ),
    injection: (
      <>
        <path d="m14 4 6 6" />
        <path d="m13 5-8 8 6 6 8-8" />
        <path d="m8 10 6 6" />
        <path d="M5 18 3 21" />
        <path d="m18 3 3 3" />
      </>
    ),
    drops: (
      <>
        <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />
        <path d="M9.5 16a2.8 2.8 0 0 0 2.5 1.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h13" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    hospital: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
        <path d="M9 21v-5h6v5M10 8h4M12 6v4" />
      </>
    ),
    doctor: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21a7 7 0 0 1 14 0" />
        <path d="M17 11h4M19 9v4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.3 8.4-8 10-4.7-1.6-8-5-8-10V6Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    back: (
      <>
        <path d="m15 18-6-6 6-6" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

// Always counts down to the next dose. A passed dose that hasn't been logged
// shows as a separate "due now" chip; it never replaces the countdown.
function NextDoseTimer({ nextDoseAt, dueAt, onElapsed, onLogDue }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = nextDoseAt ? new Date(nextDoseAt).getTime() : null;
  const diff = target ? target - now : null;

  // When the countdown reaches zero, refresh once to get the dose after it.
  useEffect(() => {
    if (diff !== null && diff <= 0 && fired.current !== nextDoseAt) {
      fired.current = nextDoseAt;
      onElapsed?.();
    }
  }, [diff, nextDoseAt, onElapsed]);

  const dueChip = (dueAt || (diff !== null && diff <= 0)) ? (
    <button type="button" className="meds-timer meds-timer--due meds-due-chip" onClick={onLogDue}>
      <span className="meds-live-dot" />
      Dose due now · log it
    </button>
  ) : null;

  if (diff === null || diff <= 0) return dueChip;

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  const label = h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;

  return (
    <span className="meds-timer-stack">
      <span className="meds-timer">
        <span className="meds-live-dot" />
        Next dose in {label}
      </span>
      {dueChip}
    </span>
  );
}

export default function Medications() {
  const navigate = useNavigate();
  const patient = JSON.parse(
    localStorage.getItem('civtech_patient') || '{}'
  );

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState({});

  const [dose, setDose] = useState(null);
  const [step, setStep] = useState('confirm');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [followup, setFollowup] = useState(null);
  const pollRef = useRef(null);

  const loadCourses = useCallback(async () => {
    try {
      const res = await client.get(
        `/reminders/courses?patient_id=${patient.id}`
      );

      setCourses(res.data || []);

      const ed = {};
      (res.data || []).forEach((course) =>
        course.meds.forEach((med) => {
          if (!med.reminders_active) ed[med.id] = true;
        })
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
      const res = await client.get(
        `/reminders/due?patient_id=${patient.id}`
      );

      if (res.data?.due) {
        setDose((prev) => prev || res.data);
      }
    } catch {
      // Silent polling failure.
    }
  }, [patient.id]);

  useEffect(() => {
    loadCourses();
    checkDue();

    pollRef.current = setInterval(checkDue, 20000);

    return () => clearInterval(pollRef.current);
  }, [loadCourses, checkDue]);

  const setDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSetReminder = async (med) => {
    const d = drafts[med.id] || {};

    if (!d.dosageInput || !d.firstDose) return;

    setSaving(true);

    try {
      await client.post('/reminders/set', {
        prescription_id: med.id,
        dosage_notation: d.dosageInput,
        first_dose_time: d.firstDose,
        pills_dispensed: d.pillsInput
          ? parseInt(d.pillsInput, 10)
          : null,
        patient_id: patient.id,
        // The time is the patient's local clock time; the server needs the offset to schedule in UTC.
        tz_offset_minutes: new Date().getTimezoneOffset(),
      });

      setEditing((prev) => ({
        ...prev,
        [med.id]: false,
      }));

      loadCourses();
    } catch {
      alert('Could not set reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
        answer:
          taken && dose.ask_checkin
            ? answer
            : null,
      });

      const data = res.data || {};

      setDose(null);
      setStep('confirm');
      setAnswer('');

      loadCourses();

      if (data.offer_followup) {
        setFollowup({
          message: data.message,
          course_outcome_id:
            data.course_outcome_id || null,
        });
      }
    } catch {
      alert('Could not save your check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaken = () => {
    if (dose?.ask_checkin) {
      setStep('feel');
    } else {
      submitDose({ taken: true });
    }
  };

  const reRoute = (destination) => {
    if (followup?.course_outcome_id) {
      localStorage.setItem(
        'civtech_followup_course',
        followup.course_outcome_id
      );
    }

    localStorage.setItem('civtech_followup_active', 'true');
    setFollowup(null);

    navigate(
      destination === 'hospital'
        ? '/hospitals'
        : '/consultation'
    );
  };

  const meta = dose
    ? formMeta(dose.med_form)
    : formMeta('tablet');

  const allMeds = courses.flatMap((course) => course.meds || []);
  const activeMeds = allMeds.filter((med) => med.reminders_active);
  const totalDoses = courses.reduce(
    (sum, course) => sum + (course.doses_total || 0),
    0
  );
  const completedDoses = courses.reduce(
    (sum, course) => sum + (course.doses_done || 0),
    0
  );

  const nextDose = activeMeds
    .filter((med) => med.next_dose_at)
    .sort(
      (a, b) =>
        new Date(a.next_dose_at) -
        new Date(b.next_dose_at)
    )[0];
  const dueMed = activeMeds.find((med) => med.due_dose_at);
  const refreshDoses = () => { loadCourses(); checkDue(); };

  const overallProgress =
    totalDoses > 0
      ? Math.round((completedDoses / totalDoses) * 100)
      : 0;

  return (
    <div className="meds-page">
      <style>{`
        @keyframes medsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(.82); }
        }

        @keyframes medsSlideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .meds-page {
          min-height: 100vh;
          background: var(--cc-canvas); background-attachment: fixed;
          color: var(--meds-text, #162033);
          padding-bottom: 110px;
        }

        .meds-shell {
          width: min(1080px, calc(100% - 32px));
          margin: 0 auto;
        }

        .meds-topbar {
          padding: 24px 0 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .meds-brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .meds-brand-mark {
          width: 40px;
          height: 40px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          color: white;
          background: #1769aa;
          box-shadow: 0 8px 20px rgba(23, 105, 224, .2);
        }

        .meds-brand-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.2px;
        }

        .meds-brand-sub {
          font-size: 11px;
          color: var(--meds-muted, #718096);
          margin-top: 2px;
        }

        .meds-back {
          border: 0;
          background: var(--meds-surface, white);
          color: var(--meds-muted, #65748b);
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          cursor: pointer;
          border: 1px solid var(--meds-border, #e5e9f0);
        }

        .meds-hero {
          padding: 25px 0 22px;
        }

        .meds-eyebrow {
          margin: 0 0 7px;
          color: #1769e0;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .9px;
        }

        .meds-title {
          margin: 0;
          font-size: clamp(27px, 5vw, 39px);
          line-height: 1.08;
          letter-spacing: -.9px;
          font-weight: 800;
        }

        .meds-description {
          max-width: 650px;
          margin: 11px 0 0;
          color: var(--meds-muted, #68778d);
          font-size: 14px;
          line-height: 1.6;
        }

        .meds-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 6px 0 25px;
        }

        .meds-stat {
          background: var(--meds-surface, white);
          border: 1px solid var(--meds-border, #e5e9f0);
          border-radius: 17px;
          padding: 16px;
          min-width: 0;
        }

        .meds-stat-label {
          font-size: 11px;
          color: var(--meds-muted, #748196);
          font-weight: 700;
          margin-bottom: 7px;
        }

        .meds-stat-value {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -.3px;
        }

        .meds-stat-meta {
          margin-top: 4px;
          font-size: 11px;
          color: var(--meds-muted, #748196);
        }

        .meds-section-title {
          font-size: 17px;
          margin: 0;
          font-weight: 800;
          letter-spacing: -.2px;
        }

        .meds-section-sub {
          margin: 5px 0 15px;
          font-size: 12px;
          color: var(--meds-muted, #748196);
        }

        .meds-course {
          background: var(--meds-surface, white);
          border: 1px solid var(--meds-border, #e5e9f0);
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 15px;
          box-shadow: 0 5px 18px rgba(25, 42, 70, .035);
        }

        .meds-course-head {
          padding: 19px 20px 17px;
          border-bottom: 1px solid var(--meds-border, #e5e9f0);
        }

        .meds-course-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .meds-course-kicker {
          margin: 0 0 5px;
          font-size: 10px;
          color: #738198;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .8px;
        }

        .meds-course-title {
          margin: 0;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 800;
        }

        .meds-progress-number {
          font-size: 18px;
          font-weight: 800;
          color: #1769e0;
          white-space: nowrap;
        }

        .meds-progress-track {
          height: 7px;
          background: #e9edf3;
          border-radius: 20px;
          overflow: hidden;
          margin-top: 15px;
        }

        .meds-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1769e0, #1b9f8a);
          border-radius: inherit;
          transition: width .4s ease;
        }

        .meds-progress-meta {
          margin: 8px 0 0;
          font-size: 11px;
          color: var(--meds-muted, #748196);
        }

        .meds-list {
          padding: 4px 20px;
        }

        .med-row {
          padding: 17px 0;
          border-bottom: 1px solid var(--meds-border, #edf0f4);
        }

        .med-row:last-child {
          border-bottom: 0;
        }

        .med-main {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .med-identity {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .med-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: #edf5ff;
          color: #1769e0;
        }

        .med-name {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .med-meta {
          margin: 4px 0 0;
          font-size: 11px;
          color: var(--meds-muted, #748196);
          text-transform: capitalize;
        }

        .med-status {
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          background: #e8f7f1;
          color: #168463;
        }

        .med-schedule {
          margin: 12px 0 0 54px;
          padding: 12px;
          background: var(--meds-soft, #f7f9fc);
          border-radius: 13px;
        }

        .med-next {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
        }

        .med-detail {
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.6;
          color: var(--meds-muted, #748196);
        }

        .med-edit {
          margin-top: 9px;
          border: 0;
          padding: 0;
          background: none;
          color: #1769e0;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .med-form {
          margin: 14px 0 0 54px;
          padding: 15px;
          background: var(--meds-soft, #f7f9fc);
          border: 1px solid var(--meds-border, #e5e9f0);
          border-radius: 14px;
        }

        .med-field {
          margin-bottom: 12px;
        }

        .med-field:last-of-type {
          margin-bottom: 14px;
        }

        .med-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--meds-muted, #64748b);
        }

        .med-input {
          width: 100%;
          box-sizing: border-box;
          min-height: 43px;
          border: 1px solid var(--meds-border, #dce2ea);
          border-radius: 10px;
          background: var(--meds-surface, white);
          color: var(--meds-text, #162033);
          padding: 0 12px;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .med-input:focus {
          border-color: #1769e0;
          box-shadow: 0 0 0 3px rgba(23, 105, 224, .1);
        }

        .med-button {
          min-height: 42px;
          border: 0;
          border-radius: 11px;
          padding: 0 15px;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .med-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .med-button--primary {
          background: #1769e0;
          color: white;
        }

        .med-button--success {
          background: #168b70;
          color: white;
        }

        .med-button--secondary {
          background: var(--meds-soft, #f4f6f9);
          color: var(--meds-text, #26344a);
          border: 1px solid var(--meds-border, #e1e6ed);
        }

        .med-button--full {
          width: 100%;
        }

        .med-empty {
          background: var(--meds-surface, white);
          border: 1px dashed var(--meds-border, #dbe1e9);
          border-radius: 20px;
          padding: 40px 22px;
          text-align: center;
        }

        .med-empty-icon {
          width: 54px;
          height: 54px;
          margin: 0 auto 13px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          color: #1769e0;
          background: #edf5ff;
        }

        .med-empty h3 {
          margin: 0 0 7px;
          font-size: 16px;
        }

        .med-empty p {
          max-width: 390px;
          margin: 0 auto;
          color: var(--meds-muted, #748196);
          font-size: 12px;
          line-height: 1.6;
        }

        .med-tip {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          background: #edf7f8;
          border: 1px solid #d7ecee;
          color: #355f66;
          border-radius: 15px;
          padding: 13px 14px;
          margin-bottom: 22px;
          font-size: 12px;
          line-height: 1.55;
        }

        .med-tip-icon {
          flex: 0 0 auto;
          margin-top: 1px;
          color: #168b8c;
        }

        .med-bottom-action {
          margin-top: 22px;
          text-align: center;
        }

        .meds-timer {
          color: #1769e0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
        }

        .meds-timer--due {
          color: #c44949;
        }

        .meds-timer-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .meds-due-chip {
          padding: 0;
          border: 0;
          background: transparent;
          font-family: inherit;
          cursor: pointer;
        }

        .meds-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: medsPulse 2s infinite;
        }

        .med-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(10, 19, 34, .58);
          backdrop-filter: blur(7px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 14px;
        }

        .med-modal {
          width: min(470px, 100%);
          background: var(--meds-surface, white);
          color: var(--meds-text, #162033);
          border: 1px solid var(--meds-border, #e5e9f0);
          border-radius: 23px;
          padding: 22px;
          box-shadow: 0 -15px 60px rgba(0, 0, 0, .18);
          animation: medsSlideUp .25s ease;
        }

        .med-modal-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .med-modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #edf5ff;
          color: #1769e0;
          margin-bottom: 15px;
        }

        .med-modal-kicker {
          margin: 0 0 6px;
          color: #1769e0;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .8px;
        }

        .med-modal-title {
          margin: 0;
          font-size: 20px;
          line-height: 1.3;
          font-weight: 800;
        }

        .med-modal-close {
          width: 34px;
          height: 34px;
          border: 1px solid var(--meds-border, #e5e9f0);
          border-radius: 10px;
          background: var(--meds-soft, #f7f9fc);
          color: var(--meds-muted, #748196);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .med-modal-body {
          margin: 9px 0 18px;
          color: var(--meds-muted, #68778d);
          font-size: 13px;
          line-height: 1.6;
        }

        .med-checkin-box {
          margin: 0 0 15px;
          padding: 13px;
          border-radius: 13px;
          background: var(--meds-soft, #f7f9fc);
          font-size: 12px;
          color: var(--meds-muted, #68778d);
          line-height: 1.5;
        }

        .med-textarea {
          width: 100%;
          box-sizing: border-box;
          resize: none;
          min-height: 110px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--meds-border, #dce2ea);
          background: var(--meds-soft, #f7f9fc);
          color: var(--meds-text, #162033);
          font: inherit;
          font-size: 13px;
          outline: none;
          margin-bottom: 12px;
        }

        .med-textarea:focus {
          border-color: #1769e0;
          box-shadow: 0 0 0 3px rgba(23, 105, 224, .1);
        }

        .med-followup-icon {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          background: #fff5e8;
          color: #bd7218;
          display: grid;
          place-items: center;
          margin-bottom: 15px;
        }

        .med-followup-note {
          padding: 12px;
          border-radius: 12px;
          background: var(--meds-soft, #f7f9fc);
          color: var(--meds-muted, #68778d);
          font-size: 12px;
          line-height: 1.55;
          margin-bottom: 15px;
        }

        @media (max-width: 620px) {
          .meds-shell {
            width: min(100% - 24px, 1080px);
          }

          .meds-topbar {
            padding-top: 16px;
          }

          .meds-summary {
            grid-template-columns: 1fr 1fr;
          }

          .meds-summary .meds-stat:last-child {
            grid-column: 1 / -1;
          }

          .med-main {
            gap: 8px;
          }

          .med-status {
            font-size: 9px;
            padding: 4px 7px;
          }

          .med-schedule,
          .med-form {
            margin-left: 0;
          }

          .med-course-head,
          .meds-list {
            padding-left: 15px;
            padding-right: 15px;
          }
        }

        @media (prefers-color-scheme: dark) {
          .meds-page {
            --meds-bg: #0b1220;
            --meds-surface: #111b2b;
            --meds-soft: #172235;
            --meds-text: #eef4fb;
            --meds-muted: #91a0b5;
            --meds-border: #223047;
          }

          .meds-progress-track {
            background: #202d42;
          }

          .med-icon,
          .med-empty-icon,
          .med-modal-icon {
            background: #142b4b;
          }

          .med-tip {
            background: #10292d;
            border-color: #1d4146;
            color: #a9cdd0;
          }
        }
      `}</style>

      <div className="meds-shell">
        <header className="meds-topbar">
          <div className="meds-brand">
            <div className="meds-brand-mark">
              <Icon name="shield" size={21} />
            </div>

            <div>
              <div className="meds-brand-name">CivCare</div>
              <div className="meds-brand-sub">
                Medication & treatment
              </div>
            </div>
          </div>

          <button
            className="meds-back"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
          >
            <Icon name="back" size={20} />
          </button>
        </header>

        <main>
          <section className="meds-hero">
            <p className="meds-eyebrow">Your treatment plan</p>
            <h1 className="meds-title">
              Medications &amp; treatment
            </h1>
            <p className="meds-description">
              Keep track of your prescribed treatment, upcoming
              doses, and progress. CivCare will remind you when it is
              time for your next dose.
            </p>
          </section>

          {!loading && courses.length > 0 && (
            <section className="meds-summary">
              <div className="meds-stat">
                <div className="meds-stat-label">Treatment progress</div>
                <div className="meds-stat-value">
                  {overallProgress}%
                </div>
                <div className="meds-stat-meta">
                  {completedDoses} of {totalDoses} doses
                </div>
              </div>

              <div className="meds-stat">
                <div className="meds-stat-label">
                  Active medications
                </div>
                <div className="meds-stat-value">
                  {activeMeds.length}
                </div>
                <div className="meds-stat-meta">
                  currently being tracked
                </div>
              </div>

              <div className="meds-stat">
                <div className="meds-stat-label">Next dose</div>
                <div className="meds-stat-value">
                  {nextDose || dueMed ? (
                    <NextDoseTimer
                      nextDoseAt={nextDose?.next_dose_at}
                      dueAt={dueMed?.due_dose_at}
                      onElapsed={refreshDoses}
                      onLogDue={checkDue}
                    />
                  ) : (
                    '—'
                  )}
                </div>
                <div className="meds-stat-meta">
                  {nextDose?.medication_name || 'No scheduled dose'}
                </div>
              </div>
            </section>
          )}

          <div className="med-tip">
            <div className="med-tip-icon">
              <Icon name="clock" size={17} />
            </div>
            <div>
              After visiting the pharmacy, enter how you were told
              to take each medication. CivCare will remind you for
              every dose and check in once each evening to see how
              you are doing.
            </div>
          </div>

          {loading && (
            <div className="med-empty">
              <div className="med-empty-icon">
                <Icon name="pill" size={23} />
              </div>
              <h3>Loading your treatment plan</h3>
              <p>
                Getting your latest prescriptions and medication
                schedules.
              </p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="med-empty">
              <div className="med-empty-icon">
                <Icon name="pill" size={23} />
              </div>
              <h3>No treatment plan yet</h3>
              <p>
                Your medications will appear here, grouped by
                diagnosis, after your doctor submits their verdict.
              </p>
            </div>
          )}

          {!loading && courses.length > 0 && (
            <>
              <section>
                <h2 className="meds-section-title">
                  Active treatment
                </h2>
                <p className="meds-section-sub">
                  Your medications are grouped by the condition they
                  were prescribed for.
                </p>

                {courses.map((course) => (
                  <article
                    key={
                      course.verdict_id ||
                      course.diagnosis
                    }
                    className="meds-course"
                  >
                    <div className="meds-course-head">
                      <div className="meds-course-title-row">
                        <div>
                          <p className="meds-course-kicker">
                            Treatment for
                          </p>
                          <h3 className="meds-course-title">
                            {course.diagnosis}
                          </h3>
                        </div>

                        <div className="meds-progress-number">
                          {course.progress}%
                        </div>
                      </div>

                      <div className="meds-progress-track">
                        <div
                          className="meds-progress-fill"
                          style={{
                            width: `${course.progress}%`,
                          }}
                        />
                      </div>

                      <p className="meds-progress-meta">
                        {course.doses_done} of{' '}
                        {course.doses_total} doses taken across{' '}
                        {course.meds.length}{' '}
                        medication
                        {course.meds.length > 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="meds-list">
                      {course.meds.map((med) => {
                        const m = formMeta(med.med_form);
                        const isEditing = editing[med.id];
                        const d = drafts[med.id] || {};

                        return (
                          <div
                            key={med.id}
                            className="med-row"
                          >
                            <div className="med-main">
                              <div className="med-identity">
                                <div className="med-icon">
                                  <Icon
                                    name={m.icon}
                                    size={20}
                                  />
                                </div>

                                <div>
                                  <p className="med-name">
                                    {med.medication_name}
                                  </p>

                                  <p className="med-meta">
                                    {med.med_form}
                                    {med.dosage_notation
                                      ? ` · ${med.dosage_notation}`
                                      : ''}
                                  </p>
                                </div>
                              </div>

                              {med.reminders_active && (
                                <span className="med-status">
                                  On track
                                </span>
                              )}
                            </div>

                            {isEditing && (
                              <div className="med-form">
                                <div className="med-field">
                                  <label>
                                    How were you told to take it?
                                  </label>

                                  <select
                                    className="med-input"
                                    value={
                                      d.dosageInput || ''
                                    }
                                    onChange={(e) =>
                                      setDraft(
                                        med.id,
                                        'dosageInput',
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="">
                                      Select schedule
                                    </option>
                                    <option value="1x1">
                                      1 {m.unit} once a day
                                    </option>
                                    <option value="1x2">
                                      1 {m.unit} twice a day
                                    </option>
                                    <option value="1x3">
                                      1 {m.unit} three times a day
                                    </option>
                                    <option value="2x2">
                                      2 {m.units} twice a day
                                    </option>
                                    <option value="2x3">
                                      2 {m.units} three times a day
                                    </option>
                                    <option value="1x4">
                                      1 {m.unit} four times a day
                                    </option>
                                  </select>
                                </div>

                                <div className="med-field">
                                  <label>
                                    How many {m.units} were you given?
                                  </label>

                                  <input
                                    className="med-input"
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 21"
                                    value={
                                      d.pillsInput || ''
                                    }
                                    onChange={(e) =>
                                      setDraft(
                                        med.id,
                                        'pillsInput',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div className="med-field">
                                  <label>
                                    Time of your first dose
                                  </label>

                                  <input
                                    className="med-input"
                                    type="time"
                                    value={
                                      d.firstDose || ''
                                    }
                                    onChange={(e) =>
                                      setDraft(
                                        med.id,
                                        'firstDose',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>

                                <button
                                  className="med-button med-button--success"
                                  onClick={() =>
                                    handleSetReminder(med)
                                  }
                                  disabled={
                                    saving ||
                                    !d.dosageInput ||
                                    !d.firstDose
                                  }
                                >
                                  <Icon
                                    name="check"
                                    size={15}
                                  />
                                  {saving
                                    ? 'Setting…'
                                    : 'Set reminders'}
                                </button>
                              </div>
                            )}

                            {!isEditing &&
                              med.reminders_active && (
                                <div className="med-schedule">
                                  <div className="med-next">
                                    <NextDoseTimer
                                      nextDoseAt={med.next_dose_at}
                                      dueAt={med.due_dose_at}
                                      onElapsed={refreshDoses}
                                      onLogDue={checkDue}
                                    />
                                  </div>

                                  <div className="med-detail">
                                    Every{' '}
                                    {
                                      med.reminder_interval_hours
                                    }{' '}
                                    hours, from{' '}
                                    {med.first_dose_time}
                                    {med.pills_dispensed
                                      ? ` · ${med.pills_dispensed} ${m.units}`
                                      : ''}
                                    {med.duration_days
                                      ? ` · ${med.duration_days}-day course`
                                      : ''}
                                  </div>

                                  {med.reminders_end_at && (
                                    <div
                                      className="med-detail"
                                      style={{
                                        color: '#1769e0',
                                        fontWeight: 700,
                                      }}
                                    >
                                      Finishes{' '}
                                      {new Date(
                                        med.reminders_end_at
                                      ).toLocaleDateString(
                                        'en-KE'
                                      )}
                                    </div>
                                  )}

                                  <button
                                    className="med-edit"
                                    onClick={() =>
                                      setEditing(
                                        (prev) => ({
                                          ...prev,
                                          [med.id]: true,
                                        })
                                      )
                                    }
                                  >
                                    <Icon
                                      name="edit"
                                      size={13}
                                    />
                                    Edit schedule
                                  </button>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}

          <div className="med-bottom-action">
            <button
              className="med-button med-button--secondary"
              onClick={() => navigate('/chat')}
            >
              <Icon name="arrow" size={15} />
              Back to AI Assistant
            </button>
          </div>
        </main>
      </div>

      {dose && (
        <div
          className="med-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Medication reminder"
        >
          <div className="med-modal">
            {step === 'confirm' && (
              <>
                <div className="med-modal-top">
                  <div>
                    <div className="med-modal-icon">
                      <Icon name={meta.icon} size={23} />
                    </div>

                    <p className="med-modal-kicker">
                      Time for your dose
                    </p>

                    <h3 className="med-modal-title">
                      {dose.medication_name}
                    </h3>
                  </div>

                  <button
                    className="med-modal-close"
                    onClick={() => setDose(null)}
                    aria-label="Close reminder"
                    disabled={submitting}
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>

                <p className="med-modal-body">
                  {meta.verb}{' '}
                  <strong>{dose.units_per_dose}</strong>{' '}
                  {dose.units_per_dose > 1
                    ? meta.units
                    : meta.unit}{' '}
                  now.
                </p>

                <button
                  className="med-button med-button--success med-button--full"
                  disabled={submitting}
                  onClick={handleTaken}
                >
                  <Icon name="check" size={17} />
                  I've taken my dose
                </button>

                <button
                  className="med-button med-button--secondary med-button--full"
                  style={{ marginTop: 9 }}
                  disabled={submitting}
                  onClick={() =>
                    submitDose({
                      taken: false,
                      skipReason: 'forgot',
                    })
                  }
                >
                  I can't take it right now
                </button>
              </>
            )}

            {step === 'feel' && (
              <>
                <div className="med-modal-icon">
                  <Icon name="shield" size={23} />
                </div>

                <p className="med-modal-kicker">
                  Evening check-in
                </p>

                <h3 className="med-modal-title">
                  {dose.checkin_question ||
                    'Evening — well done for staying on track today. How are you feeling tonight?'}
                </h3>

                <p className="med-modal-body">
                  Take your time. There is no right or wrong
                  answer. This helps keep your treatment follow-up
                  connected to how you are actually doing.
                </p>

                <textarea
                  className="med-textarea"
                  placeholder="Tell me in your own words how you feel…"
                  value={answer}
                  onChange={(e) =>
                    setAnswer(e.target.value)
                  }
                />

                <button
                  className="med-button med-button--success med-button--full"
                  disabled={
                    submitting || !answer.trim()
                  }
                  onClick={() =>
                    submitDose({ taken: true })
                  }
                >
                  {submitting ? 'Saving…' : 'Send check-in'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {followup && (
        <div
          className="med-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Follow-up options"
        >
          <div className="med-modal">
            <div className="med-followup-icon">
              <Icon name="doctor" size={23} />
            </div>

            <p className="med-modal-kicker">
              Let's get you reviewed
            </p>

            <h3 className="med-modal-title">
              {followup.message}
            </h3>

            <p className="med-modal-body">
              Your previous diagnosis, medication history, and
              treatment progress can be passed to the next care
              step so you do not have to start over.
            </p>

            <div className="med-followup-note">
              Choose the option that works best for you.
            </div>

            <button
              className="med-button med-button--primary med-button--full"
              onClick={() => reRoute('hospital')}
            >
              <Icon name="hospital" size={16} />
              Go to a nearby hospital
            </button>

            <button
              className="med-button med-button--success med-button--full"
              style={{ marginTop: 9 }}
              onClick={() => reRoute('consultation')}
            >
              <Icon name="doctor" size={16} />
              Talk to a doctor online
            </button>

            <button
              className="med-button med-button--secondary med-button--full"
              style={{ marginTop: 9 }}
              onClick={() => setFollowup(null)}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
