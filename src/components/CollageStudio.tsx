import { useRef, useState } from 'react';
import { ArrowLeft, Download, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { PRESETS, getPreset } from '../data/presets';
import { buildCssFilter, freshSettings, loadImage, preparePhoto } from '../lib/imageEngine';
import { downloadBlob } from '../lib/downloads';
import { EditorSlider } from './EditorSlider';

interface CollageItem { id: string; source: string; name: string; }
type Format = 'story' | 'post' | 'cover';
const formats: Record<Format, { label: string; width: number; height: number }> = {
  story: { label: 'Story 9:16', width: 1080, height: 1920 }, post: { label: 'Post 1:1', width: 1080, height: 1080 }, cover: { label: 'Kapak 16:9', width: 1600, height: 900 },
};
function layout(index: number, count: number, format: Format) {
  if (count === 1) return { gridColumn: '1 / -1', gridRow: '1 / -1' };
  if (count === 2) return format === 'cover' ? { gridColumn: `${index + 1}`, gridRow: '1' } : { gridColumn: '1', gridRow: `${index + 1}` };
  if (count === 3) return index === 0 ? { gridColumn: '1', gridRow: '1 / 3' } : { gridColumn: '2', gridRow: `${index}` };
  return { gridColumn: `${index % 2 + 1}`, gridRow: `${Math.floor(index / 2) + 1}` };
}
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sw = width / scale, sh = height / scale;
  context.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, width, height);
}

export function CollageStudio({ onClose, onToast }: { onClose: () => void; onToast: (message: string, type?: 'success' | 'info') => void }) {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [format, setFormat] = useState<Format>('post');
  const [presetId, setPresetId] = useState('original');
  const [gap, setGap] = useState(12);
  const [background, setBackground] = useState('#0A0A0A');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filter = buildCssFilter(freshSettings({ presetId, intensity: 85 }));
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const available = Math.max(0, 6 - items.length);
      const selected = [...files].slice(0, available);
      const added: CollageItem[] = [];
      for (const file of selected) added.push({ id: crypto.randomUUID(), source: await preparePhoto(file), name: file.name });
      setItems(current => [...current, ...added]);
      if (files.length > available) onToast('Bir kolajda en fazla 6 fotoğraf kullanılabilir.', 'info');
    } catch (reason) { onToast(reason instanceof Error ? reason.message : 'Fotoğraflar eklenemedi.', 'info'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const exportCollage = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const output = formats[format]; const canvas = document.createElement('canvas'); canvas.width = output.width; canvas.height = output.height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = background; context.fillRect(0, 0, output.width, output.height);
      const images = await Promise.all(items.map(item => loadImage(item.source)));
      const columns = items.length <= 1 ? 1 : items.length === 2 && format !== 'cover' ? 1 : 2;
      const rows = items.length <= 1 ? 1 : items.length === 2 && format !== 'cover' ? 2 : Math.ceil(items.length / 2);
      const captionSpace = caption.trim() ? Math.round(output.height * .1) : 0;
      const cellWidth = (output.width - gap * (columns + 1)) / columns;
      const cellHeight = (output.height - captionSpace - gap * (rows + 1)) / rows;
      context.filter = buildCssFilter(freshSettings({ presetId, intensity: 85 }), getPreset(presetId));
      images.forEach((image, index) => {
        let column = index % 2, row = Math.floor(index / 2), rowspan = 1;
        const colspan = 1;
        if (items.length === 1) { column = 0; row = 0; }
        if (items.length === 2 && format !== 'cover') { column = 0; row = index; }
        if (items.length === 3 && index === 0) { column = 0; row = 0; rowspan = 2; }
        if (items.length === 3 && index > 0) { column = 1; row = index - 1; }
        const x = gap + column * (cellWidth + gap), y = gap + row * (cellHeight + gap);
        context.save(); context.beginPath(); context.rect(x, y, cellWidth * colspan + gap * (colspan - 1), cellHeight * rowspan + gap * (rowspan - 1)); context.clip();
        drawCover(context, image, x, y, cellWidth * colspan + gap * (colspan - 1), cellHeight * rowspan + gap * (rowspan - 1)); context.restore();
      });
      context.filter = 'none';
      if (caption.trim()) {
        context.fillStyle = background; context.fillRect(0, output.height - captionSpace, output.width, captionSpace);
        context.fillStyle = '#FFFFFF'; context.font = `700 ${Math.round(output.height * .035)}px Manrope, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(caption.trim(), output.width / 2, output.height - captionSpace / 2, output.width * .9);
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Kolaj oluşturulamadı.')), 'image/jpeg', .92));
      await downloadBlob(blob, `my-vision-collage-${format}.jpg`); onToast('Kolajın dışa aktarıldı.');
    } catch (reason) { onToast(reason instanceof Error ? reason.message : 'Kolaj dışa aktarılamadı.', 'info'); }
    finally { setBusy(false); }
  };
  return <div className="studio-screen collage-studio"><header className="studio-header"><button className="icon-button" onClick={onClose} aria-label="Kolajı kapat"><ArrowLeft size={21} /></button><div><span className="eyebrow">CİHAZ İÇİ TASARIM</span><h1>Kolaj stüdyosu</h1></div><button className="button button--lime button--small" disabled={!items.length || busy} onClick={() => void exportCollage()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}<span>Dışa aktar</span></button></header>
    <div className="studio-layout"><section className="collage-preview-area"><div className={`collage-canvas collage-canvas--${format} collage-count-${items.length}`} style={{ gap, background, gridTemplateColumns: `repeat(${items.length <= 1 ? 1 : items.length === 2 && format !== 'cover' ? 1 : 2},1fr)` }}>{items.map((item, index) => <div key={item.id} className="collage-cell" style={layout(index, items.length, format)}><img src={item.source} alt={item.name} style={{ filter }} /><button onClick={() => setItems(current => current.filter(photo => photo.id !== item.id))} aria-label={`${item.name} fotoğrafını kolajdan çıkar`}><Trash2 size={14} /></button></div>)}{!items.length && <button className="studio-empty" onClick={() => inputRef.current?.click()}><ImagePlus size={35} /><strong>Fotoğraflarını seç</strong><span>2–6 görselle gerçek bir kolaj oluştur.</span></button>}</div>{caption && <div className="collage-caption-preview" style={{ background }}>{caption}</div>}</section>
      <aside className="studio-controls"><section><h2>Format</h2><div className="settings-segmented">{(Object.keys(formats) as Format[]).map(key => <button key={key} className={format === key ? 'active' : ''} onClick={() => setFormat(key)}>{formats[key].label}</button>)}</div></section>
        <section><h2>Görünüm</h2><select value={presetId} onChange={event => setPresetId(event.target.value)}>{PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></section>
        <section><EditorSlider label="Fotoğraf aralığı" value={gap} min={0} max={40} onChange={setGap} /><div className="creative-options"><input type="color" value={background} onChange={event => setBackground(event.target.value)} aria-label="Kolaj arka planı" /><span>Arka plan</span></div></section>
        <section><h2>Alt yazı</h2><input className="studio-text-input" aria-label="Alt yazı" value={caption} onChange={event => setCaption(event.target.value.slice(0, 70))} placeholder="İsteğe bağlı kolaj başlığı" /></section>
        <button className="button button--outline studio-add" onClick={() => inputRef.current?.click()} disabled={busy || items.length >= 6}><ImagePlus size={17} /> Fotoğraf ekle ({items.length}/6)</button>
      </aside></div>
    <input ref={inputRef} className="visually-hidden" type="file" aria-label="Fotoğraf dosyalarını seç" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void addFiles(event.target.files)} />
  </div>;
}
