import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import Icon from '../../components/Icons';

export default function Verdict() {
  const { id } = useParams();   // appointment id
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [diagnosis, setDiagnosis] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [notes, setNotes] = useState('');
  const [meds, setMeds] = useState([{ name: '', form: 'tablet', notes: '' }]);
  const [aiRating, setAiRating] = useState(0);
  const [aiHover, setAiHover] = useState(0);
  const [aiComment, setAiComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addMed = () => setMeds([...meds, { name: '', form: 'tablet', notes: '' }]);

  const updateMed = (i, field, value) =>
    setMeds(meds.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const removeMed = (i) => setMeds(meds.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      setError('Please enter a diagnosis.');
      return;
    }
    if (aiRating === 0) {
      setError('Please rate the AI triage accuracy before submitting.');
      return;
    }

    const patientId = localStorage.getItem('civtech_viewing_patient');
    if (!patientId) {
      setError('Patient session lost. Please go back and reopen the appointment.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await client.post('/verdict/submit', {
        doctor_id: doctor.id,
        patient_id: patientId,   // ← use the validated variable
        appointment_id: id,
        diagnosis,
        severity,
        notes,
        prescriptions: meds.filter((m) => m.name.trim()),
        ai_accuracy_rating: aiRating,
        ai_rating_comment: aiComment,
      });
      navigate('/doctor/dashboard');
    } catch (err) {
      console.error('422 details:', err.response?.data);
      setError('Could not submit verdict. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const SEVERITIES = [
    { id: 'mild', label: 'Mild' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'severe', label: 'Severe' },
  ];
  const RATING_HINT = ['', 'Very inaccurate', 'Mostly inaccurate', 'Partly accurate', 'Mostly accurate', 'Accurate'];

  const onSubmit = (e) => { e.preventDefault(); if (!loading) handleSubmit(); };

  return (
    <div className="vd">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button type="button" className="cc-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.ChevronLeft size={20} /></button>
          <div>
            <div className="header__logo">Diagnosis & prescription</div>
            <div className="header__sub">Completes the case and notifies the patient</div>
          </div>
        </div>
      </header>

      <form className="vd-wrap" onSubmit={onSubmit} noValidate>
        {error && (
          <div className="alert alert--error vd-full" role="alert">
            <Icon.Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
          </div>
        )}

        <div className="vd-col">
          <section className="card vd-card">
            <h2 className="vd-h">Clinical diagnosis</h2>
            <div className="form-group">
              <label className="label" htmlFor="vd-dx">Diagnosis <span className="vd-req" aria-hidden="true">*</span></label>
              <textarea id="vd-dx" className="input" required aria-required="true" rows={3}
                placeholder="e.g. Acute uncomplicated malaria"
                value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>

            <fieldset className="form-group vd-fs">
              <legend className="label">Severity</legend>
              <div className="vd-seg" role="radiogroup" aria-label="Severity">
                {SEVERITIES.map((s) => (
                  <label key={s.id} className={`vd-segopt vd-segopt--${s.id}${severity === s.id ? ' is-on' : ''}`}>
                    <input type="radio" name="severity" value={s.id} checked={severity === s.id} onChange={() => setSeverity(s.id)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="vd-notes">Clinical notes <span className="vd-opt">Optional</span></label>
              <textarea id="vd-notes" className="input" rows={3}
                placeholder="Findings, advice given, follow-up plan, referrals…"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>

          <section className="card vd-card">
            <div className="vd-headrow">
              <h2 className="vd-h" style={{ margin: 0 }}>Prescriptions</h2>
              <button type="button" className="btn btn--outline btn--sm" onClick={addMed}><Icon.Plus size={16} /> Add medication</button>
            </div>
            <p className="vd-help"><Icon.Info size={15} /> Write the medication name only. The patient records the dosage schedule from pharmacy guidance.</p>

            <ol className="vd-meds">
              {meds.map((med, i) => (
                <li key={i} className="vd-med">
                  <div className="vd-medhead">
                    <span className="vd-mednum">Medication {i + 1}</span>
                    {meds.length > 1 && (
                      <button type="button" className="vd-remove" onClick={() => removeMed(i)} aria-label={`Remove medication ${i + 1}`}>
                        <Icon.Trash size={16} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="vd-medgrid">
                    <div>
                      <label className="label" htmlFor={`vd-mn-${i}`}>Name</label>
                      <input id={`vd-mn-${i}`} className="input" placeholder="e.g. Artemether-lumefantrine"
                        value={med.name} onChange={(e) => updateMed(i, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`vd-mf-${i}`}>Form</label>
                      <select id={`vd-mf-${i}`} className="input" value={med.form} onChange={(e) => updateMed(i, 'form', e.target.value)}>
                        <option value="tablet">Tablet</option>
                        <option value="capsule">Capsule</option>
                        <option value="liquid">Liquid / syrup</option>
                        <option value="injection">Injection / shot</option>
                        <option value="drops">Drops</option>
                      </select>
                    </div>
                    <div className="vd-span">
                      <label className="label" htmlFor={`vd-mo-${i}`}>Notes <span className="vd-opt">Optional</span></label>
                      <input id={`vd-mo-${i}`} className="input" placeholder="e.g. Take with food"
                        value={med.notes} onChange={(e) => updateMed(i, 'notes', e.target.value)} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="vd-col vd-side">
          <section className="card vd-card">
            <h2 className="vd-h">Rate the AI triage <span className="vd-req" aria-hidden="true">*</span></h2>
            <p className="vd-help" style={{ marginTop: -6 }}>How closely did the AI's preliminary assessment match your findings? Ratings are used to improve triage.</p>

            <div className="vd-stars" role="radiogroup" aria-label="AI triage accuracy, 1 to 5 stars" onMouseLeave={() => setAiHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={aiRating === star}
                  aria-label={`${star} star${star > 1 ? 's' : ''} – ${RATING_HINT[star]}`}
                  className={`star ${star <= (aiHover || aiRating) ? 'filled' : ''}`}
                  onClick={() => setAiRating(star)}
                  onMouseEnter={() => setAiHover(star)}
                  onFocus={() => setAiHover(star)}
                  onBlur={() => setAiHover(0)}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="vd-ratinghint" aria-live="polite">{RATING_HINT[aiHover || aiRating] || 'Select a rating'}</p>

            {aiRating > 0 && (
              <div className="form-group" style={{ marginBottom: 0, marginTop: 14 }}>
                <label className="label" htmlFor="vd-aic">What did the AI get wrong? <span className="vd-opt">Optional</span></label>
                <textarea id="vd-aic" className="input" rows={3}
                  placeholder="Describe any inaccuracies in the AI assessment…"
                  value={aiComment} onChange={(e) => setAiComment(e.target.value)} />
              </div>
            )}
          </section>

          <div className="vd-submit">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? <span className="vd-spin" aria-hidden="true" /> : <Icon.CheckCircle size={18} />}
              {loading ? 'Submitting…' : 'Submit & complete case'}
            </button>
            <p>The patient receives your diagnosis and prescriptions in their CivCare app.</p>
          </div>
        </div>
      </form>

      <style>{`
        .vd { min-height: 100vh; background: var(--cc-canvas); background-attachment: fixed; }
        .vd-wrap { max-width: 1080px; margin: 0 auto; padding: 20px 20px 48px; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
        .vd-full { grid-column: 1 / -1; margin-bottom: 0; }
        .vd-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .vd-side { position: sticky; top: 76px; }
        .vd-card { margin-bottom: 0; }
        .vd-h { font-size: 15px; font-weight: 650; margin-bottom: 14px; }
        .vd-headrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .vd-req { color: var(--cc-danger); }
        .vd-opt { font-weight: 500; color: var(--cc-faint); margin-left: 4px; font-size: 12px; }
        .vd-fs { border: none; }
        .vd-seg { display: flex; gap: 4px; padding: 4px; background: var(--cc-surface-3); border-radius: 10px; }
        .vd-segopt { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; min-height: 40px; border-radius: 7px; font-size: 14px; font-weight: 600; color: var(--cc-muted); cursor: pointer; border: 1px solid transparent; }
        .vd-segopt input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
        .vd-segopt:has(input:focus-visible) { outline: 2px solid var(--cc-primary); outline-offset: 1px; }
        .vd-segopt.is-on { background: var(--cc-surface-solid); border-color: var(--cc-glass-border); box-shadow: var(--cc-clay); }
        .vd-segopt--mild.is-on { color: var(--cc-success); }
        .vd-segopt--moderate.is-on { color: var(--cc-warning); }
        .vd-segopt--severe.is-on { color: var(--cc-danger); }
        .vd-help { display: flex; gap: 6px; align-items: flex-start; font-size: 13.5px; color: var(--cc-muted); line-height: 1.5; margin-bottom: 14px; }
        .vd-help svg { flex-shrink: 0; margin-top: 2px; }
        .vd-meds { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .vd-med { border: 1px solid var(--cc-border); border-radius: 10px; padding: 12px 14px; background: var(--cc-surface-2); }
        .vd-medhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; min-height: 28px; }
        .vd-mednum { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--cc-muted); }
        .vd-remove { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; color: var(--cc-danger); font-size: 13px; font-weight: 600; padding: 4px 6px; border-radius: 6px; }
        .vd-remove:hover { background: var(--cc-danger-soft); }
        .vd-medgrid { display: grid; grid-template-columns: 1fr 180px; gap: 10px; }
        .vd-span { grid-column: 1 / -1; }
        .vd-stars { display: flex; gap: 2px; }
        .vd-stars .star { font-size: 34px; }
        .vd-ratinghint { font-size: 13.5px; color: var(--cc-muted); margin-top: 2px; min-height: 20px; }
        .vd-submit p { font-size: 13px; color: var(--cc-muted); text-align: center; margin-top: 8px; }
        .vd-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .7s linear infinite; }
        @media (max-width: 860px) {
          .vd-wrap { grid-template-columns: 1fr; padding: 16px 16px 40px; }
          .vd-side { position: static; }
        }
        @media (max-width: 480px) {
          .vd-medgrid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
