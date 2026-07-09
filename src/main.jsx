import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ToastProvider from './components/ToastProvider';
import TransitionProvider from './components/TransitionProvider';
import { clearLegacyPlaceholders } from './data/mockData';
import { syncWithSupabase } from './utils/storage';
import './index.css';

// Detect an OAuth (Google) redirect return *before* supabase-js strips the params
// from the URL, so App can play the split-curtain reveal once the session hydrates.
try {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') || params.has('access_token') || window.location.hash.includes('access_token')) {
    sessionStorage.setItem('lowkey_oauth_return', '1');
  }
} catch { /* sessionStorage unavailable — skip the flourish */ }

// Purge any legacy placeholder parties / demo user from older builds.
clearLegacyPlaceholders();

// Sync with Supabase cloud database
syncWithSupabase();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <TransitionProvider>
          <App />
        </TransitionProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register the service worker for installable/offline PWA support (prod only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
