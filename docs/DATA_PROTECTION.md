# CivCare and the Kenya Data Protection Act 2019

CivCare processes health data, which the Act treats as **sensitive personal data**. This file records what the software does to comply, and the steps the operator has to take outside the code. Keep it current whenever data handling changes.

Section numbers refer to the Data Protection Act 2019 and the Data Protection (General) and (Registration of Data Controllers and Data Processors) Regulations 2021.

## Built into the app

| Requirement | Section | How CivCare meets it |
|---|---|---|
| Privacy notice before collection | s. 29 | `/privacy` page in plain language. It is linked from sign-up and Profile. Its version is in `frontend/src/utils/privacy.js` and `backend/app/services/consent.py`. |
| Consent: explicit, recorded, and as easy to withdraw as to give | ss. 30, 32 | Sign-up requires the consent box. The version and time are stored on the patient (`consent_version`, `consent_at`). Existing patients see a consent screen (`PrivacyGate`) before anything else. Profile → Your privacy → Withdraw consent switches the assistant off (`/triage/message` and `/consultation/initiate` return 403). |
| Children's data | s. 33 | If the patient is under 18, or signs up with a birth certificate, a parent or guardian's name is required, and the consent wording is addressed to them. |
| Health data handled under a health professional | s. 46 | Doctors make every clinical decision. The AI is labelled as decision support on the doctor's side and never diagnoses or routes the patient. |
| No decisions based solely on automated processing | s. 35 | The patient chooses hospital or online. Every diagnosis and prescription is written by a doctor. |
| Right of access and a portable copy | ss. 26, 38 | Profile → Your privacy → Download my data (`GET /privacy/my-data`) gives a JSON file of everything held. |
| Right to know who accessed the data | s. 26 | Every opening of a case file, consultation file, record summary or past diagnoses is logged in `data_access_log`. The patient sees the list in Profile (`GET /privacy/access-log`). |
| Right to rectification | s. 40 | Patients edit their name, date of birth, area, allergies and sex (`PATCH /auth/patient/profile/update`). Each change is logged. |
| Right to erasure | s. 40 | Profile → Delete my account (`POST /privacy/delete-account`). It erases identity, conversations and check-in answers. Doctor-written diagnoses and prescriptions are kept without identifiers, because facilities must keep health records. |
| Data minimisation | s. 25(c) | The AI gets the first name only, never the phone or ID number. OpenStreetMap gets coordinates rounded to about 1 km. Doctors see only the last three digits of the ID number. Doctors' National ID numbers are no longer collected. Logs don't print phone numbers, names or symptoms. |
| Retention limits | s. 39 | A daily job (`purge_unused_chats`) empties conversations older than 12 months that never led to a visit or consultation. |
| Security by design and by default | s. 41 | See below. |

### Security controls (s. 41)

- **Every request is authenticated.** All patient-data endpoints need a signed token (`app/services/authz.py`), and so does the queue WebSocket (`?token=`). Patient tokens last 7 days and doctor tokens 12 hours.
- **Ownership is checked on every record.**
  - A patient reaches only their own records.
  - A doctor reaches a patient only while caring for them: an appointment with them or at their hospital, or an online consultation with them.
  - Requests that name a doctor must come from that doctor.
- **Credentials.**
  - Patients sign in with phone, ID number and a 4-digit PIN. Common PINs are refused.
  - Doctors use a password of at least 8 characters, not only digits.
  - Both are hashed with salted PBKDF2-SHA256 (200,000 iterations).
  - Old unsalted hashes are upgraded at the next sign-in.
  - Doctors still on their National ID must choose a password before reaching the dashboard.
- **Brute-force protection.** Five wrong attempts lock an account for 15 minutes.
- **Video.** Rooms are private, and each person joins with a 2-hour meeting token.
- **Analytics.** Clinicians only. Disease counts below 5 in a county are merged so rare cases can't identify anyone.
- **Network.**
  - CORS allows only CivCare's own web origins (`ALLOWED_ORIGINS` adds more).
  - Responses send `nosniff`, HSTS, `no-referrer` and `no-store`.
  - API docs are off unless `SHOW_API_DOCS=1`.

## The operator must do these (not code)

1. **Register with the ODPC.** Anyone processing health data must register as a data controller, whatever its size. Apply at www.odpc.go.ke and renew as required.
2. **Carry out a Data Protection Impact Assessment (s. 31)** before going live. Processing health data with AI is high risk. Record the risks in this file and how each is handled.
3. **Appoint a Data Protection Officer (s. 24).** Put their contact in `REACT_APP_PRIVACY_CONTACT` on Vercel; the privacy notice then shows it.
4. **Sign data processing agreements (s. 42)** with every processor:
   - Groq (AI, USA)
   - Supabase (database)
   - Railway (servers)
   - Vercel (website)
   - Daily.co (video, USA)
   - Africa's Talking (SMS)
   - Safaricom or Airtel (payments, once enabled)
5. **Document cross-border transfers (ss. 48–50).**
   - Health data goes to the USA (Groq, Daily.co) and possibly wherever Supabase and Railway host the data. Confirm each region and choose an EU or African region where offered.
   - Keep proof of the safeguards: each processor's terms and security certifications.
6. **Have a breach response plan (s. 43).**
   - Notify the ODPC within 72 hours of becoming aware of a breach.
   - Tell affected patients without delay when there is a real risk of harm.
   - `data_access_log` and Railway's logs are the starting points for an investigation.
7. **Set a health-records retention period** with the partner hospitals, according to Ministry of Health rules. Then decide whether finished clinical records should be archived or deleted after that period. The app currently keeps them indefinitely.
8. **Limit operator database access.** Use separate Supabase accounts with multi-factor authentication. Keep `SUPABASE_SERVICE_ROLE_KEY` and `SECRET_KEY` only in Railway's secrets. Rotate `SECRET_KEY` if it was ever shared; this signs everyone out.
9. **Turn off test shortcuts before real patients use the app.** The Kenyatta National Hospital testing override in `app/routers/hospitals.py` and `app/routers/triage.py` routes every KNH arrival to one test doctor.

## Known gaps

- **Encryption at rest:** relies on Supabase's disk encryption. Fields are not encrypted inside the app.
- **Lockout counters are held in memory,** so they reset when the server restarts.
- **Changing a phone or ID number** needs the CivCare team; there's no self-service yet.
- **USSD and SMS** don't yet show the privacy notice or collect consent. They must before they are switched on.
