import type { TextLayer } from '../types';

/** Keep a text block inside the image on the side selected by its alignment. */
export function textAvailableRatio(layer: Pick<TextLayer, 'x' | 'align'>) {
  const x = Math.max(0, Math.min(1, layer.x));
  const available = layer.align === 'center' ? 2 * Math.min(x, 1 - x) : layer.align === 'left' ? 1 - x : x;
  return Math.min(.9, Math.max(.08, available * .96));
}

/** Canvas-compatible word wrapping, including words longer than one line. */
export function wrapTextLines(value: string, maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of word) {
        const next = line + character;
        if (line && measure(next) > maxWidth) { lines.push(line); line = character; }
        else line = next;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}
