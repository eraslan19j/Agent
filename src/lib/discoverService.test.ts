import { describe, expect, it } from 'vitest';
import { randomDiscoverPage } from './discoverService';

describe('discovery page selection', () => {
  it('always stays within the available random page range', () => {
    for (let index = 0; index < 100; index += 1) {
      const page = randomDiscoverPage();
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(40);
    }
  });

  it('never repeats the current page on consecutive shuffles', () => {
    for (let current = 1; current <= 40; current += 1) {
      expect(randomDiscoverPage(current)).not.toBe(current);
    }
  });
});
