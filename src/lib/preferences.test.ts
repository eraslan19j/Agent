import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, persistPreferences, resolveTheme, type AppPreferences } from './preferences';

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('appearance preferences', () => {
  it('uses safe defaults for missing and malformed storage', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    values.set(PREFERENCES_KEY, '{broken');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects unknown persisted enum values', () => {
    values.set(PREFERENCES_KEY, JSON.stringify({ theme: 'neon', accent: 'pink', interfaceStyle: 'unknown', splashAnimation: false }));
    expect(loadPreferences()).toEqual({ ...DEFAULT_PREFERENCES, splashAnimation: false });
  });

  it('round-trips every appearance preference', () => {
    const preferences: AppPreferences = { theme: 'amoled', accent: 'purple', interfaceStyle: 'simple', reduceBlur: true, splashAnimation: false, language: 'en' };
    persistPreferences(preferences);
    expect(loadPreferences()).toEqual(preferences);
  });

  it('resolves system theme without changing explicit AMOLED', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('amoled', false)).toBe('amoled');
  });
});
