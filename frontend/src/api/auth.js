import client from './client';

// Patient
export const registerPatient = (data) => client.post('/auth/patient/register', data);
export const loginPatient    = (data) => client.post('/auth/patient/login', data);

// Doctor
export const registerDoctor  = (data) => client.post('/auth/doctor/register', data);
export const loginDoctor     = (data) => client.post('/auth/doctor/login', data);

// Forgot PIN / password: a code by SMS, then a new PIN or password
export const forgotPatientPin      = (data) => client.post('/auth/patient/forgot-pin', data);
export const resetPatientPin       = (data) => client.post('/auth/patient/reset-pin', data);
export const forgotDoctorPassword  = (data) => client.post('/auth/doctor/forgot-password', data);
export const resetDoctorPassword   = (data) => client.post('/auth/doctor/reset-password', data);
