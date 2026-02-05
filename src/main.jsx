import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for push notifications (caching disabled on localhost)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
