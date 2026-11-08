import { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Circle, Frame, Grip, Layers3, Palette, Plus, Sparkles, Trash2, Type, WandSparkles } from 'lucide-react';
import type { EditSettings, HslColor, SelectiveMask, TextLayer } from '../types';
import { EditorSlider } from './EditorSlider';

export type InteractionTool = 'none' | 'radial' | 'linear';
interface BaseProps {
  settings: EditSettings;
  commit: (patch: Partial<EditSettings>) => void;
  live: (patch: Partial<EditSettings>) => void;
  liveSettings: (updater: (current: EditSettings) => EditSettings) => void;
  start: () => void;
  end: () => void;
}

export function AdvancedEditorPanel(props: BaseProps) {
  const { settings, commit, live, liveSettings, start, end } = props;
  const [color, setColor] = useState<HslColor>('red');
  const [maskId, setMaskId] = useState<string | null>(null);
  const mask = settings.masks.find(item => item.id === maskId) ?? settings.masks[0];
  const hsl = settings.hsl[color];
  const updateHsl = (key: 'hue' | 'saturation' | 'luminance', value: number) => liveSettings(current => ({ ...current, hsl: { ...current.hsl, [color]: { ...current.hsl[color], [key]: value } } }));
  const updateMask = (key: keyof SelectiveMask, value: number) => {
    if (!mask) return;
    liveSettings(current => ({ ...current, masks: current.masks.map(item => item.id === mask.id ? { ...item, [key]: value } : item) }));
  };
  return <div className="advanced-panel">
    <div className="panel-heading"><div><span className="eyebrow">RENK</span><h3>Tonları ayrı ayrı yönet.</h3></div></div>
    <details className="tool-disclosure" open><summary><WandSparkles size={16} /> Curves <span>3 bölgeli tonal eğri</span></summary><div className="tool-disclosure__body">
      <EditorSlider label="Eğri · Gölgeler" value={settings.curveShadows} min={-100} max={100} onChange={value => live({ curveShadows: value })} onStart={start} onEnd={end} onReset={() => commit({ curveShadows: 0 })} />
      <EditorSlider label="Eğri · Orta tonlar" value={settings.curveMidtones} min={-100} max={100} onChange={value => live({ curveMidtones: value })} onStart={start} onEnd={end} onReset={() => commit({ curveMidtones: 0 })} />
      <EditorSlider label="Eğri · Parlak tonlar" value={settings.curveHighlights} min={-100} max={100} onChange={value => live({ curveHighlights: value })} onStart={start} onEnd={end} onReset={() => commit({ curveHighlights: 0 })} />
    </div></details>
    <details className="tool-disclosure"><summary><Palette size={16} /> HSL <span>7 renk kanalı</span></summary><div className="tool-disclosure__body">
      <div className="hsl-colors">{(Object.keys(settings.hsl) as HslColor[]).map(key => <button key={key} className={`hsl-color hsl-color--${key} ${color === key ? 'active' : ''}`} onClick={() => setColor(key)} aria-label={`${key} HSL`} aria-pressed={color === key} />)}</div>
      <EditorSlider label="Ton" value={hsl.hue} min={-60} max={60} onChange={value => updateHsl('hue', value)} onStart={start} onEnd={end} />
      <EditorSlider label="Doygunluk" value={hsl.saturation} min={-100} max={100} onChange={value => updateHsl('saturation', value)} onStart={start} onEnd={end} />
      <EditorSlider label="Parlaklık" value={hsl.luminance} min={-100} max={100} onChange={value => updateHsl('luminance', value)} onStart={start} onEnd={end} />
    </div></details>
    <details className="tool-disclosure"><summary><Layers3 size={16} /> Seçici maskeler <span>{settings.masks.length} maske</span></summary><div className="tool-disclosure__body">
      <div className="transform-row"><button onClick={() => props.commit({ masks: [...settings.masks, { id: crypto.randomUUID(), type: 'radial', x: .5, y: .5, radius: .3, angle: 0, feather: .45, exposure: 25, saturation: 0, temperature: 0 }] })}><Circle size={19} /><span>Radyal ekle</span></button><button onClick={() => props.commit({ masks: [...settings.masks, { id: crypto.randomUUID(), type: 'linear', x: .5, y: .5, radius: .35, angle: 90, feather: .45, exposure: 25, saturation: 0, temperature: 0 }] })}><Layers3 size={19} /><span>Lineer ekle</span></button></div>
      {settings.masks.length > 0 && <><div className="mask-list">{settings.masks.map((item, index) => <button key={item.id} className={mask?.id === item.id ? 'active' : ''} onClick={() => setMaskId(item.id)}>{item.type === 'radial' ? 'Radyal' : 'Lineer'} {index + 1}</button>)}</div>{mask && <div className="mask-controls">
        <EditorSlider label="Yerel pozlama" value={mask.exposure} min={-100} max={100} onChange={value => updateMask('exposure', value)} onStart={start} onEnd={end} />
        <EditorSlider label="Yerel doygunluk" value={mask.saturation} min={-100} max={100} onChange={value => updateMask('saturation', value)} onStart={start} onEnd={end} />
        <EditorSlider label="Yerel sıcaklık" value={mask.temperature} min={-100} max={100} onChange={value => updateMask('temperature', value)} onStart={start} onEnd={end} />
        <EditorSlider label="Maske boyutu" value={Math.round(mask.radius * 100)} min={5} max={100} onChange={value => updateMask('radius', value / 100)} onStart={start} onEnd={end} />
        <EditorSlider label="Yumuşak geçiş" value={Math.round(mask.feather * 100)} min={5} max={100} onChange={value => updateMask('feather', value / 100)} onStart={start} onEnd={end} />
        <button className="tool-danger" onClick={() => commit({ masks: settings.masks.filter(item => item.id !== mask.id) })}><Trash2 size={14} /> Maskeyi sil</button>
      </div>}</>}
      <p className="tool-note">Maskenin merkezini fotoğraf üzerindeki işaretten sürükleyebilirsin.</p>
    </div></details>
    <details className="tool-disclosure"><summary><Sparkles size={16} /> Detay <span>Gürültü ve netleştirme</span></summary><div className="tool-disclosure__body">
      <EditorSlider label="Gürültü azaltma" value={settings.noiseReduction} min={0} max={100} onChange={value => live({ noiseReduction: value })} onStart={start} onEnd={end} onReset={() => commit({ noiseReduction: 0 })} />
      <EditorSlider label="Keskinleştirme" value={settings.sharpen} min={0} max={100} onChange={value => live({ sharpen: value })} onStart={start} onEnd={end} onReset={() => commit({ sharpen: 0 })} />
    </div></details>
  </div>;
}

interface TextProps extends BaseProps { selectedId: string | null; setSelectedId: (id: string | null) => void; }
export function TextEditorPanel({ settings, commit, liveSettings, start, end, selectedId, setSelectedId }: TextProps) {
  const [draft, setDraft] = useState('');
  const selected = settings.texts.find(layer => layer.id === selectedId) ?? null;
  const update = (patch: Partial<TextLayer>) => {
    if (!selected) return;
    liveSettings(current => ({ ...current, texts: current.texts.map(layer => layer.id === selected.id ? { ...layer, ...patch } : layer) }));
  };
  const addText = () => {
    if (!draft.trim()) return;
    const id = crypto.randomUUID();
    commit({ texts: [...settings.texts, { id, text: draft.trim().slice(0, 80), x: .5, y: .5, size: 46, color: '#FFFFFF', font: 'sans', align: 'center', rotation: 0 }] });
    setSelectedId(id);
    setDraft('');
  };
  return <div className="creative-panel"><div className="panel-heading"><div><span className="eyebrow">METİN</span><h3>Fotoğrafın üzerinde anlat.</h3></div></div>
    <div className="text-composer"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={80} placeholder="Yeni metin yaz" aria-label="Yeni metin katmanı" onKeyDown={event => { if (event.key === 'Enter') addText(); }} /><button onClick={addText} disabled={!draft.trim()} aria-label="Metin ekle"><Plus size={18} /></button></div>
    {settings.texts.length > 0 && <div className="text-layer-list" aria-label="Metin katmanları">{settings.texts.map((layer, index) => <div className={`layer-row ${selected?.id === layer.id ? 'active' : ''}`} key={layer.id}><button className="layer-select" onClick={() => setSelectedId(layer.id)} aria-pressed={selected?.id === layer.id}><Type size={15} /><span data-user-content>{layer.text || `Metin ${index + 1}`}</span></button><button className="layer-delete" onClick={() => { commit({ texts: settings.texts.filter(item => item.id !== layer.id) }); if (selected?.id === layer.id) setSelectedId(null); }} aria-label={`${layer.text} metnini sil`}><Trash2 size={15} /></button></div>)}</div>}
    {selected ? <section className="text-inspector" aria-label="Seçili metni düzenle">
      <label>Metin<input value={selected.text} maxLength={80} onFocus={start} onBlur={end} onChange={event => update({ text: event.target.value })} /></label>
      <label>Yazı tipi<select value={selected.font} onChange={event => commit({ texts: settings.texts.map(layer => layer.id === selected.id ? { ...layer, font: event.target.value as TextLayer['font'] } : layer) })}><option value="sans">Sistem</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
      <EditorSlider label="Boyut" value={selected.size} min={12} max={140} onChange={value => update({ size: value })} onStart={start} onEnd={end} />
      <EditorSlider label="Döndürme" value={selected.rotation} min={-45} max={45} displayValue={`${selected.rotation}°`} onChange={value => update({ rotation: value })} onStart={start} onEnd={end} />
      <div className="text-format-row"><label>Renk<input type="color" value={selected.color} onChange={event => update({ color: event.target.value })} onFocus={start} onBlur={end} /></label><div className="text-align" role="group" aria-label="Metin hizası">{([{ value: 'left', icon: AlignLeft, label: 'Sola hizala' }, { value: 'center', icon: AlignCenter, label: 'Ortala' }, { value: 'right', icon: AlignRight, label: 'Sağa hizala' }] as const).map(({ value, icon: Icon, label }) => <button key={value} className={selected.align === value ? 'active' : ''} onClick={() => commit({ texts: settings.texts.map(layer => layer.id === selected.id ? { ...layer, align: value } : layer) })} aria-label={label} aria-pressed={selected.align === value}><Icon size={18} /></button>)}</div></div>
      <p className="tool-note">Metni fotoğraf üzerinde sürükleyerek konumlandır. Değişiklikler geri al/yinele ve dışa aktarmaya uygulanır.</p>
    </section> : settings.texts.length > 0 ? <p className="tool-note">Düzenlemek için listeden bir metin seç.</p> : <p className="tool-note">Bir metin ekledikten sonra içeriğini ve görünümünü buradan değiştirebilirsin.</p>}
    <details className="tool-disclosure frame-control"><summary><Frame size={16} /> Çerçeve <span>{settings.frame.width ? 'Açık' : 'Kapalı'}</span></summary><div className="tool-disclosure__body"><EditorSlider label="Çerçeve kalınlığı" value={settings.frame.width} min={0} max={100} onChange={value => liveSettings(current => ({ ...current, frame: { ...current.frame, width: value } }))} onStart={start} onEnd={end} /><div className="creative-options"><input type="color" value={settings.frame.color} onChange={event => commit({ frame: { ...settings.frame, color: event.target.value } })} aria-label="Çerçeve rengi" /><span>{settings.frame.width ? 'Aktif' : 'Kapalı'}</span></div></div></details>
    <div className="editor-tip"><Grip size={17} /><p><strong>Katmanları doğrudan taşı</strong>Metni fotoğraf üzerinde sürükleyebilir, geri al/yinele ile değişiklikleri geri getirebilirsin.</p></div>
  </div>;
}
