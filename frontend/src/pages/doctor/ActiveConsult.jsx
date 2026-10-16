import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { completeConsultation } from '../../api/consultation';
import { startVideo } from '../../api/video';
import client from '../../api/client';
import Icon from '../../components/Icons';

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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    try {
      const res = await startVideo({ consultation_id: id, doctor_id: doctor.id });
      setRoomUrl(res.data.room_url);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not start the video call. Please try again.');
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

  const meds = consult?.current_medications?.length ? consult.current_medications.join(', ') : 'None recorded';

  if (loading) return (
    <div className="ac-page">
      <TopBar onBack={() => navigate('/doctor/dashboard')} title="Online consultation" />
      <div className="ac-wrap">
        <div className="cc-skeleton" style={{ height: 120, marginBottom: 12 }} />
        <div className="cc-skeleton" style={{ height: 180 }} />
      </div>
      <style>{CSS}</style>
    </div>
  );

  if (!consult) return (
    <div className="ac-page">
      <TopBar onBack={() => navigate('/doctor/dashboard')} title="Online consultation" />
      <div className="ac-wrap">
        <div className="ac-empty">
          <span className="ac-emptyicon"><Icon.Alert size={24} /></span>
          <h2>Consultation not found</h2>
          <p>It may have been completed or cancelled. Return to your queue to see current requests.</p>
          <button type="button" className="btn btn--primary" style={{ width: 'auto' }} onClick={() => navigate('/doctor/dashboard')}>Back to dashboard</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  const report = (
    <>
      <section className="ac-block">
        <h3>Reason for consultation</h3>
        <p className="ac-prose">{consult.symptoms_summary || 'No summary provided.'}</p>
      </section>
      <div className="ac-facts">
        <div className={`ac-fact${consult.allergies ? ' ac-fact--warn' : ''}`}>
          <span>Allergies</span>
          <strong>{consult.allergies || 'None on record'}</strong>
        </div>
        <div className="ac-fact">
          <span>Current medication</span>
          <strong>{meds}</strong>
        </div>
      </div>
      <dl className="ac-dl">
        <div><dt>Phone</dt><dd><a href={`tel:${consult.patient_phone}`}>{consult.patient_phone}</a></dd></div>
        <div><dt>Fee</dt><dd>KES {consult.fee_amount}</dd></div>
      </dl>
    </>
  );

  // ── IN-CALL VIEW ──
  if (roomUrl) {
    return (
      <div className={`ac-call${reportOpen ? ' has-report' : ''}`}>
        <header className="ac-callbar">
          <div className="ac-who">
            <div className="ac-avatar" aria-hidden="true">{initials(consult.patient_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="ac-callname">{consult.patient_name}</div>
              <div className="ac-callsub">
                <span className="ac-live" aria-hidden="true" />
                <span aria-label={`Call duration ${fmtTimer(elapsed)}`}>{fmtTimer(elapsed)}</span>
                <span aria-hidden="true">·</span> Live
              </div>
            </div>
          </div>
          <button type="button" className={`ac-chip${reportOpen ? ' is-on' : ''}`} onClick={() => setReportOpen((o) => !o)} aria-expanded={reportOpen} aria-controls="ac-report">
            <Icon.File size={16} /> Patient brief
          </button>
        </header>

        <div className="ac-stage">
          <div className="ac-video">
            <iframe
              title="Video consultation"
              src={roomUrl}
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            />
          </div>

          {reportOpen && (
            <>
              <div className="ac-overlay" onClick={() => setReportOpen(false)} aria-hidden="true" />
              <aside id="ac-report" className="ac-report" aria-label="Patient brief">
                <div className="ac-reporthead">
                  <h2>Patient brief</h2>
                  <button type="button" className="ac-iconbtn" onClick={() => setReportOpen(false)} aria-label="Close patient brief">
                    <Icon.Close size={18} />
                  </button>
                </div>
                {report}
              </aside>
            </>
          )}
        </div>

        <footer className="ac-controls">
          {!confirmEnd ? (
            <button type="button" className="ac-end" onClick={() => setConfirmEnd(true)} disabled={ending}>
              <Icon.PhoneOff size={20} /> End consultation
            </button>
          ) : (
            <div className="ac-confirm" role="alertdialog" aria-labelledby="ac-confirm-text">
              <p id="ac-confirm-text">End the call and continue to your verdict? Payment is released when you finish.</p>
              <div className="ac-confirmbtns">
                <button type="button" className="ac-keep" onClick={() => setConfirmEnd(false)} disabled={ending}>Keep talking</button>
                <button type="button" className="ac-end" onClick={handleEndCall} disabled={ending} autoFocus>
                  {ending ? <span className="ac-spin" aria-hidden="true" /> : <Icon.PhoneOff size={18} />}
                  {ending ? 'Ending…' : 'End & write verdict'}
                </button>
              </div>
            </div>
          )}
        </footer>

        <style>{CSS}</style>
      </div>
    );
  }

  // ── PRE-CALL VIEW (patient brief) ──
  return (
    <div className="ac-page">
      <TopBar onBack={() => navigate('/doctor/dashboard')} title="Online consultation" />

      <div className="ac-wrap ac-grid">
        <div className="ac-col">
          <section className="ac-card">
            <div className="ac-patient">
              <div className="ac-avatar ac-avatar--lg" aria-hidden="true">{initials(consult.patient_name)}</div>
              <div style={{ minWidth: 0 }}>
                <h1 className="ac-name">{consult.patient_name}</h1>
                <a className="ac-phone" href={`tel:${consult.patient_phone}`}><Icon.Phone size={15} /> {consult.patient_phone}</a>
              </div>
            </div>
          </section>

          <section className="ac-card">{report}</section>
        </div>

        <aside className="ac-col">
          <section className="ac-card ac-start">
            <h2>Ready to begin?</h2>
            <p>Start a secure video room. The patient joins from their CivCare app. If video fails, you can phone them directly.</p>
            {error && (
              <div className="alert alert--error" role="alert">
                <Icon.Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
              </div>
            )}
            <button type="button" className="btn btn--primary" onClick={handleStart} disabled={starting}>
              {starting ? <span className="ac-spin" aria-hidden="true" /> : <Icon.Video size={18} />}
              {starting ? 'Starting video…' : 'Start video consultation'}
            </button>
            <div className="ac-fee">
              <span>Consultation fee</span>
              <strong>KES {consult.fee_amount}</strong>
            </div>
            <p className="ac-note">Payment is released when you end the call and submit your verdict.</p>
          </section>
        </aside>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function TopBar({ onBack, title }) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button type="button" className="cc-back" onClick={onBack} aria-label="Back to dashboard">
          <Icon.ChevronLeft size={20} />
        </button>
        <div>
          <div className="header__logo">{title}</div>
          <div className="header__sub">CivCare clinician portal</div>
        </div>
      </div>
    </header>
  );
}

const CSS = `
  .ac-page { min-height: 100vh; background: var(--cc-bg); }
  .ac-wrap { max-width: 1040px; margin: 0 auto; padding: 24px 20px 48px; }
  .ac-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
  .ac-col { display: flex; flex-direction: column; gap: 16px; }
  .ac-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; padding: 20px; box-shadow: var(--cc-shadow-sm); }
  .ac-patient { display: flex; align-items: center; gap: 14px; }
  .ac-name { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .ac-phone { display: inline-flex; align-items: center; gap: 6px; color: var(--cc-primary); font-family: var(--cc-mono); font-size: 14px; text-decoration: none; margin-top: 2px; }
  .ac-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--cc-primary-soft); color: var(--cc-primary); font-weight: 700; font-size: 13px; }
  .ac-avatar--lg { width: 52px; height: 52px; font-size: 17px; }
  .ac-block h3, .ac-fact span, .ac-dl dt { font-size: 12px; font-weight: 600; color: var(--cc-muted); }
  .ac-block h3 { margin-bottom: 6px; }
  .ac-prose { font-size: 15px; line-height: 1.6; color: var(--cc-text); white-space: pre-wrap; }
  .ac-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
  .ac-fact { padding: 10px 12px; border-radius: 10px; background: var(--cc-surface-2); border: 1px solid var(--cc-border); display: flex; flex-direction: column; gap: 2px; }
  .ac-fact strong { font-size: 14px; font-weight: 600; }
  .ac-fact--warn { background: var(--cc-warning-soft); border-color: var(--cc-warning-border); }
  .ac-fact--warn span, .ac-fact--warn strong { color: var(--cc-warning); }
  .ac-dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ac-dl dd { font-size: 14px; font-weight: 600; margin-top: 2px; }
  .ac-dl a { color: var(--cc-primary); text-decoration: none; font-family: var(--cc-mono); font-weight: 500; }
  .ac-start { position: sticky; top: 84px; }
  .ac-start h2 { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
  .ac-start > p { font-size: 14px; color: var(--cc-muted); margin-bottom: 16px; line-height: 1.5; }
  .ac-fee { display: flex; justify-content: space-between; align-items: baseline; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--cc-border); font-size: 14px; color: var(--cc-muted); }
  .ac-fee strong { font-size: 17px; color: var(--cc-text); }
  .ac-note { font-size: 12.5px; color: var(--cc-muted); margin-top: 6px; }
  .ac-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .7s linear infinite; }
  .ac-empty { text-align: center; padding: 48px 16px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: 14px; }
  .ac-empty h2 { font-size: 17px; margin: 12px 0 4px; }
  .ac-empty p { color: var(--cc-muted); font-size: 14px; max-width: 360px; margin: 0 auto 18px; }
  .ac-emptyicon { display: inline-flex; width: 48px; height: 48px; border-radius: 50%; align-items: center; justify-content: center; background: var(--cc-warning-soft); color: var(--cc-warning); }

  /* In-call — a deliberately dark, neutral stage so video is the focus */
  .ac-call { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: #0d1117; color: #e8edf3; overflow: hidden; }
  .ac-callbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .ac-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ac-call .ac-avatar { background: rgba(105,183,229,0.16); color: #9fd2f0; }
  .ac-callname { font-weight: 650; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ac-callsub { display: flex; align-items: center; gap: 6px; font-family: var(--cc-mono); font-size: 12.5px; color: rgba(232,237,243,0.7); font-variant-numeric: tabular-nums; }
  .ac-live { width: 7px; height: 7px; border-radius: 50%; background: #ef5a5a; animation: pulse-glow 1.6s ease-in-out infinite; }
  .ac-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #e8edf3; font-size: 13.5px; font-weight: 600; }
  .ac-chip:hover, .ac-chip.is-on { background: rgba(255,255,255,0.14); }
  .ac-stage { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 12px; position: relative; }
  .ac-video { position: relative; flex: 1; min-width: 0; border-radius: 14px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.08); }
  .ac-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
  .ac-overlay { display: none; }
  .ac-report { width: 360px; flex-shrink: 0; overflow-y: auto; background: var(--cc-surface); color: var(--cc-text); border-radius: 14px; padding: 16px 18px; border: 1px solid var(--cc-border); animation: fadeIn .18s ease both; }
  .ac-reporthead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .ac-reporthead h2 { font-size: 16px; font-weight: 700; }
  .ac-iconbtn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--cc-border); background: var(--cc-surface); color: var(--cc-muted); display: inline-flex; align-items: center; justify-content: center; }
  .ac-controls { display: flex; justify-content: center; padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,255,255,0.08); }
  .ac-end { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 10px 22px; border-radius: 999px; border: none; background: #d64545; color: #fff; font-weight: 650; font-size: 15px; }
  .ac-end:hover:not(:disabled) { background: #c03838; }
  .ac-end:disabled { opacity: .7; }
  .ac-confirm { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; max-width: 720px; }
  .ac-confirm p { font-size: 14px; color: rgba(232,237,243,0.85); flex: 1 1 260px; }
  .ac-confirmbtns { display: flex; gap: 8px; }
  .ac-keep { min-height: 48px; padding: 10px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #e8edf3; font-weight: 600; }
  .ac-keep:hover { background: rgba(255,255,255,0.08); }

  @media (max-width: 860px) {
    .ac-grid { grid-template-columns: 1fr; }
    .ac-start { position: static; }
    .ac-wrap { padding: 16px 16px 40px; }
  }
  @media (max-width: 900px) {
    .ac-overlay { display: block; position: fixed; inset: 0; background: var(--cc-overlay); z-index: 20; animation: fadeIn .18s ease both; }
    .ac-report { position: fixed; left: 0; right: 0; bottom: 0; width: auto; max-height: 75vh; z-index: 21; border-radius: 18px 18px 0 0; padding-bottom: calc(20px + env(safe-area-inset-bottom)); animation: slideUp .22s ease both; }
    .ac-stage { padding: 8px; }
  }
  @media (max-width: 420px) {
    .ac-facts, .ac-dl { grid-template-columns: 1fr; }
    .ac-confirmbtns { width: 100%; }
    .ac-confirmbtns > * { flex: 1; padding: 10px 12px; }
  }
`;
