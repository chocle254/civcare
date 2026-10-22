import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerDoctor, loginDoctor, forgotDoctorPassword, resetDoctorPassword } from '../../api/auth';
import client from '../../api/client';
import Icon from '../../components/Icons';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNatId, setShowNatId] = useState(false);

  const [loginForm, setLoginForm] = useState({ kmpdb_license: '', password: '' });
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
  // Forgot password: a code by SMS to the phone on the account, then a new password.
  const [resetForm, setResetForm] = useState({ kmpdb_license: '', code: '', password: '', confirm: '' });
  const [resetSent, setResetSent] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [regForm, setRegForm] = useState({
    full_name: '', phone_number: '', password: '', confirm: '', kmpdb_license: '',
    specialisation: '', hospital_name: '', consultation_fee: '',
    shift_start: '08:00', shift_end: '17:00',
  });
  const [hospitals, setHospitals] = useState([]);

  // Already signed in? Skip the sign-in screen (e.g. when pressing Back).
  useEffect(() => {
    if (localStorage.getItem('civtech_token') && localStorage.getItem('civtech_doctor')) {
      let doc = {};
      try { doc = JSON.parse(localStorage.getItem('civtech_doctor') || '{}'); } catch { doc = {}; }
      if (doc.must_set_password) setMode('setpw');
      else navigate('/doctor/dashboard', { replace: true });
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
    if (data.doctor?.must_set_password) { setMode('setpw'); setError(''); return; }
    navigate('/doctor/dashboard', { replace: true });
  };

  // Accounts made before passwords existed sign in once with their National
  // ID, then must choose a real password before reaching patient records.
  const handleSetPassword = async () => {
    setError('');
    if (pwForm.password.length < 8 || /^\d+$/.test(pwForm.password)) {
      setError('Choose a password of at least 8 characters that isn\'t only numbers.');
      return;
    }
    if (pwForm.password !== pwForm.confirm) { setError('The two passwords don\'t match.'); return; }
    setLoading(true);
    try {
      await client.post('/auth/doctor/set-password', { password: pwForm.password, current_password: loginForm.password });
      const doc = JSON.parse(localStorage.getItem('civtech_doctor') || '{}');
      localStorage.setItem('civtech_doctor', JSON.stringify({ ...doc, must_set_password: false }));
      navigate('/doctor/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save your password. Try again.');
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setError('');
    if (!loginForm.kmpdb_license || !loginForm.password) {
      setError('Enter your KMPDB licence number and password.');
      return;
    }
    setLoading(true);
    try { const res = await loginDoctor(loginForm); saveAndNavigate(res.data); }
    catch (err) { setError(err.response?.data?.detail || 'Login failed. Please check your details.'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError('');
    const required = ['full_name', 'phone_number', 'password', 'kmpdb_license', 'hospital_name'];
    for (const f of required) { if (!regForm[f]) { setError('Please fill in all required fields.'); return; } }
    if (regForm.password.length < 8 || /^\d+$/.test(regForm.password)) {
      setError('Choose a password of at least 8 characters that isn\'t only numbers.');
      return;
    }
    if (regForm.password !== regForm.confirm) { setError('The two passwords don\'t match.'); return; }
    setLoading(true);
    try {
      const { confirm, ...body } = regForm;
      const res = await registerDoctor({ ...body, consultation_fee: parseFloat(regForm.consultation_fee) || 0 });
      saveAndNavigate(res.data);
    } catch (err) { setError(err.response?.data?.detail || 'Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const startReset = () => {
    setResetForm((f) => ({ ...f, kmpdb_license: f.kmpdb_license || loginForm.kmpdb_license }));
    setResetSent('');
    switchMode('reset');
  };

  const handleSendCode = async () => {
    setError('');
    if (!resetForm.kmpdb_license.trim()) { setError('Enter your KMPDB licence number.'); return; }
    setLoading(true);
    try {
      const res = await forgotDoctorPassword({ kmpdb_license: resetForm.kmpdb_license.trim() });
      setResetSent(res.data?.message || 'Code sent. Check your SMS.');
      // Test mode (no SMS connected): the server returns the code to show.
      setResetCode(res.data?.test_code || '');
      if (res.data?.test_code) setResetForm((f) => ({ ...f, code: res.data.test_code }));
    } catch (err) { setError(err.response?.data?.detail || 'Could not send the code. Try again.'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!/^\d{6}$/.test(resetForm.code.trim())) { setError('Enter the 6-digit code from the SMS.'); return; }
    if (resetForm.password.length < 8 || /^\d+$/.test(resetForm.password)) {
      setError('Choose a password of at least 8 characters that isn\'t only numbers.');
      return;
    }
    if (resetForm.password !== resetForm.confirm) { setError('The two passwords don\'t match.'); return; }
    setLoading(true);
    try {
      const res = await resetDoctorPassword({
        kmpdb_license: resetForm.kmpdb_license.trim(),
        code: resetForm.code.trim(),
        password: resetForm.password,
      });
      saveAndNavigate(res.data);
    } catch (err) { setError(err.response?.data?.detail || 'Could not reset your password. Try again.'); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (mode === 'reset') { if (resetSent) handleResetPassword(); else handleSendCode(); }
    else if (mode === 'setpw') handleSetPassword();
    else if (mode === 'login') handleLogin();
    else handleRegister();
  };

  const switchMode = (m) => { setMode(m); setError(''); };

  const natIdToggle = (
    <button
      type="button"
      className="dl-eye"
      onClick={() => setShowNatId((v) => !v)}
      aria-label={showNatId ? 'Hide password' : 'Show password'}
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

          <h1 className="dl-title">{mode === 'setpw' ? 'Choose a password' : mode === 'reset' ? 'Reset your password' : mode === 'login' ? 'Sign in' : 'Create your clinician account'}</h1>
          <p className="dl-sub">
            {mode === 'reset'
              ? 'We\'ll send a code by SMS to the phone number on your account.'
              : mode === 'setpw'
              ? 'Your National ID is no longer enough to protect patient records. Choose a password you\'ll use from now on.'
              : mode === 'login'
              ? 'Use your KMPDB licence number and password.'
              : 'You will sign in with your KMPDB licence number and a password.'}
          </p>

          {mode !== 'setpw' && mode !== 'reset' && <div className="dl-tabs" role="tablist" aria-label="Account">
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
          </div>}

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
                  <label className="label" htmlFor="dl-pass">Password</label>
                  <div className="dl-pw">
                    <input id="dl-pass" className="input" name="password" aria-describedby="dl-pass-hint"
                      type={showNatId ? 'text' : 'password'} autoComplete="current-password"
                      value={loginForm.password} onChange={handleLoginChange} />
                    {natIdToggle}
                  </div>
                  <p id="dl-pass-hint" className="dl-hint">First time since passwords were added? Enter your National ID; you'll then choose a password.</p>
                  <p className="dl-hint">
                    <button type="button" className="dl-link" onClick={startReset}>Forgot your password?</button>
                  </p>
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

            {mode === 'reset' && (
              <>
                {resetSent && (
                  <div className="alert alert--info" role="status">
                    <span>
                      {resetSent}
                      {resetCode && <strong style={{ display: 'block', marginTop: 6, fontSize: 20, letterSpacing: '0.2em' }}>{resetCode}</strong>}
                    </span>
                  </div>
                )}
                <div className="form-group">
                  <label className="label" htmlFor="dl-rlicence">KMPDB licence number</label>
                  <input id="dl-rlicence" className="input" placeholder="e.g. MED/001/2020"
                    autoComplete="username" autoCapitalize="characters"
                    value={resetForm.kmpdb_license} onChange={(e) => setResetForm({ ...resetForm, kmpdb_license: e.target.value })} />
                </div>
                {resetSent && (
                  <>
                    <div className="form-group">
                      <label className="label" htmlFor="dl-code">Code from the SMS</label>
                      <input id="dl-code" className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits"
                        value={resetForm.code} onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label" htmlFor="dl-rpw">New password</label>
                      <div className="dl-pw">
                        <input id="dl-rpw" className="input" type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                          value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} />
                        {natIdToggle}
                      </div>
                      <p className="dl-hint">At least 8 characters, not only numbers.</p>
                    </div>
                    <div className="form-group">
                      <label className="label" htmlFor="dl-rpw2">Repeat new password</label>
                      <input id="dl-rpw2" className="input" type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                        value={resetForm.confirm} onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })} />
                    </div>
                  </>
                )}
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading && <span className="dl-spin" aria-hidden="true" />}
                  {loading ? 'Please wait…' : resetSent ? 'Save new password and sign in' : 'Send me a code'}
                </button>
                <p className="dl-switch">
                  {resetSent && (
                    <>
                      No SMS after a minute?{' '}
                      <button type="button" className="dl-link" onClick={handleSendCode} disabled={loading}>Send a new code</button>
                      {' · '}
                    </>
                  )}
                  <button type="button" className="dl-link" onClick={() => switchMode('login')}>Back to sign in</button>
                </p>
              </>
            )}

            {mode === 'setpw' && (
              <>
                <div className="form-group">
                  <label className="label" htmlFor="dl-newpw">New password</label>
                  <div className="dl-pw">
                    <input id="dl-newpw" className="input" type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                      value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })} />
                    {natIdToggle}
                  </div>
                  <p className="dl-hint">At least 8 characters, not only numbers, and not your National ID.</p>
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="dl-newpw2">Repeat new password</label>
                  <input id="dl-newpw2" className="input" type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                    value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                </div>
                {!loginForm.password && (
                  <p className="dl-hint">Sign in again to change your password.{' '}
                    <button type="button" className="dl-link" onClick={() => { localStorage.clear(); switchMode('login'); }}>Sign in</button>
                  </p>
                )}
                <button type="submit" className="btn btn--primary" disabled={loading || !loginForm.password}>
                  {loading && <span className="dl-spin" aria-hidden="true" />}
                  {loading ? 'Saving…' : 'Save password and continue'}
                </button>
              </>
            )}

            {mode === 'register' && (
              <>
                <fieldset className="dl-set">
                  <legend>About you</legend>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-name">Full name <Req /></label>
                    <input id="dl-name" className="input" name="full_name" placeholder="Jane Wanjiru" autoComplete="name"
                      value={regForm.full_name} onChange={handleRegChange} />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-phone">Phone number <Req /></label>
                    <input id="dl-phone" className="input" name="phone_number" type="tel" placeholder="+254712345678" autoComplete="tel"
                      value={regForm.phone_number} onChange={handleRegChange} />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-pass-r">Password <Req /></label>
                    <div className="dl-pw">
                      <input id="dl-pass-r" className="input" name="password"
                        type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                        value={regForm.password} onChange={handleRegChange} />
                      {natIdToggle}
                    </div>
                    <p className="dl-hint">At least 8 characters, not only numbers.</p>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="dl-pass-c">Repeat password <Req /></label>
                    <input id="dl-pass-c" className="input" name="confirm"
                      type={showNatId ? 'text' : 'password'} autoComplete="new-password"
                      value={regForm.confirm} onChange={handleRegChange} />
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
                    <p className="dl-hint">Hospital not listed? It has to join CivCare first: <a href="/hospital/register">register your hospital</a>.</p>
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
            <p><Icon.Shield size={15} /> The CivCare team checks every licence on the KMPDC register.</p>
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
        .dl-hint { font-size: 13px; color: var(--cc-muted); margin-top: 6px; line-height: 1.45; }
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
