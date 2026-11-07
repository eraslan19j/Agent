import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, CircleGauge, Columns2, Contrast, Crop, Download, Eye, Focus,
  FlipHorizontal2, FlipVertical2, Grid3X3, Image as ImageIcon, LoaderCircle,
  LockKeyhole, Redo2, RotateCcw, RotateCw, Save, Share2, SlidersHorizontal,
  Sparkles, Sun, Thermometer, Undo2, WandSparkles, Waves,
} from 'lucide-react';
import { AUTO_ENHANCE_SETTINGS, getPreset, PRESETS } from '../data/presets';
import { buildCssFilter, createThumbnail, freshSettings, loadImage, outputDimensions, renderPhoto } from '../lib/imageEngine';
import { downloadBlob, shareProject } from '../lib/downloads';
import type { AspectRatio, EditSettings, EditorSession, EditorTab, ExportOptions, PhotoProject } from '../types';
import { Brand } from './Brand';
import { Modal } from './Modal';

interface PhotoEditorProps {
  session: EditorSession;
  isPro: boolean;
  onClose: () => void;
  onSave: (project: PhotoProject) => Promise<PhotoProject>;
  onRequirePro: () => void;
  onToast: (message: string, type?: 'success' | 'info') => void;
}

const ratios: { value: AspectRatio; label: string; pro?: boolean }[] = [
  { value: 'original', label: 'Orijinal' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9', pro: true },
];

const adjustments = [
  { key: 'exposure' as const, label: 'Pozlama', min: -100, max: 100, icon: Sun },
  { key: 'brightness' as const, label: 'Parlaklık', min: 50, max: 150, icon: CircleGauge, neutral: 100 },
  { key: 'contrast' as const, label: 'Kontrast', min: 50, max: 150, icon: Contrast, neutral: 100 },
  { key: 'highlights' as const, label: 'Parlak alanlar', min: -100, max: 100, icon: Sun },
  { key: 'shadows' as const, label: 'Gölgeler', min: -100, max: 100, icon: CircleGauge },
  { key: 'saturation' as const, label: 'Doygunluk', min: 0, max: 200, icon: Sparkles, neutral: 100 },
  { key: 'temperature' as const, label: 'Sıcaklık', min: -100, max: 100, icon: Thermometer },
];

const effects = [
  { key: 'clarity' as const, label: 'Netlik', min: -50, max: 100, icon: Focus },
  { key: 'blur' as const, label: 'Yumuşak odak', min: 0, max: 20, icon: Waves, pro: true },
  { key: 'fade' as const, label: 'Solma', min: 0, max: 100, icon: ImageIcon },
  { key: 'vignette' as const, label: 'Vinyet', min: 0, max: 100, icon: CircleGauge },
  { key: 'grain' as const, label: 'Film greni', min: 0, max: 100, icon: Grid3X3, pro: true },
];

export function PhotoEditor({ session, isPro, onClose, onSave, onRequirePro, onToast }: PhotoEditorProps) {
  const [settings, setSettings] = useState<EditSettings>(() => ({ ...freshSettings(), ...session.initialSettings, ...(session.applyAutoEnhance ? AUTO_ENHANCE_SETTINGS : {}) }));
  const [history, setHistory] = useState<EditSettings[]>([]);
  const [future, setFuture] = useState<EditSettings[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>('looks');
  const [name, setName] = useState(session.name);
  const [projectId, setProjectId] = useState(session.projectId);
  const [compare, setCompare] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [showGrid, setShowGrid] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'jpeg', quality: 0.92, maxDimension: 2048 });
  const [busy, setBusy] = useState<'save' | 'export' | 'share' | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [adjustGroup, setAdjustGroup] = useState<'light' | 'effects'>('light');
  const sliderStart = useRef<EditSettings | null>(null);
  const currentPreset = getPreset(settings.presetId);
  const filter = useMemo(() => buildCssFilter(settings), [settings]);
  const isQuarterTurn = settings.rotation % 180 !== 0;

  useEffect(() => {
    void loadImage(session.source).then((image) => setImageSize({ width: image.naturalWidth, height: image.naturalHeight })).catch(() => onToast('Fotoğraf yüklenemedi.', 'info'));
  }, [session.source, onToast]);

  const commit = (patch: Partial<EditSettings>, base?: EditSettings) => {
    setHistory((items) => [...items.slice(-39), base || settings]);
    setFuture([]);
    setSettings((current) => ({ ...current, ...patch }));
  };

  const updateSlider = (key: keyof EditSettings, value: number) => {
    if (!sliderStart.current) sliderStart.current = settings;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const endSlider = () => {
    if (sliderStart.current) {
      setHistory((items) => [...items.slice(-39), sliderStart.current!]);
      setFuture([]);
      sliderStart.current = null;
    }
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [settings, ...items]);
    setSettings(previous);
    setHistory((items) => items.slice(0, -1));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, settings]);
    setSettings(next);
    setFuture((items) => items.slice(1));
  };

  useEffect(() => {
    const releaseOriginal = () => setShowOriginal(false);
    window.addEventListener('pointerup', releaseOriginal);
    window.addEventListener('pointercancel', releaseOriginal);
    return () => {
      window.removeEventListener('pointerup', releaseOriginal);
      window.removeEventListener('pointercancel', releaseOriginal);
    };
  }, []);

  const selectPreset = (presetId: string) => {
    const preset = getPreset(presetId);
    if (preset.pro && !isPro) { onRequirePro(); return; }
    commit({ presetId, intensity: presetId === 'original' ? 0 : 85 });
    onToast(presetId === 'original' ? 'Temel görünüme dönüldü.' : `${preset.name} fotoğrafına uygulandı.`);
  };

  const save = async () => {
    setBusy('save');
    try {
      const thumbnail = await createThumbnail(session.source, settings);
      const saved = await onSave({
        id: projectId || crypto.randomUUID(),
        name: name.trim() || 'Adsız proje',
        source: session.source,
        thumbnail,
        settings,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setProjectId(saved.id);
      onToast('Proje cihazına kaydedildi.');
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : 'Proje kaydedilemedi.', 'info');
    } finally { setBusy(null); }
  };

  const exportPhoto = async () => {
    if (exportOptions.maxDimension > 2048 && !isPro) { onRequirePro(); return; }
    setBusy('export');
    try {
      const blob = await renderPhoto(session.source, settings, exportOptions);
      const safeName = (name.trim() || 'my-vision').toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '-').replace(/İ/g, 'i');
      await downloadBlob(blob, `${safeName}.${exportOptions.format === 'jpeg' ? 'jpg' : 'png'}`);
      setExportOpen(false);
      onToast('Fotoğrafın hazır. Harika görünüyor!');
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : 'Dışa aktarma tamamlanamadı.', 'info');
    } finally { setBusy(null); }
  };

  const share = async () => {
    setBusy('share');
    try {
      const blob = await renderPhoto(session.source, settings, { format: 'jpeg', quality: 0.9, maxDimension: isPro ? 4096 : 2048 });
      await shareProject(blob);
    } catch (reason) {
      if (reason instanceof Error && reason.name !== 'AbortError') onToast('Paylaşım başlatılamadı.', 'info');
    } finally { setBusy(null); }
  };

  const output = imageSize.width ? outputDimensions(imageSize.width, imageSize.height, settings, exportOptions.maxDimension) : null;
  const aspect = settings.aspectRatio === 'original' ? undefined : settings.aspectRatio.replace(':', '/');
  const transform = `rotate(${settings.rotation}deg) scale(${settings.flipHorizontal ? -1 : 1}, ${settings.flipVertical ? -1 : 1})${isQuarterTurn ? ' scale(.78)' : ''}`;

  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div className="editor-header__left"><button className="icon-button" onClick={onClose} aria-label="Editörden çık"><ArrowLeft size={21} /></button><span className="editor-brand"><Brand compact /></span><span className="editor-divider" /><input className="project-name-input" value={name} onChange={(event) => setName(event.target.value)} aria-label="Proje adı" maxLength={48} /></div>
        <div className="editor-header__center"><button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Geri al"><Undo2 size={19} /></button><button className="icon-button" onClick={redo} disabled={!future.length} aria-label="Yinele"><Redo2 size={19} /></button></div>
        <div className="editor-header__actions"><button className="button button--ghost editor-save" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}<span>Kaydet</span></button><button className="button button--lime button--small" onClick={() => setExportOpen(true)}><Download size={17} /><span>Dışa aktar</span></button></div>
      </header>

      <main className="editor-workspace">
        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <span className="canvas-label"><i /> CANLI ÖNİZLEME</span>
            <div><button className={compare ? 'tool-button active' : 'tool-button'} onClick={() => { setCompare(!compare); setShowOriginal(false); }}><Columns2 size={16} /> <span>Önce / Sonra</span></button><button className={showGrid ? 'tool-button active' : 'tool-button'} onClick={() => setShowGrid(!showGrid)} aria-label="Izgara"><Grid3X3 size={17} /></button><button className="tool-button" onClick={share} disabled={busy !== null} aria-label="Paylaş">{busy === 'share' ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}</button></div>
          </div>
          <div className="canvas-stage">
            <div className="photo-stage" style={{ aspectRatio: aspect }}>
              <div className="photo-stage__image">
                <img src={session.source} alt="Düzenlenen fotoğraf" style={{ filter, transform }} draggable={false} />
              </div>
              {(compare || showOriginal) && <div className="before-image" style={{ clipPath: showOriginal ? 'inset(0)' : `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={session.source} alt="Düzenleme öncesi" style={{ transform }} draggable={false} /></div>}
              {settings.vignette > 0 && !showOriginal && <div className="vignette-overlay" style={{ opacity: Math.min(1, settings.vignette / 100) }} />}
              {settings.grain > 0 && !showOriginal && <div className="grain-overlay" style={{ opacity: Math.min(0.65, settings.grain / 140) }} />}
              {!compare && <button className={`original-hold ${showOriginal ? 'active' : ''}`} onPointerDown={(event) => { event.preventDefault(); setShowOriginal(true); }} onPointerUp={() => setShowOriginal(false)} onPointerLeave={() => setShowOriginal(false)} onContextMenu={(event) => event.preventDefault()} aria-label="Orijinal fotoğrafı görmek için basılı tut"><Eye size={14} /><span>{showOriginal ? 'ORİJİNAL' : 'Basılı tut: Orijinal'}</span></button>}
              {showGrid && <div className="composition-grid"><i /><i /><i /><i /></div>}
              {compare && <><span className="compare-label compare-label--before">ÖNCE</span><span className="compare-label compare-label--after">SONRA</span><div className="compare-line" style={{ left: `${comparePosition}%` }}><span><Columns2 size={16} /></span></div><input className="compare-range" type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} aria-label="Önce ve sonra karşılaştırması" /></>}
              <span className="preset-indicator">{currentPreset.name}{settings.intensity > 0 && currentPreset.id !== 'original' ? ` · ${settings.intensity}%` : ''}</span>
            </div>
          </div>
          <div className="canvas-footer"><span>{imageSize.width ? `${imageSize.width} × ${imageSize.height} px` : 'Fotoğraf hazırlanıyor…'}</span><button onClick={() => { commit(freshSettings()); onToast('Tüm ayarlar sıfırlandı.', 'info'); }}><RotateCcw size={14} /> Sıfırla</button></div>
        </section>

        <aside className="editor-panel">
          <div className="editor-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'looks'} className={activeTab === 'looks' ? 'active' : ''} onClick={() => setActiveTab('looks')}><WandSparkles size={18} /><span>Görünümler</span></button>
            <button role="tab" aria-selected={activeTab === 'adjust'} className={activeTab === 'adjust' ? 'active' : ''} onClick={() => setActiveTab('adjust')}><SlidersHorizontal size={18} /><span>Ayarlar</span></button>
            <button role="tab" aria-selected={activeTab === 'crop'} className={activeTab === 'crop' ? 'active' : ''} onClick={() => setActiveTab('crop')}><Crop size={18} /><span>Kırp</span></button>
          </div>
          <div className="editor-panel__content">
            {activeTab === 'looks' && <div className="looks-panel">
              <div className="panel-heading"><div><span className="eyebrow">İMZA KOLEKSİYONU</span><h3>Görünümünü seç</h3></div><span>{PRESETS.length} stil</span></div>
              <div className="editor-presets">
                {PRESETS.map((preset) => <button key={preset.id} className={settings.presetId === preset.id ? 'editor-preset active' : 'editor-preset'} onClick={(event) => { selectPreset(preset.id); event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}>
                  <div><img src={session.source} alt={`${preset.name} önizlemesi`} style={{ filter: buildCssFilter({ ...freshSettings(), presetId: preset.id, intensity: 85 }) }} />{preset.pro && !isPro && <span className="preset-lock"><LockKeyhole size={12} /></span>}{settings.presetId === preset.id && <span className="preset-check"><Check size={13} /></span>}</div><span>{preset.name}</span>
                </button>)}
              </div>
              {settings.presetId !== 'original' && <div className="intensity-control"><EditorSlider label="Görünüm yoğunluğu" value={settings.intensity} min={0} max={100} onChange={(value) => updateSlider('intensity', value)} onStart={() => { sliderStart.current = settings; }} onEnd={endSlider} onReset={() => commit({ intensity: 100 })} /></div>}
              <div className="editor-tip"><Sparkles size={17} /><p><strong>Küçük bir editör sırrı</strong>Görünümü %70–85 yoğunlukta kullanarak daha doğal bir sonuç elde edebilirsin.</p></div>
            </div>}
            {activeTab === 'adjust' && <div className="adjust-panel">
              <div className="panel-heading"><div><span className="eyebrow">HASSAS KONTROL</span><h3>Her ton, senin kararın.</h3></div></div>
              <div className="segmented-control adjust-segments"><button className={adjustGroup === 'light' ? 'active' : ''} onClick={() => setAdjustGroup('light')}>Işık & renk</button><button className={adjustGroup === 'effects' ? 'active' : ''} onClick={() => setAdjustGroup('effects')}>Doku & efekt</button></div>
              <div className="sliders-list">
                {(adjustGroup === 'light' ? adjustments : effects).map((item) => <div key={item.key} className="adjustment-item">{'pro' in item && item.pro && !isPro && <button className="pro-control-lock" onClick={onRequirePro}><LockKeyhole size={12} /> PRO</button>}<EditorSlider label={item.label} icon={item.icon} value={settings[item.key]} min={item.min} max={item.max} neutral={'neutral' in item ? item.neutral : 0} disabled={'pro' in item && item.pro && !isPro} onChange={(value) => updateSlider(item.key, value)} onStart={() => { sliderStart.current = settings; }} onEnd={endSlider} onReset={() => commit({ [item.key]: 'neutral' in item ? item.neutral : 0 })} /></div>)}
              </div>
            </div>}
            {activeTab === 'crop' && <div className="crop-panel">
              <div className="panel-heading"><div><span className="eyebrow">KADRAJ & AÇI</span><h3>Hikâyeye odaklan.</h3></div></div>
              <h4 className="control-label">En boy oranı</h4><div className="ratio-grid">{ratios.map((ratio) => <button key={ratio.value} className={settings.aspectRatio === ratio.value ? 'active' : ''} onClick={() => { if (ratio.pro && !isPro) { onRequirePro(); return; } commit({ aspectRatio: ratio.value }); }}><span className={`ratio-icon ratio-icon--${ratio.value.replace(':', '-')}`} /><strong>{ratio.label}</strong>{ratio.pro && !isPro && <LockKeyhole size={11} />}</button>)}</div>
              <h4 className="control-label">Döndür</h4><div className="transform-row"><button onClick={() => commit({ rotation: settings.rotation - 90 })}><RotateCcw size={21} /><span>90° sola</span></button><button onClick={() => commit({ rotation: settings.rotation + 90 })}><RotateCw size={21} /><span>90° sağa</span></button></div>
              <h4 className="control-label">Aynala</h4><div className="transform-row"><button className={settings.flipHorizontal ? 'active' : ''} onClick={() => commit({ flipHorizontal: !settings.flipHorizontal })}><FlipHorizontal2 size={21} /><span>Yatay</span></button><button className={settings.flipVertical ? 'active' : ''} onClick={() => commit({ flipVertical: !settings.flipVertical })}><FlipVertical2 size={21} /><span>Dikey</span></button></div>
              <div className="editor-tip"><Crop size={17} /><p><strong>Sosyal medyaya hazır</strong>4:5 Instagram gönderileri, 1:1 profil ve ürün kareleri için idealdir.</p></div>
            </div>}
          </div>
        </aside>
      </main>

      {exportOpen && <Modal title="Fotoğrafını dışa aktar" onClose={() => busy === null && setExportOpen(false)} className="export-modal">
        <div className="export-preview"><img src={session.source} alt="Dışa aktarılacak fotoğraf" style={{ filter }} /><span><Check size={15} /> Düzenlemeler uygulandı</span></div>
        <div className="export-field"><label>Dosya formatı</label><div className="format-options"><button className={exportOptions.format === 'jpeg' ? 'active' : ''} onClick={() => setExportOptions({ ...exportOptions, format: 'jpeg' })}><strong>JPG</strong><small>Paylaşım için ideal</small></button><button className={exportOptions.format === 'png' ? 'active' : ''} onClick={() => setExportOptions({ ...exportOptions, format: 'png' })}><strong>PNG</strong><small>Kayıpsız kalite</small></button></div></div>
        <div className="export-field"><label>Çıktı boyutu</label><div className="size-options">{[1080, 2048, 4096].map((size) => <button key={size} className={exportOptions.maxDimension === size ? 'active' : ''} onClick={() => { if (size > 2048 && !isPro) { onRequirePro(); return; } setExportOptions({ ...exportOptions, maxDimension: size }); }}><strong>{size === 4096 ? '4K' : `${size} px`}</strong><small>{size === 1080 ? 'Sosyal medya' : size === 2048 ? 'Yüksek kalite' : 'Maksimum'}</small>{size > 2048 && !isPro && <LockKeyhole size={12} />}</button>)}</div></div>
        {exportOptions.format === 'jpeg' && <EditorSlider label="Görüntü kalitesi" value={Math.round(exportOptions.quality * 100)} min={60} max={100} displayValue={`${Math.round(exportOptions.quality * 100)}%`} onChange={(value) => setExportOptions({ ...exportOptions, quality: value / 100 })} />}
        <div className="export-summary"><span>Tahmini çıktı</span><strong>{output ? `${output.width} × ${output.height} px` : 'Hesaplanıyor…'}</strong></div>
        <button className="button button--lime export-confirm" onClick={() => void exportPhoto()} disabled={busy !== null}>{busy === 'export' ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}{busy === 'export' ? 'Fotoğraf işleniyor…' : 'Fotoğrafı indir'}</button>
        <p className="export-note">Orijinal fotoğrafın değiştirilmez. Yeni bir kopya oluşturulur.</p>
      </Modal>}
    </div>
  );
}

interface EditorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  icon?: typeof Sun;
  neutral?: number;
  displayValue?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onReset?: () => void;
}

function EditorSlider({ label, value, min, max, icon: Icon, neutral = 0, displayValue, disabled, onChange, onStart, onEnd, onReset }: EditorSliderProps) {
  return (
    <div className={`editor-slider ${disabled ? 'disabled' : ''}`}>
      <div className="editor-slider__label"><span>{Icon && <Icon size={15} />}{label}</span><button onDoubleClick={onReset} onClick={onReset} aria-label={`${label} sıfırla`}>{displayValue || `${value > 0 && neutral === 0 ? '+' : ''}${value}`}</button></div>
      <input type="range" min={min} max={max} value={value} disabled={disabled} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onPointerDown={onStart} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onEnd} onPointerCancel={onEnd} onKeyUp={onEnd} aria-label={label} />
    </div>
  );
}
