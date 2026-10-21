import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installAuth } from './utils/authFetch';
import { refreshPush, listenForRotation } from './utils/push';
import { translateDom } from './i18n/dom';
import { getLang } from './i18n';

installAuth();
document.documentElement.lang = getLang() === 'en' ? 'en' : 'sw';
translateDom();
refreshPush();
listenForRotation();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
