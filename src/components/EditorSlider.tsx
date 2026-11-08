import { Sun } from 'lucide-react';

interface EditorSliderProps {
  label: string; value: number; min: number; max: number; icon?: typeof Sun; neutral?: number; displayValue?: string; disabled?: boolean;
  onChange: (value: number) => void; onStart?: () => void; onEnd?: () => void; onReset?: () => void;
}
export function EditorSlider({ label, value, min, max, icon: Icon, neutral = 0, displayValue, disabled, onChange, onStart, onEnd, onReset }: EditorSliderProps) {
  return <div className={`editor-slider ${disabled ? 'disabled' : ''}`}>
    <div className="editor-slider__label"><span>{Icon && <Icon size={15} />}{label}</span><button onDoubleClick={onReset} onClick={onReset} aria-label={`${label} sıfırla`}>{displayValue || `${value > 0 && neutral === 0 ? '+' : ''}${value}`}</button></div>
    <input type="range" min={min} max={max} value={value} disabled={disabled} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onPointerDown={onStart} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onEnd} onPointerCancel={onEnd} onKeyUp={onEnd} aria-label={label} />
  </div>;
}
