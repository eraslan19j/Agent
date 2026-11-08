import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, loadPreferences, PREFERENCES_KEY, persistPreferences, resolveTheme, type AppPreferences } from './preferences';

const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(), getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
};
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
Object.defineProperty(globalThis, 'matchMedia', { value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }), configurable: true });

beforeEach(() => values.clear());

describe('appearance preferences', () => {
  it('defaults to the system appearance', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('rejects unknown values and migrates the old pure-black option', () => {
    values.set(PREFERENCES_KEY, JSON.stringify({ theme: 'amoled', language: 'en' }));
    expect(loadPreferences()).toEqual({ theme: 'dark', language: 'en' });
  });

  it('round-trips current preferences', () => {
    const preferences: AppPreferences = { theme: 'light', language: 'en' };
    persistPreferences(preferences);
    expect(loadPreferences()).toEqual(preferences);
  });
});
