import { useRef, useState } from 'react';
import { Check, X, Move } from 'lucide-react';
import type { NormalizedCrop } from '../types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export function FreeCropEditor({ source, initialCrop, onApply, onClose }: { source: string; initialCrop?: NormalizedCrop; onApply: (crop: NormalizedCrop) => void; onClose: () => void }) {
  const [crop, setCrop] = useState<NormalizedCrop>(initialCrop ?? { x: .08, y: .08, width: .84, height: .84 });
  const imageRef = useRef<HTMLImageElement>(null);
  const gesture = useRef<{ handle: Handle; x: number; y: number; crop: NormalizedCrop } | null>(null);
  const start = (event: React.PointerEvent, handle: Handle) => {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { handle, x: event.clientX, y: event.clientY, crop };
  };
  const move = (event: React.PointerEvent) => {
    const startValue = gesture.current; const image = imageRef.current;
    if (!startValue || !image) return;
    const rect = image.getBoundingClientRect();
    const dx = (event.clientX - startValue.x) / rect.width, dy = (event.clientY - startValue.y) / rect.height;
    const base = startValue.crop; const next = { ...base };
    if (startValue.handle === 'move') {
      next.x = clamp(base.x + dx, 0, 1 - base.width); next.y = clamp(base.y + dy, 0, 1 - base.height);
    } else {
      if (startValue.handle.includes('w')) {
        const right = base.x + base.width; next.x = clamp(base.x + dx, 0, right - .05); next.width = right - next.x;
      } else {
        next.width = clamp(base.width + dx, .05, 1 - base.x);
      }
      if (startValue.handle.includes('n')) {
        const bottom = base.y + base.height; next.y = clamp(base.y + dy, 0, bottom - .05); next.height = bottom - next.y;
      } else {
        next.height = clamp(base.height + dy, .05, 1 - base.y);
      }
    }
    setCrop(next);
  };
  const end = () => { gesture.current = null; };
  const cropStyle = { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` };
  return <div className="free-crop-modal" role="dialog" aria-modal="true" aria-label="Serbest kırpma">
    <header><button className="icon-button" onClick={onClose} aria-label="Kırpmayı iptal et"><X size={21} /></button><div><span className="eyebrow">SERBEST KIRPMA</span><strong>Kadrajını belirle</strong></div><button className="button button--lime button--small" onClick={() => onApply(crop)}><Check size={17} /> Uygula</button></header>
    <div className="free-crop-workspace"><div className="free-crop-image-wrap">
      <img ref={imageRef} src={source} alt="Serbest kırpma önizlemesi" draggable={false} />
      <div className="free-crop-shade" style={{ clipPath: `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%)` }} />
      <div className="free-crop-rect" style={cropStyle} onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div className="composition-grid"><i /><i /><i /><i /></div><Move size={20} className="crop-move-icon" />
        {(['nw', 'ne', 'sw', 'se'] as Handle[]).map(handle => <button key={handle} className={`crop-handle crop-handle--${handle}`} onPointerDown={event => start(event, handle)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label={`${handle} kırpma tutamacı`} />)}
      </div>
    </div></div>
    <p className="free-crop-hint">Kadrajı taşı; köşelerden en boy oranını serbestçe değiştir.</p>
  </div>;
}
