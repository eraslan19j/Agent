import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import '@fontsource/manrope/latin-ext-400.css';
import '@fontsource/manrope/latin-ext-500.css';
import '@fontsource/manrope/latin-ext-600.css';
import '@fontsource/manrope/latin-ext-700.css';
import '@fontsource/manrope/latin-ext-800.css';
import '@fontsource/instrument-serif/latin-ext-400.css';
import './styles.css';
import './liquid-glass.css';
import './preferences.css';
import App from './App';
import { applyPreferences, loadPreferences } from './lib/preferences';

applyPreferences(loadPreferences());
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-android');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
