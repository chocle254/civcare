import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { completeConsultation } from '../../api/consultation';
import { startVideo } from '../../api/video';
import client from '../../api/client';

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const fmtTimer = (sec) => {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

export default function ActiveConsult() {
  const { id }   = useParams();   // consultation id
  const navigate = useNavigate();
  const doctor   = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');

  const [consult, setConsult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending,  setEnding]  = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

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

  // Live call timer, running only while the room is actually open.
  useEffect(() => {
    if (!roomUrl) return;
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [roomUrl]);

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
        {/* Top bar — patient identity + live timer + report access */}
        <div style={vs.callBar}>
          <div style={vs.callBarLeft}>
            <div style={vs.avatarCircle}>{initials(consult.patient_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={vs.callName}>{consult.patient_name}</div>
              <div style={vs.callSub}><span style={vs.liveDot} />{fmtTimer(elapsed)} · Live consultation</div>
            </div>
          </div>
          <button style={vs.reportChip} className="cc-press" onClick={() => setReportOpen(true)}>
            📋 Report
          </button>
        </div>

        {/* Video surface */}
        <div style={vs.videoWrap}>
          <iframe
            title="Video consultation"
            src={roomUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            style={vs.iframe}
          />
        </div>

        {/* Floating end-call FAB, phone-app style */}
        <div style={vs.fabWrap}>
          <button style={vs.endFab} className="cc-press" onClick={handleEndCall} disabled={ending} aria-label="End call">
            {ending ? '···' : '📵'}
          </button>
          <span style={vs.endFabLabel}>{ending ? 'Ending…' : 'End & write verdict'}</span>
        </div>

        {/* Report drawer — pulls up the AI-gathered symptom report mid-call
            without leaving or interrupting the video. */}
        {reportOpen && (
          <>
            <div style={vs.overlay} onClick={() => setReportOpen(false)} />
            <div style={vs.reportSheet}>
              <div style={vs.sheetPill} />
              <div style={vs.sheetHeader}>
                <p style={vs.sheetTitle}>Patient Report</p>
                <button style={vs.closeBtn} className="cc-press" onClick={() => setReportOpen(false)} aria-label="Close">✕</button>
              </div>

              <div style={vs.reportBlock}>
                <p style={vs.reportLabel}>Reason for Consultation</p>
                <p style={vs.reportText}>{consult.symptoms_summary || '—'}</p>
              </div>

              <div style={vs.reportGrid}>
                <div style={vs.reportCell}>
                  <p style={vs.reportLabel}>Allergies</p>
                  <p style={vs.reportValue}>{consult.allergies || 'None on record'}</p>
                </div>
                <div style={vs.reportCell}>
                  <p style={vs.reportLabel}>Current Meds</p>
                  <p style={vs.reportValue}>{consult.current_medications?.join(', ') || 'None'}</p>
                </div>
              </div>

              <div style={vs.reportBlock}>
                <p style={vs.reportLabel}>Contact</p>
                <p style={vs.reportText}>📞 {consult.patient_phone}</p>
              </div>

              <div style={vs.reportBlock}>
                <p style={vs.reportLabel}>Fee</p>
                <p style={vs.reportText}>KES {consult.fee_amount}</p>
              </div>
            </div>
          </>
        )}

        <style>{`
          .cc-press { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1); }
          .cc-press:active { transform: scale(0.94); }
          @keyframes vcSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes vcFadeIn { from{opacity:0} to{opacity:1} }
          @keyframes vcPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,77,109,0.5)} 50%{box-shadow:0 0 0 6px rgba(255,77,109,0)} }
          @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        `}</style>
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
  callPage: {
    position: 'relative', height: '100vh', width: '100%', overflow: 'hidden',
    background: 'radial-gradient(1200px 800px at 20% -10%, rgba(79,70,229,0.18), transparent 60%), var(--bg)',
    display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif",
  },

  callBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '14px 16px', flexShrink: 0, zIndex: 5,
    background: 'rgba(13,13,26,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border)',
  },
  callBarLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--accent-light)', fontWeight: 700, fontSize: 13,
  },
  callName: { color: 'var(--text)', fontWeight: 700, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  callSub: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'vcPulse 1.8s ease-in-out infinite', display: 'inline-block' },
  reportChip: {
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--surface-hi)', border: '1px solid var(--border-hi)', borderRadius: 999,
    color: 'var(--text)', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', cursor: 'pointer',
  },

  videoWrap: { position: 'relative', flex: 1, minHeight: 0, margin: '10px 12px', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' },
  iframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' },

  fabWrap: { position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 6, pointerEvents: 'none' },
  endFab: {
    pointerEvents: 'auto', width: 60, height: 60, borderRadius: '50%',
    background: 'linear-gradient(135deg,#ff4d6d,#d62246)', border: '3px solid rgba(255,255,255,0.15)',
    color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 28px rgba(255,77,109,0.45)',
  },
  endFabLabel: { pointerEvents: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(13,13,26,0.7)', padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(8px)' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(4,4,10,0.55)', backdropFilter: 'blur(2px)', zIndex: 20, animation: 'vcFadeIn 0.2s ease both' },
  reportSheet: {
    position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-hi)', borderBottom: 'none',
    borderRadius: '24px 24px 0 0', padding: '14px 20px calc(24px + env(safe-area-inset-bottom))',
    zIndex: 21, animation: 'vcSheetUp 0.3s var(--spring) both', maxHeight: '72vh', overflowY: 'auto',
    boxShadow: '0 -20px 50px rgba(0,0,0,0.5)',
  },
  sheetPill: { width: 36, height: 4, borderRadius: 2, background: 'var(--border-hi)', margin: '0 auto 16px' },
  sheetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 },
  closeBtn: {
    width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-hi)', border: '1px solid var(--border-hi)',
    color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  reportBlock: { marginBottom: 16 },
  reportGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  reportCell: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' },
  reportLabel: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 5px' },
  reportText: { fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' },
  reportValue: { fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 },
};
