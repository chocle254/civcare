import axios from 'axios';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  // AI steps (routing, case statements) can take 20–40 s on a slow
  // connection; 15 s cut them off mid-way and showed an error.
  timeout: 60000,
});

// Attach token to every request automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('civtech_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // An expired session signs the person out. A wrong password on a
    // sign-in form is also a 401, but that must show its error instead.
    const url = err.config?.url || '';
    const signingIn = /\/auth\/(patient|doctor)\/(login|register)|\/admin\/login/.test(url);
    if (err.response?.status === 401 && !signingIn) {
      const doctor = window.location.pathname.startsWith('/doctor');
      localStorage.clear();
      window.location.href = doctor ? '/doctor' : '/';
    }
    return Promise.reject(err);
  }
);

export default client;
