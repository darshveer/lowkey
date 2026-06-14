import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { seedMockData } from './data/mockData';
import { syncWithSupabase } from './utils/storage';
import './index.css';

// Seed mock data on first load
seedMockData();

// Sync with Supabase cloud database
syncWithSupabase();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
