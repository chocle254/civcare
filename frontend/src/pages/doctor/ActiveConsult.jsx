

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { completeConsultation } from '../../api/consultation';
import { startVideo } from '../../api/video';
import client from '../../api/client';

export default function ActiveConsult() {
  const { id }   = useParams();   // consultation id
  const navigate = useNavigate();
  const doctor   = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [consult, setConsult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending,  setEnding]  = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/consultation/${id}`);
        setConsult(res.data);
      } catch {
        setConsult(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await startVideo({ consultation_id: id, doctor_id: doctor.id });
      setRoomUrl(res.data.room_url);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not start the video call.');
    } finally {
      setStarting(false);
    }
  };

  // End the call → release payment → go straight to the diagnosis/prescription screen
  const handleEndCall = async () => {
    setEnding(true);
    try {
      await completeConsultation({ consultation_id: id, doctor_id: doctor.id });
    } catch {
      /* payment release is best-effort; still proceed to verdict */
    }
    if (consult?.patient_id) {
      localStorage.setItem('civtech_viewing_patient', consult.patient_id);
    }
    navigate(`/doctor/verdict/${id}`);
  };

  if (loading) return (
    <div className="page">
      <div className="header"><div className="header__logo">CivTech Care</div></div>
      <div className="loader"><div className="spinner" /></div>
    </div>
  );

  if (!consult) return (
    <div className="page">
      <div className="header"><div className="header__logo">CivCare</div></div>
      <div className="container">
        <div className="alert alert--error" style={{ marginTop: 24 }}>Consultation not found.</div>
        <button className="btn btn--outline" onClick={() => navigate('/doctor/dashboard')}>Back to Queue</button>
      </div>
    </div>
  );

  // ── IN-CALL VIEW ──
  if (roomUrl) {
    return (
      <div style={vs.callPage}>
        <div style={vs.callBar}>
          <div>
            <div style={vs.callName}>{consult.patient_name}</div>
            <div style={vs.callSub}>📞 {consult.patient_phone} · Live consultation</div>
          </div>
          <button style={vs.endBtn} onClick={handleEndCall} disabled={ending}>
            {ending ? 'Ending…' : 'End Call & Write Verdict'}
          </button>
        </div>
        <iframe
          title="Video consultation"
          src={roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          style={vs.iframe}
        />
        <p style={vs.hint}>
          Use the controls in the call to mute your mic or turn your camera off, just like Google Meet.
        </p>
      </div>
    );
  }

  // ── PRE-CALL VIEW (patient brief) ──
  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="header__logo">CivTech Care</div>
          <div className="header__sub">Online Consultation</div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20 }}>
        <div className="card">
          <p className="card__title">Patient</p>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{consult.patient_name}</p>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>📞 {consult.patient_phone}</p>
          <div style={{ background: 'var(--blue-light)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--gray-600)' }}>
            Start the secure video call below. You can also phone the patient directly on their number.
          </div>
        </div>

        <div className="card">
          <p className="card__title">Reason for Consultation</p>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {consult.symptoms_summary || '—'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>ALLERGIES</p>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{consult.allergies || 'None on record'}</p>
            </div>
            <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>CURRENT MEDS</p>
              <p style={{ fontSize: 13 }}>{consult.current_medications?.join(', ') || 'None'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="card__title">Payment</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--gray-600)', fontSize: 14 }}>Consultation Fee</span>
            <strong style={{ fontSize: 16 }}>KES {consult.fee_amount}</strong>
          </div>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 10 }}>
            Payment is released when you end the call and submit your verdict.
          </p>
        </div>

        <button className="btn btn--primary" onClick={handleStart} disabled={starting} style={{ marginBottom: 12 }}>
          {starting ? 'Starting video…' : '🎥 Start Video Consultation'}
        </button>
        <button className="btn btn--ghost" onClick={() => navigate('/doctor/dashboard')}>Back to Queue</button>
      </div>
    </div>
  );
}

const vs = {
  callPage: { minHeight: '100vh', background: '#0b0b12', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" },
  callBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  callName: { color: '#fff', fontWeight: 700, fontSize: 15 },
  callSub:  { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  endBtn:   { background: 'linear-gradient(135deg,#ff4d6d,#d62246)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, padding: '11px 18px', borderRadius: 12, cursor: 'pointer', flexShrink: 0 },
  iframe:   { flex: 1, width: '100%', border: 'none', minHeight: 0 },
  hint:     { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: '10px 16px 18px', margin: 0 },
};
