import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ToastProvider from './components/ToastProvider';
import { clearLegacyPlaceholders } from './data/mockData';
import { syncWithSupabase } from './utils/storage';
import './index.css';

// Purge any legacy placeholder parties / demo user from older builds.
clearLegacyPlaceholders();

// Sync with Supabase cloud database
syncWithSupabase();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
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
