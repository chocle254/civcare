import client from './client';
export const updateDoctorStatus  = (data)        => client.patch('/doctors/status', data);
export const redirectPatients    = (data)        => client.post('/doctors/redirect-patients', data);
export const pingDoctor          = (doctorId)    => client.post(`/doctors/ping?doctor_id=${doctorId}`);
export const getAvailableDoctors = ()            => client.get('/doctors/available');
export const updateSettings      = (data)        => client.patch('/doctors/settings', data);
export const getTransferTargets  = (doctorId)    => client.get(`/doctors/transfer-targets?doctor_id=${doctorId}`);
export const transferPatient     = (data)        => client.post('/doctors/transfer', data);
