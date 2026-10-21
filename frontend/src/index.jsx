import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installAuth } from './utils/authFetch';
import { refreshPush, listenForRotation } from './utils/push';

installAuth();
refreshPush();
listenForRotation();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
