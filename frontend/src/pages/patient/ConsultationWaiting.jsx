import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideoRoom } from '../../api/video';

const fmtTimer = (sec) => {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

export default function ConsultationWaiting() {
  const navigate       = useNavigate();
  const patient        = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const consultationId = localStorage.getItem('civtech_consultation_id');
  const doctor          = JSON.parse(localStorage.getItem('civtech_selected_doctor') || '{}');

  const [ready, setReady]     = useState(false);
  const [roomUrl, setRoomUrl] = useState(null);
  const [joined, setJoined]   = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const poll = useCallback(async () => {
    if (!consultationId) return;
    try {
      const res = await getVideoRoom(consultationId);
      if (res.data.ready && res.data.room_url) {
        setReady(true);
        setRoomUrl(res.data.room_url);
      }
    } catch { /* keep waiting */ }
  }, [consultationId]);

  useEffect(() => {
    if (!consultationId || joined) return;
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll, consultationId, joined]);

  // Live call timer, running only once the patient has joined.
  useEffect(() => {
    if (!joined || !roomUrl) return;
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [joined, roomUrl]);

  const doctorName = doctor.full_name || doctor.name || 'your doctor';

  // ── IN-CALL VIEW ──
  if (joined && roomUrl) {
    return (
      <div style={s.callPage}>
        <div style={s.callBar}>
          <div style={s.callBarLeft}>
            <div style={s.avatarCircle}>🩺</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.callName}>Dr. {doctorName.replace(/^Dr\.?\s*/i, '')}</div>
              <div style={s.callSub}><span style={s.liveDot} />{fmtTimer(elapsed)} · Live consultation</div>
            </div>
          </div>
        </div>

        <div style={s.videoWrap}>
          <iframe
            title="Video consultation"
            src={roomUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            style={s.iframe}
          />
        </div>

        <div style={s.fabWrap}>
          <button style={s.endFab} className="cc-press" onClick={() => navigate('/rate')} aria-label="Leave call">📵</button>
          <span style={s.endFabLabel}>Leave call</span>
        </div>

        <style>{`
          .cc-press { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1); }
          .cc-press:active { transform: scale(0.94); }
          @keyframes wcPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,77,109,0.5)} 50%{box-shadow:0 0 0 6px rgba(255,77,109,0)} }
          @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        `}</style>
      </div>
    );
  }

  // ── WAITING / READY VIEW ──
  return (
    <div style={s.page}>
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: ready ? 'rgba(0,212,170,0.18)' : 'rgba(0,212,170,0.12)',
          border: `2px solid rgba(0,212,170,${ready ? 0.6 : 0.35})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          animation: ready ? 'none' : 'pulse 1.8s ease-in-out infinite',
        }}>
          {ready ? '🎥' : '⏳'}
        </div>
      </div>

      <h1 style={s.title}>{ready ? 'Your Doctor Is Ready' : 'Waiting for Your Doctor'}</h1>

      {ready ? (
        <>
          <p style={s.sub}>The doctor has started the video consultation. Join when you are ready.</p>
          <button style={s.joinBtn} onClick={() => setJoined(true)}>Join Video Call →</button>
        </>
      ) : (
        <>
          <p style={s.sub}>Your consultation is booked and payment is held safely in escrow.</p>
          <p style={s.sub}>
            The doctor will start the call shortly. Keep this screen open — it will let you in automatically.
          </p>
          <div style={s.note}>
            You can also receive a direct call on{' '}
            <strong style={{ color: '#00d4aa' }}>{patient.phone}</strong>.
          </div>
        </>
      )}

      <button onClick={() => navigate('/dashboard')} style={s.backBtn}>Back to Dashboard</button>

      <style>{`@keyframes pulse {0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}`}</style>
    </div>
  );
}

const s = {
  page:    { minHeight: '100vh', background: '#000', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' },
  title:   { fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 },
  sub:     { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.6, maxWidth: 360 },
  note:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 22px', margin: '20px 0 32px', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 },
  joinBtn: { width: '100%', maxWidth: 320, padding: '16px 0', background: 'linear-gradient(135deg,#00d4aa,#00a884)', border: 'none', borderRadius: 14, color: '#04241d', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16 },
  backBtn: { width: '100%', maxWidth: 320, padding: '14px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 14 },

  callPage: {
    position: 'relative', height: '100vh', width: '100%', overflow: 'hidden',
    background: 'radial-gradient(1200px 800px at 20% -10%, rgba(0,212,170,0.14), transparent 60%), #0b0b12',
    display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif",
  },
  callBar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexShrink: 0, zIndex: 5,
    background: 'rgba(11,11,18,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  callBarLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(0,212,170,0.14)', border: '1px solid rgba(0,212,170,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
  },
  callName: { color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  callSub: { display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11.5, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" },
  liveDot: { width: 6, height: 6, borderRadius: '50%', background: '#06d6a0', animation: 'wcPulse 1.8s ease-in-out infinite', display: 'inline-block' },

  videoWrap: { position: 'relative', flex: 1, minHeight: 0, margin: '10px 12px', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' },
  iframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' },

  fabWrap: { position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 6, pointerEvents: 'none' },
  endFab: {
    pointerEvents: 'auto', width: 60, height: 60, borderRadius: '50%',
    background: 'linear-gradient(135deg,#ff4d6d,#d62246)', border: '3px solid rgba(255,255,255,0.15)',
    color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 28px rgba(255,77,109,0.45)',
  },
  endFabLabel: { pointerEvents: 'none', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', background: 'rgba(11,11,18,0.7)', padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(8px)' },
};
