import client from './client';

export const sendMessage = (data) => client.post('/triage/message', data, { timeout: 90000 });
export const confirmArrival = (data) => client.post('/triage/confirm-arrival', data);
export const callPatient = (data) => client.post('/triage/call-patient', data);
export const selectHospital = (data) => client.post('/triage/select-hospital', data);
export const createAppointment = (data) => client.post('/triage/create-appointment', data);
export const getSession = (id) => client.get(`/triage/session/${id}`);
export const checkInAfterTransfer = (appointmentId) => client.post(`/triage/appointment/${appointmentId}/arrived`);
