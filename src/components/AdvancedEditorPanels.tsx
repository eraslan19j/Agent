import { useState } from 'react';
import { Brush, Circle, Eraser, Eye, Frame, Grip, Layers3, Palette, Plus, Scan, Sparkles, Sticker, Trash2, Type, WandSparkles } from 'lucide-react';
import type { EditSettings, HslColor, SelectiveMask } from '../types';
import { EditorSlider } from './EditorSlider';

export type InteractionTool = 'none' | 'radial' | 'linear' | 'heal' | 'object' | 'redeye' | 'brush';
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
    <div className="panel-heading"><div><span className="eyebrow">RENK LABORATUVARI</span><h3>Tonları ayrı ayrı yönet.</h3></div></div>
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
      <p className="tool-note">Maskenin merkezini fotoğraftaki sarı işaretten sürükleyebilirsin.</p>
    </div></details>
    <details className="tool-disclosure"><summary><Sparkles size={16} /> Detay <span>Gürültü ve netleştirme</span></summary><div className="tool-disclosure__body">
      <EditorSlider label="Gürültü azaltma" value={settings.noiseReduction} min={0} max={100} onChange={value => live({ noiseReduction: value })} onStart={start} onEnd={end} onReset={() => commit({ noiseReduction: 0 })} />
      <EditorSlider label="Keskinleştirme" value={settings.sharpen} min={0} max={100} onChange={value => live({ sharpen: value })} onStart={start} onEnd={end} onReset={() => commit({ sharpen: 0 })} />
    </div></details>
    <details className="tool-disclosure"><summary><Scan size={16} /> Arka plan kaldırma <span>Cihaz içi</span></summary><div className="tool-disclosure__body">
      <EditorSlider label="Zemin renk toleransı" value={settings.backgroundRemoval} min={0} max={100} onChange={value => live({ backgroundRemoval: value })} onStart={start} onEnd={end} onReset={() => commit({ backgroundRemoval: 0 })} />
      <p className="tool-note">Kenarlardaki zemin rengini ayıran ücretsiz, cihaz içi bir yöntemdir. Düz ve kontrast zeminlerde en iyi sonucu verir; saç veya karmaşık sahnelerde AI kalitesi iddia etmez. Şeffaf sonucu PNG olarak dışa aktar.</p>
    </div></details>
  </div>;
}

interface RetouchProps extends BaseProps { tool: InteractionTool; setTool: (tool: InteractionTool) => void; radius: number; setRadius: (value: number) => void; }
export function RetouchEditorPanel({ tool, setTool, radius, setRadius, settings, commit }: RetouchProps) {
  return <div className="retouch-panel"><div className="panel-heading"><div><span className="eyebrow">YEREL RÖTUŞ</span><h3>Dokun, düzelt, doğal bırak.</h3></div></div>
    <div className="retouch-tools"><button className={tool === 'heal' ? 'active' : ''} onClick={() => setTool(tool === 'heal' ? 'none' : 'heal')}><Eraser size={23} /><strong>Healing</strong><span>Küçük leke</span></button><button className={tool === 'object' ? 'active' : ''} onClick={() => setTool(tool === 'object' ? 'none' : 'object')}><Scan size={23} /><strong>Nesne</strong><span>Yerel doku</span></button><button className={tool === 'redeye' ? 'active' : ''} onClick={() => setTool(tool === 'redeye' ? 'none' : 'redeye')}><Eye size={23} /><strong>Kırmızı göz</strong><span>Renk düzeltme</span></button></div>
    <EditorSlider label="Fırça yarıçapı" value={radius} min={8} max={90} onChange={setRadius} displayValue={`${radius} px`} />
    <p className="tool-note">Aracı seçip fotoğraftaki bölgeye dokun. Healing ve nesne aracı yakın dokuyu harmanlar; bulut/AI içerik üretimi yapılmaz. Büyük veya karmaşık nesnelerde birkaç küçük dokunuş daha iyi sonuç verir.</p>
    {settings.repairs.length > 0 && <button className="tool-danger" onClick={() => commit({ repairs: [] })}><Trash2 size={14} /> Tüm rötuş işaretlerini kaldır</button>}
  </div>;
}

interface CreativeProps extends BaseProps { tool: InteractionTool; setTool: (tool: InteractionTool) => void; brushSize: number; setBrushSize: (value: number) => void; brushColor: string; setBrushColor: (value: string) => void; }
export function CreativeEditorPanel({ settings, commit, tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor }: CreativeProps) {
  const [text, setText] = useState('');
  const [font, setFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const addText = () => {
    if (!text.trim()) return;
    commit({ texts: [...settings.texts, { id: crypto.randomUUID(), text: text.trim().slice(0, 80), x: .5, y: .5, size: 46, color: textColor, font, align: 'center', rotation: 0 }] });
    setText('');
  };
  return <div className="creative-panel"><div className="panel-heading"><div><span className="eyebrow">TASARIM KATMANLARI</span><h3>Fotoğrafın üzerinde anlat.</h3></div></div>
    <details className="tool-disclosure" open><summary><Type size={16} /> Metin <span>{settings.texts.length} katman</span></summary><div className="tool-disclosure__body">
      <div className="text-composer"><input value={text} onChange={event => setText(event.target.value)} maxLength={80} placeholder="Metnini yaz" aria-label="Metin katmanı" /><button onClick={addText} disabled={!text.trim()} aria-label="Metin ekle"><Plus size={18} /></button></div>
      <div className="creative-options"><select value={font} onChange={event => setFont(event.target.value as typeof font)} aria-label="Yazı tipi"><option value="sans">Manrope</option><option value="serif">Instrument Serif</option><option value="mono">Monospace</option></select><input type="color" value={textColor} onChange={event => setTextColor(event.target.value)} aria-label="Metin rengi" /></div>
      {settings.texts.map(layer => <div className="layer-row" key={layer.id}><Type size={14} /><span>{layer.text}</span><button onClick={() => commit({ texts: settings.texts.filter(item => item.id !== layer.id) })} aria-label="Metni sil"><Trash2 size={14} /></button></div>)}
      {settings.texts.length > 0 && <p className="tool-note">Metni fotoğraf üzerinde sürükleyerek konumlandır.</p>}
    </div></details>
    <details className="tool-disclosure"><summary><Sticker size={16} /> Çıkartma <span>{settings.stickers.length} katman</span></summary><div className="tool-disclosure__body"><div className="sticker-options">{['★', '♥', '✦', '☀', '☾', '⚡', '✿', '©'].map(value => <button key={value} onClick={() => commit({ stickers: [...settings.stickers, { id: crypto.randomUUID(), value, x: .5, y: .5, size: 55, rotation: 0 }] })}>{value}</button>)}</div>{settings.stickers.length > 0 && <button className="tool-danger" onClick={() => commit({ stickers: [] })}><Trash2 size={14} /> Çıkartmaları temizle</button>}</div></details>
    <details className="tool-disclosure"><summary><Brush size={16} /> Fırça <span>Gerçek vektör konturlar</span></summary><div className="tool-disclosure__body">
      <button className={`brush-toggle ${tool === 'brush' ? 'active' : ''}`} onClick={() => setTool(tool === 'brush' ? 'none' : 'brush')}><Brush size={17} />{tool === 'brush' ? 'Fırçayı bitir' : 'Fırçayla çiz'}</button>
      <div className="creative-options"><input type="color" value={brushColor} onChange={event => setBrushColor(event.target.value)} aria-label="Fırça rengi" /><span>{settings.brushStrokes.length} kontur</span></div>
      <EditorSlider label="Fırça kalınlığı" value={brushSize} min={3} max={80} onChange={setBrushSize} />
      <p className="tool-note">Fırça açıkken fotoğraf üzerinde parmağını veya fareyi sürükle.</p>
    </div></details>
    <details className="tool-disclosure"><summary><Frame size={16} /> Çerçeve <span>Kenar içi</span></summary><div className="tool-disclosure__body"><EditorSlider label="Çerçeve kalınlığı" value={settings.frame.width} min={0} max={100} onChange={value => commit({ frame: { ...settings.frame, width: value } })} /><div className="creative-options"><input type="color" value={settings.frame.color} onChange={event => commit({ frame: { ...settings.frame, color: event.target.value } })} aria-label="Çerçeve rengi" /><span>{settings.frame.width ? 'Aktif' : 'Kapalı'}</span></div></div></details>
    <div className="editor-tip"><Grip size={17} /><p><strong>Katmanları doğrudan taşı</strong>Metin ve çıkartmaları fotoğraf üzerinde sürükleyebilir, geri al/yinele ile tüm değişiklikleri geri getirebilirsin.</p></div>
  </div>;
}
