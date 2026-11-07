import { useMemo, useState } from 'react';
import { ArrowUpRight, Crown, Search, Sparkles, X } from 'lucide-react';
import { GALLERY } from '../data/samples';
import { getPreset } from '../data/presets';
import { buildCssFilter, freshSettings } from '../lib/imageEngine';
import type { EditorSession } from '../types';
import { ScreenHeader } from './ScreenHeader';

const categories = ['Tümü', 'Portre', 'Sinema', 'Seyahat', 'Siyah Beyaz'];

interface DiscoverScreenProps {
  isPro: boolean;
  onOpen: (session: EditorSession) => void;
  onPro: () => void;
  onNotifications: () => void;
}

export function DiscoverScreen({ isPro, onOpen, onPro, onNotifications }: DiscoverScreenProps) {
  const [category, setCategory] = useState('Tümü');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => GALLERY.filter((item) =>
    (category === 'Tümü' || item.category === category) &&
    `${item.title} ${item.category}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')),
  ), [category, query]);

  return (
    <div className="screen discover-screen page-enter">
      <ScreenHeader eyebrow="İLHAM PANOSU" title="Bak. Keşfet. Yarat." subtitle="Editör seçkileriyle kendi görsel dilini bul." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <div className="discover-tools">
        <label className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Görünüm veya stil ara" aria-label="Keşfette ara" />{query && <button onClick={() => setQuery('')} aria-label="Aramayı temizle"><X size={16} /></button>}</label>
      </div>
      <div className="chip-row" role="tablist" aria-label="Kategoriler">
        {categories.map((item) => <button role="tab" aria-selected={category === item} className={category === item ? 'chip active' : 'chip'} key={item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="discover-feature">
        <div><span className="eyebrow"><Sparkles size={13} /> HAFTANIN SEÇKİSİ</span><h2>Altın saatin<br /><em>büyüsünü</em> yakala.</h2><p>Günün en yumuşak ışığını altı özel görünümle yeniden yarat.</p></div>
        <img src="/images/beach.jpg" alt="Altın saatte kıyı" />
      </div>
      <div className="section-heading"><div><span className="eyebrow">EDITÖRÜN SEÇİMİ</span><h2>{category === 'Tümü' ? 'Sana ilham versin' : category}</h2></div><span className="result-count">{filtered.length} çalışma</span></div>
      {filtered.length ? (
        <div className="inspiration-grid">
          {filtered.map((item) => {
            const preset = getPreset(item.presetId);
            return (
              <button className={`inspiration-card inspiration-card--${item.size}`} key={item.id} onClick={() => { if (preset.pro && !isPro) { onPro(); return; } onOpen({ source: item.image, name: item.title, initialSettings: { ...freshSettings(), presetId: item.presetId } }); }}>
                <img src={item.image} alt={item.title} style={{ filter: buildCssFilter({ ...freshSettings(), presetId: item.presetId }) }} />
                <span className="inspiration-card__overlay" />
                <span className="inspiration-card__top">{preset.pro && !isPro ? <i><Crown size={12} /> PRO</i> : <i>{item.category}</i>}<b><ArrowUpRight size={18} /></b></span>
                <span className="inspiration-card__bottom"><strong>{item.title}</strong><small>{preset.name} görünümüyle dene</small></span>
              </button>
            );
          })}
        </div>
      ) : <div className="empty-state"><Search size={32} /><h3>Sonuç bulunamadı</h3><p>Başka bir kelime veya kategori deneyebilirsin.</p><button className="button button--outline" onClick={() => { setQuery(''); setCategory('Tümü'); }}>Filtreleri temizle</button></div>}
    </div>
  );
}
