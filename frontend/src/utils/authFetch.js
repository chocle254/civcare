import axios from 'axios';

// Some pages call the API with plain axios or fetch instead of the shared
// client. This adds the signed-in person's token to every request bound for
// the CivCare API, so the server can check who is asking.
const API = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = () => localStorage.getItem('civtech_token');
const isApi = (url) => typeof url === 'string' && url.startsWith(API);

export function installAuth() {
  axios.interceptors.request.use((config) => {
    const t = token();
    if (t && isApi(config.url) && !config.headers?.Authorization) {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${t}` };
    }
    return config;
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    const t = token();
    if (t && isApi(url)) {
      const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${t}`);
      return nativeFetch(input, { ...init, headers });
    }
    return nativeFetch(input, init);
  };
}
