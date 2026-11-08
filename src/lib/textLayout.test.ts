import { describe, expect, it } from 'vitest';
import { textAvailableRatio, wrapTextLines } from './textLayout';

const measure = (value: string) => value.length * 10;

describe('editable text layout', () => {
  it('wraps long aligned text instead of clipping it at the image edge', () => {
    const maxWidth = 100;
    const lines = wrapTextLines('Sonradan düzenlendi', maxWidth, measure);
    expect(lines).toEqual(['Sonradan', 'düzenlendi']);
    expect(lines.every(line => measure(line) <= maxWidth)).toBe(true);
  });

  it('breaks words that cannot fit on one line', () => {
    expect(wrapTextLines('abcdefghij', 35, measure)).toEqual(['abc', 'def', 'ghi', 'j']);
  });

  it('keeps explicit paragraphs and empty lines', () => {
    expect(wrapTextLines('Bir\n\nİki', 100, measure)).toEqual(['Bir', '', 'İki']);
  });

  it('uses the available side for each alignment and clamps edge positions', () => {
    expect(textAvailableRatio({ x: .5, align: 'center' })).toBe(.9);
    expect(textAvailableRatio({ x: .5, align: 'left' })).toBeCloseTo(.48);
    expect(textAvailableRatio({ x: .5, align: 'right' })).toBeCloseTo(.48);
    expect(textAvailableRatio({ x: 0, align: 'right' })).toBe(.08);
    expect(textAvailableRatio({ x: 2, align: 'left' })).toBe(.08);
  });
});
