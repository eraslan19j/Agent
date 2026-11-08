import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Cloud, Images, LoaderCircle, Pencil, RefreshCw, Share2, Upload, Users } from 'lucide-react';
import { listSharedPhotos, sharedPhotoFile, sharedPhotoLink, uploadSharedPhoto, type SharedPhoto } from '../lib/sharedPhotos';

interface SharedPhotosScreenProps {
  onEdit: (file: File) => void;
  onToast: (message: string, type?: 'success' | 'info') => void;
}

export function SharedPhotosScreen({ onEdit, onToast }: SharedPhotosScreenProps) {
  const [photos, setPhotos] = useState<SharedPhoto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const sharedId = window.location.pathname.match(/^\/share\/([0-9a-f-]+)$/i)?.[1] ?? null;

  const refresh = useCallback(async () => {
    setStatus('loading');
    try { setPhotos(await listSharedPhotos()); setStatus('ready'); }
    catch (reason) { setStatus('error'); onToast(reason instanceof Error ? reason.message : 'Paylaşım sunucusuna ulaşılamadı.', 'info'); }
  }, [onToast]);
  useEffect(() => {
    let active = true;
    void listSharedPhotos().then(items => { if (active) { setPhotos(items); setStatus('ready'); } }).catch(reason => { if (active) { setStatus('error'); onToast(reason instanceof Error ? reason.message : 'Paylaşım sunucusuna ulaşılamadı.', 'info'); } });
    return () => { active = false; };
  }, [onToast]);
  useEffect(() => {
    if (status !== 'ready' || !sharedId) return;
    document.getElementById(`shared-${sharedId}`)?.scrollIntoView({ block: 'center' });
  }, [status, sharedId]);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const photo = await uploadSharedPhoto(file, caption);
      setPhotos(current => [photo, ...current.filter(item => item.id !== photo.id)]); setCaption(''); setStatus('ready');
      onToast('Fotoğraf paylaşım alanına yüklendi.');
    } catch (reason) { onToast(reason instanceof Error ? reason.message : 'Fotoğraf yüklenemedi.', 'info'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; if (cameraInput.current) cameraInput.current.value = ''; }
  };
  const edit = async (photo: SharedPhoto) => {
    setBusyId(photo.id);
    try { onEdit(await sharedPhotoFile(photo)); }
    catch (reason) { onToast(reason instanceof Error ? reason.message : 'Fotoğraf editöre aktarılamadı.', 'info'); }
    finally { setBusyId(null); }
  };
  const share = async (photo: SharedPhoto) => {
    const url = sharedPhotoLink(photo);
    try {
      if (navigator.share) { await navigator.share({ title: `${photo.name} · My Vision`, text: photo.caption || 'My Vision paylaşılan fotoğrafı', url }); return; }
      await navigator.clipboard.writeText(url); onToast('Paylaşım bağlantısı kopyalandı.');
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) onToast('Bağlantı paylaşılamadı. Tarayıcı izinlerini kontrol et.', 'info'); }
  };

  return <div className="screen shared-screen page-enter">
    <section className="shared-hero">
      <div><span className="eyebrow">ORTAK ÇALIŞMA ALANI</span><h1>Fotoğraflar.<br />Birlikte güzel.</h1><p>Müşterilerin yüklediği fotoğrafları seç, hafif efektlerle düzenle ve bağlantıyı paylaş.</p></div>
      <span className="shared-hero__icon"><Users size={34} /></span>
    </section>
    <section className="shared-upload" aria-labelledby="shared-upload-title">
      <div className="section-heading"><div><span className="eyebrow">YENİ FOTOĞRAF</span><h2 id="shared-upload-title">Paylaşım alanına ekle</h2></div><Cloud size={22} /></div>
      <p className="tool-note">Bu alana yüklenen fotoğraflar sunucuda saklanır ve galeriyi gören herkese açık olur. Özel projelerin otomatik yüklenmez.</p>
      <input value={caption} onChange={event => setCaption(event.target.value.slice(0,120))} placeholder="Kısa not (isteğe bağlı)" aria-label="Paylaşılan fotoğraf notu" />
      <div className="shared-upload__actions">
        <button className="button button--primary" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}Fotoğraf yükle</button>
        <button className="button button--outline" onClick={() => cameraInput.current?.click()} disabled={uploading}><Camera size={18} />Çek ve yükle</button>
        <button className="icon-button" onClick={() => void refresh()} disabled={uploading || status === 'loading'} aria-label="Paylaşılan fotoğrafları yenile"><RefreshCw size={19} /></button>
      </div>
    </section>
    {status === 'loading' ? <div className="shared-status" role="status"><LoaderCircle className="spin" size={24} /><span>Paylaşılan fotoğraflar yükleniyor</span></div> : status === 'error' ? <div className="shared-status shared-status--error"><Cloud size={28} /><h2>Sunucuya ulaşılamadı</h2><p>Yerel projelerin kullanılabilir. Paylaşım için sunucunun çalıştığını kontrol et.</p><button className="button button--outline" onClick={() => void refresh()}>Tekrar dene</button></div> : photos.length === 0 ? <div className="shared-status"><Images size={32} /><h2>İlk paylaşılan fotoğrafı ekle</h2><p>Galeri veya kamera ile başlayabilirsin.</p></div> : <section className="shared-gallery" aria-label="Paylaşılan fotoğraf galerisi">
      {photos.map(photo => <article className={`shared-card ${sharedId === photo.id ? 'is-shared' : ''}`} id={`shared-${photo.id}`} key={photo.id}>
        <div className="shared-card__image"><img src={photo.url} alt={photo.name} loading="lazy" /></div>
        <div className="shared-card__body"><div><strong>{photo.name}</strong><small>{new Date(photo.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · {(photo.size / 1024 / 1024).toFixed(1)} MB</small></div>{photo.caption && <p>{photo.caption}</p>}
          <div className="shared-card__actions"><button className="button button--primary" onClick={() => void edit(photo)} disabled={busyId !== null}>{busyId === photo.id ? <LoaderCircle className="spin" size={16} /> : <Pencil size={16} />}Seç ve düzenle</button><button className="button button--outline" onClick={() => void share(photo)}><Share2 size={16} />Paylaş</button></div>
        </div>
      </article>)}
    </section>}
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Paylaşım için fotoğraf seç" onChange={event => void upload(event.target.files?.[0])} />
    <input ref={cameraInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Paylaşım için fotoğraf çek" onChange={event => void upload(event.target.files?.[0])} />
  </div>;
}
