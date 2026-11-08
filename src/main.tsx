import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './styles.css';
import './liquid-glass.css';
import './preferences.css';
import './editor-advanced.css';
import './studio.css';
import App from './App';
import { applyPreferences, loadPreferences } from './lib/preferences';
import { startLocalization } from './lib/localization';

const initialPreferences = loadPreferences();
applyPreferences(initialPreferences);
startLocalization(initialPreferences.language);
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-android');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
