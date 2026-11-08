import { CalendarDays, CircleDot, Sparkles } from 'lucide-react';
import { CREATIVE_EFFECTS, formatCreativeDate } from '../lib/creativeEffects';
import type { EditSettings } from '../types';
import { EditorSlider } from './EditorSlider';

interface CreativeEffectsPanelProps {
  settings: EditSettings;
  commit: (patch: Partial<EditSettings> | ((current: EditSettings) => Partial<EditSettings>)) => void;
  liveSettings: (updater: (current: EditSettings) => EditSettings) => void;
  start: () => void;
  end: () => void;
}

export function CreativeEffectsPanel({ settings, commit, liveSettings, start, end }: CreativeEffectsPanelProps) {
  const creative = settings.creative;
  const selected = CREATIVE_EFFECTS.find(effect => effect.id === creative.id) ?? CREATIVE_EFFECTS[0];
  const setIntensity = (value: number) => liveSettings(current => ({ ...current, creative: { ...current.creative, intensity: value } }));
  return <section className="creative-effects" aria-label="Hafif efektler">
    <div className="creative-effects__heading"><span><Sparkles size={16} /> Hafif efektler</span><small>WebGL öncelikli · Canvas 2D yedekli</small></div>
    <div className="creative-effect-grid" role="group" aria-label="Efekt seçimi">
      {CREATIVE_EFFECTS.map(effect => <button key={effect.id} className={creative.id === effect.id ? 'active' : ''} data-effect={effect.id} onClick={() => commit(current => ({ creative: { ...current.creative, id: effect.id, intensity: effect.defaultIntensity } }))} aria-pressed={creative.id === effect.id}><i aria-hidden="true" /><span>{effect.name}</span></button>)}
    </div>
    {creative.id !== 'none' && <EditorSlider label="Efekt yoğunluğu" value={creative.intensity} min={0} max={100} displayValue={`${creative.intensity}%`} onChange={setIntensity} onStart={start} onEnd={end} onReset={() => commit(current => ({ creative: { ...current.creative, intensity: selected.defaultIntensity } }))} />}
    <div className="creative-option-row">
      <button role="switch" aria-checked={creative.particles} className={creative.particles ? 'active' : ''} onClick={() => commit(current => ({ creative: { ...current.creative, particles: !current.creative.particles } }))}><CircleDot size={16} /><span>Parçacıklar</span><strong>{creative.particles ? 'Etkin' : 'Kapalı'}</strong></button>
      <button role="switch" aria-checked={creative.dateStamp} className={creative.dateStamp ? 'active' : ''} onClick={() => commit(current => ({ creative: { ...current.creative, dateStamp: !current.creative.dateStamp, dateStampText: current.creative.dateStampText || formatCreativeDate(new Date()) } }))}><CalendarDays size={16} /><span>Tarih damgası</span><strong>{creative.dateStamp ? 'Etkin' : 'Kapalı'}</strong></button>
    </div>
    {creative.particles && <EditorSlider label="Parçacık yoğunluğu" value={creative.particleIntensity} min={0} max={100} displayValue={`${creative.particleIntensity}%`} onChange={value => liveSettings(current => ({ ...current, creative: { ...current.creative, particleIntensity: value } }))} onStart={start} onEnd={end} onReset={() => commit(current => ({ creative: { ...current.creative, particleIntensity: 35 } }))} />}
    {creative.dateStamp && creative.dateStampText && <p className="creative-date-preview"><CalendarDays size={14} /><span data-user-content>{creative.dateStampText}</span></p>}
    <p className="tool-note">Efektler fotoğraf ve video karelerinde aynı modeli kullanır. Kapalı parçacıklar çıktıya eklenmez.</p>
  </section>;
}
