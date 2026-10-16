import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateDoctorStatus } from '../../api/doctors';
import { callPatient } from '../../api/triage';
import client from '../../api/client';
import Icon from '../../components/Icons';

export default function PatientProfile() {
  const { id } = useParams();   // appointment id
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);
  // Referral controls (guardrail UI): the AI routes the case to whichever doctor
  // is available — not necessarily the matching specialty. If the assigned doctor
  // isn't the right fit, they can hand the case off here.
  const [referMenu, setReferMenu] = useState(null); // 'specialist' | 'hospital' | null
  const [error, setError] = useState('');

  const SPECIALTIES = [
    'Cardiologist', 'Dermatologist', 'Pediatrician', 'Gynecologist',
    'Neurologist', 'Orthopedic Surgeon', 'Psychiatrist', 'ENT Specialist',
    'Ophthalmologist', 'General Surgeon',
  ];
  const REFERRAL_HOSPITALS = [
    'Kenyatta National Hospital', 'Aga Khan University Hospital',
    'Nairobi Hospital', 'Moi Teaching & Referral Hospital',
    'Coast General Hospital', 'Mater Misericordiae Hospital',
  ];

  // Call the patient straight from the case file — no need to go back to the queue.
  const handleCall = async () => {
    setCalling(true);
    setError('');
    try {
      await callPatient({ appointment_id: id, doctor_id: doctor.id });
      setCalled(true);
    } catch {
      setError('Could not notify the patient. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/triage/appointment/${id}?doctor_id=${doctor.id}`);
        setProfile(res.data);
        // Doctor opened profile — auto switch to with_patient
        await updateDoctorStatus({ doctor_id: doctor.id, status: 'with_patient' });
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, doctor.id]);

  if (loading) return (
    <div className="pp">
      <Bar onBack={() => navigate('/doctor/dashboard')} />
      <div className="pp-wrap">
        <div className="cc-skeleton" style={{ height: 88, marginBottom: 12 }} />
        <div className="pp-grid">
          <div className="cc-skeleton" style={{ height: 320 }} />
          <div className="cc-skeleton" style={{ height: 240 }} />
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  if (!profile) return (
    <div className="pp">
      <Bar onBack={() => navigate('/doctor/dashboard')} />
      <div className="pp-wrap">
        <div className="pp-empty">
          <span className="pp-emptyicon"><Icon.Alert size={24} /></span>
          <h2>Patient profile not found</h2>
          <p>This appointment may have been reassigned or closed.</p>
          <button type="button" className="btn btn--primary" style={{ width: 'auto' }} onClick={() => navigate('/doctor/dashboard')}>Back to queue</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  const risk = profile.risk_score || 'moderate';
  const RISK_LABEL = { critical: 'Critical', moderate: 'Moderate', low: 'Low' };
  const badgeCls = { critical: 'badge--critical', moderate: 'badge--moderate', low: 'badge--low' };
  const messages = profile.conversation || [];
  const patientSnippets = messages.filter((m) => {
    if (m.role !== 'patient') return false;
    const c = m.content.toLowerCase().trim();
    const skipWords = ['yes', 'no', 'yeah', 'nope', 'okay', 'ok', 'now', 'yes i can'];
    return !skipWords.includes(c) && c.length > 3;
  });
  const transcript = messages.filter((msg) => msg.role !== 'action' && msg.role !== 'system');

  const goToVerdict = () => {
    const pid = profile.patient_id;
    if (!pid) {
      setError('Cannot proceed: patient ID is missing from this profile. Please contact support.');
      return;
    }
    localStorage.setItem('civtech_viewing_patient', pid);
    navigate(`/doctor/verdict/${id}`);
  };

  const callBtn = (cls) => (
    <button type="button" className={`pp-btn ${called ? 'pp-btn--done' : 'pp-btn--secondary'} ${cls || ''}`} disabled={calling || called} onClick={handleCall}>
      {called ? <Icon.Check size={17} /> : <Icon.Bell size={17} />}
      {calling ? 'Calling…' : called ? 'Patient called' : 'Call patient in'}
    </button>
  );

  return (
    <div className="pp">
      <Bar onBack={() => navigate('/doctor/dashboard')}>{callBtn('pp-hide-sm')}</Bar>

      <div className="pp-wrap">
        {/* Identity strip */}
        <section className="pp-id" aria-label="Patient identity">
          <div className="pp-idmain">
            <h1>{profile.patient_name}</h1>
            <span className={`badge ${badgeCls[risk] || badgeCls.moderate}`}>{RISK_LABEL[risk] || 'Moderate'} priority</span>
          </div>
          <dl className="pp-iddl">
            {[
              ['Age', profile.patient_age || '—'],
              ['Phone', profile.patient_phone],
              ['Location', profile.patient_location || '—'],
              [profile.identity_type || 'ID', profile.identity_number || '—'],
            ].map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>

        {error && (
          <div className="alert alert--error" role="alert">
            <Icon.Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
          </div>
        )}

        {profile.allergy_flags && (
          <div className="pp-flag" role="note">
            <Icon.Alert size={20} />
            <div>
              <strong>AI allergy / medication alert</strong>
              <p>{profile.allergy_flags}</p>
            </div>
          </div>
        )}

        <div className="pp-grid">
          {/* LEFT — complaint & triage */}
          <div className="pp-col">
            <section className="pp-card">
              <h2 className="pp-h">Current complaint & AI triage</h2>

              <div className="pp-ai">
                <span className="pp-ailabel"><Icon.Sparkle size={14} /> AI preliminary assessment</span>
                {profile.ai_assessment
                  ? <p>{profile.ai_assessment}</p>
                  : <p className="pp-muted">Not available. An assessment is generated when the patient completes a new triage session.</p>}
              </div>

              <div className="pp-metrics">
                <div><span>Triage score</span><strong>{profile.risk_numeric ?? '—'}<small>/100</small></strong></div>
                <div><span>AI confidence</span><strong>{profile.ai_confidence ?? '—'}<small>%</small></strong></div>
              </div>

              {profile.possible_diagnosis && (
                <div className="pp-dx">
                  <span>AI possible diagnosis</span>
                  <strong>{profile.possible_diagnosis}</strong>
                  {profile.diagnosis_reasoning && <p>{profile.diagnosis_reasoning}</p>}
                </div>
              )}
              <p className="pp-disclaimer">AI output supports, and does not replace, your clinical judgement.</p>

              {(profile.symptom_summary || patientSnippets.length > 0) && (
                <div className="pp-sub">
                  <h3>Patient-reported symptoms</h3>
                  {profile.symptom_summary ? (
                    <p className="pp-prose">{profile.symptom_summary}</p>
                  ) : (
                    <ul className="pp-tags">
                      {patientSnippets.map((m, i) => (
                        <li key={i}>{m.content.length > 40 ? m.content.slice(0, 40) + '…' : m.content}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {transcript.length > 0 && (
                <details className="pp-details">
                  <summary>View full AI conversation <span className="pp-muted">({transcript.length} messages)</span></summary>
                  <div className="pp-chat">
                    {transcript.map((msg, i) => (
                      <div key={i} className={`pp-msg${msg.role === 'patient' ? ' is-patient' : ''}`}>
                        <span className="cc-visually-hidden">{msg.role === 'patient' ? 'Patient: ' : 'Assistant: '}</span>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          </div>

          {/* RIGHT — history & referral */}
          <div className="pp-col">
            <section className="pp-card">
              <h2 className="pp-h">Medical history</h2>
              <dl className="pp-hist">
                <div>
                  <dt>Known allergies</dt>
                  <dd className={profile.allergies ? 'pp-allergy' : ''}>
                    {profile.allergies ? <><Icon.Alert size={15} /> {profile.allergies}</> : 'None on record'}
                  </dd>
                </div>
                <div>
                  <dt>Known conditions</dt>
                  <dd>{profile.conditions || 'None on record'}</dd>
                </div>
                <div>
                  <dt>Current medications</dt>
                  <dd>
                    {profile.current_medications?.length > 0 ? (
                      <ul className="pp-tags pp-tags--meds">
                        {profile.current_medications.map((med, i) => <li key={i}>{med}</li>)}
                      </ul>
                    ) : 'None on record'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="pp-card">
              <h2 className="pp-h">Not the right fit?</h2>
              <p className="pp-muted pp-small">
                CivCare routes each case to the next available doctor; it never chooses the specialty.
                If this patient needs different expertise, choose a referral below.
              </p>
              <div className="pp-refer" role="group" aria-label="Referral type">
                <button type="button" className={`pp-btn pp-btn--ghost${referMenu === 'specialist' ? ' is-on' : ''}`}
                  aria-pressed={referMenu === 'specialist'}
                  onClick={() => setReferMenu(referMenu === 'specialist' ? null : 'specialist')}>
                  <Icon.Stethoscope size={16} /> Specialist
                </button>
                <button type="button" className={`pp-btn pp-btn--ghost${referMenu === 'hospital' ? ' is-on' : ''}`}
                  aria-pressed={referMenu === 'hospital'}
                  onClick={() => setReferMenu(referMenu === 'hospital' ? null : 'hospital')}>
                  <Icon.Hospital size={16} /> Hospital
                </button>
              </div>

              {referMenu === 'specialist' && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="label" htmlFor="pp-spec">Specialty</label>
                  <select id="pp-spec" className="input" defaultValue="">
                    <option value="" disabled>Choose a specialist…</option>
                    {SPECIALTIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                  </select>
                </div>
              )}
              {referMenu === 'hospital' && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="label" htmlFor="pp-hosp">Referral hospital</label>
                  <select id="pp-hosp" className="input" defaultValue="">
                    <option value="" disabled>Choose a hospital…</option>
                    {REFERRAL_HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
              {referMenu && (
                <p className="pp-note"><Icon.Info size={15} /> Referrals aren't sent automatically yet. Record the referral in your verdict notes.</p>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Sticky actions */}
      <div className="pp-actions">
        <div className="pp-actionsin">
          <button type="button" className="pp-btn pp-btn--ghost pp-hide-sm" onClick={() => navigate('/doctor/dashboard')}>Back to queue</button>
          <span style={{ flex: 1 }} className="pp-hide-sm" />
          {callBtn()}
          <button type="button" className="pp-btn pp-btn--primary" onClick={goToVerdict}>
            Write diagnosis & prescription <Icon.ArrowRight size={17} />
          </button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Bar({ onBack, children }) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button type="button" className="cc-back" onClick={onBack} aria-label="Back to queue"><Icon.ChevronLeft size={20} /></button>
        <div>
          <div className="header__logo">Patient case file</div>
          <div className="header__sub">CivCare clinician portal</div>
        </div>
      </div>
      {children}
    </header>
  );
}

const CSS = `
  .pp { min-height: 100vh; background: var(--cc-bg); padding-bottom: 96px; }
  .pp-wrap { max-width: 1120px; margin: 0 auto; padding: 20px 20px 24px; }
  .pp-id { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; box-shadow: var(--cc-shadow-sm); display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; }
  .pp-idmain { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .pp-idmain h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; }
  .pp-iddl { display: flex; flex-wrap: wrap; gap: 12px 28px; }
  .pp-iddl dt, .pp-hist dt { font-size: 12px; font-weight: 600; color: var(--cc-muted); }
  .pp-iddl dd { font-size: 14.5px; font-weight: 600; margin-top: 1px; }
  .pp-flag { display: flex; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--cc-danger-soft); border: 1px solid var(--cc-danger-border); color: var(--cc-danger); margin-bottom: 16px; }
  .pp-flag svg { flex-shrink: 0; margin-top: 1px; }
  .pp-flag strong { font-size: 14px; }
  .pp-flag p { color: var(--cc-text); font-size: 14px; white-space: pre-line; margin-top: 2px; }
  .pp-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
  .pp-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .pp-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; padding: 18px 20px; box-shadow: var(--cc-shadow-sm); }
  .pp-h { font-size: 15px; font-weight: 650; margin-bottom: 14px; }
  .pp-ai { background: var(--cc-primary-soft); border: 1px solid var(--cc-primary-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
  .pp-ailabel { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--cc-primary); margin-bottom: 4px; }
  .pp-ai p { font-size: 14.5px; line-height: 1.6; color: var(--cc-text); }
  .pp-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .pp-metrics > div, .pp-dx { background: var(--cc-surface-2); border: 1px solid var(--cc-border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
  .pp-metrics span, .pp-dx span { font-size: 12px; font-weight: 600; color: var(--cc-muted); }
  .pp-metrics strong { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .pp-metrics small { font-size: 13px; color: var(--cc-muted); font-weight: 500; margin-left: 2px; }
  .pp-dx strong { font-size: 15px; }
  .pp-dx p { font-size: 13.5px; color: var(--cc-text-2); line-height: 1.5; margin-top: 4px; }
  .pp-disclaimer { font-size: 12.5px; color: var(--cc-muted); margin-top: 10px; }
  .pp-sub { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--cc-border); }
  .pp-sub h3 { font-size: 13px; font-weight: 650; margin-bottom: 8px; }
  .pp-prose { font-size: 14.5px; line-height: 1.7; white-space: pre-line; }
  .pp-tags { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .pp-tags li { background: var(--cc-surface-3); color: var(--cc-text-2); border-radius: 999px; padding: 3px 11px; font-size: 13px; font-weight: 500; }
  .pp-tags--meds li { background: var(--cc-warning-soft); color: var(--cc-warning); border: 1px solid var(--cc-warning-border); font-weight: 600; }
  .pp-details { margin-top: 16px; border-top: 1px solid var(--cc-border); padding-top: 12px; }
  .pp-details summary { cursor: pointer; font-size: 14px; font-weight: 600; color: var(--cc-primary); min-height: 32px; display: flex; align-items: center; gap: 6px; }
  .pp-chat { margin-top: 10px; background: var(--cc-surface-2); border: 1px solid var(--cc-border); border-radius: 10px; padding: 12px; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .pp-msg { align-self: flex-start; max-width: 82%; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 12px 12px 12px 4px; padding: 8px 12px; font-size: 13.5px; line-height: 1.5; }
  .pp-msg.is-patient { align-self: flex-end; background: var(--cc-primary); color: var(--cc-on-primary); border-color: transparent; border-radius: 12px 12px 4px 12px; }
  .pp-hist { display: flex; flex-direction: column; gap: 14px; }
  .pp-hist dd { font-size: 14.5px; margin-top: 3px; }
  .pp-allergy { color: var(--cc-danger); font-weight: 650; display: flex; align-items: center; gap: 6px; }
  .pp-muted { color: var(--cc-muted); }
  .pp-small { font-size: 13.5px; line-height: 1.5; margin-bottom: 12px; }
  .pp-refer { display: flex; gap: 8px; flex-wrap: wrap; }
  .pp-note { display: flex; gap: 6px; align-items: flex-start; font-size: 13px; color: var(--cc-muted); margin-top: 4px; }
  .pp-note svg { flex-shrink: 0; margin-top: 2px; }
  .pp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; padding: 9px 16px; border-radius: 8px; border: 1px solid transparent; font-size: 14px; font-weight: 600; white-space: nowrap; transition: background .15s ease, border-color .15s ease; }
  .pp-btn--primary { background: var(--cc-primary); color: var(--cc-on-primary); }
  .pp-btn--primary:hover { background: var(--cc-primary-hover); }
  .pp-btn--secondary { background: var(--cc-primary-soft); color: var(--cc-primary); border-color: var(--cc-primary-border); }
  .pp-btn--secondary:hover:not(:disabled) { border-color: var(--cc-primary); }
  .pp-btn--done { background: var(--cc-success-soft); color: var(--cc-success); border-color: var(--cc-success-border); cursor: default; }
  .pp-btn--ghost { background: var(--cc-surface); color: var(--cc-text-2); border-color: var(--cc-border-strong); }
  .pp-btn--ghost:hover, .pp-btn--ghost.is-on { border-color: var(--cc-primary); color: var(--cc-primary); }
  .pp-btn--ghost.is-on { background: var(--cc-primary-soft); }
  .pp-actions { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--cc-surface); border-top: 1px solid var(--cc-border); box-shadow: 0 -4px 16px rgba(16,24,40,0.05); padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); }
  .pp-actionsin { max-width: 1080px; margin: 0 auto; display: flex; gap: 10px; align-items: center; }
  .pp-empty { text-align: center; padding: 48px 16px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; }
  .pp-empty h2 { font-size: 17px; margin: 12px 0 4px; }
  .pp-empty p { color: var(--cc-muted); font-size: 14px; margin-bottom: 18px; }
  .pp-emptyicon { display: inline-flex; width: 48px; height: 48px; border-radius: 50%; align-items: center; justify-content: center; background: var(--cc-warning-soft); color: var(--cc-warning); }
  @media (max-width: 900px) { .pp-grid { grid-template-columns: 1fr; } }
  @media (max-width: 640px) {
    .pp-wrap { padding: 16px; }
    .pp-hide-sm { display: none !important; }
    .pp-actions { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); }
    .pp-actionsin > .pp-btn { flex: 1; padding: 9px 10px; font-size: 13.5px; white-space: normal; text-align: center; }
    .pp-iddl { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
    .pp-card, .pp-id { padding: 16px; }
  }
`;
