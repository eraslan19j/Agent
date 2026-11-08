import { useRef, useState } from 'react';
import { ArrowLeft, Check, Clipboard, Download, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { PRESETS } from '../data/presets';
import { buildCssFilter, freshSettings, preparePhoto, renderPhoto } from '../lib/imageEngine';
import { pasteSettings } from '../lib/recipes';
import { downloadBlob } from '../lib/downloads';
import type { EditSettings } from '../types';

interface BatchItem { id: string; source: string; name: string; }
export function BatchStudio({ isPro, onClose, onToast }: { isPro: boolean; onClose: () => void; onToast: (message: string, type?: 'success' | 'info') => void }) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [presetId, setPresetId] = useState('original');
  const [copied, setCopied] = useState<EditSettings | null>(null);
  const [watermark, setWatermark] = useState('');
  const [maxDimension, setMaxDimension] = useState(2048);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const activeSettings = copied ?? freshSettings({ presetId, intensity: 85 });
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true); cancelRef.current = false;
    try {
      const available = Math.max(0, 12 - items.length);
      const added: BatchItem[] = [];
      for (const file of [...files].slice(0, available)) {
        if (cancelRef.current) break;
        added.push({ id: crypto.randomUUID(), source: await preparePhoto(file), name: file.name.replace(/\.[^.]+$/, '') });
      }
      setItems(current => [...current, ...added]);
      if (files.length > available) onToast('Toplu işlemde en fazla 12 fotoğraf seçilebilir.', 'info');
    } catch (reason) { onToast(reason instanceof Error ? reason.message : 'Dosyalar hazırlanamadı.', 'info'); }
    finally { setImporting(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const exportAll = async () => {
    if (!items.length || progress) return;
    cancelRef.current = false; setProgress({ done: 0, total: items.length });
    let succeeded = 0; const failed: string[] = [];
    for (const item of items) {
      if (cancelRef.current) break;
      try {
        const settings: EditSettings = { ...activeSettings, texts: watermark.trim() ? [...activeSettings.texts, { id: crypto.randomUUID(), text: watermark.trim(), x: .95, y: .95, size: 28, color: '#FFFFFF', font: 'sans', align: 'right', rotation: 0 }] : activeSettings.texts };
        const blob = await renderPhoto(item.source, settings, { format: 'jpeg', quality: .9, maxDimension });
        await downloadBlob(blob, `${item.name}-my-vision.jpg`); succeeded += 1;
      } catch { failed.push(item.name); }
      setProgress({ done: succeeded + failed.length, total: items.length });
    }
    const cancelled = cancelRef.current;
    setProgress(null);
    if (failed.length) onToast(`${succeeded} fotoğraf üretildi; ${failed.length} fotoğraf üretilemedi: ${failed.join(', ')}`, 'info');
    else if (cancelled) onToast(`İşlem durduruldu; ${succeeded} fotoğraf üretildi.`, 'info');
    else onToast(`${succeeded} fotoğrafın tamamı gerçek çıktı olarak üretildi.`);
  };
  const busy = importing || progress !== null;
  return <div className="studio-screen batch-studio"><header className="studio-header"><button className="icon-button" onClick={busy ? () => { cancelRef.current = true; } : onClose} aria-label={busy ? 'İşlemi durdur' : 'Toplu işlemi kapat'}><ArrowLeft size={21} /></button><div><span className="eyebrow">TOPLU ÜRETİM</span><h1>Batch stüdyo</h1></div><button className="button button--lime button--small" disabled={!items.length || busy} onClick={() => void exportAll()}><Download size={17} /><span>Tümünü üret</span></button></header>
    <div className="studio-layout"><section className="batch-preview-area">{items.length ? <div className="batch-grid">{items.map(item => <article key={item.id}><div><img src={item.source} alt={item.name} style={{ filter: buildCssFilter(activeSettings) }} /><button onClick={() => setItems(current => current.filter(photo => photo.id !== item.id))} disabled={busy} aria-label={`${item.name} dosyasını çıkar`}><Trash2 size={14} /></button></div><strong>{item.name}</strong></article>)}</div> : <button className="studio-empty" onClick={() => inputRef.current?.click()}><ImagePlus size={35} /><strong>Toplu düzenlenecek fotoğrafları seç</strong><span>Aynı tarif ve filigran en fazla 12 gerçek dosyaya uygulanır.</span></button>}</section>
      <aside className="studio-controls"><section><h2>Düzenleme tarifi</h2><select value={presetId} disabled={Boolean(copied)} onChange={event => { setPresetId(event.target.value); setCopied(null); }}>{PRESETS.filter(preset => !preset.pro || isPro).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><button className="button button--outline studio-add" onClick={() => { const value = pasteSettings(); if (value) { setCopied(value); onToast('Kopyalanan ayarlar toplu işleme uygulandı.'); } else onToast('Önce editörde “Ayarları kopyala” kullan.', 'info'); }}><Clipboard size={16} /> Kopyalanan ayarları kullan</button>{copied && <button className="tool-danger" onClick={() => setCopied(null)}>Kopyalanan tarifi kaldır</button>}</section>
        <section><h2>Filigran</h2><input className="studio-text-input" aria-label="Filigran" value={watermark} onChange={event => setWatermark(event.target.value.slice(0, 50))} placeholder="Örn. © stüdyon" /><p className="tool-note">Sağ alt köşeye her çıktıda ayrı metin katmanı olarak işlenir. Boş bırakılırsa eklenmez.</p></section>
        <section><h2>Çıktı boyutu</h2><div className="settings-segmented">{[1080, 2048, 4096].map(size => <button key={size} className={maxDimension === size ? 'active' : ''} disabled={size === 4096 && !isPro} onClick={() => setMaxDimension(size)}>{size === 4096 ? '4K Pro' : size}</button>)}</div></section>
        <button className="button button--outline studio-add" onClick={() => inputRef.current?.click()} disabled={busy || items.length >= 12}><ImagePlus size={17} /> Fotoğraf ekle ({items.length}/12)</button>
        {progress && <div className="batch-progress" role="status"><div><LoaderCircle className="spin" size={16} /><strong>{progress.done} / {progress.total}</strong></div><progress max={progress.total} value={progress.done} /><button onClick={() => { cancelRef.current = true; }}>İşlemi durdur</button>{progress.done === progress.total && <Check size={16} />}</div>}
      </aside></div>
    <input ref={inputRef} className="visually-hidden" type="file" aria-label="Fotoğraf dosyalarını seç" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void addFiles(event.target.files)} />
  </div>;
}
