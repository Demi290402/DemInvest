import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

import { pwaUpdateManager } from './lib/pwaUpdateManager';

// Il PwaUpdateManager gestisce automaticamente il ciclo di vita del Service Worker
// e controlla continuamente (in background) nuovi deploy e rilasci
void pwaUpdateManager;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

