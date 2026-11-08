import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ArrowLeft, Check, Copy, Download, Film, GripVertical, LoaderCircle, Music2, Pause, Play, Plus, RotateCw, Save, Scissors, Share2, Sparkles, Split, Trash2, Type, Volume2, VolumeX, X } from 'lucide-react';
import { Modal } from './Modal';
import { Brand } from './Brand';
import { CREATIVE_EFFECTS, applyCreativeEffects, formatCreativeDate } from '../lib/creativeEffects';
import { freshSettings } from '../lib/imageEngine';
import { downloadBlob, shareProject } from '../lib/downloads';
import { exportVideo, exportedVideoDuration } from '../lib/videoPipeline';
import { clipOutputDuration, detectVideoCapabilities, MAX_VIDEO_CLIPS, MAX_VIDEO_DURATION, moveVideoClip, normalizeTrim, splitVideoClip, validateVideoDraft, videoDimensions, videoMemoryWarning, VIDEO_SPEEDS, type VideoCapabilities } from '../lib/videoModel';
import { deleteVideoDraft, listVideoDrafts, loadVideoDraft, releaseVideoDraft, saveVideoDraft } from '../lib/videoStorage';
import type { VideoAspectRatio, VideoClip, VideoDraft, VideoDraftSummary, VideoResolution, VideoTextLayer } from '../types/video';

interface VideoEditorProps { onClose: () => void; onToast: (message: string, type?: 'success' | 'info') => void }
type InspectorTab = 'clip' | 'effects' | 'text' | 'audio';
const now = () => Date.now();
const makeDraft = (): VideoDraft => ({ id: crypto.randomUUID(), name: 'Yeni video', createdAt: now(), updatedAt: now(), aspectRatio: '9:16', resolution: 720, clips: [], creative: freshSettings().creative, texts: [] });
const touch = (draft: VideoDraft) => ({ ...draft, updatedAt: now() });
const time = (value: number) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`;

function readVideoFile(file: File): Promise<VideoClip> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) { reject(new Error('Yalnız video dosyaları seçilebilir.')); return; }
    if (file.size > 500 * 1024 * 1024) { reject(new Error('Video 500 MB sınırını aşıyor.')); return; }
    const source = URL.createObjectURL(file); const video = document.createElement('video');
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('Video bilgisi zaman aşımına uğradı.')), 15000);
    const cleanup = () => { window.clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null; video.ontimeupdate = null; video.removeAttribute('src'); video.load(); };
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      const duration = video.duration;
      cleanup();
      if (error) { URL.revokeObjectURL(source); reject(error); return; }
      if (!Number.isFinite(duration) || duration < .04 || duration > MAX_VIDEO_DURATION) { URL.revokeObjectURL(source); reject(new Error('Klip 0,04–120 saniye arasında olmalı.')); return; }
      resolve({ id: crypto.randomUUID(), name: file.name, source, blob: file, duration, trimStart: 0, trimEnd: duration, speed: 1, volume: 1, muted: false, rotation: 0, transition: 'none' });
    };
    video.preload = 'metadata'; video.muted = true;
    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        // MediaRecorder WebM often omits the duration field; a terminal seek makes Chrome calculate it.
        video.ontimeupdate = () => { video.ontimeupdate = null; finish(); };
        video.currentTime = Number.MAX_SAFE_INTEGER;
      } else finish();
    };
    video.onerror = () => finish(new Error('Video açılamadı. MP4, WebM veya MOV deneyin.'));
    video.src = source;
  });
}

export function VideoEditor({ onClose, onToast }: VideoEditorProps) {
  const [draft, setDraft] = useState<VideoDraft>(makeDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('clip');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [drafts, setDrafts] = useState<VideoDraftSummary[]>([]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStage, setExportStage] = useState('');
  const [exportError, setExportError] = useState('');
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ blob: Blob; url: string } | null>(null);
  const [capabilities, setCapabilities] = useState<VideoCapabilities | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const exportController = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const outputRef = useRef(output);
  const saveGeneration = useRef(0);
  const selected = draft.clips.find(clip => clip.id === selectedId) ?? draft.clips[0] ?? null;
  const selectedText = draft.texts.find(layer => layer.id === selectedTextId) ?? null;
  const exportDuration = exportedVideoDuration(draft.clips);
  const memoryWarning = videoMemoryWarning(draft.clips, draft.resolution);
  const baseSettings = useMemo(() => freshSettings(), []);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { outputRef.current = output; }, [output]);
  useEffect(() => { void listVideoDrafts().then(setDrafts).catch(() => undefined); void detectVideoCapabilities().then(setCapabilities).catch(() => undefined); }, []);
  useEffect(() => () => { exportController.current?.abort(); releaseVideoDraft(draftRef.current); if (outputRef.current) URL.revokeObjectURL(outputRef.current.url); }, []);

  const persist = useCallback(async (snapshot: VideoDraft, notify = true) => {
    if (!snapshot.clips.length) { if (notify) onToast('Önce en az bir video klip ekle.', 'info'); return false; }
    setSaving(true);
    try {
      const saved = await saveVideoDraft(snapshot); releaseVideoDraft(saved);
      setDirty(false); setDrafts(await listVideoDrafts());
      if (notify) onToast('Video taslağı cihazına kaydedildi.');
      return true;
    } catch (reason) { if (notify) onToast(reason instanceof Error ? reason.message : 'Video taslağı kaydedilemedi.', 'info'); return false; }
    finally { setSaving(false); }
  }, [onToast]);

  useEffect(() => {
    if (!dirty || !draft.clips.length || exporting) return;
    const generation = ++saveGeneration.current; const snapshot = draft;
    const timer = window.setTimeout(() => { void persist(snapshot, false).then(saved => { if (saved && generation !== saveGeneration.current) setDirty(true); }); }, 1800);
    return () => { window.clearTimeout(timer); saveGeneration.current += 1; };
  }, [draft, dirty, exporting, persist]);

  const updateDraft = (updater: (current: VideoDraft) => VideoDraft) => { setDraft(current => touch(updater(current))); setDirty(true); };
  const updateClip = (patch: Partial<VideoClip>) => {
    if (!selected) return;
    if (patch.trimStart !== undefined && videoRef.current) { videoRef.current.currentTime = patch.trimStart; setCurrentTime(patch.trimStart); }
    updateDraft(current => ({ ...current, clips: current.clips.map(clip => clip.id === selected.id ? { ...clip, ...patch, ...normalizeTrim(clip.duration, patch.trimStart ?? clip.trimStart, patch.trimEnd ?? clip.trimEnd) } : clip) }));
  };
  const selectClip = (clip: VideoClip) => { videoRef.current?.pause(); musicRef.current?.pause(); setSelectedId(clip.id); setCurrentTime(clip.trimStart); setPlaying(false); };
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    const accepted: VideoClip[] = [];
    try {
      for (const file of Array.from(files).slice(0, MAX_VIDEO_CLIPS - draft.clips.length)) {
        try { accepted.push(await readVideoFile(file)); }
        catch (reason) { onToast(reason instanceof Error ? reason.message : 'Video içe aktarılamadı.', 'info'); }
      }
      if (!accepted.length) return;
      const nextClips = [...draft.clips, ...accepted];
      const validation = validateVideoDraft(nextClips);
      if (validation) { for (const clip of accepted) URL.revokeObjectURL(clip.source); onToast(validation, 'info'); return; }
      updateDraft(current => ({ ...current, clips: [...current.clips, ...accepted] }));
      setSelectedId(accepted[0].id); setInspectorTab('clip');
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const loadDraft = async (id: string) => {
    const loaded = await loadVideoDraft(id); if (!loaded) return;
    releaseVideoDraft(draftRef.current); if (outputRef.current) URL.revokeObjectURL(outputRef.current.url); setDraft(loaded); setSelectedId(loaded.clips[0]?.id ?? null); setDirty(false); setOutput(null);
  };
  const removeDraft = async (id: string) => { await deleteVideoDraft(id); setDrafts(await listVideoDrafts()); };

  const split = () => {
    if (!selected) return;
    const parts = splitVideoClip(selected, currentTime, crypto.randomUUID()); if (!parts) { onToast('Oynatma çizgisini klibin içine taşı.', 'info'); return; }
    updateDraft(current => ({ ...current, clips: current.clips.flatMap(clip => clip.id === selected.id ? parts : [clip]) }));
    setSelectedId(parts[1].id);
  };
  const duplicate = () => {
    if (!selected || draft.clips.length >= MAX_VIDEO_CLIPS) return;
    const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} · kopya`, transition: 'none' as const };
    updateDraft(current => ({ ...current, clips: current.clips.flatMap(clip => clip.id === selected.id ? [clip, copy] : [clip]) })); setSelectedId(copy.id);
  };
  const remove = () => {
    if (!selected) return;
    const index = draft.clips.findIndex(clip => clip.id === selected.id); const next = draft.clips.filter(clip => clip.id !== selected.id);
    updateDraft(current => ({ ...current, clips: current.clips.filter(clip => clip.id !== selected.id) }));
    setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null); setPlaying(false);
  };
  const move = (direction: -1 | 1) => { if (!selected) return; updateDraft(current => ({ ...current, clips: moveVideoClip(current.clips, selected.id, direction) })); };

  const syncMusic = (clip: VideoClip) => {
    if (!draft.music || !musicRef.current) return;
    const index = draft.clips.findIndex(item => item.id === clip.id); if (index < 0) return;
    const before = draft.clips.slice(0, index).reduce((sum, item) => sum + clipOutputDuration(item), 0);
    musicRef.current.currentTime = Math.min(musicRef.current.duration || before, before);
  };
  const togglePlay = async () => {
    const video = videoRef.current; if (!video || !selected) return;
    syncMusic(selected);
    if (playing) { video.pause(); musicRef.current?.pause(); setPlaying(false); return; }
    if (video.currentTime < selected.trimStart || video.currentTime >= selected.trimEnd) video.currentTime = selected.trimStart;
    try { await video.play(); if (draft.music) await musicRef.current?.play().catch(() => undefined); setPlaying(true); }
    catch { onToast('Video oynatılamadı. Dosya biçimini kontrol et.', 'info'); }
  };
  const onTimeUpdate = () => {
    const video = videoRef.current; if (!video || !selected) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime < selected.trimEnd - .025) return;
    video.pause(); const index = draft.clips.findIndex(clip => clip.id === selected.id); const next = draft.clips[index + 1];
    if (next) { setSelectedId(next.id); setCurrentTime(next.trimStart); }
    else { setPlaying(false); musicRef.current?.pause(); }
  };
  useEffect(() => {
    const video = videoRef.current; if (!video || !selected) return;
    video.playbackRate = selected.speed; video.volume = selected.muted ? 0 : selected.volume;
  }, [selected, selectedId]);
  useEffect(() => { if (musicRef.current && draft.music) musicRef.current.volume = draft.music.volume; }, [draft.music]);


  useEffect(() => {
    const canvas = canvasRef.current; const video = videoRef.current; if (!canvas || !video) return;
    const context = canvas.getContext('2d', { alpha: false }); if (!context) return;
    const size = videoDimensions(draft.aspectRatio, 720); const scale = Math.min(1, 640 / Math.max(size.width, size.height));
    canvas.width = Math.round(size.width * scale); canvas.height = Math.round(size.height * scale);
    let frame = 0, last = 0;
    const draw = (nowMs: number) => {
      frame = requestAnimationFrame(draw); if (nowMs - last < 66) return; last = nowMs;
      const current = draftRef.current; const clip = current.clips.find(item => item.id === selectedId) ?? current.clips[0];
      context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
      if (clip && video.readyState >= 2) {
        const quarter = clip.rotation % 180 !== 0; const sourceWidth = quarter ? video.videoHeight : video.videoWidth; const sourceHeight = quarter ? video.videoWidth : video.videoHeight;
        const cover = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
        context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(clip.rotation * Math.PI / 180);
        context.drawImage(video, -video.videoWidth * cover / 2, -video.videoHeight * cover / 2, video.videoWidth * cover, video.videoHeight * cover); context.restore();
      }
      applyCreativeEffects(context, canvas.width, canvas.height, { ...baseSettings, creative: current.creative }, { forceBackend: 'canvas2d', time: video.currentTime || 0 });
      const clipIndex = clip ? current.clips.findIndex(item => item.id === clip.id) : 0;
      const before = clip ? current.clips.slice(0, clipIndex).reduce((sum, item) => sum + clipOutputDuration(item), 0) : 0;
      const globalTime = clip ? before + Math.max(0, video.currentTime - clip.trimStart) / clip.speed : 0;
      for (const layer of current.texts.filter(item => globalTime >= item.start && globalTime <= item.end)) {
        const size = Math.max(12, layer.size / 100 * Math.min(canvas.width, canvas.height));
        context.save(); context.font = `${layer.kind === 'sticker' ? 400 : 650} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.shadowColor = 'rgba(0,0,0,.55)'; context.shadowBlur = size * .12; context.fillStyle = layer.color; context.fillText(layer.text, layer.x * canvas.width, layer.y * canvas.height, canvas.width * .88); context.restore();
      }
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [selectedId, draft.clips, draft.aspectRatio, draft.creative, draft.texts, baseSettings]);

  const addText = (kind: VideoTextLayer['kind']) => {
    const value = textDraft.trim() || (kind === 'sticker' ? '⭐' : ''); if (!value) return;
    const layer: VideoTextLayer = { id: crypto.randomUUID(), kind, text: value.slice(0, 80), start: 0, end: Math.min(5, Math.max(.1, exportDuration)), x: .5, y: kind === 'sticker' ? .65 : .2, size: kind === 'sticker' ? 14 : 8, color: '#FFFFFF' };
    updateDraft(current => ({ ...current, texts: [...current.texts, layer] })); setSelectedTextId(layer.id); setTextDraft('');
  };
  const updateText = (patch: Partial<VideoTextLayer>) => { if (!selectedText) return; updateDraft(current => ({ ...current, texts: current.texts.map(layer => layer.id === selectedText.id ? { ...layer, ...patch } : layer) })); };
  const addMusic = (file?: File) => {
    if (!file) return; if (!file.type.startsWith('audio/')) { onToast('Bir ses dosyası seç.', 'info'); return; }
    if (draft.music) URL.revokeObjectURL(draft.music.source);
    updateDraft(current => ({ ...current, music: { name: file.name, source: URL.createObjectURL(file), blob: file, volume: .45, fadeIn: 1, fadeOut: 1 } }));
  };

  const startExport = async () => {
    const validation = validateVideoDraft(draft.clips); if (validation) { onToast(validation, 'info'); return; }
    setPlaying(false); videoRef.current?.pause(); musicRef.current?.pause();
    if (output) { URL.revokeObjectURL(output.url); setOutput(null); }
    const controller = new AbortController(); exportController.current = controller; setExporting(true); setProgress(0); setExportError(''); setExportStage('FFmpeg hazırlanıyor');
    try {
      const blob = await exportVideo(draft, { signal: controller.signal, onProgress: setProgress, onStage: stage => setExportStage({ load: 'FFmpeg yükleniyor', prepare: 'Klipler ve katmanlar hazırlanıyor', encode: 'MP4 kodlanıyor', verify: 'Çıktı doğrulanıyor' }[stage]) });
      setOutput({ blob, url: URL.createObjectURL(blob) }); onToast('MP4 videon hazır.');
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) { console.error('[video-export-ui]', reason); const message = reason instanceof Error ? reason.message : reason instanceof ErrorEvent && reason.message ? reason.message : 'Video dışa aktarılamadı. 720p ve daha kısa bir taslak deneyin.'; setExportError(message); onToast(message, 'info'); } }
    finally { setExporting(false); exportController.current = null; }
  };
  const requestClose = useCallback(() => { if (exporting) return; if (dirty && draft.clips.length) setCloseOpen(true); else onClose(); }, [dirty, draft.clips.length, exporting, onClose]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (exporting) { onToast('Video üretimi bitene kadar bekleyin veya iptal edin.', 'info'); return; }
      if (closeOpen) setCloseOpen(false);
      else if (dirty && draft.clips.length) setCloseOpen(true);
      else if (!canGoBack) onClose();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [closeOpen, dirty, draft.clips.length, exporting, onClose, onToast]);

  return <div className="video-editor">
    <header className="video-header"><div><button className="icon-button" onClick={requestClose} aria-label="Video editöründen çık"><ArrowLeft size={21} /></button><Brand compact /><input value={draft.name} onChange={event => updateDraft(current => ({ ...current, name: event.target.value.slice(0, 48) }))} aria-label="Video proje adı" /></div><span className={`video-save-state ${dirty ? 'is-dirty' : ''}`}><i />{dirty ? 'Taslak kaydedilmedi' : 'Taslak kaydedildi'}</span><div><button className="button button--ghost" onClick={() => void persist(draft)} disabled={saving || exporting || !draft.clips.length} aria-label="Video taslağını kaydet">{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}<span>Kaydet</span></button><button className="button button--primary" onClick={() => void startExport()} disabled={exporting || !draft.clips.length} aria-label="MP4 üret"><Film size={17} /><span>MP4 üret</span></button></div></header>
    {!draft.clips.length ? <main className="video-empty"><Film size={48} /><span className="eyebrow">ÇOK KLİPLİ VİDEO STÜDYOSU</span><h1>Görüşünü hareket ettir.</h1><p>En fazla 8 klip, toplam 120 saniye. 720p veya 1080p MP4; 4K video yok. Dosyalar cihazından çıkmaz.</p><button className="button button--primary button-large" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <LoaderCircle className="spin" size={19} /> : <Plus size={19} />}Video klipler seç</button>{capabilities && <small>{capabilities.webcodecs ? 'WebCodecs algılandı' : capabilities.mediaRecorder ? 'MediaRecorder algılandı' : 'MediaRecorder yok'} · MP4 çıktı Worker FFmpeg ile üretilir</small>}
      {drafts.length > 0 && <section className="video-recovery"><h2>Cihazındaki taslaklar</h2>{drafts.map(item => <div key={item.id}><button onClick={() => void loadDraft(item.id)}><Film size={17} /><span><strong>{item.name}</strong><small>{item.clipCount} klip · {time(item.duration)}</small></span></button><button onClick={() => void removeDraft(item.id)} aria-label={`${item.name} taslağını sil`}><Trash2 size={16} /></button></div>)}</section>}
    </main> : <main className="video-workspace">
      <section className="video-stage-panel"><div className="video-stage-toolbar"><span>{draft.clips.length} klip · {time(exportDuration)}</span><span>{draft.resolution}p · {draft.aspectRatio}</span></div><div className="video-canvas-wrap"><video ref={videoRef} src={selected?.source} onLoadedMetadata={event => { if (!selected) return; event.currentTarget.currentTime = selected.trimStart; setCurrentTime(selected.trimStart); syncMusic(selected); if (playing) void event.currentTarget.play(); }} onTimeUpdate={onTimeUpdate} onEnded={onTimeUpdate} playsInline preload="auto" /><canvas ref={canvasRef} aria-label="Video önizlemesi" />{draft.music && <audio ref={musicRef} src={draft.music.source} preload="auto" />}</div>
        <div className="video-transport"><button className="icon-button" onClick={() => void togglePlay()} aria-label={playing ? 'Duraklat' : 'Oynat'}>{playing ? <Pause size={20} /> : <Play size={20} />}</button><input type="range" min={selected?.trimStart ?? 0} max={selected?.trimEnd ?? 0} step={.01} value={Math.min(currentTime, selected?.trimEnd ?? 0)} onChange={event => { const value = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value); }} aria-label="Klip oynatma çizgisi" /><span>{time(Math.max(0, currentTime - (selected?.trimStart ?? 0)) / (selected?.speed ?? 1))} / {time(selected ? clipOutputDuration(selected) : 0)}</span></div>
        <div className="video-timeline" aria-label="Video zaman çizelgesi">{draft.clips.map((clip, index) => <button key={clip.id} className={selected?.id === clip.id ? 'active' : ''} style={{ flexGrow: Math.max(.2, clipOutputDuration(clip)) }} onClick={() => selectClip(clip)}><GripVertical size={13} /><span>{index + 1}. {clip.name}</span><small>{time(clipOutputDuration(clip))}{clip.transition === 'fade' ? ' · fade' : ''}</small></button>)}<button className="video-add-clip" onClick={() => fileRef.current?.click()} disabled={draft.clips.length >= MAX_VIDEO_CLIPS} aria-label="Klip ekle"><Plus size={18} /></button></div>
        {memoryWarning && <p className="video-warning">{memoryWarning}</p>}
        {exportError && <p className="video-warning" role="alert">Dışa aktarma hatası: {exportError} Ayarları koruyup yeniden deneyebilirsin.</p>}
        {output && <div className="video-output"><Check size={18} /><video src={output.url} controls playsInline aria-label="Üretilen MP4" /><div><button className="button button--primary" onClick={() => void downloadBlob(output.blob, `${draft.name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '-')}.mp4`)}><Download size={16} />İndir</button><button className="button button--outline" onClick={() => void shareProject(output.blob, 'my-vision.mp4').catch(() => onToast('Paylaşım başlatılamadı.', 'info'))}><Share2 size={16} />Paylaş</button></div></div>}
      </section>
      <aside className="video-inspector"><div className="video-global-settings"><label>Oran<select value={draft.aspectRatio} onChange={event => updateDraft(current => ({ ...current, aspectRatio: event.target.value as VideoAspectRatio }))}>{(['9:16','1:1','4:5','16:9'] as const).map(ratio => <option key={ratio}>{ratio}</option>)}</select></label><label>Çözünürlük<select value={draft.resolution} onChange={event => updateDraft(current => ({ ...current, resolution: Number(event.target.value) as VideoResolution }))}><option value={720}>720p</option><option value={1080}>1080p</option></select></label></div>
        <div className="video-inspector-tabs">{([{ id: 'clip', label: 'Klip', icon: Scissors },{ id: 'effects', label: 'Efekt', icon: Sparkles },{ id: 'text', label: 'Metin', icon: Type },{ id: 'audio', label: 'Ses', icon: Music2 }] as const).map(tab => <button key={tab.id} className={inspectorTab === tab.id ? 'active' : ''} onClick={() => setInspectorTab(tab.id)}><tab.icon size={16} />{tab.label}</button>)}</div>
        <div className="video-inspector-content">
          {inspectorTab === 'clip' && selected && <section><h2>Klip düzenle</h2><div className="video-clip-actions"><button onClick={split}><Split size={16} />Böl</button><button onClick={duplicate}><Copy size={16} />Kopyala</button><button onClick={() => move(-1)} disabled={draft.clips[0]?.id === selected.id}><ArrowLeft size={16} />Öne al</button><button onClick={() => move(1)} disabled={draft.clips.at(-1)?.id === selected.id}><ArrowLeft size={16} className="flip-x" />Sonra al</button><button className="danger" onClick={remove}><Trash2 size={16} />Sil</button></div>
            <label>Başlangıç · {selected.trimStart.toFixed(2)} sn<input type="range" min={0} max={selected.duration} step={.01} value={selected.trimStart} onChange={event => updateClip({ trimStart: Math.min(Number(event.target.value), selected.trimEnd - .04) })} /></label><label>Bitiş · {selected.trimEnd.toFixed(2)} sn<input type="range" min={0} max={selected.duration} step={.01} value={selected.trimEnd} onChange={event => updateClip({ trimEnd: Math.max(Number(event.target.value), selected.trimStart + .04) })} /></label>
            <label>Hız<select value={selected.speed} onChange={event => updateClip({ speed: Number(event.target.value) })}>{VIDEO_SPEEDS.map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label><label>Ses · {Math.round(selected.volume * 100)}%<input type="range" min={0} max={1} step={.01} value={selected.volume} onChange={event => updateClip({ volume: Number(event.target.value) })} /></label><div className="video-inline-actions"><button onClick={() => updateClip({ muted: !selected.muted })}>{selected.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{selected.muted ? 'Sesi aç' : 'Sustur'}</button><button onClick={() => updateClip({ rotation: ((selected.rotation + 90) % 360) as VideoClip['rotation'] })}><RotateCw size={16} />90° döndür</button></div><label>Sonraki klibe geçiş<select value={selected.transition} onChange={event => updateClip({ transition: event.target.value as VideoClip['transition'] })}><option value="none">Geçiş yok</option><option value="fade">Fade 0,35 sn</option></select></label><p className="tool-note">Oran değişimi klibi güvenli şekilde cover-crop ile kadraja yerleştirir.</p></section>}
          {inspectorTab === 'effects' && <section><h2>Ortak hafif efektler</h2><label>Efekt<select value={draft.creative.id} onChange={event => { const effect = CREATIVE_EFFECTS.find(item => item.id === event.target.value) ?? CREATIVE_EFFECTS[0]; updateDraft(current => ({ ...current, creative: { ...current.creative, id: effect.id, intensity: effect.defaultIntensity } })); }}>{CREATIVE_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label>{draft.creative.id !== 'none' && <label>Yoğunluk · {draft.creative.intensity}%<input type="range" min={0} max={100} value={draft.creative.intensity} onChange={event => updateDraft(current => ({ ...current, creative: { ...current.creative, intensity: Number(event.target.value) } }))} /></label>}<label className="video-check"><input type="checkbox" checked={draft.creative.particles} onChange={event => updateDraft(current => ({ ...current, creative: { ...current.creative, particles: event.target.checked } }))} />Parçacıklar</label>{draft.creative.particles && <label>Parçacık yoğunluğu · {draft.creative.particleIntensity}%<input type="range" min={0} max={100} value={draft.creative.particleIntensity} onChange={event => updateDraft(current => ({ ...current, creative: { ...current.creative, particleIntensity: Number(event.target.value) } }))} /></label>}<label className="video-check"><input type="checkbox" checked={draft.creative.dateStamp} onChange={event => updateDraft(current => ({ ...current, creative: { ...current.creative, dateStamp: event.target.checked, dateStampText: current.creative.dateStampText || formatCreativeDate(new Date()) } }))} />Tarih damgası</label><p className="tool-note">Fotoğraf editörüyle aynı ayar modeli. Video zamanı hareketli efektlerde kare zamanını kullanır.</p></section>}
          {inspectorTab === 'text' && <section><h2>Zamanlı metin ve sticker</h2><div className="video-text-add"><input value={textDraft} onChange={event => setTextDraft(event.target.value)} maxLength={80} placeholder="Metin veya emoji" aria-label="Video metni" /><button onClick={() => addText('text')}><Plus size={15} />Metin</button><button onClick={() => addText('sticker')}><Plus size={15} />Sticker</button></div><div className="video-text-list">{draft.texts.map(layer => <button key={layer.id} className={selectedTextId === layer.id ? 'active' : ''} onClick={() => setSelectedTextId(layer.id)}><span>{layer.text}</span><small>{layer.start.toFixed(1)}–{layer.end.toFixed(1)} sn</small></button>)}</div>{selectedText && <div className="video-text-editor"><input value={selectedText.text} maxLength={80} onChange={event => updateText({ text: event.target.value })} aria-label="Seçili video metni" /><div className="video-time-fields"><label>Başlangıç<input type="number" min={0} max={exportDuration} step={.1} value={selectedText.start} onChange={event => updateText({ start: Math.max(0, Math.min(Number(event.target.value), selectedText.end - .1)) })} /></label><label>Bitiş<input type="number" min={.1} max={exportDuration} step={.1} value={selectedText.end} onChange={event => updateText({ end: Math.max(selectedText.start + .1, Math.min(Number(event.target.value), exportDuration)) })} /></label></div><label>Yatay konum<input type="range" min={.05} max={.95} step={.01} value={selectedText.x} onChange={event => updateText({ x: Number(event.target.value) })} /></label><label>Dikey konum<input type="range" min={.05} max={.95} step={.01} value={selectedText.y} onChange={event => updateText({ y: Number(event.target.value) })} /></label><label>Boyut<input type="range" min={3} max={22} value={selectedText.size} onChange={event => updateText({ size: Number(event.target.value) })} /></label><label>Renk<input type="color" value={selectedText.color} onChange={event => updateText({ color: event.target.value })} /></label><button className="button button--outline" onClick={() => { updateDraft(current => ({ ...current, texts: current.texts.filter(layer => layer.id !== selectedText.id) })); setSelectedTextId(null); }}><Trash2 size={15} />Katmanı sil</button></div>}</section>}
          {inspectorTab === 'audio' && <section><h2>Kullanıcı müziği</h2><p className="tool-note">Yalnız kendi dosyanı veya kullanım hakkına sahip olduğun müziği ekle. Paket müzik gömülmez.</p><button className="button button--outline" onClick={() => musicInputRef.current?.click()}><Music2 size={16} />{draft.music ? 'Müziği değiştir' : 'Müzik seç'}</button>{draft.music && <><p className="video-music-name">{draft.music.name}</p><label>Müzik seviyesi · {Math.round(draft.music.volume * 100)}%<input type="range" min={0} max={1} step={.01} value={draft.music.volume} onChange={event => updateDraft(current => ({ ...current, music: current.music ? { ...current.music, volume: Number(event.target.value) } : undefined }))} /></label><label>Fade in · {draft.music.fadeIn} sn<input type="range" min={0} max={5} step={.5} value={draft.music.fadeIn} onChange={event => updateDraft(current => ({ ...current, music: current.music ? { ...current.music, fadeIn: Number(event.target.value) } : undefined }))} /></label><label>Fade out · {draft.music.fadeOut} sn<input type="range" min={0} max={5} step={.5} value={draft.music.fadeOut} onChange={event => updateDraft(current => ({ ...current, music: current.music ? { ...current.music, fadeOut: Number(event.target.value) } : undefined }))} /></label><button className="button button--ghost" onClick={() => { URL.revokeObjectURL(draft.music!.source); updateDraft(current => ({ ...current, music: undefined })); }}><X size={15} />Müziği kaldır</button></>}</section>}
        </div>
      </aside>
    </main>}
    <input ref={fileRef} className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" aria-label="Video klipleri seç" multiple onChange={event => void addFiles(event.target.files)} /><input ref={musicInputRef} className="visually-hidden" type="file" accept="audio/*" aria-label="Video müziği seç" onChange={event => addMusic(event.target.files?.[0])} />
    {exporting && <div className="video-export-overlay" role="dialog" aria-modal="true" aria-label="Video dışa aktarma"><Film size={32} /><h2>MP4 üretiliyor</h2><p>{exportStage}</p><progress max={1} value={progress} /><strong>%{Math.round(progress * 100)}</strong><button className="button button--outline" onClick={() => exportController.current?.abort()}>İptal</button><small>Uygulamayı açık tut. 1080p süre cihaza göre değişir.</small></div>}
    {closeOpen && <Modal title="Video taslağı kaydedilmedi" onClose={() => setCloseOpen(false)}><p className="confirm-copy">Son video değişiklikleri henüz cihazdaki taslağa yazılmadı.</p><div className="confirm-actions"><button className="button button--outline" onClick={() => setCloseOpen(false)}>Düzenlemeye dön</button><button className="button button--ghost" onClick={onClose}>Kaydetmeden çık</button><button className="button button--primary" onClick={() => void persist(draft).then(saved => { if (saved) onClose(); })}>Kaydet ve çık</button></div></Modal>}
  </div>;
}
