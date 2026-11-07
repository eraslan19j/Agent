import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowUpRight, ExternalLink, LoaderCircle, RefreshCw, Shuffle, WifiOff, X } from 'lucide-react';
import { fetchDiscoverPhotos, randomDiscoverPage, type DiscoverPhoto } from '../lib/discoverService';
import { ScreenHeader } from './ScreenHeader';

interface DiscoverScreenProps {
  isPro: boolean;
  onUsePhoto: (photo: DiscoverPhoto) => Promise<void>;
  onCancelImport: () => void;
  onOverlayChange: (open: boolean) => void;
  registerCloseHandler: (handler: (() => void) | null) => void;
  onPro: () => void;
  onNotifications: () => void;
  busy?: boolean;
}

export function DiscoverScreen({ isPro, onUsePhoto, onCancelImport, onOverlayChange, registerCloseHandler, onPro, onNotifications, busy = false }: DiscoverScreenProps) {
  const [photos, setPhotos] = useState<DiscoverPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DiscoverPhoto | null>(null);
  const [page, setPage] = useState(0);
  const [using, setUsing] = useState(false);
  const [importError, setImportError] = useState('');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (nextPage = randomDiscoverPage(), force = false) => {
    const id = ++requestId.current;
    setLoading(true); setError(''); setPage(nextPage);
    try {
      const result = await fetchDiscoverPhotos(nextPage, force);
      if (id === requestId.current && mounted.current) setPhotos(result);
    } catch (reason) {
      if (id === requestId.current && mounted.current) setError(reason instanceof Error && reason.name === 'AbortError' ? 'Bağlantı zaman aşımına uğradı. İnternetini kontrol edip yeniden dene.' : 'Fotoğraflar şu anda alınamadı. Bağlantını kontrol edip yeniden dene.');
    } finally {
      if (id === requestId.current && mounted.current) setLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    onCancelImport();
    setSelected(null);
    setUsing(false);
    setImportError('');
    setPreviewLoaded(false);
    onOverlayChange(false);
  }, [onCancelImport, onOverlayChange]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
      mounted.current = false;
      onCancelImport();
      onOverlayChange(false);
    };
  }, [load, onCancelImport, onOverlayChange]);

  useEffect(() => {
    registerCloseHandler(closeDetail);
    return () => registerCloseHandler(null);
  }, [closeDetail, registerCloseHandler]);

  useEffect(() => {
    if (!selected) return;
    detailRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, closeDetail]);

  const openDetail = (photo: DiscoverPhoto) => {
    setImportError('');
    setPreviewLoaded(false);
    setSelected(photo);
    onOverlayChange(true);
  };

  const handleUsePhoto = async () => {
    if (!selected || using) return;
    setUsing(true);
    setImportError('');
    try {
      await onUsePhoto(selected);
      if (mounted.current) closeDetail();
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setUsing(false);
        return;
      }
      setImportError(reason instanceof Error ? reason.message : 'Fotoğraf aktarılamadı. Bağlantını kontrol edip tekrar dene.');
    } finally {
      if (mounted.current) setUsing(false);
    }
  };

  return (
    <div className="screen discover-screen page-enter">
      <ScreenHeader eyebrow="GERÇEK FOTOĞRAFLAR · YENİ BAKIŞLAR" title="Keşfet" subtitle="Her karıştırmada değişen, kaynağı açıkça belirtilen fotoğraf seçkisi." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <section className="discover-intro glass-panel"><div><span className="eyebrow">SÜREKLİ DEĞİŞEN SEÇKİ</span><h2>Bir sonraki kareni bul.</h2><p>Beğendiğin fotoğrafı stüdyona aktar, düzenle ve kendi görüşünü yarat.</p></div><button className="button button--lime" onClick={() => void load(randomDiscoverPage(page), true)} disabled={loading}><Shuffle size={17} /> Karıştır</button></section>
      <div className="source-note"><span className="source-dot" /> Fotoğraflar <strong>Lorem Picsum</strong> üzerinden yüklenir · Fotoğrafçı adı her kartta belirtilir.</div>
      {error ? <div className="empty-state glass-panel network-error"><WifiOff size={35} /><h2>Seçkiye ulaşılamadı.</h2><p>{error}</p><button className="button button--lime" onClick={() => void load(page || randomDiscoverPage(), true)}><RefreshCw size={17} /> Yeniden dene</button></div>
        : loading && photos.length === 0 ? <div className="discover-grid skeleton-grid" aria-label="Fotoğraflar yükleniyor">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><span /><i /><b /></div>)}</div>
          : <div className={`discover-grid ${loading ? 'is-refreshing' : ''}`}>{photos.map((photo, index) => (
            <button className="discover-card stagger-item" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }} key={`${page}-${photo.id}`} onClick={() => openDetail(photo)} aria-label={`${photo.author} fotoğrafını önizle`}>
              <img src={photo.thumbnailUrl} alt={`${photo.author} tarafından çekilen fotoğraf`} loading="lazy" />
              <span className="discover-card-shade" /><span className="discover-card-open"><ArrowUpRight size={18} /></span>
              <span className="discover-card-caption"><strong>{photo.author}</strong><span>Lorem Picsum · {photo.width} × {photo.height}</span></span>
            </button>
          ))}</div>}
      {!loading && !error && photos.length > 0 && <button className="button button--glass discover-more" onClick={() => void load(randomDiscoverPage(page), true)}><Shuffle size={18} /> Başka fotoğraflar göster</button>}
      {selected && createPortal(
        <div className="modal-backdrop discover-backdrop" onClick={closeDetail}>
          <div className="discover-detail glass-modal" role="dialog" aria-modal="true" aria-labelledby="discover-detail-title" tabIndex={-1} ref={detailRef} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close icon-button" onClick={closeDetail} aria-label="Önizlemeyi kapat"><X size={20} /></button>
            <div className="discover-detail-media">
              <img className="discover-detail-image" src={selected.fullUrl} alt={`${selected.author} tarafından çekilen fotoğraf`} onLoad={() => setPreviewLoaded(true)} onError={() => { setPreviewLoaded(true); setImportError('Fotoğraf önizlemesi yüklenemedi. Bağlantını kontrol edip tekrar dene.'); }} />
              {!previewLoaded && <span className="discover-preview-loading"><LoaderCircle className="spin" size={23} /> Önizleme yükleniyor</span>}
            </div>
            <div className="discover-detail-copy"><span className="eyebrow">FOTOĞRAFÇI</span><h2 id="discover-detail-title">{selected.author}</h2><p>{selected.width} × {selected.height} orijinal piksel · Lorem Picsum</p></div>
            {importError && <p className="discover-import-error" role="alert">{importError}</p>}
            <button className="button button--lime button-large" onClick={() => void handleUsePhoto()} disabled={using || busy}>
              {using || busy ? <><LoaderCircle size={19} className="spin" /> Fotoğraf hazırlanıyor…</> : importError ? <><RefreshCw size={19} /> Tekrar dene</> : <><ArrowDownToLine size={19} /> Düzenlemeye aktar <ArrowUpRight size={18} /></>}
            </button>
            <a className="photo-attribution" href={selected.sourceUrl} target="_blank" rel="noreferrer">Kaynak sayfasını aç <ExternalLink size={13} /></a>
            <p className="license-note">Kullanmadan önce kaynak sayfasındaki güncel kullanım koşullarını kontrol et.</p>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
