import { useNavigate } from 'react-router-dom';
import { PRIVACY_VERSION, PRIVACY_CONTACT } from '../utils/privacy';

// The privacy notice the Data Protection Act 2019 (s. 29) requires before
// collecting personal data. Plain language; every claim here matches what
// the app actually does. Bump PRIVACY_VERSION (front and back end) when the
// substance changes, so patients are asked to agree again.

const SECTIONS = [
  {
    h: 'Who we are',
    body: [
      'CivCare is a health assistant and a way to reach doctors in Kenya. CivCare decides how your information is used, so under the Data Protection Act 2019 we are the "data controller" responsible for it.',
    ],
  },
  {
    h: 'What we collect',
    list: [
      'Your details: name, phone number, ID or birth certificate number, date of birth, sex, the area you live in and allergies you tell us about.',
      'What you tell the health assistant about how you feel.',
      'What doctors record about you: diagnoses, notes, prescriptions.',
      'Your medicine reminders and how you said you felt at each check-in.',
      'The hospital you choose and, when you look for hospitals, your rough location.',
      'Online consultations you book and their payment status.',
      'Medical records you choose to upload, such as X-rays, scans, surgery reports and lab results.',
      'A record of every time a doctor opens your file.',
    ],
  },
  {
    h: 'Why we use it',
    list: [
      'To ask you the right questions about how you feel and help you choose between a hospital near you and a doctor online.',
      'To give the doctor you choose a summary of your case before they see you, so you don\'t start from zero.',
      'To remind you to take your medicines and check how you are doing.',
      'If you upload a written report, to copy out what it says (operations, diagnoses, medicines) so the assistant and your doctor know your history. The assistant never reads X-ray or scan images and never judges your results.',
    ],
    after: 'We use your health information because you agree to it, and because it is used to provide you with health care by registered health professionals. We never sell your information or use it for advertising.',
  },
  {
    h: 'The AI assistant does not decide for you',
    body: [
      'The health assistant is an AI. It does not diagnose you and does not decide where you should go; you choose. When it writes a summary for a doctor, the doctor sees it labelled as support, and the doctor makes every clinical decision.',
      'You can stop the assistant using your information at any time by withdrawing your consent in Profile.',
    ],
  },
  {
    h: 'Who can see your information',
    list: [
      'The doctors you are sent to or choose, and clinicians at the hospital where you are being cared for.',
      'You.',
      'No one else at CivCare looks at your health records except to fix a fault you report or when the law requires it. The CivCare team sees totals, such as how many people used the app, never your name or record.',
    ],
  },
  {
    h: 'Services that help us run CivCare',
    body: ['These companies process information for us under our instructions. Some are outside Kenya, so your information may be transferred abroad; you agree to this when you create an account.'],
    list: [
      'Groq (USA) runs the AI. It receives what you type, your first name, age, sex, area and medical history, and the written reports you upload. It never receives your phone number or ID number.',
      'Supabase stores the database and the files you upload, Railway runs our servers, Vercel serves the website.',
      'Daily.co (USA) carries video consultations.',
      'Africa\'s Talking (Kenya) sends SMS messages.',
      'OpenStreetMap finds hospitals near you. It only receives your area rounded to about 1 km.',
    ],
  },
  {
    h: 'How long we keep it',
    list: [
      'Your account stays until you delete it.',
      'Conversations with the assistant that never led to a visit or consultation are emptied after 12 months.',
      'Diagnoses and prescriptions are health records that hospitals must keep. If you delete your account, they are kept without your name, phone or ID number, so they can no longer be linked to you through CivCare.',
    ],
  },
  {
    h: 'How we protect it',
    list: [
      'You sign in with your phone number, ID number and a PIN. Five wrong PINs lock the account for 15 minutes.',
      'Everything travels over encrypted connections.',
      'A doctor can only open your file while you are their patient, and every time they do it is recorded. You can see that record.',
      'If your information is ever exposed in a way that puts you at risk, we will tell you and the Office of the Data Protection Commissioner within 72 hours of finding out.',
    ],
  },
  {
    h: 'Your rights',
    body: ['Under the Data Protection Act 2019 you can:'],
    list: [
      'See and download everything we hold about you.',
      'Correct details that are wrong.',
      'Delete your account.',
      'Withdraw your consent, or object to how your information is used.',
      'See who has opened your record.',
    ],
    after: 'Do all of these from Profile → Your privacy. If you are unhappy with how we handle your information, you can complain to the Office of the Data Protection Commissioner at www.odpc.go.ke.',
  },
  {
    h: 'Children',
    body: ['A patient under 18 needs a parent or guardian to agree to this notice for them when the account is created.'],
  },
];

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <main className="pv">
      <style>{`
        .pv { min-height: 100dvh; background: var(--cc-bg); color: var(--cc-text); padding: 28px 18px 48px; box-sizing: border-box; }
        .pv__inner { max-width: 680px; margin: 0 auto; }
        .pv__back { border: 1px solid var(--cc-border-strong); background: var(--cc-surface-solid); color: var(--cc-text); border-radius: 10px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
        .pv__back:focus-visible { outline: 3px solid var(--cc-primary-border); outline-offset: 2px; }
        .pv h1 { font-size: clamp(26px, 5vw, 34px); letter-spacing: -0.02em; margin: 22px 0 6px; text-wrap: balance; }
        .pv__meta { color: var(--cc-muted); font-size: 13px; margin: 0 0 26px; }
        .pv section { padding: 18px 0; border-top: 1px solid var(--cc-border); }
        .pv h2 { font-size: 17px; margin: 0 0 8px; text-wrap: balance; }
        .pv p, .pv li { font-size: 14.5px; line-height: 1.65; color: var(--cc-text-2); max-width: 65ch; }
        .pv p { margin: 0 0 8px; }
        .pv ul { margin: 4px 0 8px; padding-left: 20px; display: grid; gap: 6px; }
        .pv__contact { margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: var(--cc-primary-soft); border: 1px solid var(--cc-primary-border); font-size: 14px; }
      `}</style>
      <div className="pv__inner">
        <button type="button" className="pv__back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          ← Back
        </button>
        <h1>How CivCare uses your information</h1>
        <p className="pv__meta">Privacy notice · version {PRIVACY_VERSION} · Kenya Data Protection Act 2019</p>

        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {(s.body || []).map((t) => <p key={t}>{t}</p>)}
            {s.list && <ul>{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
            {s.after && <p>{s.after}</p>}
          </section>
        ))}

        <div className="pv__contact">
          {PRIVACY_CONTACT
            ? <>Questions about your information? Contact our data protection officer: <strong>{PRIVACY_CONTACT}</strong></>
            : <>Questions about your information? Use Profile → Your privacy to download, correct or delete it, or contact the CivCare team.</>}
        </div>
      </div>
    </main>
  );
}
