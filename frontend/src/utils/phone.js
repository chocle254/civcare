// Kenyan mobile numbers: people type 0712 345 678, 0110 123 456, 712345678,
// 254712345678 or +254 712 345 678. Normalise them all to +2547XXXXXXXX /
// +2541XXXXXXXX before sending, so accounts never split across formats.

export function normalizeKePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  let local;
  if (digits.length === 12 && digits.startsWith('254')) local = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('0')) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else return null;
  if (!/^[17]\d{8}$/.test(local)) return null;
  return `+254${local}`;
}

export const PHONE_HINT = 'Kenyan mobile number, e.g. 0712 345 678';
export const PHONE_ERROR = 'Enter a valid Kenyan mobile number, such as 0712 345 678 or 0110 123 456.';
