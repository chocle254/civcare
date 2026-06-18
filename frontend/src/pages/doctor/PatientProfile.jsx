import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateDoctorStatus } from '../../api/doctors';
import client from '../../api/client';

export default function PatientProfile() {
  const { id } = useParams();   // appointment id
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/triage/appointment/${id}?doctor_id=${doctor.id}`);
        setProfile(res.data);
        console.log('Profile data:', res.data); // ADD THIS
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
    <div className="page">
      <div className="header"><div className="header__logo">CivCare</div></div>
      <div className="loader"><div className="spinner" /></div>
    </div>
  );

  if (!profile) return (
    <div className="page">
      <div className="header"><div className="header__logo">CivCare</div></div>
      <div className="container">
        <div className="alert alert--error" style={{ marginTop: 24 }}>
          Patient profile not found.
        </div>
        <button className="btn btn--outline" onClick={() => navigate('/doctor/dashboard')}>
          Back to Queue
        </button>
      </div>
    </div>
  );

  const risk = profile.risk_score || 'moderate';
  const badgeCls = { critical: 'badge--critical', moderate: 'badge--moderate', low: 'badge--low' };
  const messages = profile.conversation || [];

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="header__logo">CivCare</div>
          <div className="header__sub">Patient Profile</div>
        </div>
        <button
          className="btn btn--outline btn--sm"
          style={{ width: 'auto' }}
          onClick={() => navigate('/doctor/dashboard')}
        >
          ← Queue
        </button>
      </div>

      <div className="container--wide" style={{ paddingTop: 20 }}>

        {/* ── Section 1: Identity ── */}
        <div className="card">
          <p className="card__title">Patient Identity</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Full Name', profile.patient_name],
              ['Age', profile.patient_age || '—'],
              ['Phone', profile.patient_phone],
              ['Location', profile.patient_location || '—'],
              ['ID Type', profile.identity_type],
              ['ID Number', profile.identity_number],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Current Symptoms + AI Triage ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className="card__title" style={{ marginBottom: 0 }}>Current Complaint & AI Triage</p>
            <span className={`badge ${badgeCls[risk]}`}>
              {risk.toUpperCase()} RISK
            </span>
          </div>

          {/* AI Summary */}
          <div style={{
            background: 'var(--blue-light)',
            borderRadius: 'var(--radius)',
            padding: 14,
            marginBottom: 16,
            fontSize: 14,
            color: 'var(--gray-800)',
            borderLeft: '3px solid var(--blue)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>
              AI PRELIMINARY ASSESSMENT
            </p>
            {profile.ai_assessment || (
              <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>
                Not available — start a new session for AI assessment to generate.
              </span>
            )}
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>RISK SCORE</p>
              <p style={{ fontWeight: 700, fontSize: 18 }}>{profile.risk_numeric ?? '—'}/100</p>
            </div>
            <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>AI CONFIDENCE</p>
              <p style={{ fontWeight: 700, fontSize: 18 }}>{profile.ai_confidence ?? '—'}%</p>
            </div>
            {profile.possible_diagnosis && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--gray-100)', borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>AI POSSIBLE DIAGNOSIS</p>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{profile.possible_diagnosis}</p>
                {profile.diagnosis_reasoning && (
                  <p style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {profile.diagnosis_reasoning}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Symptom Summary */}
          {(profile.symptom_summary || messages.filter(m => m.role === 'patient').length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8 }}>
                PATIENT REPORTED SYMPTOMS
              </p>
              {profile.symptom_summary ? (
                <div style={{
                  background: 'var(--gray-100)', borderRadius: 6,
                  padding: 12, fontSize: 13, lineHeight: 1.8,
                  color: 'var(--gray-800)', whiteSpace: 'pre-line',
                }}>
                  {profile.symptom_summary}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {messages
                    .filter(m => {
                      if (m.role !== 'patient') return false;
                      const c = m.content.toLowerCase().trim();
                      const skipWords = ['yes', 'no', 'yeah', 'nope', 'okay', 'ok', 'now', 'yes i can'];
                      return !skipWords.includes(c) && c.length > 3;
                    })
                    .map((m, i) => (
                      <span key={i} style={{
                        background: 'var(--blue-light)', color: 'var(--blue)',
                        border: '1px solid var(--blue)', borderRadius: 20,
                        padding: '3px 12px', fontSize: 12, fontWeight: 600,
                      }}>
                        {m.content.length > 40 ? m.content.slice(0, 40) + '...' : m.content}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Full AI conversation — collapsible */}
          <details>
            <summary style={{
              fontSize: 12, fontWeight: 700, color: 'var(--gray-600)',
              marginBottom: 10, cursor: 'pointer', userSelect: 'none',
            }}>
              VIEW FULL AI CONVERSATION
            </summary>
            <div style={{
              background: 'var(--gray-100)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginTop: 10,
              maxHeight: 320,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {messages.filter(msg => msg.role !== 'action' && msg.role !== 'system').map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'patient' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'patient' ? 'var(--blue)' : 'var(--white)',
                  color: msg.role === 'patient' ? 'white' : 'var(--text)',
                  borderRadius: 12,
                  padding: '8px 12px',
                  maxWidth: '80%',
                  fontSize: 13,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  {msg.content}
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* ── Section 3: Medical History ── */}
        <div className="card">
          <p className="card__title">Medical History</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>KNOWN CONDITIONS</p>
              <p style={{ fontSize: 14 }}>{profile.conditions || 'None on record'}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>KNOWN ALLERGIES</p>
              <p style={{ fontSize: 14, color: profile.allergies ? 'var(--red)' : 'inherit', fontWeight: profile.allergies ? 700 : 400 }}>
                {profile.allergies || 'None on record'}
              </p>
            </div>
            {profile.allergy_flags && (
              <div style={{ gridColumn: '1 / -1', background: '#fde8e8', border: '1px solid var(--red)', borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ AI ALLERGY/MEDICATION ALERT</p>
                <p style={{ fontSize: 13, color: 'var(--gray-800)', whiteSpace: 'pre-line' }}>{profile.allergy_flags}</p>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>CURRENT MEDICATIONS</p>
              {profile.current_medications?.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {profile.current_medications.map((med, i) => (
                    <span key={i} style={{
                      background: '#fff3cd',
                      color: '#856404',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                    }}>
                      {med}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14 }}>None on record</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button
            className="btn btn--primary"
            onClick={() => {
              const pid = profile.patient_id;
              if (!pid) {
                alert('Cannot proceed: patient ID missing from profile data. Contact support.');
                return;
              }
              localStorage.setItem('civtech_viewing_patient', pid);
              navigate(`/doctor/verdict/${id}`);
            }}
          >
            Submit Diagnosis & Prescriptions
          </button>
          <button
            className="btn btn--outline"
            onClick={() => navigate('/doctor/dashboard')}
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
