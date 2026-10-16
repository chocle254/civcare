import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideoRoom } from '../../api/video';
import Icon from '../../components/Icons';

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

  const drName = `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}`;
  const doctorLabel = doctorName === 'your doctor' ? 'Your doctor' : drName;

  // ── IN-CALL VIEW ──
  if (joined && roomUrl) {
    return (
      <div className="cw-call">
        <header className="cw-callbar">
          <span className="cw-callavatar" aria-hidden="true"><Icon.Stethoscope size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="cw-callname">{doctorLabel}</div>
            <div className="cw-callsub"><span className="cw-live" aria-hidden="true" />{fmtTimer(elapsed)} · Live consultation</div>
          </div>
        </header>

        <div className="cw-stage">
          <iframe
            title="Video consultation"
            src={roomUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          />
        </div>

        <footer className="cw-controls">
          <button type="button" className="cw-leave" onClick={() => navigate('/rate')}>
            <Icon.PhoneOff size={20} /> Leave call
          </button>
        </footer>
        <style>{CSS}</style>
      </div>
    );
  }

  // ── WAITING / READY VIEW ──
  const steps = [
    { label: 'Consultation booked', sub: 'Payment is held until your consultation is complete', state: 'done' },
    { label: ready ? `${doctorLabel} has started the call` : `Waiting for ${doctorLabel.toLowerCase() === 'your doctor' ? 'your doctor' : doctorLabel}`, sub: ready ? 'The video room is open' : 'Usually within a few minutes', state: ready ? 'done' : 'active' },
    { label: 'Join the video call', sub: 'Allow camera and microphone when asked', state: ready ? 'active' : 'todo' },
  ];

  return (
    <div className="cw">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="cc-back" onClick={() => navigate('/dashboard')} aria-label="Back to home">
            <Icon.ChevronLeft size={20} />
          </button>
          <div>
            <div className="header__logo">Online consultation</div>
            <div className="header__sub">{doctorLabel}</div>
          </div>
        </div>
      </header>

      <main className="cw-wrap">
        <section className={`cw-hero${ready ? ' is-ready' : ''}`} aria-live="polite">
          <span className="cw-heroicon" aria-hidden="true">
            {ready ? <Icon.Video size={28} /> : <Icon.Clock size={28} />}
          </span>
          <h1>{ready ? 'Your doctor is ready' : 'Waiting for your doctor'}</h1>
          <p>
            {ready
              ? 'The video consultation has started. Join when you are somewhere private and quiet.'
              : 'Keep this screen open. The Join button appears here automatically when the call starts.'}
          </p>
          {ready && (
            <button type="button" className="btn btn--primary cw-join" onClick={() => setJoined(true)}>
              <Icon.Video size={18} /> Join video call
            </button>
          )}
        </section>

        <ol className="cw-steps" aria-label="Consultation progress">
          {steps.map((st, i) => (
            <li key={i} className={`cw-step is-${st.state}`}>
              <span className="cw-stepmark" aria-hidden="true">
                {st.state === 'done' ? <Icon.Check size={14} /> : i + 1}
              </span>
              <div>
                <p className="cw-steplabel">{st.label}<span className="cc-visually-hidden">{st.state === 'done' ? ' (complete)' : st.state === 'active' ? ' (in progress)' : ''}</span></p>
                <p className="cw-stepsub">{st.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        {!ready && patient.phone && (
          <p className="cw-note"><Icon.Phone size={16} /> If video isn't possible, your doctor may call you on <strong>{patient.phone}</strong>.</p>
        )}

        <button type="button" className="btn btn--ghost" onClick={() => navigate('/dashboard')}>Back to home</button>
      </main>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .cw { min-height: 100vh; background: var(--cc-bg); }
  .cw-wrap { max-width: 520px; margin: 0 auto; padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 16px; }
  .cw-hero { text-align: center; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 16px; padding: 28px 20px 24px; box-shadow: var(--cc-shadow-sm); }
  .cw-heroicon { display: inline-flex; width: 64px; height: 64px; border-radius: 50%; align-items: center; justify-content: center; background: var(--cc-primary-soft); color: var(--cc-primary); margin-bottom: 14px; position: relative; }
  .cw-hero:not(.is-ready) .cw-heroicon::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid var(--cc-primary-border); animation: pulse-glow 1.8s ease-in-out infinite; }
  .cw-hero.is-ready .cw-heroicon { background: var(--cc-success-soft); color: var(--cc-success); }
  .cw-hero h1 { font-size: 21px; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 6px; }
  .cw-hero p { color: var(--cc-muted); font-size: 15px; line-height: 1.55; max-width: 380px; margin: 0 auto; }
  .cw-join { margin-top: 20px; min-height: 52px; font-size: 16px; }
  .cw-steps { list-style: none; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 16px; padding: 8px 18px; }
  .cw-step { display: flex; gap: 12px; padding: 12px 0; position: relative; }
  .cw-step + .cw-step { border-top: 1px solid var(--cc-border); }
  .cw-stepmark { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; border: 2px solid var(--cc-border-strong); color: var(--cc-faint); background: var(--cc-surface); }
  .cw-step.is-done .cw-stepmark { background: var(--cc-success); border-color: var(--cc-success); color: #fff; }
  .cw-step.is-active .cw-stepmark { border-color: var(--cc-primary); color: var(--cc-primary); }
  .cw-steplabel { font-size: 15px; font-weight: 600; color: var(--cc-text); }
  .cw-step.is-todo .cw-steplabel { color: var(--cc-muted); }
  .cw-stepsub { font-size: 13.5px; color: var(--cc-muted); }
  .cw-note { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; color: var(--cc-text-2); background: var(--cc-surface-2); border: 1px solid var(--cc-border); border-radius: 12px; padding: 12px 14px; line-height: 1.5; }
  .cw-note svg { flex-shrink: 0; margin-top: 2px; color: var(--cc-muted); }

  .cw-call { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: #0d1117; color: #e8edf3; overflow: hidden; }
  .cw-callbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .cw-callavatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: rgba(105,183,229,0.16); color: #9fd2f0; }
  .cw-callname { font-weight: 650; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cw-callsub { display: flex; align-items: center; gap: 6px; font-family: var(--cc-mono); font-size: 12.5px; color: rgba(232,237,243,0.7); font-variant-numeric: tabular-nums; }
  .cw-live { width: 7px; height: 7px; border-radius: 50%; background: #ef5a5a; animation: pulse-glow 1.6s ease-in-out infinite; }
  .cw-stage { flex: 1; min-height: 0; position: relative; margin: 8px; border-radius: 14px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.08); }
  .cw-stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
  .cw-controls { display: flex; justify-content: center; padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); }
  .cw-leave { display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 10px 24px; border-radius: 999px; border: none; background: #d64545; color: #fff; font-weight: 650; font-size: 15px; }
  .cw-leave:hover { background: #c03838; }
`;
