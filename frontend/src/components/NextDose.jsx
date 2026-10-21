import { useEffect, useRef, useState } from 'react';

// Home-screen medicine card, from the real reminder schedule
// (GET /reminders/today): a live countdown to the next dose, today's doses,
// the run of doses taken in a row, and how far through the treatment
// the patient is.

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
const dayWord = (iso) => {
  const d = new Date(iso), t = new Date();
  const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return 'today';
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow';
  return d.toLocaleDateString('en-KE', { weekday: 'long' });
};
const amount = (m) => {
  const n = parseInt(String(m?.dosage_notation || '').split('x')[0], 10);
  const form = m?.med_form || 'tablet';
  if (!n) return null;
  if (form === 'syrup' || form === 'liquid') return `${n * 5} ml`;
  return `${n} ${form}${n > 1 ? 's' : ''}`;
};
const STATUS = {
  taken: { label: 'Taken', mark: '✓' },
  skipped: { label: 'Skipped', mark: '–' },
  missed: { label: 'Missed', mark: '!' },
  due: { label: 'Due now', mark: '•' },
  upcoming: { label: 'Later', mark: '' },
};

export default function NextDose({ data, hasMedicines, onOpen, onElapsed }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(null);
  const next = data?.next;

  useEffect(() => {
    if (!next && !data?.due?.length) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [next, data]);

  // When the countdown reaches zero, ask the dashboard to refresh once.
  useEffect(() => {
    if (next && new Date(next.at).getTime() <= now && fired.current !== next.reminder_id) {
      fired.current = next.reminder_id;
      onElapsed?.();
    }
  }, [now, next, onElapsed]);

  if (!data) return null;
  const due = data.due || [];
  const noSchedule = !next && !due.length && !(data.courses || []).length;
  if (noSchedule && !hasMedicines) return null;

  if (noSchedule) {
    return (
      <section className="nd nd--setup">
        <Styles />
        <p className="nd-eyebrow">Your medicines</p>
        <p className="nd-title">Set your dose times</p>
        <p className="nd-sub">Choose when you'll take your first dose and CivCare will count down to every dose and remind you.</p>
        <button className="nd-btn nd-btn--primary" onClick={onOpen}>Set reminders</button>
      </section>
    );
  }

  const target = next ? new Date(next.at).getTime() : null;
  const from = next?.previous_at ? new Date(next.previous_at).getTime() : null;
  const left = target ? target - now : 0;
  const span = target && from ? target - from : null;
  const progress = span ? Math.min(1, Math.max(0, 1 - left / span)) : null;
  const names = next ? [next, ...(next.also || [])] : [];
  const R = 46, C = 2 * Math.PI * R;

  return (
    <section className={`nd ${due.length ? 'nd--due' : ''}`} aria-live="polite">
      <Styles />
      {due.length > 0 ? (
        <div className="nd-due">
          <div className="nd-due__pulse" aria-hidden="true" />
          <div className="nd-due__text">
            <p className="nd-eyebrow">Time for your dose</p>
            <p className="nd-title">{due.map((d) => d.medication_name).join(' and ')}</p>
            <p className="nd-sub">{due.map((d) => [amount(d), `due ${timeOf(d.at)}`].filter(Boolean).join(', ')).join(' · ')}</p>
          </div>
          <button className="nd-btn nd-btn--primary" onClick={onOpen}>Take it now</button>
        </div>
      ) : null}

      {next && (
        <div className="nd-next">
          <div className="nd-ring" role="img" aria-label={`Next dose in ${clock(left)}`}>
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <circle cx="54" cy="54" r={R} className="nd-ring__track" />
              {progress != null && (
                <circle cx="54" cy="54" r={R} className="nd-ring__fill"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 54 54)" />
              )}
            </svg>
            <div className="nd-ring__in">
              <span className="nd-ring__time">{clock(left)}</span>
              <span className="nd-ring__cap">{left >= 3600000 ? 'hrs : min : sec' : 'min : sec'}</span>
            </div>
          </div>
          <div className="nd-next__text">
            <p className="nd-eyebrow">{due.length ? 'After that' : 'Next dose'}</p>
            <p className="nd-title">{names.map((m) => m.medication_name).join(' + ')}</p>
            <p className="nd-sub">
              {names.map(amount).filter(Boolean).join(' + ')}
              {names.some(amount) ? ' · ' : ''}
              {timeOf(next.at)} {dayWord(next.at)}
            </p>
            {data.streak >= 2 && (
              <p className="nd-streak"><span aria-hidden="true">★</span> {data.streak} doses in a row taken</p>
            )}
          </div>
        </div>
      )}

      {data.today?.length > 0 && (
        <div className="nd-today">
          <p className="nd-label">Today</p>
          <ol className="nd-doses">
            {data.today.map((d) => (
              <li key={d.reminder_id} className={`nd-dose nd-dose--${d.status}`} title={`${d.medication_name} · ${STATUS[d.status].label}`}>
                <span className="nd-dose__dot" aria-hidden="true">{STATUS[d.status].mark}</span>
                <span className="nd-dose__t">{timeOf(d.at)}</span>
                <span className="cc-visually-hidden">{d.medication_name}, {STATUS[d.status].label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(data.courses || []).map((c) => {
        const pct = c.doses_total ? Math.round((c.doses_taken / c.doses_total) * 100) : 0;
        return (
          <div key={c.diagnosis + c.ends_at} className="nd-course">
            <div className="nd-course__row">
              <span className="nd-course__name">{c.diagnosis}</span>
              <span className="nd-course__meta">
                {c.day && c.days ? `Day ${c.day} of ${c.days} · ` : ''}{c.doses_taken} of {c.doses_total} doses
              </span>
            </div>
            <div className="nd-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.diagnosis} treatment progress`}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}

      <button className="nd-foot" onClick={onOpen}>Open treatment plan <span aria-hidden="true">→</span></button>
    </section>
  );
}

function Styles() {
  return (
    <style>{`
      .nd { background: var(--cc-glass); border: 1px solid var(--cc-glass-border); border-radius: 20px; box-shadow: var(--cc-shadow);
        padding: 16px; display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; overflow: hidden; }
      .nd--due { border-color: var(--cc-primary-border); }
      .nd-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; color: var(--cc-muted); margin: 0 0 3px; }
      .nd-title { font-size: 17px; font-weight: 750; color: var(--cc-text); margin: 0; overflow-wrap: anywhere; }
      .nd-sub { font-size: 13px; color: var(--cc-muted); margin: 3px 0 0; line-height: 1.45; }
      .nd--setup .nd-btn { align-self: flex-start; margin-top: 4px; }
      .nd-btn { min-height: 40px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--cc-border-strong); background: var(--cc-surface-solid);
        color: var(--cc-text); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; flex-shrink: 0; }
      .nd-btn--primary { background: var(--cc-primary-grad); border-color: var(--cc-primary); color: var(--cc-on-primary); box-shadow: var(--cc-primary-glow); }
      .nd-btn:focus-visible, .nd-foot:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }

      .nd-due { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--cc-primary-soft); border-radius: 14px; padding: 12px 14px; }
      .nd-due__pulse { width: 12px; height: 12px; border-radius: 50%; background: var(--cc-primary); flex-shrink: 0; animation: ndPulse 1.6s ease-out infinite; }
      .nd-due__text { flex: 1; min-width: 150px; }
      @keyframes ndPulse { 0% { box-shadow: 0 0 0 0 rgba(23,105,170,.45); } 100% { box-shadow: 0 0 0 12px rgba(23,105,170,0); } }

      .nd-next { display: flex; align-items: center; gap: 16px; }
      .nd-ring { position: relative; width: 108px; height: 108px; flex-shrink: 0; }
      .nd-ring svg { width: 100%; height: 100%; display: block; }
      .nd-ring__track { fill: none; stroke: var(--cc-surface-3); stroke-width: 8; }
      .nd-ring__fill { fill: none; stroke: var(--cc-primary); stroke-width: 8; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
      .nd-ring__in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .nd-ring__time { font-size: 19px; font-weight: 800; color: var(--cc-text); font-variant-numeric: tabular-nums; letter-spacing: -.3px; }
      .nd-ring__cap { font-size: 8.5px; color: var(--cc-faint); letter-spacing: .3px; margin-top: 1px; }
      .nd-next__text { flex: 1; min-width: 0; }
      .nd-streak { display: inline-flex; gap: 5px; align-items: center; margin: 8px 0 0; font-size: 12px; font-weight: 650;
        color: var(--cc-success); background: var(--cc-success-soft); border: 1px solid var(--cc-success-border); border-radius: 999px; padding: 3px 10px; }

      .nd-label { font-size: 11px; font-weight: 700; color: var(--cc-muted); margin: 0 0 6px; }
      .nd-doses { list-style: none; display: flex; gap: 8px; overflow-x: auto; padding: 0 0 2px; margin: 0; scrollbar-width: none; }
      .nd-dose { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 52px; }
      .nd-dose__dot { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 800; border: 2px dashed var(--cc-border-strong); color: var(--cc-faint); background: var(--cc-surface-solid); }
      .nd-dose__t { font-size: 11px; color: var(--cc-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .nd-dose--taken .nd-dose__dot { border: 0; background: var(--cc-success); color: #fff; }
      .nd-dose--skipped .nd-dose__dot { border: 2px solid var(--cc-border-strong); color: var(--cc-muted); }
      .nd-dose--missed .nd-dose__dot { border: 2px solid var(--cc-warning); color: var(--cc-warning); background: var(--cc-warning-soft); }
      .nd-dose--due .nd-dose__dot { border: 0; background: var(--cc-primary); color: #fff; }

      .nd-course { display: flex; flex-direction: column; gap: 6px; }
      .nd-course__row { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; }
      .nd-course__name { font-weight: 650; color: var(--cc-text); }
      .nd-course__meta { color: var(--cc-muted); font-variant-numeric: tabular-nums; }
      .nd-bar { height: 8px; border-radius: 4px; background: var(--cc-surface-3); overflow: hidden; }
      .nd-bar span { display: block; height: 100%; border-radius: 4px; background: var(--cc-success); transition: width .4s ease; }

      .nd-foot { align-self: stretch; display: flex; justify-content: space-between; align-items: center; border: 0; border-top: 1px solid var(--cc-border);
        background: none; color: var(--cc-primary); font: inherit; font-size: 13.5px; font-weight: 650; padding: 12px 2px 0; cursor: pointer; }
      @media (prefers-reduced-motion: reduce) { .nd-due__pulse { animation: none; } .nd-ring__fill, .nd-bar span { transition: none; } }
    `}</style>
  );
}
