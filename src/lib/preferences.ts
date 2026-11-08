import { Capacitor } from '@capacitor/core';

export type ThemePreference = 'dark' | 'light' | 'system';
export type LanguagePreference = 'tr' | 'en';

export interface AppPreferences {
  theme: ThemePreference;
  language: LanguagePreference;
}

export const DEFAULT_PREFERENCES: AppPreferences = { theme: 'system', language: 'tr' };
export const PREFERENCES_KEY = 'myvision.preferences.v2';

interface NativeThemePlugin {
  setPreferences(options: { theme: string; splashAnimation: boolean }): Promise<void>;
}
const NativeTheme = Capacitor.isNativePlatform() ? Capacitor.registerPlugin<NativeThemePlugin>('Theme') : null;

export function loadPreferences(): AppPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}') as { theme?: string; language?: string };
    return {
      theme: value.theme === 'amoled' ? 'dark' : ['dark', 'light', 'system'].includes(value.theme || '') ? value.theme as ThemePreference : DEFAULT_PREFERENCES.theme,
      language: value.language === 'en' ? 'en' : 'tr',
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}

export function persistPreferences(preferences: AppPreferences) {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Tercihler bu oturumda etkin kalır. */ }
  if (NativeTheme) void NativeTheme.setPreferences({ theme: preferences.theme, splashAnimation: false }).catch(() => undefined);
}

export function resolveTheme(preference: ThemePreference, systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches) {
  if (preference !== 'system') return preference;
  return systemDark ? 'dark' : 'light';
}

export function applyPreferences(preferences: AppPreferences) {
  const root = document.documentElement;
  const theme = resolveTheme(preferences.theme);
  root.dataset.theme = theme;
  root.dataset.themePreference = preferences.theme;
  root.lang = preferences.language;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F5F5F7' : '#000000');
}

export function watchSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
