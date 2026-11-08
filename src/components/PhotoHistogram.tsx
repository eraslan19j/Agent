import { useEffect, useState } from 'react';
import { renderPhoto } from '../lib/imageEngine';
import type { EditSettings } from '../types';

const empty = Array.from({ length: 48 }, () => 0);
export function PhotoHistogram({ source, settings }: { source: string; settings: EditSettings }) {
  const [bins, setBins] = useState<number[]>(empty);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void renderPhoto(source, settings, { format: 'jpeg', quality: .65, maxDimension: 256 }).then(async blob => {
        const bitmap = await createImageBitmap(blob);
        if (!active) { bitmap.close(); return; }
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 64;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0, 96, 64); bitmap.close();
        const data = context.getImageData(0, 0, 96, 64).data;
        const values = Array.from({ length: 48 }, () => 0);
        for (let i = 0; i < data.length; i += 4) {
          const luminance = Math.round(data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722);
          values[Math.min(47, Math.floor(luminance / 256 * 48))] += 1;
        }
        const max = Math.max(1, ...values);
        if (active) setBins(values.map(value => value / max));
      }).catch(() => undefined);
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source, settings]);
  return <div className="photo-histogram" role="img" aria-label="Düzenlenen fotoğrafın 48 bölgeli canlı luminans histogramı"><div>{bins.map((value, index) => <i key={index} style={{ transform: `scaleY(${Math.max(.015, value)})` }} />)}</div><span>GÖLGELER</span><span>ORTA TON</span><span>PARLAK</span></div>;
}
