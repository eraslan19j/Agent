import { Capacitor } from '@capacitor/core';

export type ThemePreference = 'dark' | 'amoled' | 'light' | 'system';
export type AccentPreference = 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'dynamic';
export type InterfaceStyle = 'glass' | 'simple';
export type LanguagePreference = 'tr' | 'en';

export interface AppPreferences {
  theme: ThemePreference;
  accent: AccentPreference;
  interfaceStyle: InterfaceStyle;
  reduceBlur: boolean;
  splashAnimation: boolean;
  language: LanguagePreference;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark', accent: 'yellow', interfaceStyle: 'glass', reduceBlur: false, splashAnimation: true, language: 'tr',
};

export const PREFERENCES_KEY = 'myvision.preferences.v2';
const accents = {
  yellow: { hex: '#FFC400', rgb: '255, 196, 0' },
  blue: { hex: '#56A8FF', rgb: '86, 168, 255' },
  green: { hex: '#58D68D', rgb: '88, 214, 141' },
  red: { hex: '#FF6B6B', rgb: '255, 107, 107' },
  purple: { hex: '#B89CFF', rgb: '184, 156, 255' },
  dynamic: { hex: '#FFC400', rgb: '255, 196, 0' },
};

interface NativeThemePlugin {
  setPreferences(options: { theme: string; splashAnimation: boolean }): Promise<void>;
  getDynamicColor(): Promise<{ color?: string }>;
}
const NativeTheme = Capacitor.isNativePlatform() ? Capacitor.registerPlugin<NativeThemePlugin>('Theme') : null;

export function loadPreferences(): AppPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}') as Partial<AppPreferences>;
    return {
      theme: ['dark', 'amoled', 'light', 'system'].includes(value.theme || '') ? value.theme! : DEFAULT_PREFERENCES.theme,
      accent: ['yellow', 'blue', 'green', 'red', 'purple', 'dynamic'].includes(value.accent || '') ? value.accent! : DEFAULT_PREFERENCES.accent,
      interfaceStyle: value.interfaceStyle === 'simple' ? 'simple' : 'glass',
      reduceBlur: value.reduceBlur === true,
      splashAnimation: value.splashAnimation !== false,
      language: value.language === 'en' ? 'en' : 'tr',
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}

export function persistPreferences(preferences: AppPreferences) {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Settings remain active for this session. */ }
  if (NativeTheme) void NativeTheme.setPreferences({ theme: preferences.theme, splashAnimation: preferences.splashAnimation }).catch(() => undefined);
}

export function resolveTheme(preference: ThemePreference, systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches) {
  if (preference !== 'system') return preference;
  return systemDark ? 'dark' : 'light';
}

function rgbFromHex(hex: string) {
  const value = hex.replace('#', '');
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
}

export function applyPreferences(preferences: AppPreferences, dynamicColor?: string) {
  const root = document.documentElement;
  const theme = resolveTheme(preferences.theme);
  const accent = dynamicColor && preferences.accent === 'dynamic' ? { hex: dynamicColor, rgb: rgbFromHex(dynamicColor) } : accents[preferences.accent];
  root.dataset.theme = theme;
  root.dataset.themePreference = preferences.theme;
  root.dataset.accent = preferences.accent;
  root.dataset.uiStyle = preferences.interfaceStyle;
  root.dataset.reduceBlur = String(preferences.reduceBlur);
  root.lang = preferences.language;
  root.style.setProperty('--brand-yellow', accent.hex);
  root.style.setProperty('--brand-rgb', accent.rgb);
  root.style.setProperty('--lime', accent.hex);
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F7F7F5' : theme === 'amoled' ? '#000000' : '#0A0A0A');
}

export async function getDynamicAccent(): Promise<string | undefined> {
  if (!NativeTheme) return undefined;
  try { return (await NativeTheme.getDynamicColor()).color; } catch { return undefined; }
}

export function watchSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
