import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerPatient, loginPatient } from '../../api/auth';
import { normalizeKePhone, PHONE_HINT, PHONE_ERROR } from '../../utils/phone';

const Icon = ({ name, size = 20 }) => {
  const paths = {
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.4 2.9 8 7 9 4.1-1 7-4.6 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    phone: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
    id: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <path d="M13 10h5M13 14h4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    heart: (
      <>
        <path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3Z" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: (
      <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
    ),
    check: <path d="m5 12 4 4L19 6" />,
    doctor: (
      <>
        <path d="M8 4v5a4 4 0 0 0 8 0V4" />
        <path d="M6 4h4M14 4h4M12 13v3" />
        <path d="M8 20c.7-2.7 2-4 4-4s3.3 1.3 4 4" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

const Field = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  required = false,
  hint,
  inputMode,
  autoComplete = 'off',
  children,
}) => (
  <div className="cc-auth-field">
    <label htmlFor={name}>
      {label}
      {required && <span className="cc-required"> *</span>}
    </label>

    <div className="cc-input-wrap">
      <span className="cc-input-icon">
        <Icon name={icon} size={18} />
      </span>

      {children || (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-describedby={hint ? `${name}-hint` : undefined}
        />
      )}
    </div>
    {hint && <p id={`${name}-hint`} className="cc-field-hint">{hint}</p>}
  </div>
);

export default function Register() {
  const navigate = useNavigate();

  // Already signed in? Skip the sign-in screen (e.g. when pressing Back).
  useEffect(() => {
    if (localStorage.getItem('civtech_token') && localStorage.getItem('civtech_patient')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({
    phone_number: '',
    identity_number: '',
  });

  const [regForm, setRegForm] = useState({
    full_name: '',
    phone_number: '',
    identity_number: '',
    identity_type: 'national_id',
    date_of_birth: '',
    location: '',
    allergies: '',
  });

  const handleLoginChange = (e) =>
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });

  const handleRegChange = (e) =>
    setRegForm({ ...regForm, [e.target.name]: e.target.value });

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const saveAndNavigate = (data) => {
    localStorage.setItem('civtech_token', data.access_token);
    localStorage.setItem('civtech_patient', JSON.stringify(data.patient));
    // replace: Back from the dashboard shouldn't return to this form
    navigate('/dashboard', { replace: true });
  };

  const handleLogin = async () => {
    setError('');

    if (!loginForm.phone_number || !loginForm.identity_number) {
      setError('Please enter your phone number and ID number.');
      return;
    }

    const phone = normalizeKePhone(loginForm.phone_number);
    if (!phone) {
      setError(PHONE_ERROR);
      return;
    }

    setLoading(true);

    try {
      const res = await loginPatient({ ...loginForm, phone_number: phone });
      saveAndNavigate(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Login failed. Please check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');

    if (
      !regForm.full_name ||
      !regForm.phone_number ||
      !regForm.identity_number
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    const phone = normalizeKePhone(regForm.phone_number);
    if (!phone) {
      setError(PHONE_ERROR);
      return;
    }

    setLoading(true);

    try {
      const res = await registerPatient({ ...regForm, phone_number: phone });
      saveAndNavigate(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .cc-field-hint {
          font-size: 12.5px;
          color: var(--cc-muted);
          margin-top: 6px;
        }

        .cc-auth-page {
          --cc-bg: #f5f8fc;
          --cc-surface: #ffffff;
          --cc-surface-soft: #f7faff;
          --cc-border: #e2e8f0;
          --cc-border-strong: #d5deea;
          --cc-text: #142033;
          --cc-muted: #66758a;
          --cc-faint: #94a3b8;
          --cc-primary: #1769aa;
          --cc-primary-dark: #12578e;
          --cc-primary-soft: #eaf3fa;
          --cc-on-primary: #ffffff;
          --cc-teal: #0f9f86;
          --cc-danger: #c93545;
          --cc-danger-bg: #fff1f2;
          --cc-danger-border: #fecdd3;
          --cc-shadow: 0 20px 60px rgba(15, 35, 65, 0.08);
          --cc-shadow-small: 0 6px 20px rgba(15, 35, 65, 0.06);

          min-height: 100dvh;
          background:
            radial-gradient(
              800px 500px at 0% 0%,
              rgba(23, 105, 170, 0.07),
              transparent 60%
            ),
            radial-gradient(
              700px 500px at 100% 100%,
              rgba(15, 159, 134, 0.05),
              transparent 60%
            ),
            var(--cc-bg);
          color: var(--cc-text);
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 28px 20px 36px;
          box-sizing: border-box;
        }

        .cc-auth-shell {
          width: min(1080px, 100%);
          margin: 0 auto;
        }

        .cc-auth-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
        }

        .cc-brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .cc-brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          color: #fff;
          background: #1769aa;
          box-shadow: 0 8px 20px rgba(23, 105, 170, 0.22);
        }

        .cc-brand-name {
          font-size: 18px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .cc-brand-sub {
          margin-top: 3px;
          color: var(--cc-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1px;
        }

        .cc-secure-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--cc-muted);
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .cc-secure-pill svg {
          color: var(--cc-teal);
        }

        .cc-auth-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.9fr) minmax(380px, 1.1fr);
          gap: 22px;
          align-items: stretch;
        }

        .cc-auth-intro {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 38px;
          min-height: 610px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background:
            linear-gradient(
              145deg,
              rgba(15, 47, 91, 0.98),
              rgba(18, 59, 111, 0.96)
            );
          color: #fff;
          box-shadow: var(--cc-shadow);
        }

        .cc-auth-intro::before {
          content: "";
          position: absolute;
          width: 330px;
          height: 330px;
          border-radius: 50%;
          right: -150px;
          top: -130px;
          background: rgba(64, 143, 255, 0.15);
        }

        .cc-auth-intro::after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          left: -160px;
          bottom: -140px;
          background: rgba(21, 190, 163, 0.11);
        }

        .cc-intro-content,
        .cc-intro-bottom {
          position: relative;
          z-index: 1;
        }

        .cc-intro-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.07);
          border-radius: 999px;
          color: rgba(255,255,255,0.78);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .cc-auth-intro h1 {
          margin: 24px 0 14px;
          max-width: 430px;
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.04;
          letter-spacing: -1.6px;
        }

        .cc-auth-intro p {
          margin: 0;
          max-width: 430px;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
          line-height: 1.7;
        }

        .cc-benefits {
          display: grid;
          gap: 11px;
          margin-top: 34px;
        }

        .cc-benefit {
          display: flex;
          align-items: center;
          gap: 11px;
          color: rgba(255,255,255,0.88);
          font-size: 12px;
          font-weight: 600;
        }

        .cc-benefit-icon {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(255,255,255,0.09);
          color: #8de2d2;
        }

        .cc-intro-bottom {
          display: flex;
          align-items: center;
          gap: 9px;
          color: rgba(255,255,255,0.55);
          font-size: 10px;
          line-height: 1.5;
        }

        .cc-auth-card {
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          border-radius: 28px;
          padding: 34px;
          box-shadow: var(--cc-shadow);
        }

        .cc-mode-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 4px;
          background: var(--cc-surface-soft);
          border: 1px solid var(--cc-border);
          border-radius: 14px;
          margin-bottom: 28px;
        }

        .cc-mode-tab {
          border: 0;
          background: transparent;
          color: var(--cc-muted);
          border-radius: 10px;
          padding: 11px 12px;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: 160ms ease;
        }

        .cc-mode-tab.active {
          color: var(--cc-primary);
          background: var(--cc-surface);
          box-shadow: 0 3px 10px rgba(15, 35, 65, 0.07);
        }

        .cc-auth-heading {
          margin-bottom: 24px;
        }

        .cc-auth-heading h2 {
          margin: 0 0 7px;
          font-size: 25px;
          letter-spacing: -0.7px;
        }

        .cc-auth-heading p {
          margin: 0;
          color: var(--cc-muted);
          font-size: 13px;
          line-height: 1.55;
        }

        .cc-error {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          padding: 12px 13px;
          margin-bottom: 18px;
          border-radius: 12px;
          color: var(--cc-danger);
          background: var(--cc-danger-bg);
          border: 1px solid var(--cc-danger-border);
          font-size: 12px;
          line-height: 1.45;
          font-weight: 600;
        }

        .cc-auth-field {
          margin-bottom: 17px;
        }

        .cc-auth-field label {
          display: block;
          margin: 0 0 7px;
          color: var(--cc-text);
          font-size: 12px;
          font-weight: 750;
        }

        .cc-required {
          color: var(--cc-primary);
        }

        .cc-input-wrap {
          position: relative;
        }

        .cc-input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--cc-faint);
          pointer-events: none;
          display: grid;
          place-items: center;
        }

        .cc-input-wrap input,
        .cc-input-wrap select {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid var(--cc-border);
          border-radius: 12px;
          background: var(--cc-surface);
          color: var(--cc-text);
          outline: none;
          padding: 0 13px 0 43px;
          font: inherit;
          font-size: 13px;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .cc-input-wrap input::placeholder {
          color: var(--cc-faint);
        }

        .cc-input-wrap input:focus,
        .cc-input-wrap select:focus {
          border-color: rgba(23, 105, 170, 0.55);
          box-shadow: 0 0 0 4px rgba(23, 105, 170, 0.09);
        }

        .cc-input-wrap select {
          appearance: auto;
          cursor: pointer;
        }

        .cc-register-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 14px;
        }

        .cc-register-grid .cc-auth-field.full {
          grid-column: 1 / -1;
        }

        .cc-submit {
          width: 100%;
          height: 50px;
          margin-top: 6px;
          border: 0;
          border-radius: 13px;
          background: var(--cc-primary);
          color: var(--cc-on-primary);
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 9px 22px rgba(23, 105, 170, 0.2);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            opacity 160ms ease;
        }

        .cc-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(23, 105, 170, 0.25);
        }

        .cc-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .cc-submit:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .cc-switch-text {
          margin: 18px 0 0;
          text-align: center;
          color: var(--cc-muted);
          font-size: 12px;
        }

        .cc-link {
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--cc-primary);
          font: inherit;
          font-weight: 750;
          cursor: pointer;
        }

        .cc-doctor-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          margin-top: 18px;
          padding: 11px;
          border: 1px solid var(--cc-border);
          border-radius: 12px;
          background: var(--cc-surface-soft);
          color: var(--cc-muted);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .cc-doctor-link:hover {
          color: var(--cc-primary);
          border-color: var(--cc-border-strong);
        }

        .cc-privacy {
          margin: 17px auto 0;
          max-width: 440px;
          text-align: center;
          color: var(--cc-faint);
          font-size: 10px;
          line-height: 1.55;
        }

        .cc-theme-note {
          display: none;
        }

        @media (max-width: 800px) {
          .cc-auth-page {
            padding: 18px 14px 28px;
          }

          .cc-auth-topbar {
            margin-bottom: 18px;
          }

          .cc-secure-pill {
            display: none;
          }

          .cc-auth-grid {
            grid-template-columns: 1fr;
          }

          .cc-auth-intro {
            min-height: auto;
            padding: 25px;
            border-radius: 22px;
          }

          .cc-auth-intro h1 {
            font-size: 31px;
            letter-spacing: -1.1px;
            margin-top: 18px;
          }

          .cc-benefits {
            grid-template-columns: 1fr 1fr;
            margin-top: 25px;
          }

          .cc-intro-bottom {
            margin-top: 24px;
          }

          .cc-auth-card {
            border-radius: 22px;
            padding: 23px 18px;
          }
        }

        @media (max-width: 520px) {
          .cc-auth-page {
            padding: 14px 11px 22px;
          }

          .cc-brand-mark {
            width: 38px;
            height: 38px;
            border-radius: 11px;
          }

          .cc-brand-name {
            font-size: 16px;
          }

          .cc-brand-sub {
            font-size: 10px;
          }

          .cc-auth-intro {
            padding: 21px;
          }

          .cc-auth-intro h1 {
            font-size: 28px;
          }

          .cc-auth-intro p {
            font-size: 13px;
          }

          .cc-benefits {
            grid-template-columns: 1fr;
          }

          .cc-auth-card {
            padding: 20px 15px;
          }

          .cc-auth-heading h2 {
            font-size: 22px;
          }

          .cc-register-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .cc-register-grid .cc-auth-field.full {
            grid-column: auto;
          }
        }

        @media (prefers-color-scheme: dark) {
          .cc-auth-page {
            --cc-bg: #08111f;
            --cc-surface: #0e1a2b;
            --cc-surface-soft: #111f32;
            --cc-border: #203149;
            --cc-border-strong: #2b405c;
            --cc-text: #edf4ff;
            --cc-muted: #9aacbf;
            --cc-faint: #6f8299;
            --cc-primary: #69b7e5;
            --cc-primary-dark: #86c6ec;
            --cc-primary-soft: #11293a;
            --cc-on-primary: #08131d;
            --cc-teal: #39c6ad;
            --cc-danger: #ff7a89;
            --cc-danger-bg: rgba(190, 40, 60, 0.13);
            --cc-danger-border: rgba(255, 105, 120, 0.24);
            --cc-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
            --cc-shadow-small: 0 8px 25px rgba(0, 0, 0, 0.2);

            background:
              radial-gradient(
                800px 500px at 0% 0%,
                rgba(23, 105, 170, 0.12),
                transparent 60%
              ),
              radial-gradient(
                700px 500px at 100% 100%,
                rgba(15, 159, 134, 0.06),
                transparent 60%
              ),
              var(--cc-bg);
          }

          .cc-auth-intro {
            background:
              linear-gradient(
                145deg,
                #0d2340,
                #102e50
              );
          }

          .cc-input-wrap input,
          .cc-input-wrap select {
            background: #0c1727;
          }

          .cc-mode-tab.active {
            background: #16253a;
          }

          .cc-secure-pill,
          .cc-doctor-link {
            background: var(--cc-surface);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cc-mode-tab,
          .cc-input-wrap input,
          .cc-input-wrap select,
          .cc-submit {
            transition: none;
          }
        }
      `}</style>

      <main className="cc-auth-page">
        <div className="cc-auth-shell">
          <header className="cc-auth-topbar">
            <div className="cc-brand">
              <div className="cc-brand-mark">
                <Icon name="heart" size={22} />
              </div>

              <div>
                <div className="cc-brand-name">CivCare</div>
                <div className="cc-brand-sub">AI-powered healthcare</div>
              </div>
            </div>

            <div className="cc-secure-pill">
              <Icon name="shield" size={14} />
              Secure patient access
            </div>
          </header>

          <section className="cc-auth-grid">
            <aside className="cc-auth-intro">
              <div className="cc-intro-content">
                <div className="cc-intro-eyebrow">
                  <Icon name="heart" size={13} />
                  Your health, connected
                </div>

                <h1>
                  Healthcare that keeps up with you.
                </h1>

                <p>
                  Access your medical records, manage treatments,
                  connect with doctors and get AI-assisted guidance
                  through one secure patient experience.
                </p>

                <div className="cc-benefits">
                  <div className="cc-benefit">
                    <span className="cc-benefit-icon">
                      <Icon name="check" size={15} />
                    </span>
                    Personal medical records in one place
                  </div>

                  <div className="cc-benefit">
                    <span className="cc-benefit-icon">
                      <Icon name="check" size={15} />
                    </span>
                    Medication schedules and reminders
                  </div>

                  <div className="cc-benefit">
                    <span className="cc-benefit-icon">
                      <Icon name="check" size={15} />
                    </span>
                    Connect with available doctors
                  </div>

                  <div className="cc-benefit">
                    <span className="cc-benefit-icon">
                      <Icon name="check" size={15} />
                    </span>
                    AI-assisted health navigation
                  </div>
                </div>
              </div>

              <div className="cc-intro-bottom">
                <Icon name="shield" size={14} />
                Your healthcare information is handled with privacy
                and security in mind.
              </div>
            </aside>

            <section className="cc-auth-card">
              <div className="cc-mode-tabs">
                <button
                  type="button"
                  className={`cc-mode-tab ${
                    mode === 'login' ? 'active' : ''
                  }`}
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </button>

                <button
                  type="button"
                  className={`cc-mode-tab ${
                    mode === 'register' ? 'active' : ''
                  }`}
                  onClick={() => switchMode('register')}
                >
                  Create account
                </button>
              </div>

              <div className="cc-auth-heading">
                <h2>
                  {mode === 'login'
                    ? 'Welcome back'
                    : 'Create your health account'}
                </h2>

                <p>
                  {mode === 'login'
                    ? 'Sign in securely to continue to your CivCare dashboard.'
                    : 'Set up your patient profile to start using CivCare.'}
                </p>
              </div>

              {error && (
                <div className="cc-error">
                  <Icon name="shield" size={17} />
                  <span>{error}</span>
                </div>
              )}

              {mode === 'login' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                  }}
                >
                  <Field
                    label="Phone number"
                    name="phone_number"
                    value={loginForm.phone_number}
                    onChange={handleLoginChange}
                    placeholder="0712 345 678"
                    icon="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    hint={PHONE_HINT}
                    required
                  />

                  <Field
                    label="Identity number"
                    name="identity_number"
                    value={loginForm.identity_number}
                    onChange={handleLoginChange}
                    placeholder="National ID / Birth Cert / CHF number"
                    icon="id"
                    required
                  />

                  <button
                    className="cc-submit"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign in to CivCare'}
                  </button>

                  <p className="cc-switch-text">
                    New patient?{' '}
                    <button
                      type="button"
                      className="cc-link"
                      onClick={() => switchMode('register')}
                    >
                      Create an account
                    </button>
                  </p>
                </form>
              )}

              {mode === 'register' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRegister();
                  }}
                >
                  <div className="cc-register-grid">
                    <div className="cc-auth-field full">
                      <Field
                        label="Full name"
                        name="full_name"
                        value={regForm.full_name}
                        onChange={handleRegChange}
                        placeholder="e.g. Jane Wanjiru"
                        icon="user"
                        required
                      />
                    </div>

                    <Field
                      label="Phone number"
                      name="phone_number"
                      value={regForm.phone_number}
                      onChange={handleRegChange}
                      placeholder="0712 345 678"
                      icon="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      hint={PHONE_HINT}
                      required
                    />

                    <Field
                      label="Identity number"
                      name="identity_number"
                      value={regForm.identity_number}
                      onChange={handleRegChange}
                      placeholder="Your ID number"
                      icon="id"
                      required
                    />

                    <div className="cc-auth-field">
                      <label htmlFor="identity_type">
                        Identity type
                        <span className="cc-required"> *</span>
                      </label>

                      <div className="cc-input-wrap">
                        <span className="cc-input-icon">
                          <Icon name="id" size={18} />
                        </span>

                        <select
                          id="identity_type"
                          name="identity_type"
                          value={regForm.identity_type}
                          onChange={handleRegChange}
                        >
                          <option value="national_id">
                            National ID
                          </option>
                          <option value="birth_cert">
                            Birth Certificate Number
                          </option>
                          <option value="chf_number">
                            CHF Register Number
                          </option>
                        </select>
                      </div>
                    </div>

                    <Field
                      label="Date of birth"
                      name="date_of_birth"
                      value={regForm.date_of_birth}
                      onChange={handleRegChange}
                      placeholder=""
                      icon="calendar"
                      type="date"
                    />

                    <div className="cc-auth-field full">
                      <Field
                        label="Area / town"
                        name="location"
                        value={regForm.location}
                        onChange={handleRegChange}
                        placeholder="e.g. Kapsabet, Kisumu"
                        icon="location"
                      />
                    </div>

                    <div className="cc-auth-field full">
                      <Field
                        label="Known allergies"
                        name="allergies"
                        value={regForm.allergies}
                        onChange={handleRegChange}
                        placeholder="e.g. Penicillin, Sulfa drugs"
                        icon="heart"
                      />
                    </div>
                  </div>

                  <button
                    className="cc-submit"
                    type="submit"
                    disabled={loading}
                  >
                    {loading
                      ? 'Creating account...'
                      : 'Create account & continue'}
                  </button>

                  <p className="cc-switch-text">
                    Already registered?{' '}
                    <button
                      type="button"
                      className="cc-link"
                      onClick={() => switchMode('login')}
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}

              <button
                type="button"
                className="cc-doctor-link"
                onClick={() => navigate('/doctor')}
              >
                <Icon name="doctor" size={16} />
                Healthcare professional? Doctor login
                <Icon name="arrow" size={14} />
              </button>

              <p className="cc-privacy">
                Your information is handled securely and in accordance
                with applicable healthcare privacy and data-protection
                requirements, including the Kenya Data Protection Act 2019.
              </p>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
