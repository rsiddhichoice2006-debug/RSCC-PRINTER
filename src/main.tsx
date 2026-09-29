import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign browser background/tab-switching "Database is closing/hidden" rejections from crashing the app
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason?.message || String(reason || '')).toLowerCase();
    if (
      msg.includes('database is closing') ||
      msg.includes('database is closing/hidden') ||
      msg.includes('connection is closing')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = (event.message || '').toLowerCase();
    if (
      msg.includes('database is closing') ||
      msg.includes('database is closing/hidden') ||
      msg.includes('connection is closing')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
