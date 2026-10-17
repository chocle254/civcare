import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerDoctor, loginDoctor } from '../../api/auth';
import Icon from '../../components/Icons';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNatId, setShowNatId] = useState(false);

  const [loginForm, setLoginForm] = useState({ kmpdb_license: '', national_id: '' });
  const [regForm, setRegForm] = useState({
    full_name: '', phone_number: '', national_id: '', kmpdb_license: '',
    specialisation: '', hospital_name: '', consultation_fee: '',
    shift_start: '08:00', shift_end: '17:00',
  });
  const [hospitals, setHospitals] = useState([]);

  // Already signed in? Skip the sign-in screen (e.g. when pressing Back).
  useEffect(() => {
    if (localStorage.getItem('civtech_token') && localStorage.getItem('civtech_doctor')) {
      navigate('/doctor/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/hospitals/registered`)
      .then(r => r.json())
      .then(data => setHospitals(data || []))
      .catch(() => { });
  }, []);

  const SPECIALISATIONS = [
    'General Practitioner', 'Internal Medicine', 'Paediatrics',
    'Obstetrics & Gynaecology', 'Surgery', 'Orthopaedics',
    'Cardiology', 'Neurology', 'Psychiatry', 'Dermatology',
    'Ophthalmology', 'ENT (Ear, Nose & Throat)', 'Radiology',
    'Anaesthesiology', 'Emergency Medicine', 'Oncology',
    'Urology', 'Nephrology', 'Gastroenterology', 'Pulmonology',
  ];

  const handleLoginChange = (e) => setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  const handleRegChange = (e) => setRegForm({ ...regForm, [e.target.name]: e.target.value });

  const saveAndNavigate = (data) => {
    localStorage.setItem('civtech_token', data.access_token);
    localStorage.setItem('civtech_doctor', JSON.stringify(data.doctor));
    navigate('/doctor/dashboard', { replace: true });
  };

  const handleLogin = async () => {
    setError('');
    if (!loginForm.kmpdb_license || !loginForm.national_id) {
      setError('Please enter your KMPDB license number and National ID.');
      return;
    }
    setLoading(true);
    try { const res = await loginDoctor(loginForm); saveAndNavigate(res.data); }
    catch (err) { setError(err.response?.data?.detail || 'Login failed. Please check your details.'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError('');
    const required = ['full_name', 'phone_number', 'national_id', 'kmpdb_license', 'hospital_name'];
    for (const f of required) { if (!regForm[f]) { setError('Please fill in all required fields.'); return; } }
    setLoading(true);
    try {
      const res = await registerDoctor({ ...regForm, consultation_fee: parseFloat(regForm.consultation_fee) || 0 });
      saveAndNavigate(res.data);
    } catch (err) { setError(err.response?.data?.detail || 'Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    mode === 'login' ? handleLogin() : handleRegister();
  };

  const switchMode = (m) => { setMode(m); setError(''); };

  const natIdToggle = (
    <button
      type="button"
      className="dl-eye"
      onClick={() => setShowNatId((v) => !v)}
      aria-label={showNatId ? 'Hide National ID' : 'Show National ID'}
      aria-pressed={showNatId}
    >
      {showNatId ? <Icon.EyeOff size={18} /> : <Icon.Eye size={18} />}
    </button>
  );

  return (
    <div className="dl">
      <aside className="dl-intro" aria-hidden="true">
        <div className="dl-brand">
          <span className="dl-mark"><Icon.Heart size={20} /></span>
          <span>CivCare</span>
        </div>
        <div>
          <h2>Your triage queue, ready when you are.</h2>
          <ul>
            <li><Icon.Users size={18} /> Patients arrive pre-assessed and sorted by clinical priority.</li>
            <li><Icon.Video size={18} /> Run paid online consultations from the same workspace.</li>
            <li><Icon.Clock size={18} /> Set your shift and breaks; waiting patients are redirected when you step away.</li>
          </ul>
        </div>
        <p className="dl-introfoot">Clinician portal</p>
      </aside>

      <main className="dl-main">
        <div className="dl-wrap">
          <div className="dl-brand dl-brand--mobile">
            <span className="dl-mark"><Icon.Heart size={20} /></span>
            <span>CivCare <small>Clinician portal</small></span>
          </div>

          <h1 className="dl-title">{mode === 'login' ? 'Sign in' : 'Create your clinician account'}</h1>
          <p className="dl-sub">
            {mode === 'login'
              ? 'Use your KMPDB licence number and National ID.'
              : 'You will sign in with your KMPDB licence number and National ID.'}
          </p>

          <div className="dl-tabs" role="tablist" aria-label="Account">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`dl-tab${mode === m ? ' is-on' : ''}`}
                onClick={() => switchMode(m)}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              <Icon.Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'login' && (
              <>
                <div className="form-group">
                  <label className="label" htmlFor="dl-licence">KMPDB licence number</label>
                  <input id="dl-licence" className="input" name="kmpdb_license" placeholder="e.g. MED/001/2020"
                    autoComplete="username" autoCapitalize="characters"
                    value={loginForm.kmpdb_license} onChange={handleLoginChange} />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="dl-natid">National ID number</label>
                  <div className="dl-pw">
                    <input id="dl-natid" className="input" name="national_id" inputMode="numeric"
                      type={showNatId ? 'text' : 'password'} autoComplete="current-password"
                      value={loginForm.national_id} onChange={handleLoginChange} />
                    {natIdToggle}
                  </div>
                </div>
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading && <span className="dl-spin" aria-hidden="true" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="dl-switch">
                  First time here?{' '}
                  <button type="button" className="dl-link" onClick={() => switchMode('register')}>Register your account</button>
                </p>
              </>
            )}

            {mode === 'register' && (
              <>
                <fieldset className="dl-set">
                  <legend>About you</legend>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-name">Full name <Req /></label>
                    <input id="dl-name" className="input" name="full_name" placeholder="Dr. Jane Wanjiru" autoComplete="name"
                      value={regForm.full_name} onChange={handleRegChange} />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-phone">Phone number <Req /></label>
                    <input id="dl-phone" className="input" name="phone_number" type="tel" placeholder="+254712345678" autoComplete="tel"
                      value={regForm.phone_number} onChange={handleRegChange} />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-natid-r">National ID number <Req /></label>
                    <div className="dl-pw">
                      <input id="dl-natid-r" className="input" name="national_id" inputMode="numeric"
                        type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                        value={regForm.national_id} onChange={handleRegChange} />
                      {natIdToggle}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="dl-set">
                  <legend>Practice</legend>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-licence-r">KMPDB licence number <Req /></label>
                    <input id="dl-licence-r" className="input" name="kmpdb_license" placeholder="e.g. MED/001/2020" autoCapitalize="characters"
                      value={regForm.kmpdb_license} onChange={handleRegChange} />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-hospital">Hospital <Req /></label>
                    <select id="dl-hospital" className="input" name="hospital_name" value={regForm.hospital_name} onChange={handleRegChange}>
                      <option value="">{hospitals.length ? 'Select your hospital' : 'Loading hospitals…'}</option>
                      {hospitals.map((h) => <option key={h.id} value={h.name}>{h.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-spec">Specialisation</label>
                    <select id="dl-spec" className="input" name="specialisation" value={regForm.specialisation} onChange={handleRegChange}>
                      <option value="">Select specialisation</option>
                      {SPECIALISATIONS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-fee">Online consultation fee (KES)</label>
                    <input id="dl-fee" className="input" name="consultation_fee" type="number" min="0" inputMode="numeric" placeholder="e.g. 500"
                      value={regForm.consultation_fee} onChange={handleRegChange} />
                  </div>
                  <div className="dl-row">
                    <div className="form-group">
                      <label className="label" htmlFor="dl-ss">Shift start</label>
                      <input id="dl-ss" className="input" name="shift_start" type="time" value={regForm.shift_start} onChange={handleRegChange} />
                    </div>
                    <div className="form-group">
                      <label className="label" htmlFor="dl-se">Shift end</label>
                      <input id="dl-se" className="input" name="shift_end" type="time" value={regForm.shift_end} onChange={handleRegChange} />
                    </div>
                  </div>
                </fieldset>

                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading && <span className="dl-spin" aria-hidden="true" />}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
                <p className="dl-switch">
                  Already registered?{' '}
                  <button type="button" className="dl-link" onClick={() => switchMode('login')}>Sign in</button>
                </p>
              </>
            )}
          </form>

          <div className="dl-foot">
            <p><Icon.Shield size={15} /> Doctor accounts are verified against KMPDB records.</p>
            <button type="button" className="dl-link dl-link--muted" onClick={() => navigate('/')}>
              <Icon.ChevronLeft size={16} /> Patient sign-in
            </button>
          </div>
        </div>
      </main>

      <style>{`
        .dl { min-height: 100vh; display: grid; grid-template-columns: minmax(320px, 440px) 1fr; background: var(--cc-canvas); background-attachment: fixed; }
        .dl-intro {
          background: radial-gradient(520px 420px at 110% -10%, rgba(126,200,240,.45), transparent 60%), radial-gradient(480px 380px at -20% 110%, rgba(40,190,170,.35), transparent 60%), linear-gradient(160deg, #1a73b8 0%, #12578e 60%, #0f4775 100%); color: #fff; padding: 40px 40px 32px; overflow: hidden;
          display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
          position: sticky; top: 0; height: 100vh;
        }
        @media (prefers-color-scheme: dark) { .dl-intro { filter: brightness(.82); } }
        .dl-intro h2 { font-size: 26px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 24px; max-width: 340px; }
        .dl-intro ul { list-style: none; display: flex; flex-direction: column; gap: 16px; }
        .dl-intro li { display: flex; gap: 12px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,0.92); padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16); }
        .dl-intro li svg { flex-shrink: 0; margin-top: 2px; }
        .dl-introfoot { font-size: 13px; color: rgba(255,255,255,0.65); }
        .dl-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; }
        .dl-mark { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,.28); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; }
        .dl-brand--mobile { display: none; color: var(--cc-text); margin-bottom: 28px; }
        .dl-brand--mobile .dl-mark { background: var(--cc-primary); color: var(--cc-on-primary); }
        .dl-brand--mobile small { display: block; font-size: 12px; font-weight: 500; color: var(--cc-muted); }
        .dl-main { display: flex; justify-content: center; align-items: flex-start; padding: 56px 24px 48px; }
        .dl-wrap { width: 100%; max-width: 460px; background: var(--cc-glass-strong); -webkit-backdrop-filter: var(--cc-blur); backdrop-filter: var(--cc-blur); border: 1px solid var(--cc-glass-border); box-shadow: var(--cc-glass-edge), var(--cc-shadow); border-radius: 22px; padding: 32px 28px; }
        @media (max-width: 480px) { .dl-wrap { padding: 24px 18px; border-radius: 18px; } }
        .dl-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
        .dl-sub { color: var(--cc-muted); font-size: 15px; margin-bottom: 20px; }
        .dl-tabs { display: flex; gap: 4px; padding: 4px; background: var(--cc-surface-3); border-radius: 10px; margin-bottom: 20px; }
        .dl-tab { flex: 1; min-height: 38px; border: 1px solid transparent; background: none; border-radius: 7px; font-size: 14px; font-weight: 600; color: var(--cc-muted); }
        .dl-tab:hover { color: var(--cc-text); }
        .dl-tab.is-on { background: var(--cc-surface); color: var(--cc-text); border-color: var(--cc-border); box-shadow: var(--cc-shadow-sm); }
        .dl-set { border: none; margin-bottom: 8px; }
        .dl-set legend { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cc-muted); margin-bottom: 12px; }
        .dl-set + .dl-set { border-top: 1px solid var(--cc-border); padding-top: 20px; }
        .dl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .dl-pw { position: relative; }
        .dl-pw .input { padding-right: 48px; }
        .dl-eye { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 42px; height: 40px; border: none; background: none; color: var(--cc-muted); display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; }
        .dl-eye:hover { color: var(--cc-text); }
        .dl-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .7s linear infinite; }
        .dl-switch { text-align: center; font-size: 14px; color: var(--cc-muted); margin-top: 16px; }
        .dl-link { background: none; border: none; padding: 2px; color: var(--cc-primary); font-weight: 600; font-size: inherit; display: inline-flex; align-items: center; gap: 4px; }
        .dl-link:hover { text-decoration: underline; }
        .dl-link--muted { color: var(--cc-muted); font-weight: 500; font-size: 14px; }
        .dl-req { color: var(--cc-danger); }
        .dl-foot { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--cc-border); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .dl-foot p { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--cc-muted); text-align: center; }
        @media (max-width: 900px) {
          .dl { grid-template-columns: 1fr; }
          .dl-intro { display: none; }
          .dl-brand--mobile { display: flex; }
          .dl-main { padding: 24px 12px 32px; }
        }
      `}</style>
    </div>
  );
}

function Req() {
  return <span className="dl-req" aria-label="required">*</span>;
}
