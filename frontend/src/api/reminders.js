import client from './client';

export const getMyMeds      = (patientId) => client.get(`/reminders/my-meds?patient_id=${patientId}`);
export const setReminders   = (data)      => client.post('/reminders/set', data);
export const respondReminder = (data)     => client.post('/reminders/respond', data);

// ── Carer loop ──
export const getDueDose     = (patientId) => client.get(`/reminders/due?patient_id=${patientId}`);
export const submitCheckin  = (data)      => client.post('/reminders/checkin', data);
export const getFollowup    = (courseId)  => client.get(`/reminders/followup/${courseId}`);
