// Must match PRIVACY_VERSION in backend/app/services/consent.py.
export const PRIVACY_VERSION = '2026-10-18';

// Who patients contact about their data. Set REACT_APP_PRIVACY_CONTACT on
// Vercel to the data protection officer's email or phone.
export const PRIVACY_CONTACT = process.env.REACT_APP_PRIVACY_CONTACT || '';
