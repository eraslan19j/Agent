import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, ExternalLink, RefreshCw, Shuffle, WifiOff, X } from 'lucide-react';
import { fetchDiscoverPhotos, randomDiscoverPage, type DiscoverPhoto } from '../lib/discoverService';
import { ScreenHeader } from './ScreenHeader';

interface DiscoverScreenProps {
  isPro: boolean;
  onUsePhoto: (photo: DiscoverPhoto) => void | boolean | Promise<void | boolean>;
  onPro: () => void;
  onNotifications: () => void;
  busy?: boolean;
}

export function DiscoverScreen({ isPro, onUsePhoto, onPro, onNotifications, busy = false }: DiscoverScreenProps) {
  const [photos, setPhotos] = useState<DiscoverPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DiscoverPhoto | null>(null);
  const [page, setPage] = useState(0);
  const [using, setUsing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage = randomDiscoverPage(), force = false) => {
    const id = ++requestId.current;
    setLoading(true); setError(''); setPage(nextPage);
    try {
      const result = await fetchDiscoverPhotos(nextPage, force);
      if (id === requestId.current) setPhotos(result);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error && reason.name === 'AbortError' ? 'Bağlantı zaman aşımına uğradı. İnternetini kontrol edip yeniden dene.' : 'Fotoğraflar şu anda alınamadı. Bağlantını kontrol edip yeniden dene.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [load]);

  const handleUsePhoto = async () => {
    if (!selected) return;
    setUsing(true);
    try {
      const imported = await onUsePhoto(selected);
      if (imported !== false) setSelected(null);
    } finally { setUsing(false); }
  };

  return (
    <div className="screen discover-screen page-enter">
      <ScreenHeader eyebrow="GERÇEK FOTOĞRAFLAR · YENİ BAKIŞLAR" title="Keşfet" subtitle="Her karıştırmada değişen, kaynağı açıkça belirtilen fotoğraf seçkisi." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <section className="discover-intro glass-panel"><div><span className="eyebrow">SÜREKLİ DEĞİŞEN SEÇKİ</span><h2>Bir sonraki kareni bul.</h2><p>Beğendiğin fotoğrafı stüdyona aktar, düzenle ve kendi görüşünü yarat.</p></div><button className="button button--lime" onClick={() => void load(randomDiscoverPage(page), true)} disabled={loading}><Shuffle size={17} /> Karıştır</button></section>
      <div className="source-note"><span className="source-dot" /> Fotoğraflar <strong>Lorem Picsum</strong> üzerinden yüklenir · Fotoğrafçı adı her kartta belirtilir.</div>
      {error ? <div className="empty-state glass-panel network-error"><WifiOff size={35} /><h2>Seçkiye ulaşılamadı.</h2><p>{error}</p><button className="button button--lime" onClick={() => void load(page || randomDiscoverPage(), true)}><RefreshCw size={17} /> Yeniden dene</button></div>
        : loading && photos.length === 0 ? <div className="discover-grid skeleton-grid" aria-label="Fotoğraflar yükleniyor">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><span /><i /><b /></div>)}</div>
          : <div className={`discover-grid ${loading ? 'is-refreshing' : ''}`}>{photos.map((photo, index) => (
            <button className="discover-card stagger-item" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }} key={`${page}-${photo.id}`} onClick={() => setSelected(photo)}>
              <img src={photo.thumbnailUrl} alt={`${photo.author} tarafından çekilen fotoğraf`} loading="lazy" />
              <span className="discover-card-shade" /><span className="discover-card-open"><ArrowUpRight size={18} /></span>
              <span className="discover-card-caption"><strong>{photo.author}</strong><span>Lorem Picsum · {photo.width} × {photo.height}</span></span>
            </button>
          ))}</div>}
      {!loading && !error && photos.length > 0 && <button className="button button--glass discover-more" onClick={() => void load(randomDiscoverPage(page), true)}><Shuffle size={18} /> Başka fotoğraflar göster</button>}
      {selected && <div className="modal-backdrop" onClick={() => !using && setSelected(null)}><div className="discover-detail glass-modal" role="dialog" aria-modal="true" aria-label={`${selected.author} fotoğrafı`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={() => setSelected(null)} disabled={using} aria-label="Kapat"><X size={20} /></button>
        <img className="discover-detail-image" src={selected.fullUrl} alt={`${selected.author} tarafından çekilen fotoğraf`} />
        <div className="discover-detail-copy"><span className="eyebrow">FOTOĞRAFÇI</span><h2>{selected.author}</h2><p>{selected.width} × {selected.height} orijinal piksel · Lorem Picsum</p></div>
        <button className="button button--lime button-large" onClick={() => void handleUsePhoto()} disabled={using || busy}>{using || busy ? <><RefreshCw size={19} className="spin" /> Fotoğraf hazırlanıyor…</> : <><ArrowDownToLine size={19} /> Düzenlemeye aktar <ArrowUpRight size={18} /></>}</button>
        <a className="photo-attribution" href={selected.sourceUrl} target="_blank" rel="noreferrer">Kaynak sayfasını aç <ExternalLink size={13} /></a>
        <p className="license-note">Kullanmadan önce kaynak sayfasındaki güncel kullanım koşullarını kontrol et.</p>
      </div></div>}
    </div>
  );
}
