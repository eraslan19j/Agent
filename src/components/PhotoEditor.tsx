import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, CircleGauge, Columns2, Contrast, Crop, Download, Eye, Focus,
  FlipHorizontal2, FlipVertical2, Grid3X3, Image as ImageIcon, LoaderCircle,
  Redo2, RotateCcw, RotateCw, Save, Share2, SlidersHorizontal,
  Sparkles, Sun, Thermometer, Undo2, WandSparkles, Waves, Palette, Type,
  ZoomIn, ZoomOut, Copy, Clipboard, Plus, Trash2, BarChart3,
} from 'lucide-react';
import { AUTO_ENHANCE_SETTINGS, getPreset, PRESETS } from '../data/presets';
import { buildCssFilter, canvasBackingSize, computeSettingsCrop, createThumbnail, freshSettings, hasAdvancedRendering, loadImage, outputDimensions, previewDimensions, renderPhoto } from '../lib/imageEngine';
import { copySettings, deleteRecipe, loadRecipes, pasteSettings, saveRecipe, type CustomRecipe } from '../lib/recipes';
import { downloadBlob, shareProject } from '../lib/downloads';
import { textAvailableRatio } from '../lib/textLayout';
import type { AspectRatio, EditSettings, EditorSession, EditorTab, ExportOptions, PhotoProject } from '../types';
import { Brand } from './Brand';
import { MyVisionLogo } from './MyVisionLogo';
import { Modal } from './Modal';
import { EditorSlider } from './EditorSlider';
import { AdvancedEditorPanel, TextEditorPanel, type InteractionTool } from './AdvancedEditorPanels';
import { FreeCropEditor } from './FreeCropEditor';
import { PhotoHistogram } from './PhotoHistogram';

interface PhotoEditorProps {
  session: EditorSession;
  onClose: () => void;
  onSave: (project: PhotoProject) => Promise<PhotoProject>;
  onToast: (message: string, type?: 'success' | 'info') => void;
}

const ratios: { value: AspectRatio; label: string }[] = [
  { value: 'original', label: 'Orijinal' },
  { value: 'free', label: 'Serbest' },
  { value: '1:1', label: 'Post 1:1' },
  { value: '4:5', label: 'Post 4:5' },
  { value: '9:16', label: 'Story 9:16' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: 'Kapak 2:3' },
  { value: '16:9', label: '16:9' },
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
  { key: 'blur' as const, label: 'Yumuşak odak', min: 0, max: 20, icon: Waves },
  { key: 'fade' as const, label: 'Solma', min: 0, max: 100, icon: ImageIcon },
  { key: 'vignette' as const, label: 'Vinyet', min: 0, max: 100, icon: CircleGauge },
  { key: 'grain' as const, label: 'Film greni', min: 0, max: 100, icon: Grid3X3 },
];

export function PhotoEditor({ session, onClose, onSave, onToast }: PhotoEditorProps) {
  const [settings, setSettings] = useState<EditSettings>(() => freshSettings({ ...session.initialSettings, ...(session.applyAutoEnhance ? AUTO_ENHANCE_SETTINGS : {}) }));
  const [history, setHistory] = useState<EditSettings[]>([]);
  const [future, setFuture] = useState<EditSettings[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>('looks');
  const [name, setName] = useState(session.name);
  const [projectId, setProjectId] = useState(session.projectId);
  const [compare, setCompare] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [showGrid, setShowGrid] = useState(false);
  const [showHistogram, setShowHistogram] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'jpeg', quality: 0.92, maxDimension: 2048 });
  const [busy, setBusy] = useState<'save' | 'export' | 'share' | null>(null);
  const [imageSize, setImageSize] = useState({ width: session.width ?? 0, height: session.height ?? 0 });
  const [stageBounds, setStageBounds] = useState({ width: 0, height: 0 });
  const [adjustGroup, setAdjustGroup] = useState<'light' | 'effects'>('light');
  const [interactionTool] = useState<InteractionTool>('none');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [freeCropOpen, setFreeCropOpen] = useState(false);
  const [advancedPreview, setAdvancedPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [recipes, setRecipes] = useState<CustomRecipe[]>(() => loadRecipes());
  const [recipeName, setRecipeName] = useState('');
  const sliderStart = useRef<EditSettings | null>(null);
  const layerGesture = useRef<{ kind: 'text' | 'mask'; id: string; rect: DOMRect } | null>(null);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const currentPreset = getPreset(settings.presetId);
  const previewSource = session.previewSource ?? session.source;
  const filter = useMemo(() => buildCssFilter(settings), [settings]);
  const isQuarterTurn = settings.rotation % 180 !== 0;
  const advanced = hasAdvancedRendering(settings);

  useEffect(() => {
    if (session.width && session.height) return;
    let active = true;
    void loadImage(previewSource).then((image) => {
      if (active) setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    }).catch(() => { if (active) onToast('Fotoğraf yüklenemedi.', 'info'); });
    return () => { active = false; };
  }, [previewSource, session.width, session.height, onToast]);

  useEffect(() => {
    const container = stageContainerRef.current;
    if (!container) return;
    const measure = () => {
      const style = getComputedStyle(container);
      const width = Math.max(0, container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const height = Math.max(0, container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      setStageBounds((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, []);

  useEffect(() => {
    if (!advanced || !imageSize.width || !stageBounds.width) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setPreviewBusy(true);
      const cssSize = previewDimensions(stageBounds.width, stageBounds.height, imageSize.width, imageSize.height, settings);
      const backing = canvasBackingSize(cssSize.width, cssSize.height, window.devicePixelRatio || 1);
      const maxDimension = Math.max(1, backing.width, backing.height);
      void renderPhoto(previewSource, settings, { format: 'jpeg', quality: .82, maxDimension }).then(async blob => {
        if (!active) return;
        setAdvancedPreview(URL.createObjectURL(blob));
      }).catch(() => {
        if (active) onToast('Gelişmiş önizleme oluşturulamadı; dışa aktarmada daha küçük boyut deneyin.', 'info');
      }).finally(() => { if (active) setPreviewBusy(false); });
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [advanced, settings, previewSource, imageSize.width, imageSize.height, stageBounds.width, stageBounds.height, onToast]);

  useEffect(() => () => { if (advancedPreview) URL.revokeObjectURL(advancedPreview); }, [advancedPreview]);

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

  const startHistory = () => { if (!sliderStart.current) sliderStart.current = settings; };
  const live = (patch: Partial<EditSettings>) => setSettings(current => ({ ...current, ...patch }));
  const liveSettings = (updater: (current: EditSettings) => EditSettings) => setSettings(updater);

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
    commit({ presetId, intensity: presetId === 'original' ? 0 : 85 });
    onToast(presetId === 'original' ? 'Temel görünüme dönüldü.' : `${preset.name} fotoğrafına uygulandı.`);
  };

  const save = async () => {
    setBusy('save');
    try {
      const thumbnail = await createThumbnail(previewSource, settings);
      const saved = await onSave({
        id: projectId || crypto.randomUUID(),
        name: name.trim() || 'Adsız proje',
        source: session.source,
        previewSource,
        width: imageSize.width,
        height: imageSize.height,
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
      const blob = await renderPhoto(session.source, settings, { format: 'jpeg', quality: 0.9, maxDimension: 4096 });
      await shareProject(blob);
    } catch (reason) {
      if (reason instanceof Error && reason.name !== 'AbortError') onToast('Paylaşım başlatılamadı.', 'info');
    } finally { setBusy(null); }
  };

  const normalizedPoint = (event: React.PointerEvent, rect: DOMRect) => ({
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  });

  const startLayerDrag = (event: React.PointerEvent, kind: 'text' | 'mask', id: string) => {
    event.preventDefault(); event.stopPropagation();
    const stage = event.currentTarget.closest('.photo-stage');
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    layerGesture.current = { kind, id, rect: stage.getBoundingClientRect() };
    if (kind === 'text') setSelectedTextId(id);
    startHistory();
  };
  const moveLayer = (event: React.PointerEvent) => {
    const gesture = layerGesture.current;
    if (!gesture) return;
    event.stopPropagation();
    const point = normalizedPoint(event, gesture.rect);
    if (gesture.kind === 'text') liveSettings(current => ({ ...current, texts: current.texts.map(item => item.id === gesture.id ? { ...item, ...point } : item) }));
    else liveSettings(current => ({ ...current, masks: current.masks.map(item => item.id === gesture.id ? { ...item, ...point } : item) }));
  };
  const endLayerDrag = () => { if (layerGesture.current) { layerGesture.current = null; endSlider(); } };

  const pinchDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch' || interactionTool !== 'none') return;
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPoints.current.size === 2) {
      const [a, b] = [...touchPoints.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const pinchMove = (event: React.PointerEvent) => {
    if (!touchPoints.current.has(event.pointerId)) return;
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPoints.current.size === 2 && pinchStart.current) {
      const [a, b] = [...touchPoints.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.max(1, Math.min(4, pinchStart.current.zoom * distance / Math.max(1, pinchStart.current.distance))));
    }
  };
  const pinchUp = (event: React.PointerEvent) => { touchPoints.current.delete(event.pointerId); if (touchPoints.current.size < 2) pinchStart.current = null; };

  const output = imageSize.width ? outputDimensions(imageSize.width, imageSize.height, settings, exportOptions.maxDimension) : null;
  const preview = previewDimensions(stageBounds.width, stageBounds.height, imageSize.width, imageSize.height, settings);
  const previewImageWidth = isQuarterTurn ? preview.height : preview.width;
  const crop = imageSize.width ? computeSettingsCrop(imageSize.width, imageSize.height, settings) : null;
  const previewScale = crop ? previewImageWidth / crop.width : 1;
  const cropOffsetX = crop ? (imageSize.width / 2 - crop.x - crop.width / 2) * previewScale : 0;
  const cropOffsetY = crop ? (imageSize.height / 2 - crop.y - crop.height / 2) * previewScale : 0;
  const transform = `rotate(${settings.rotation}deg) scale(${settings.flipHorizontal ? -1 : 1}, ${settings.flipVertical ? -1 : 1}) translate(${cropOffsetX}px, ${cropOffsetY}px)`;
  const previewImageStyle: React.CSSProperties = {
    width: crop ? imageSize.width * previewScale : '100%',
    height: crop ? imageSize.height * previewScale : '100%',
    maxWidth: 'none',
    objectFit: 'contain',
    transform,
  };
  const advancedImageStyle: React.CSSProperties = { left: 0, top: 0, width: '100%', height: '100%', objectFit: 'contain', transform: 'none' };

  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div className="editor-header__left"><button className="icon-button" onClick={onClose} aria-label="Editörden çık"><ArrowLeft size={21} /></button><span className="editor-brand"><Brand compact /></span><span className="editor-divider" /><input className="project-name-input" value={name} onChange={(event) => setName(event.target.value)} aria-label="Proje adı" maxLength={48} /></div>
        <div className="editor-header__center"><button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Geri al"><Undo2 size={19} /></button><button className="icon-button" onClick={redo} disabled={!future.length} aria-label="Yinele"><Redo2 size={19} /></button></div>
        <div className="editor-header__actions"><button className="button button--ghost editor-save" aria-label="Kaydet" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}<span>Kaydet</span></button><button className="button button--lime button--small" aria-label="Dışa aktar" onClick={() => setExportOpen(true)}><Download size={17} /><span>Dışa aktar</span></button></div>
      </header>

      <main className="editor-workspace">
        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <span className="canvas-label"><i /> CANLI ÖNİZLEME</span>
            <div><button className={compare ? 'tool-button active' : 'tool-button'} onClick={() => { setCompare(!compare); setShowOriginal(false); }}><Columns2 size={16} /> <span>Önce / Sonra</span></button><button className={showHistogram ? 'tool-button active' : 'tool-button'} onClick={() => setShowHistogram(!showHistogram)} aria-label="Histogram"><BarChart3 size={17} /></button><button className={showGrid ? 'tool-button active' : 'tool-button'} onClick={() => setShowGrid(!showGrid)} aria-label="Izgara"><Grid3X3 size={17} /></button><button className="tool-button" onClick={share} disabled={busy !== null} aria-label="Paylaş">{busy === 'share' ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}</button></div>
          </div>
          <div className="canvas-stage" ref={stageContainerRef} onPointerDown={pinchDown} onPointerMove={pinchMove} onPointerUp={pinchUp} onPointerCancel={pinchUp}>
            <div className={`photo-stage ${interactionTool !== 'none' ? 'photo-stage--interactive' : ''}`} style={{ width: preview.width || '100%', height: preview.height || '100%', aspectRatio: preview.aspectRatio, transform: `scale(${zoom})` }}>
              <div className="photo-stage__image">
                <img src={advanced && advancedPreview ? advancedPreview : previewSource} alt="Düzenlenen fotoğraf" style={advanced && advancedPreview ? advancedImageStyle : { ...previewImageStyle, filter }} draggable={false} />
              </div>
              {(compare || showOriginal) && <div className="before-image" style={{ clipPath: showOriginal ? 'inset(0)' : `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={previewSource} alt="Düzenleme öncesi" style={previewImageStyle} draggable={false} /></div>}
              {!advanced && settings.vignette > 0 && !showOriginal && <div className="vignette-overlay" style={{ opacity: Math.min(1, settings.vignette / 100) }} />}
              {!advanced && settings.grain > 0 && !showOriginal && <div className="grain-overlay" style={{ opacity: Math.min(0.65, settings.grain / 140) }} />}
              {settings.masks.map(mask => <div key={mask.id} className={`mask-marker mask-marker--${mask.type}`} style={{ left: `${mask.x * 100}%`, top: `${mask.y * 100}%`, width: `${mask.radius * 200}%`, aspectRatio: mask.type === 'radial' ? 1 : '1 / 5', transform: `translate(-50%,-50%) rotate(${mask.angle}deg)` }} onPointerDown={event => startLayerDrag(event, 'mask', mask.id)} onPointerMove={moveLayer} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />)}
              {settings.texts.map(layer => <div key={layer.id} className="design-layer design-text" style={{ left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, maxWidth: `${textAvailableRatio(layer) * 100}%`, color: layer.color, fontFamily: layer.font === 'serif' ? 'ui-serif, Georgia, serif' : layer.font === 'mono' ? 'ui-monospace, monospace' : 'inherit', fontSize: `${Math.max(10, layer.size / 550 * Math.min(preview.width, preview.height))}px`, transform: `translate(${layer.align === 'left' ? '0' : layer.align === 'right' ? '-100%' : '-50%'},-50%) rotate(${layer.rotation}deg)`, textAlign: layer.align }} onPointerDown={event => startLayerDrag(event, 'text', layer.id)} onPointerMove={moveLayer} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag}><span style={{ opacity: previewBusy || !advancedPreview ? 1 : 0 }}>{layer.text}</span></div>) }
              {!compare && <button className={`original-hold ${showOriginal ? 'active' : ''}`} onPointerDown={(event) => { event.preventDefault(); setShowOriginal(true); }} onPointerUp={() => setShowOriginal(false)} onPointerLeave={() => setShowOriginal(false)} onContextMenu={(event) => event.preventDefault()} aria-label="Orijinal fotoğrafı görmek için basılı tut"><Eye size={14} /><span>{showOriginal ? 'ORİJİNAL' : 'Basılı tut: Orijinal'}</span></button>}
              {showGrid && <div className="composition-grid"><i /><i /><i /><i /></div>}
              {compare && <><span className="compare-label compare-label--before">ÖNCE</span><span className="compare-label compare-label--after">SONRA</span><div className="compare-line" style={{ left: `${comparePosition}%` }}><span><Columns2 size={16} /></span></div><input className="compare-range" type="range" min="0" max="100" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} aria-label="Önce ve sonra karşılaştırması" /></>}
              <span className="preset-indicator">{currentPreset.name}{settings.intensity > 0 && currentPreset.id !== 'original' ? ` · ${settings.intensity}%` : ''}</span>
              {previewBusy && <span className="advanced-preview-status"><LoaderCircle className="spin" size={12} /> Önizleme</span>}
              {showHistogram && <PhotoHistogram source={previewSource} settings={settings} />}
            </div>
          </div>
          <div className="canvas-footer"><span>{imageSize.width ? `${imageSize.width} × ${imageSize.height} px` : 'Fotoğraf hazırlanıyor…'}</span><div className="zoom-controls"><button onClick={() => setZoom(value => Math.max(1, value - .25))} disabled={zoom <= 1} aria-label="Uzaklaştır"><ZoomOut size={15} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(4, value + .25))} disabled={zoom >= 4} aria-label="Yakınlaştır"><ZoomIn size={15} /></button></div><button onClick={() => { commit(freshSettings()); setAdvancedPreview(null); onToast('Tüm ayarlar sıfırlandı.', 'info'); }}><RotateCcw size={14} /> Sıfırla</button></div>
        </section>

        <aside className="editor-panel">
          <div className="editor-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'looks'} className={activeTab === 'looks' ? 'active' : ''} onClick={() => setActiveTab('looks')}><WandSparkles size={18} /><span>Görünümler</span></button>
            <button role="tab" aria-selected={activeTab === 'adjust'} className={activeTab === 'adjust' ? 'active' : ''} onClick={() => setActiveTab('adjust')}><SlidersHorizontal size={18} /><span>Ayarlar</span></button>
            <button role="tab" aria-selected={activeTab === 'crop'} className={activeTab === 'crop' ? 'active' : ''} onClick={() => setActiveTab('crop')}><Crop size={18} /><span>Kırp</span></button>
            <button role="tab" aria-selected={activeTab === 'color'} className={activeTab === 'color' ? 'active' : ''} onClick={() => setActiveTab('color')}><Palette size={18} /><span>Renk</span></button>
            <button role="tab" aria-selected={activeTab === 'text'} className={activeTab === 'text' ? 'active' : ''} onClick={() => setActiveTab('text')}><Type size={18} /><span>Metin</span></button>
          </div>
          <div className="editor-panel__content">
            {activeTab === 'looks' && <div className="looks-panel">
              <div className="panel-heading"><div><span className="eyebrow">İMZA KOLEKSİYONU</span><h3>Görünümünü seç</h3></div><span>{PRESETS.length} stil</span></div>
              <div className="editor-presets">
                {PRESETS.map((preset) => <button key={preset.id} className={settings.presetId === preset.id ? 'editor-preset active' : 'editor-preset'} onClick={(event) => { selectPreset(preset.id); event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}>
                  <div><img src={previewSource} alt={`${preset.name} önizlemesi`} style={{ filter: buildCssFilter({ ...freshSettings(), presetId: preset.id, intensity: 85 }) }} />{settings.presetId === preset.id && <span className="preset-check"><Check size={13} /></span>}</div><span>{preset.name}</span>
                </button>)}
              </div>
              {settings.presetId !== 'original' && <div className="intensity-control"><EditorSlider label="Görünüm yoğunluğu" value={settings.intensity} min={0} max={100} onChange={(value) => updateSlider('intensity', value)} onStart={() => { sliderStart.current = settings; }} onEnd={endSlider} onReset={() => commit({ intensity: 100 })} /></div>}
              <div className="recipe-tools"><div className="recipe-actions"><button onClick={() => { copySettings(settings); onToast('Düzenleme ayarları kopyalandı.'); }}><Copy size={14} /> Ayarları kopyala</button><button onClick={() => { const pasted = pasteSettings(); if (pasted) { commit(pasted); onToast('Kopyalanan ayarlar uygulandı.'); } else onToast('Kopyalanmış ayar bulunamadı.', 'info'); }}><Clipboard size={14} /> Yapıştır</button></div><div className="recipe-save"><input value={recipeName} onChange={event => setRecipeName(event.target.value)} maxLength={32} placeholder="Özel tarif adı" aria-label="Özel tarif adı" /><button onClick={() => { if (!recipeName.trim()) return; try { setRecipes(saveRecipe(recipeName, settings)); setRecipeName(''); onToast('Özel tarif cihazına kaydedildi.'); } catch { onToast('Tarif kaydedilemedi; depolama alanını kontrol et.', 'info'); } }} disabled={!recipeName.trim()} aria-label="Tarifi kaydet"><Plus size={16} /></button></div>
                {recipes.map(recipe => <div className="recipe-row" key={recipe.id}><button onClick={() => commit(recipe.settings)}><WandSparkles size={13} /><span>{recipe.name}</span></button><button onClick={() => setRecipes(deleteRecipe(recipe.id))} aria-label={`${recipe.name} tarifini sil`}><Trash2 size={13} /></button></div>)}
              </div>
              <div className="editor-tip"><Sparkles size={17} /><p><strong>Küçük bir editör sırrı</strong>Görünümü %70–85 yoğunlukta kullanarak daha doğal bir sonuç elde edebilirsin.</p></div>
            </div>}
            {activeTab === 'adjust' && <div className="adjust-panel">
              <div className="panel-heading"><div><span className="eyebrow">HASSAS KONTROL</span><h3>Her ton, senin kararın.</h3></div></div>
              <div className="segmented-control adjust-segments"><button className={adjustGroup === 'light' ? 'active' : ''} onClick={() => setAdjustGroup('light')}>Işık & renk</button><button className={adjustGroup === 'effects' ? 'active' : ''} onClick={() => setAdjustGroup('effects')}>Doku & efekt</button></div>
              <div className="sliders-list">
                {(adjustGroup === 'light' ? adjustments : effects).map((item) => <div key={item.key} className="adjustment-item"><EditorSlider label={item.label} icon={item.icon} value={settings[item.key]} min={item.min} max={item.max} neutral={'neutral' in item ? item.neutral : 0} onChange={(value) => updateSlider(item.key, value)} onStart={() => { sliderStart.current = settings; }} onEnd={endSlider} onReset={() => commit({ [item.key]: 'neutral' in item ? item.neutral : 0 })} /></div>)}
              </div>
            </div>}
            {activeTab === 'crop' && <div className="crop-panel">
              <div className="panel-heading"><div><span className="eyebrow">KADRAJ & AÇI</span><h3>Hikâyeye odaklan.</h3></div></div>
              <h4 className="control-label">En boy oranı</h4><div className="ratio-grid">{ratios.map((ratio) => <button key={ratio.value} className={settings.aspectRatio === ratio.value ? 'active' : ''} onClick={() => { commit({ aspectRatio: ratio.value, ...(ratio.value === 'free' && !settings.crop ? { crop: { x: .08, y: .08, width: .84, height: .84 } } : {}) }); if (ratio.value === 'free') setFreeCropOpen(true); }}><span className={`ratio-icon ratio-icon--${ratio.value.replace(':', '-')}`} /><strong>{ratio.label}</strong></button>)}</div>
              {settings.aspectRatio === 'free' && <button className="free-crop-open" onClick={() => setFreeCropOpen(true)}><Crop size={15} /> Serbest kadrajı düzenle</button>}
              <div className="geometry-controls"><EditorSlider label="Straighten" value={settings.straighten} min={-45} max={45} displayValue={`${settings.straighten}°`} onChange={value => live({ straighten: value })} onStart={startHistory} onEnd={endSlider} onReset={() => commit({ straighten: 0 })} /><EditorSlider label="Yatay perspektif" value={settings.perspectiveX} min={-35} max={35} onChange={value => live({ perspectiveX: value })} onStart={startHistory} onEnd={endSlider} onReset={() => commit({ perspectiveX: 0 })} /><EditorSlider label="Dikey perspektif" value={settings.perspectiveY} min={-35} max={35} onChange={value => live({ perspectiveY: value })} onStart={startHistory} onEnd={endSlider} onReset={() => commit({ perspectiveY: 0 })} /></div>
              <h4 className="control-label">Döndür</h4><div className="transform-row"><button onClick={() => commit({ rotation: settings.rotation - 90 })}><RotateCcw size={21} /><span>90° sola</span></button><button onClick={() => commit({ rotation: settings.rotation + 90 })}><RotateCw size={21} /><span>90° sağa</span></button></div>
              <h4 className="control-label">Aynala</h4><div className="transform-row"><button className={settings.flipHorizontal ? 'active' : ''} onClick={() => commit({ flipHorizontal: !settings.flipHorizontal })}><FlipHorizontal2 size={21} /><span>Yatay</span></button><button className={settings.flipVertical ? 'active' : ''} onClick={() => commit({ flipVertical: !settings.flipVertical })}><FlipVertical2 size={21} /><span>Dikey</span></button></div>
              <div className="editor-tip"><Crop size={17} /><p><strong>Sosyal medyaya hazır</strong>4:5 Instagram gönderileri, 1:1 profil ve ürün kareleri için idealdir.</p></div>
            </div>}
            {activeTab === 'color' && <AdvancedEditorPanel settings={settings} commit={commit} live={live} liveSettings={liveSettings} start={startHistory} end={endSlider} />}
            {activeTab === 'text' && <TextEditorPanel settings={settings} commit={commit} live={live} liveSettings={liveSettings} start={startHistory} end={endSlider} selectedId={selectedTextId} setSelectedId={setSelectedTextId} />}
          </div>
        </aside>
      </main>

      {freeCropOpen && <FreeCropEditor source={previewSource} initialCrop={settings.crop} onClose={() => setFreeCropOpen(false)} onApply={nextCrop => { commit({ aspectRatio: 'free', crop: nextCrop }); setFreeCropOpen(false); }} />}
      {busy === 'share' && <div className="editor-share-status glass-modal" role="status"><MyVisionLogo variant="wordmark" size={34} /><LoaderCircle className="spin" size={22} /><strong>Görüşün paylaşıma hazırlanıyor</strong></div>}
      {exportOpen && <Modal title="Fotoğrafını dışa aktar" onClose={() => busy === null && setExportOpen(false)} className="export-modal">
        <div className="export-preview"><img src={advancedPreview ?? previewSource} alt="Dışa aktarılacak fotoğraf" style={{ filter }} /><span><Check size={15} /> Düzenlemeler uygulandı</span></div>
        <div className="export-field"><label>Dosya formatı</label><div className="format-options"><button className={exportOptions.format === 'jpeg' ? 'active' : ''} onClick={() => setExportOptions({ ...exportOptions, format: 'jpeg' })}><strong>JPG</strong><small>Paylaşım için ideal</small></button><button className={exportOptions.format === 'png' ? 'active' : ''} onClick={() => setExportOptions({ ...exportOptions, format: 'png' })}><strong>PNG</strong><small>Kayıpsız kalite</small></button></div></div>
        <div className="export-field"><label>Çıktı boyutu</label><div className="size-options">{[1080, 2048, 4096].map((size) => <button key={size} className={exportOptions.maxDimension === size ? 'active' : ''} onClick={() => setExportOptions({ ...exportOptions, maxDimension: size })}><strong>{size === 4096 ? '4K' : `${size} px`}</strong><small>{size === 1080 ? 'Sosyal medya' : size === 2048 ? 'Yüksek kalite' : 'Maksimum'}</small></button>)}</div></div>
        {exportOptions.format === 'jpeg' && <EditorSlider label="Görüntü kalitesi" value={Math.round(exportOptions.quality * 100)} min={60} max={100} displayValue={`${Math.round(exportOptions.quality * 100)}%`} onChange={(value) => setExportOptions({ ...exportOptions, quality: value / 100 })} />}
        <div className="export-summary"><span>Tahmini çıktı</span><strong>{output ? `${output.width} × ${output.height} px` : 'Hesaplanıyor…'}</strong></div>
        <button className="button button--lime export-confirm" onClick={() => void exportPhoto()} disabled={busy !== null}>{busy === 'export' ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}{busy === 'export' ? 'Fotoğraf işleniyor…' : 'Fotoğrafı indir'}</button>
        <p className="export-note">Orijinal fotoğrafın değiştirilmez. Yeni bir kopya oluşturulur.</p>
      </Modal>}
    </div>
  );
}
