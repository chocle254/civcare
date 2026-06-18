import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideoRoom } from '../../api/video';

export default function ConsultationWaiting() {
  const navigate       = useNavigate();
  const patient        = JSON.parse(localStorage.getItem('civtech_patient') || '{}');
  const consultationId = localStorage.getItem('civtech_consultation_id');

  const [ready, setReady]     = useState(false);
  const [roomUrl, setRoomUrl] = useState(null);
  const [joined, setJoined]   = useState(false);

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

  // ── IN-CALL VIEW ──
  if (joined && roomUrl) {
    return (
      <div style={s.callPage}>
        <div style={s.callBar}>
          <div style={s.callName}>Consultation with your doctor</div>
          <button style={s.leaveBtn} onClick={() => navigate('/rate')}>Leave Call</button>
        </div>
        <iframe
          title="Video consultation"
          src={roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          style={s.iframe}
        />
        <p style={s.hint}>Tap the controls to mute your mic or turn your camera off.</p>
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
  callPage:{ minHeight: '100vh', background: '#0b0b12', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" },
  callBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  callName:{ color: '#fff', fontWeight: 700, fontSize: 14 },
  leaveBtn:{ background: 'linear-gradient(135deg,#ff4d6d,#d62246)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 12, cursor: 'pointer' },
  iframe:  { flex: 1, width: '100%', border: 'none', minHeight: 0 },
  hint:    { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: '10px 16px 18px', margin: 0 },
};
