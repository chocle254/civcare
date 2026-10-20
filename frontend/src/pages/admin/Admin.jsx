import { useCallback, useEffect, useState } from 'react';

// The CivCare team's dashboard. Totals, money, ratings, hospital
// applications and the doctor list; never individual patient records.
// The admin token is kept apart from patient and doctor sign-ins, so
// opening this on a shared phone doesn't sign anyone else out.

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN = 'civcare_admin_token';
const ME = 'civcare_admin';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } };

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${read(TOKEN) || ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') {
    write(TOKEN, null);
    write(ME, null);
    window.dispatchEvent(new Event('civcare:admin-signed-out'));
  }
  if (!res.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
  return data;
}

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-KE'));
const kes = (n) => (n == null ? '—' : `KES ${Number(n).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const when = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};
const ago = (iso) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const STATUS_LABEL = {
  pending: 'Waiting', arrived: 'Arrived', called: 'Called in', in_progress: 'With doctor',
  completed: 'Seen', redirected: 'Moved', cancelled: 'Did not come', refunded: 'Refunded', expired: 'Expired',
};

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
];
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'hospitals', label: 'Hospitals' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'team', label: 'Team' },
];

export default function Admin() {
  const [me, setMe] = useState(() => { try { return JSON.parse(read(ME) || 'null'); } catch { return null; } });

  useEffect(() => {
    const out = () => setMe(null);
    window.addEventListener('civcare:admin-signed-out', out);
    return () => window.removeEventListener('civcare:admin-signed-out', out);
  }, []);

  return (
    <div className="adm">
      <AdminStyles />
      {me && read(TOKEN) ? <Dashboard me={me} onSignOut={() => { write(TOKEN, null); write(ME, null); setMe(null); }} />
        : <SignIn onIn={setMe} />}
    </div>
  );
}

function SignIn({ onIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await call('/admin/login', { method: 'POST', body: { email, password } });
      write(TOKEN, r.access_token);
      write(ME, JSON.stringify(r.admin));
      onIn(r.admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="adm-signin">
      <form className="adm-card adm-signin__card" onSubmit={submit}>
        <p className="adm-eyebrow">CivCare team</p>
        <h1 className="adm-h1">Sign in to the dashboard</h1>
        <p className="adm-muted">For CivCare staff only. Doctors sign in at <a href="/doctor">/doctor</a>.</p>
        <label className="label" htmlFor="adm-email">Email</label>
        <input id="adm-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="label" htmlFor="adm-pass">Password</label>
        <input id="adm-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="btn btn--primary adm-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function Dashboard({ me, onSignOut }) {
  const [tab, setTab] = useState(() => read('civcare_admin_tab') || 'overview');
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await call(`/admin/overview?days=${days}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { write('civcare_admin_tab', tab); }, [tab]);

  const pending = data?.hospitals?.pending || 0;

  return (
    <>
      <header className="adm-top">
        <div className="adm-top__in">
          <div>
            <p className="adm-eyebrow">CivCare team</p>
            <p className="adm-brand">Operations dashboard</p>
          </div>
          <div className="adm-top__me">
            <span className="adm-muted adm-hide-sm">{me.full_name}</span>
            <button className="btn btn--ghost btn--sm" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
        <nav className="adm-tabs" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button key={t.id} className={`adm-tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
              {t.id === 'hospitals' && pending > 0 && <span className="adm-count">{pending}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="adm-main">
        {tab === 'overview' && (
          <Overview data={data} days={days} setDays={setDays} loading={loading} error={error} reload={load} go={setTab} />
        )}
        {tab === 'hospitals' && <Hospitals onChange={load} />}
        {tab === 'doctors' && <Doctors />}
        {tab === 'feedback' && <Feedback />}
        {tab === 'team' && <Team />}
      </main>
    </>
  );
}

// ── Overview ──

function Overview({ data, days, setDays, loading, error, reload, go }) {
  return (
    <div className="adm-stack">
      <div className="adm-bar">
        <div className="adm-seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.days} className={days === p.days ? 'is-on' : ''} onClick={() => setDays(p.days)} aria-pressed={days === p.days}>{p.label}</button>
          ))}
        </div>
        <button className="btn btn--outline btn--sm" onClick={reload} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {error && <p className="adm-error" role="alert">{error}</p>}
      {!data && !error && <p className="adm-muted">Loading the numbers…</p>}

      {data && (
        <>
          {data.alerts.length > 0 && (
            <section className="adm-alerts" aria-label="Needs attention">
              {data.alerts.map((a, i) => (
                <button key={i} className={`adm-alert adm-alert--${a.level}`} onClick={() => go(a.tab)}>
                  <span className="adm-alert__dot" aria-hidden="true" />
                  <span>{a.text}</span>
                  {a.tab !== 'overview' && <span className="adm-alert__go" aria-hidden="true">›</span>}
                </button>
              ))}
            </section>
          )}

          <section className="adm-kpis" aria-label="Headline numbers">
            <Kpi label="Patients" value={num(data.patients.total)} sub={`${num(data.patients.new)} joined in this period`} />
            <Kpi label="Conversations with the assistant" value={num(data.triage.conversations)} sub={`${pct(data.triage.completed, data.triage.conversations)} finished`} />
            <Kpi label="Hospital visits" value={num(data.visits.total)} sub={`${num(data.visits.transferred)} transferred by a doctor`} />
            <Kpi label="Paid in" value={kes(data.money.collected)} sub={data.money.mode === 'test' ? 'Test mode: not real money' : `${kes(data.money.commission)} commission`} tone={data.money.mode === 'test' ? 'test' : ''} />
            <Kpi label="Patient rating" value={data.ratings.patients.average ? `${data.ratings.patients.average.toFixed(1)} / 5` : '—'} sub={`${num(data.ratings.patients.count)} ratings`} />
            <Kpi label="Doctors' rating of the AI" value={data.ratings.ai_accuracy.average ? `${data.ratings.ai_accuracy.average.toFixed(1)} / 5` : '—'} sub={`${num(data.ratings.ai_accuracy.count)} reviews`} />
          </section>

          <div className="adm-grid2">
            <Panel title="New patients" note={days === 0 || days > 90 ? 'Daily, last 90 days' : 'Daily'}>
              <Bars series={data.patients.series} label="new patients" />
              <dl className="adm-dl">
                <Row k="Used the assistant in this period" v={num(data.patients.active)} />
                <Row k="Accounts erased by the patient" v={num(data.patients.deleted)} />
                <Row k="Haven't agreed to the privacy notice" v={num(data.patients.without_consent)} warn={data.patients.without_consent > 0} />
              </dl>
            </Panel>

            <Panel title="Conversations with the assistant" note="Daily">
              <Bars series={data.triage.series} label="conversations" />
              <dl className="adm-dl">
                <Row k="Finished" v={`${num(data.triage.completed)} · ${pct(data.triage.completed, data.triage.conversations)}`} />
                <Row k="Left before the end" v={`${num(data.triage.abandoned)} · ${pct(data.triage.abandoned, data.triage.conversations)}`} />
                <Row k="Sent to a hospital" v={num(data.triage.sent_to_hospital)} />
                <Row k="Sent to an online doctor" v={num(data.triage.sent_online)} />
              </dl>
            </Panel>

            <Panel title="Hospital visits" note="Referrals the assistant made">
              <dl className="adm-dl">
                {Object.entries(data.visits.by_status).map(([k, v]) => <Row key={k} k={STATUS_LABEL[k] || k} v={num(v)} />)}
                {Object.keys(data.visits.by_status).length === 0 && <Row k="No visits yet" v="0" />}
                <Row k="Transferred to another doctor or hospital" v={num(data.visits.transferred)} />
                <Row k="Moved because the doctor went on break" v={num(data.visits.reassigned)} />
                <Row k="No doctor was available" v={num(data.visits.no_doctor)} warn={data.visits.no_doctor > 0} />
              </dl>
              <div className="adm-waits">
                <Wait label="Arrival to being called" m={data.visits.wait_to_call} />
                <Wait label="Called to finished" m={data.visits.call_to_done} />
              </div>
            </Panel>

            <Panel title="Money" note={data.money.mode === 'test' ? 'M-Pesa sandbox' : 'Live payments'} badge={data.money.mode === 'test' ? 'Test mode' : null}>
              <Bars series={data.money.series} label="paid consultations" />
              <dl className="adm-dl">
                <Row k={`Paid consultations (${num(data.money.paid_count)})`} v={kes(data.money.collected)} strong />
                <Row k="CivCare commission" v={kes(data.money.commission)} />
                <Row k="Owed or paid to doctors" v={kes(data.money.doctor_payouts)} />
                <Row k="Held until the consultation ends" v={kes(data.money.held_in_escrow)} />
                <Row k={`Refunded (${num(data.money.refunded_count)})`} v={kes(data.money.refunded)} warn={data.money.refunded_count > 0} />
                <Row k="Booked, not yet paid" v={num(data.money.awaiting_payment)} />
                {Object.entries(data.money.by_method).map(([k, v]) => <Row key={k} k={`Paid with ${k === 'mpesa' ? 'M-Pesa' : k === 'airtel' ? 'Airtel Money' : k}`} v={num(v)} />)}
              </dl>
            </Panel>

            <Panel title="Ratings">
              <Stars title="Patients rating their online consultation" r={data.ratings.patients} />
              <Stars title="Doctors rating the AI's triage" r={data.ratings.ai_accuracy} />
              <dl className="adm-dl">
                <Row k="Cases where the doctor disagreed with the AI" v={`${num(data.ratings.ai_disagreements)} of ${num(data.ratings.ai_reviews)}`} warn={data.ratings.ai_disagreements > 0} />
              </dl>
              <button className="btn btn--outline btn--sm" onClick={() => go('feedback')}>Read the comments</button>
            </Panel>

            <Panel title="After the visit" note="Medicine check-ins">
              <dl className="adm-dl">
                <Row k="Dose check-ins" v={num(data.follow_up.dose_checkins)} />
                <Row k="Dose taken" v={`${num(data.follow_up.doses_taken)} · ${pct(data.follow_up.doses_taken, data.follow_up.dose_checkins)}`} />
                <Row k="Felt worse or had side effects" v={num(data.follow_up.feeling_worse)} warn={data.follow_up.feeling_worse > 0} />
                <Row k="Finished a course of treatment" v={num(data.follow_up.courses_finished)} />
                <Row k="Still unwell at the end" v={num(data.follow_up.still_unwell)} warn={data.follow_up.still_unwell > 0} />
                <Row k="Came back for more care" v={num(data.follow_up.came_back)} />
              </dl>
            </Panel>

            <Panel title="Doctors and hospitals">
              <dl className="adm-dl">
                <Row k="Doctors, active" v={`${num(data.doctors.active)} of ${num(data.doctors.total)}`} />
                <Row k="Available right now" v={num(data.doctors.available_now)} />
                <Row k="Joined in this period" v={num(data.doctors.new)} />
                <Row k="Still on their National ID password" v={num(data.doctors.on_id_password)} warn={data.doctors.on_id_password > 0} />
                <Row k="Hospitals on CivCare" v={num(data.hospitals.approved || 0)} />
                <Row k="Applications waiting" v={num(data.hospitals.pending || 0)} warn={(data.hospitals.pending || 0) > 0} />
                <Row k="Applications turned down" v={num(data.hospitals.rejected || 0)} />
              </dl>
            </Panel>

            <Panel title="Records and privacy">
              <dl className="adm-dl">
                <Row k="Records uploaded by patients" v={num(data.records.uploaded)} />
                <Row k="Patients with uploaded records" v={num(data.records.patients_with_records)} />
                <Row k="Storage used" v={`${data.records.storage_mb} MB`} />
                <Row k="Times a doctor opened a record" v={num(data.privacy.record_opens)} />
              </dl>
              <p className="adm-muted adm-small">Patients can see who opened their record in Profile → Your privacy.</p>
            </Panel>
          </div>
          <p className="adm-muted adm-small">Updated {new Date(data.generated_at).toLocaleString('en-KE')}. Days run midnight to midnight, Nairobi time.</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className={`adm-kpi ${tone ? `adm-kpi--${tone}` : ''}`}>
      <p className="adm-kpi__label">{label}</p>
      <p className="adm-kpi__value">{value}</p>
      <p className="adm-kpi__sub">{sub}</p>
    </div>
  );
}

function Panel({ title, note, badge, children }) {
  return (
    <section className="adm-card adm-panel">
      <div className="adm-panel__head">
        <h2 className="adm-h2">{title}</h2>
        {badge ? <span className="adm-badge">{badge}</span> : note ? <span className="adm-muted adm-small">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, warn, strong }) {
  return (
    <div className={`adm-row ${warn ? 'is-warn' : ''} ${strong ? 'is-strong' : ''}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Wait({ label, m }) {
  return (
    <div className="adm-wait">
      <p className="adm-kpi__label">{label}</p>
      <p className="adm-wait__v">{m.median == null ? '—' : `${m.median} min`}</p>
      <p className="adm-muted adm-small">{m.median == null ? 'No timed visits yet' : `typical · 9 in 10 within ${m.p90} min · ${m.count} visits`}</p>
    </div>
  );
}

// Daily counts as bars, one scale from zero to the busiest day.
function Bars({ series, label }) {
  const [hover, setHover] = useState(null);
  if (!series?.length) return null;
  const max = Math.max(...series.map((d) => d.count), 1);
  const total = series.reduce((a, d) => a + d.count, 0);
  const W = 300, H = 64, gap = series.length > 40 ? 1 : 2;
  const bw = (W - gap * (series.length - 1)) / series.length;
  const shown = hover != null ? series[hover] : null;
  const fmt = (k) => new Date(`${k}T12:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return (
    <figure className="adm-bars">
      <figcaption className="adm-bars__cap">
        {shown ? <><strong>{num(shown.count)}</strong> {label} on {fmt(shown.date)}</>
          : <><strong>{num(total)}</strong> {label} · busiest day {num(max === 1 && total === 0 ? 0 : max)}</>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`${total} ${label}, daily`} onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H} y2={H} className="adm-bars__base" />
        {series.map((d, i) => {
          const h = d.count ? Math.max((d.count / max) * (H - 4), 3) : 0;
          const x = i * (bw + gap);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={x} y="0" width={bw + gap} height={H} fill="transparent" />
              {h > 0 && <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} className={`adm-bars__bar ${hover === i ? 'is-on' : ''}`} />}
            </g>
          );
        })}
        <text x="0" y={H + 12} className="adm-bars__tick">{fmt(series[0].date)}</text>
        <text x={W} y={H + 12} textAnchor="end" className="adm-bars__tick">{fmt(series[series.length - 1].date)}</text>
      </svg>
    </figure>
  );
}

function Stars({ title, r }) {
  const max = Math.max(...Object.values(r.distribution), 1);
  return (
    <div className="adm-stars">
      <p className="adm-stars__title">{title}</p>
      <p className="adm-stars__avg">{r.average ? r.average.toFixed(1) : '—'}<span> / 5 · {num(r.count)} ratings</span></p>
      {['5', '4', '3', '2', '1'].map((k) => (
        <div key={k} className="adm-stars__row">
          <span className="adm-stars__k">{k}★</span>
          <span className="adm-stars__track"><span className={`adm-stars__fill ${Number(k) <= 2 ? 'is-low' : ''}`} style={{ width: `${(r.distribution[k] / max) * 100}%` }} /></span>
          <span className="adm-stars__n">{num(r.distribution[k])}</span>
        </div>
      ))}
    </div>
  );
}

// ── Hospitals ──

function Hospitals({ onChange }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try { setRows(await call('/admin/hospitals')); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = (rows || []).filter((h) => filter === 'all' || h.status === filter);
  const count = (s) => (rows || []).filter((h) => h.status === s).length;

  return (
    <div className="adm-stack">
      <div className="adm-bar">
        <div className="adm-seg" role="group" aria-label="Show">
          {[['all', 'All'], ['pending', `Waiting (${count('pending')})`], ['approved', 'On CivCare'], ['rejected', 'Turned down']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</button>
          ))}
        </div>
        <p className="adm-muted adm-small">Hospitals apply at <strong>/hospital/register</strong>.</p>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {!rows && !error && <p className="adm-muted">Loading hospitals…</p>}
      {rows && shown.length === 0 && <p className="adm-muted">No hospitals here yet.</p>}
      <div className="adm-list">
        {shown.map((h) => (
          <HospitalCard key={h.id} h={h} open={open === h.id} toggle={() => setOpen(open === h.id ? null : h.id)}
            onSaved={() => { load(); onChange(); }} />
        ))}
      </div>
    </div>
  );
}

function HospitalCard({ h, open, toggle, onSaved }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');

  const decide = async (decision) => {
    setBusy(decision);
    setError('');
    try {
      await call(`/admin/hospitals/${h.id}/review`, { method: 'POST', body: { decision, note } });
      setConfirm('');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const state = h.status === 'pending' ? ['Waiting for review', 'action']
    : h.status === 'rejected' ? ['Turned down', 'muted']
      : h.is_active ? ['On CivCare', 'good'] : ['Suspended', 'warn'];

  return (
    <article className="adm-card adm-item">
      <button className="adm-item__head" onClick={toggle} aria-expanded={open}>
        <div>
          <p className="adm-item__title">{h.name}</p>
          <p className="adm-muted adm-small">{h.town}, {h.county} · KMHFL {h.facility_code}{h.level ? ` · ${h.level}` : ''}</p>
        </div>
        <span className={`adm-pill adm-pill--${state[1]}`}>{state[0]}</span>
      </button>
      {open && (
        <div className="adm-item__body">
          <dl className="adm-dl">
            <Row k="Ownership" v={h.ownership || '—'} />
            <Row k="Hospital phone" v={h.phone_number || '—'} />
            <Row k="Hospital email" v={h.email || '—'} />
            <Row k="Address" v={h.address || '—'} />
            <Row k="Location pinned" v={h.latitude != null ? `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}` : 'No: patients nearby won\'t see it'} warn={h.latitude == null} />
            <Row k="Applied by" v={h.contact_name ? `${h.contact_name}, ${h.contact_role}` : '—'} />
            <Row k="Their phone" v={h.contact_phone || '—'} />
            <Row k="Their email" v={h.contact_email || '—'} />
            <Row k="Applied" v={when(h.applied_at || h.created_at)} />
            <Row k="Doctors" v={num(h.doctors)} />
            <Row k="Hospital visits" v={num(h.visits)} />
            {h.reviewed_at && <Row k="Last decision" v={`${when(h.reviewed_at)} by ${h.reviewed_by}`} />}
            {h.review_note && <Row k="Note" v={h.review_note} />}
          </dl>
          {h.status === 'pending' && (
            <p className="adm-muted adm-small">Before approving, call the person who applied and check the facility code on the Kenya Master Health Facility List (kmhfl.health.go.ke).</p>
          )}
          <label className="label" htmlFor={`note-${h.id}`}>Note (required to turn down)</label>
          <input id={`note-${h.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Facility code doesn't match KMHFL" />
          {error && <p className="adm-error" role="alert">{error}</p>}
          <div className="adm-actions">
            {(h.status !== 'approved' || !h.is_active) && (
              <button className="btn btn--success btn--sm" disabled={!!busy} onClick={() => decide(h.status === 'approved' ? 'reactivate' : 'approve')}>
                {busy === 'approve' || busy === 'reactivate' ? 'Saving…' : h.status === 'approved' ? 'Reactivate' : 'Approve'}
              </button>
            )}
            {h.status === 'pending' && (
              <button className="btn btn--outline btn--sm" disabled={!!busy} onClick={() => decide('reject')}>{busy === 'reject' ? 'Saving…' : 'Turn down'}</button>
            )}
            {h.status === 'approved' && h.is_active && (confirm === 'suspend' ? (
              <>
                <span className="adm-small">Patients and doctors will no longer see it.</span>
                <button className="btn btn--danger btn--sm" disabled={!!busy} onClick={() => decide('suspend')}>{busy === 'suspend' ? 'Saving…' : 'Yes, suspend'}</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setConfirm('')}>Cancel</button>
              </>
            ) : (
              <button className="btn btn--outline btn--sm" onClick={() => setConfirm('suspend')}>Suspend</button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ── Doctors ──

function Doctors() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setRows(await call('/admin/doctors')); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (d) => {
    setBusy(d.id);
    try { await call(`/admin/doctors/${d.id}/active`, { method: 'POST', body: { active: !d.is_active } }); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const term = q.trim().toLowerCase();
  const shown = (rows || []).filter((d) => !term || [d.full_name, d.hospital, d.kmpdb_license, d.specialisation].some((x) => (x || '').toLowerCase().includes(term)));

  return (
    <div className="adm-stack">
      <div className="adm-bar">
        <label className="cc-visually-hidden" htmlFor="adm-q">Search doctors</label>
        <input id="adm-q" className="input adm-search" placeholder="Search name, hospital or licence" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="adm-muted adm-small">Check each licence on the KMPDC register before a doctor sees patients.</p>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {!rows && !error && <p className="adm-muted">Loading doctors…</p>}
      {rows && shown.length === 0 && <p className="adm-muted">No doctors match.</p>}
      {shown.length > 0 && (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Doctor</th><th>Hospital</th><th className="n">Patients seen</th><th className="n">Online consults</th>
                <th className="n">Patient rating</th><th>Last active</th><th>Account</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={d.is_active ? '' : 'is-off'}>
                  <td>
                    <strong>{d.full_name}</strong>
                    <span className="adm-muted adm-small adm-block">{d.kmpdb_license}{d.specialisation ? ` · ${d.specialisation}` : ''}</span>
                    {d.on_id_password && d.is_active && <span className="adm-pill adm-pill--warn adm-pill--xs">National ID password</span>}
                  </td>
                  <td>{d.hospital}</td>
                  <td className="n">{num(d.patients_seen)}</td>
                  <td className="n">{num(d.consultations)}</td>
                  <td className="n">{d.patient_rating ? `${d.patient_rating.toFixed(1)} (${d.patient_ratings})` : '—'}</td>
                  <td>{ago(d.last_active_at)}</td>
                  <td>
                    <button className={`btn btn--sm ${d.is_active ? 'btn--outline' : 'btn--success'}`} disabled={busy === d.id} onClick={() => toggle(d)}>
                      {busy === d.id ? 'Saving…' : d.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Feedback ──

function Feedback() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [low, setLow] = useState(false);
  useEffect(() => { call('/admin/feedback?days=90').then(setData).catch((e) => setError(e.message)); }, []);
  const pick = (list) => (list || []).filter((r) => !low || Number(r.stars) <= 2);

  return (
    <div className="adm-stack">
      <div className="adm-bar">
        <label className="adm-check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Only 1 and 2 stars</label>
        <p className="adm-muted adm-small">Last 90 days. Patients aren't named here.</p>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {!data && !error && <p className="adm-muted">Loading feedback…</p>}
      {data && (
        <div className="adm-grid2">
          <FeedbackList title="Patients on their online consultation" rows={pick(data.patients)} />
          <FeedbackList title="Doctors on the AI's triage" rows={pick(data.doctors_on_ai)} />
        </div>
      )}
    </div>
  );
}

function FeedbackList({ title, rows }) {
  return (
    <section className="adm-card adm-panel">
      <h2 className="adm-h2">{title}</h2>
      {rows.length === 0 && <p className="adm-muted">No ratings yet.</p>}
      <ul className="adm-fb">
        {rows.map((r, i) => (
          <li key={i} className={Number(r.stars) <= 2 ? 'is-low' : ''}>
            <p className="adm-fb__top"><span className="adm-fb__stars" aria-label={`${r.stars} of 5 stars`}>{'★'.repeat(Number(r.stars) || 0)}<span className="adm-fb__off">{'★'.repeat(5 - (Number(r.stars) || 0))}</span></span> <span className="adm-muted adm-small">{when(r.date)}</span></p>
            {r.comment && <p className="adm-fb__c">“{r.comment}”</p>}
            <p className="adm-muted adm-small">{r.doctor} · {r.hospital}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Team ──

function Team() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => call('/admin/team').then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await call('/admin/team', { method: 'POST', body: form });
      setMsg(`${r.message} Give them the password in person or by phone, not by SMS or email.`);
      setForm({ full_name: '', email: '', password: '' });
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="adm-grid2">
      <section className="adm-card adm-panel">
        <h2 className="adm-h2">Who can sign in</h2>
        {!rows && <p className="adm-muted">Loading…</p>}
        <ul className="adm-fb">
          {(rows || []).map((a) => (
            <li key={a.id}><p><strong>{a.full_name}</strong></p><p className="adm-muted adm-small">{a.email} · last signed in {ago(a.last_login_at)}</p></li>
          ))}
        </ul>
      </section>
      <form className="adm-card adm-panel" onSubmit={add}>
        <h2 className="adm-h2">Add a team member</h2>
        <p className="adm-muted adm-small">They'll see totals, ratings and payments, and can approve hospitals. They can't open patient records.</p>
        <label className="label" htmlFor="t-name">Name</label>
        <input id="t-name" className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <label className="label" htmlFor="t-email">Email</label>
        <input id="t-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <label className="label" htmlFor="t-pass">First password (10+ characters)</label>
        <input id="t-pass" className="input" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
        {error && <p className="adm-error" role="alert">{error}</p>}
        {msg && <p className="adm-ok" role="status">{msg}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Adding…' : 'Add team member'}</button>
      </form>
    </div>
  );
}

function AdminStyles() {
  return (
    <style>{`
      .adm { min-height: 100vh; background: var(--cc-bg); color: var(--cc-text); font-family: Inter, system-ui, sans-serif; }
      .adm a { color: var(--cc-primary); }
      .adm-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--cc-muted); }
      .adm-h1 { font-size: 22px; font-weight: 700; text-wrap: balance; }
      .adm-h2 { font-size: 15px; font-weight: 650; }
      .adm-muted { color: var(--cc-muted); }
      .adm-small { font-size: 12.5px; line-height: 1.45; }
      .adm-block { display: block; }
      .adm-error { color: var(--cc-danger); font-size: 13.5px; }
      .adm-ok { color: var(--cc-success); font-size: 13.5px; }
      .adm-full { width: 100%; }
      .adm-card { background: var(--cc-surface-solid); border: 1px solid var(--cc-border); border-radius: 14px; }

      .adm-signin { min-height: 100vh; display: grid; place-items: center; padding: 24px max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px)); }
      .adm-signin__card { width: 100%; max-width: 380px; padding: 28px 24px; display: flex; flex-direction: column; gap: 10px; }
      .adm-signin__card .btn { margin-top: 8px; }

      .adm-top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--cc-surface-solid); border-bottom: 1px solid var(--cc-border); }
      .adm-top__in, .adm-tabs, .adm-main { max-width: 1180px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
      .adm-top__in { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-block: 12px 6px; }
      .adm-brand { font-size: 17px; font-weight: 700; }
      .adm-top__me { display: flex; align-items: center; gap: 10px; }
      .adm-tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
      .adm-tab { background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 10px; font: inherit; font-size: 14px; font-weight: 550; color: var(--cc-muted); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
      .adm-tab.is-on { color: var(--cc-primary); border-bottom-color: var(--cc-primary); }
      .adm-tab:focus-visible, .adm-seg button:focus-visible, .adm-alert:focus-visible, .adm-item__head:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
      .adm-count { background: var(--cc-warning); color: #fff; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 7px; }

      .adm-main { padding-block: 18px 48px; }
      .adm-stack { display: flex; flex-direction: column; gap: 16px; }
      .adm-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
      .adm-seg { display: inline-flex; flex-wrap: wrap; background: var(--cc-surface-3); border-radius: 10px; padding: 3px; gap: 2px; }
      .adm-seg button { border: 0; background: none; font: inherit; font-size: 13px; font-weight: 550; color: var(--cc-text-2); padding: 6px 12px; border-radius: 8px; cursor: pointer; }
      .adm-seg button.is-on { background: var(--cc-surface-solid); color: var(--cc-text); box-shadow: 0 1px 2px rgba(16,24,40,.12); }
      .adm-search { max-width: 340px; }
      .adm-check { display: inline-flex; gap: 8px; align-items: center; font-size: 14px; }

      .adm-alerts { display: flex; flex-direction: column; gap: 6px; }
      .adm-alert { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; font: inherit; font-size: 14px; padding: 10px 14px; border-radius: 10px; border: 1px solid; cursor: pointer; color: var(--cc-text); }
      .adm-alert__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .adm-alert__go { margin-left: auto; font-size: 18px; color: var(--cc-muted); }
      .adm-alert--action { background: var(--cc-primary-soft); border-color: var(--cc-primary-border); }
      .adm-alert--action .adm-alert__dot { background: var(--cc-primary); }
      .adm-alert--warning { background: var(--cc-warning-soft); border-color: var(--cc-warning-border); }
      .adm-alert--warning .adm-alert__dot { background: var(--cc-warning); }
      .adm-alert--info { background: var(--cc-surface-2); border-color: var(--cc-border); }
      .adm-alert--info .adm-alert__dot { background: var(--cc-faint); }

      .adm-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
      .adm-kpi { background: var(--cc-surface-solid); border: 1px solid var(--cc-border); border-radius: 12px; padding: 14px; }
      .adm-kpi--test { border-style: dashed; }
      .adm-kpi__label { font-size: 11.5px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: var(--cc-muted); }
      .adm-kpi__value { font-size: 24px; font-weight: 700; margin-top: 6px; font-variant-numeric: tabular-nums; }
      .adm-kpi__sub { font-size: 12.5px; color: var(--cc-muted); margin-top: 2px; }

      .adm-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; align-items: start; }
      @media (max-width: 400px) { .adm-grid2 { grid-template-columns: 1fr; } .adm-hide-sm { display: none; } }
      .adm-panel { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .adm-panel__head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .adm-badge { font-size: 11px; font-weight: 700; color: var(--cc-warning); background: var(--cc-warning-soft); border: 1px solid var(--cc-warning-border); border-radius: 999px; padding: 2px 8px; }

      .adm-dl { display: flex; flex-direction: column; }
      .adm-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid var(--cc-border); font-size: 13.5px; }
      .adm-row:first-child { border-top: 0; }
      .adm-row dt { color: var(--cc-text-2); }
      .adm-row dd { font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
      .adm-row.is-warn dd { color: var(--cc-warning); }
      .adm-row.is-strong dd { font-size: 15px; }

      .adm-waits { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .adm-wait { background: var(--cc-surface-2); border-radius: 10px; padding: 10px 12px; }
      .adm-wait__v { font-size: 20px; font-weight: 700; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }

      .adm-bars { margin: 0; }
      .adm-bars__cap { font-size: 12.5px; color: var(--cc-muted); margin-bottom: 6px; min-height: 18px; }
      .adm-bars__cap strong { color: var(--cc-text); font-variant-numeric: tabular-nums; }
      .adm-bars svg { width: 100%; height: auto; display: block; overflow: visible; }
      .adm-bars__base { stroke: var(--cc-border-strong); stroke-width: 1; }
      .adm-bars__bar { fill: var(--cc-primary); opacity: .78; }
      .adm-bars__bar.is-on { opacity: 1; }
      .adm-bars__tick { font-size: 9px; fill: var(--cc-muted); }

      .adm-stars__title { font-size: 13px; color: var(--cc-text-2); }
      .adm-stars__avg { font-size: 20px; font-weight: 700; margin: 2px 0 6px; font-variant-numeric: tabular-nums; }
      .adm-stars__avg span { font-size: 12.5px; font-weight: 500; color: var(--cc-muted); }
      .adm-stars__row { display: grid; grid-template-columns: 28px 1fr 34px; align-items: center; gap: 8px; font-size: 12.5px; padding: 2px 0; }
      .adm-stars__k { color: var(--cc-muted); }
      .adm-stars__n { text-align: right; font-variant-numeric: tabular-nums; }
      .adm-stars__track { height: 8px; background: var(--cc-surface-3); border-radius: 4px; overflow: hidden; }
      .adm-stars__fill { display: block; height: 100%; background: var(--cc-primary); border-radius: 4px; }
      .adm-stars__fill.is-low { background: var(--cc-warning); }

      .adm-list { display: flex; flex-direction: column; gap: 8px; }
      .adm-item__head { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; background: none; border: 0; text-align: left; font: inherit; color: inherit; cursor: pointer; }
      .adm-item__title { font-weight: 650; font-size: 15px; }
      .adm-item__body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
      .adm-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .adm-pill { font-size: 12px; font-weight: 650; border-radius: 999px; padding: 3px 10px; white-space: nowrap; border: 1px solid; }
      .adm-pill--xs { font-size: 11px; padding: 1px 7px; display: inline-block; margin-top: 4px; }
      .adm-pill--action { color: var(--cc-primary); background: var(--cc-primary-soft); border-color: var(--cc-primary-border); }
      .adm-pill--good { color: var(--cc-success); background: var(--cc-success-soft); border-color: var(--cc-success-border); }
      .adm-pill--warn { color: var(--cc-warning); background: var(--cc-warning-soft); border-color: var(--cc-warning-border); }
      .adm-pill--muted { color: var(--cc-muted); background: var(--cc-surface-2); border-color: var(--cc-border); }

      .adm-tablewrap { overflow-x: auto; border: 1px solid var(--cc-border); border-radius: 12px; background: var(--cc-surface-solid); }
      .adm-table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 760px; }
      .adm-table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--cc-muted); font-weight: 650; padding: 10px 12px; border-bottom: 1px solid var(--cc-border); }
      .adm-table td { padding: 10px 12px; border-bottom: 1px solid var(--cc-border); vertical-align: top; }
      .adm-table tr:last-child td { border-bottom: 0; }
      .adm-table .n { text-align: right; font-variant-numeric: tabular-nums; }
      .adm-table tr.is-off td { color: var(--cc-muted); }

      .adm-fb { list-style: none; display: flex; flex-direction: column; }
      .adm-fb li { padding: 10px 0; border-top: 1px solid var(--cc-border); display: flex; flex-direction: column; gap: 3px; }
      .adm-fb li:first-child { border-top: 0; }
      .adm-fb li.is-low { box-shadow: inset 3px 0 0 var(--cc-warning); padding-left: 10px; }
      .adm-fb__stars { color: var(--cc-warning); letter-spacing: 1px; }
      .adm-fb__off { color: var(--cc-border-strong); }
      .adm-fb__c { font-size: 14px; line-height: 1.5; }
      @media (prefers-reduced-motion: reduce) { .adm * { transition: none !important; } }
    `}</style>
  );
}
