import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

// Patients keep their own X-rays, scans, surgery and discharge reports and
// lab results here. Doctors caring for them can open the files. For written
// reports the assistant copies out what the document says; it never reads
// X-ray or scan images.

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const KINDS = [
  { id: 'xray', label: 'X-ray or scan image', reads: false },
  { id: 'surgery', label: 'Surgery or operation report', reads: true },
  { id: 'discharge', label: 'Discharge summary', reads: true },
  { id: 'imaging', label: 'Radiology or scan report (written)', reads: true },
  { id: 'lab', label: 'Lab result', reads: true },
  { id: 'prescription', label: 'Prescription or clinic card', reads: true },
  { id: 'other', label: 'Other medical document', reads: true },
];
const MAX_MB = 10;

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtTaken = (t) => {
  if (!t) return '';
  const d = new Date(t.length === 7 ? `${t}-15` : t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleDateString('en-KE', t.length === 7 ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

// Phone photos are often 4–8 MB. Shrink to a sharp 2400 px JPEG so they
// upload quickly on mobile data and the assistant can read them.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export async function openRecord(id) {
  const tab = window.open('', '_blank');
  try {
    const { data } = await axios.get(`${API}/documents/${id}/open`);
    if (tab) tab.location.href = data.url; else window.location.href = data.url;
  } catch (e) {
    if (tab) tab.close();
    throw e;
  }
}

function ReadState({ d }) {
  if (d.kind === 'xray') return <span className="mr-chip mr-chip--muted">Image for your doctor</span>;
  if (d.read_status === 'pending') return <span className="mr-chip mr-chip--info">Assistant is reading it…</span>;
  if (d.read_status === 'read') return <span className="mr-chip mr-chip--ok">Assistant has read it</span>;
  return <span className="mr-chip mr-chip--warn">Not readable by the assistant</span>;
}

function Extracted({ ex }) {
  if (!ex) return null;
  const list = (label, v) => (v?.length ? <div><dt>{label}</dt><dd>{v.join('; ')}</dd></div> : null);
  const one = (label, v) => (v ? <div><dt>{label}</dt><dd>{v}</dd></div> : null);
  return (
    <dl className="mr-ex">
      {one('Summary', ex.summary)}
      {one('Document', ex.document_type)}
      {one('Date written', ex.date)}
      {one('Facility', ex.facility)}
      {list('Procedures', ex.procedures)}
      {list('Diagnoses written', ex.diagnoses)}
      {list('Medicines', ex.medicines)}
      {list('Allergies', ex.allergies)}
      {list('Results', ex.results)}
      {one('Report’s own conclusion', ex.stated_conclusion)}
      {one('Follow-up', ex.follow_up)}
      {one('Why not', ex.reason)}
    </dl>
  );
}

export default function MedicalRecords() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/documents/mine`);
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Could not load your records. Please try again.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Reports are read in the background; check back while any are pending.
  useEffect(() => {
    if (!rows?.some((d) => d.read_status === 'pending')) return undefined;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [rows, load]);

  const del = async (id) => {
    setBusyId(id);
    try {
      await axios.delete(`${API}/documents/${id}`);
      setConfirmDel(null);
      await load();
    } catch {
      setError('Could not delete it. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const view = async (id) => {
    setError('');
    try { await openRecord(id); } catch { setError('Could not open the file. Please try again.'); }
  };

  return (
    <div className="mr">
      <MrStyles />
      <div className="mr-intro">
        <p>Keep your X-rays, scans, surgery reports and lab results here. Doctors treating you through CivCare can open them, and the assistant can take past operations and results into account.</p>
        {!adding && <button className="mr-btn mr-btn--primary" onClick={() => setAdding(true)}>Add a record</button>}
      </div>

      {adding && <UploadForm onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      {error && <p className="mr-err" role="alert">{error}</p>}
      {!rows && !error && <p className="mr-muted">Loading your records…</p>}
      {rows && rows.length === 0 && !adding && (
        <p className="mr-muted">No records yet. A photo of a discharge summary or an X-ray film is enough to start.</p>
      )}

      <ul className="mr-list">
        {(rows || []).map((d) => (
          <li key={d.id} className="mr-item">
            <div className="mr-item__top">
              <div className="mr-item__main">
                <p className="mr-title">{d.title}</p>
                <p className="mr-meta">{d.kind_label}{d.taken_on ? ` · ${fmtTaken(d.taken_on)}` : ''}{d.facility ? ` · ${d.facility}` : ''}</p>
              </div>
              <ReadState d={d} />
            </div>
            {d.notes && <p className="mr-note">{d.notes}</p>}
            <div className="mr-actions">
              <button className="mr-btn" onClick={() => view(d.id)}>Open</button>
              {d.kind !== 'xray' && d.read_status !== 'pending' && (
                <button className="mr-btn" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                  {open === d.id ? 'Hide' : 'What the assistant copied'}
                </button>
              )}
              {confirmDel === d.id ? (
                <>
                  <button className="mr-btn mr-btn--danger" disabled={busyId === d.id} onClick={() => del(d.id)}>{busyId === d.id ? 'Deleting…' : 'Delete for good'}</button>
                  <button className="mr-btn" onClick={() => setConfirmDel(null)}>Keep</button>
                </>
              ) : (
                <button className="mr-btn mr-btn--quiet" onClick={() => setConfirmDel(d.id)}>Delete</button>
              )}
              <span className="mr-meta mr-size">{fmtSize(d.size_bytes)}</span>
            </div>
            {open === d.id && <Extracted ex={d.extracted} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UploadForm({ onDone, onCancel }) {
  const [kind, setKind] = useState('');
  const [title, setTitle] = useState('');
  const [takenOn, setTakenOn] = useState('');
  const [facility, setFacility] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const k = KINDS.find((x) => x.id === kind);

  const pick = (e) => {
    const f = e.target.files?.[0];
    setError('');
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { setError('Choose a photo (JPG, PNG, WebP) or a PDF.'); return; }
    if (f.size > MAX_MB * 1048576 && f.type === 'application/pdf') { setError(`The PDF is larger than ${MAX_MB} MB.`); return; }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!kind || !title.trim() || !file) { setError('Choose the kind of record, give it a name and pick the file.'); return; }
    setBusy(true);
    setError('');
    try {
      const small = await shrink(file);
      if (small.size > MAX_MB * 1048576) throw new Error(`The file is larger than ${MAX_MB} MB.`);
      const body = new FormData();
      body.append('file', small);
      body.append('kind', kind);
      body.append('title', title.trim());
      body.append('taken_on', takenOn);
      body.append('facility', facility.trim());
      body.append('notes', notes.trim());
      body.append('consent', consent ? 'true' : 'false');
      await axios.post(`${API}/documents/upload`, body, { onUploadProgress: (p) => p.total && setProgress(Math.round((p.loaded / p.total) * 100)) });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Could not upload. Please try again.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <form className="mr-form" onSubmit={submit}>
      <p className="mr-title">Add a record</p>
      <label className="mr-label" htmlFor="mr-kind">What is it?</label>
      <select id="mr-kind" className="mr-input" value={kind} onChange={(e) => setKind(e.target.value)} required>
        <option value="">Choose</option>
        {KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      {k && (
        <p className="mr-hint">{k.reads
          ? 'The assistant will copy out what the report says (operations, diagnoses, medicines). It won’t judge the results.'
          : 'The assistant won’t look at the image. Only your doctor will. Add a note about what it was for.'}</p>
      )}
      <label className="mr-label" htmlFor="mr-title">Name</label>
      <input id="mr-title" className="mr-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'xray' ? 'e.g. Chest X-ray' : 'e.g. Appendix operation'} maxLength={120} required />
      <div className="mr-two">
        <div>
          <label className="mr-label" htmlFor="mr-when">When (month)</label>
          <input id="mr-when" className="mr-input" type="month" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} max={new Date().toISOString().slice(0, 7)} />
        </div>
        <div>
          <label className="mr-label" htmlFor="mr-where">Where</label>
          <input id="mr-where" className="mr-input" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="Hospital or clinic" maxLength={120} />
        </div>
      </div>
      <label className="mr-label" htmlFor="mr-notes">Note for your doctor (optional)</label>
      <textarea id="mr-notes" className="mr-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="e.g. Taken for the cough I had in March" />

      <label className="mr-label" htmlFor="mr-file">File</label>
      <input id="mr-file" className="mr-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pick} />
      <p className="mr-hint">A clear photo in good light works. Up to {MAX_MB} MB.{file ? ` Chosen: ${file.name} (${fmtSize(file.size)}).` : ''}</p>

      <label className="mr-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree that CivCare stores this file securely and shows it to the doctors treating me. For written reports, the assistant copies out the text to help with my care. I can delete it at any time.</span>
      </label>

      {error && <p className="mr-err" role="alert">{error}</p>}
      <div className="mr-actions">
        <button className="mr-btn mr-btn--primary" disabled={busy || !consent}>{busy ? (progress ? `Uploading ${progress}%` : 'Preparing…') : 'Upload'}</button>
        <button type="button" className="mr-btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

export function MrStyles() {
  return (
    <style>{`
      .mr { display: flex; flex-direction: column; gap: 14px; }
      .mr-intro { display: flex; flex-direction: column; gap: 10px; font-size: 13.5px; line-height: 1.55; color: var(--cc-text-2); }
      .mr-intro .mr-btn { align-self: flex-start; }
      .mr-muted { font-size: 13px; color: var(--cc-faint); }
      .mr-err { font-size: 13px; color: var(--cc-danger); }
      .mr-hint { font-size: 12.5px; color: var(--cc-muted); line-height: 1.45; }
      .mr-list { list-style: none; display: flex; flex-direction: column; gap: 10px; padding: 0; margin: 0; }
      .mr-item { background: var(--cc-surface); border: 1px solid var(--cc-glass-border); border-radius: 14px; box-shadow: var(--cc-shadow-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
      .mr-item__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
      .mr-item__main { min-width: 0; }
      .mr-title { font-size: 14.5px; font-weight: 600; color: var(--cc-text); margin: 0; overflow-wrap: anywhere; }
      .mr-meta { font-size: 12px; color: var(--cc-faint); margin: 3px 0 0; }
      .mr-size { margin: 0 0 0 auto; }
      .mr-note { font-size: 13px; color: var(--cc-muted); line-height: 1.5; margin: 0; }
      .mr-chip { font-size: 11px; font-weight: 650; border-radius: 999px; padding: 3px 9px; border: 1px solid; white-space: nowrap; }
      .mr-chip--ok { color: var(--cc-success); background: var(--cc-success-soft); border-color: var(--cc-success-border); }
      .mr-chip--info { color: var(--cc-info); background: var(--cc-info-soft); border-color: var(--cc-info-border); }
      .mr-chip--warn { color: var(--cc-warning); background: var(--cc-warning-soft); border-color: var(--cc-warning-border); }
      .mr-chip--muted { color: var(--cc-muted); background: var(--cc-surface-2); border-color: var(--cc-border); }
      .mr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .mr-btn { min-height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--cc-border-strong); background: var(--cc-surface-solid); color: var(--cc-text); font: inherit; font-size: 13.5px; font-weight: 550; cursor: pointer; }
      .mr-btn:disabled { opacity: .55; cursor: default; }
      .mr-btn:focus-visible { outline: 2px solid var(--cc-primary); outline-offset: 2px; }
      .mr-btn--primary { background: var(--cc-primary); border-color: var(--cc-primary); color: var(--cc-on-primary); }
      .mr-btn--danger { background: var(--cc-danger); border-color: var(--cc-danger); color: #fff; }
      .mr-btn--quiet { border-color: transparent; background: none; color: var(--cc-muted); }
      .mr-ex { display: flex; flex-direction: column; gap: 6px; background: var(--cc-surface-2); border-radius: 10px; padding: 10px 12px; margin: 0; font-size: 13px; }
      .mr-ex dt { font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .04em; color: var(--cc-muted); }
      .mr-ex dd { margin: 1px 0 0; color: var(--cc-text); line-height: 1.45; overflow-wrap: anywhere; }
      .mr-form { background: var(--cc-surface-solid); border: 1px solid var(--cc-primary-border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
      .mr-label { font-size: 12.5px; font-weight: 600; color: var(--cc-text-2); margin-top: 4px; }
      .mr-input { width: 100%; min-height: 40px; border-radius: 10px; border: 1px solid var(--cc-border-strong); background: var(--cc-surface-solid); color: var(--cc-text); font: inherit; font-size: 14px; padding: 8px 10px; }
      .mr-input:focus { outline: 2px solid var(--cc-primary); outline-offset: 0; }
      textarea.mr-input { resize: vertical; }
      .mr-file { font-size: 13.5px; color: var(--cc-text-2); max-width: 100%; }
      .mr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      @media (max-width: 420px) { .mr-two { grid-template-columns: 1fr; } }
      .mr-consent { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.5; color: var(--cc-text-2); margin-top: 6px; }
      .mr-consent input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
    `}</style>
  );
}

// Doctor side: the files a patient uploaded, inside the case file.
export function PatientRecords({ patientId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    axios.get(`${API}/documents/patient/${patientId}`)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load the patient’s uploaded records.'));
  }, [patientId]);

  const view = async (id) => {
    setError('');
    try { await openRecord(id); } catch { setError('Could not open the file. Please try again.'); }
  };

  return (
    <section className="pp-card">
      <MrStyles />
      <h2 className="pp-h">Records the patient uploaded</h2>
      <p className="mr-hint">The patient’s own files, not checked by a clinician. For written reports the assistant only copied the text; it never read the images. Opening a file is recorded in the patient’s access log.</p>
      {error && <p className="mr-err" role="alert">{error}</p>}
      {!rows && !error && <p className="mr-muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="mr-muted">None uploaded.</p>}
      <ul className="mr-list">
        {(rows || []).map((d) => (
          <li key={d.id} className="mr-item">
            <div className="mr-item__top">
              <div className="mr-item__main">
                <p className="mr-title">{d.title}</p>
                <p className="mr-meta">{d.kind_label}{d.taken_on ? ` · ${fmtTaken(d.taken_on)}` : ''}{d.facility ? ` · ${d.facility}` : ''}</p>
              </div>
            </div>
            {d.extracted?.summary && <p className="mr-note">{d.extracted.summary}</p>}
            {d.notes && <p className="mr-note">Patient’s note: {d.notes}</p>}
            <div className="mr-actions">
              <button className="mr-btn mr-btn--primary" onClick={() => view(d.id)}>Open file</button>
              {d.extracted && Object.keys(d.extracted).length > 1 && (
                <button className="mr-btn" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>{open === d.id ? 'Hide details' : 'Copied details'}</button>
              )}
            </div>
            {open === d.id && <Extracted ex={d.extracted} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
