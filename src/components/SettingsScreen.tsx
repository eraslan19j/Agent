import { ChevronLeft, Check, Monitor, Moon, Sun, RotateCcw, Palette, Zap, Languages, Database } from 'lucide-react';
import { DEFAULT_PREFERENCES, type AppPreferences, type ThemePreference } from '../lib/preferences';

interface Props {
  preferences: AppPreferences;
  onChange: (preferences: AppPreferences) => void;
  onBack: () => void;
}

const themes: { id: ThemePreference; label: string; description: string; icon: typeof Moon }[] = [
  { id: 'light', label: 'Açık', description: 'Aydınlık ve nötr', icon: Sun },
  { id: 'dark', label: 'Koyu', description: 'Yüksek kontrast', icon: Moon },
  { id: 'system', label: 'Sistem', description: 'Cihazı takip et', icon: Monitor },
];

export default function SettingsScreen({ preferences, onChange, onBack }: Props) {
  const update = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => onChange({ ...preferences, [key]: value });
  return <div className="settings-screen screen-enter">
    <header className="settings-header"><button className="icon-button" onClick={onBack} aria-label="Geri"><ChevronLeft size={22} /></button><div><span className="settings-eyebrow">MY VISION</span><h1>Ayarlar</h1></div><button className="icon-button" onClick={() => onChange({ ...DEFAULT_PREFERENCES })} aria-label="Görünümü sıfırla"><RotateCcw size={18} /></button></header>
    <div className="settings-scroll">
      <section className="settings-section"><div className="settings-section-title"><Languages size={19} /><div><h2>Dil / Language</h2><p>Uygulama dilini seç. · Choose your app language.</p></div></div>
        <div className="settings-segmented"><button className={preferences.language === 'tr' ? 'active' : ''} onClick={() => update('language', 'tr')} aria-pressed={preferences.language === 'tr'}>Türkçe</button><button className={preferences.language === 'en' ? 'active' : ''} onClick={() => update('language', 'en')} aria-pressed={preferences.language === 'en'}>English</button></div>
      </section>
      <section className="settings-section"><div className="settings-section-title"><Palette size={19} /><div><h2>Görünüm</h2><p>Açık ve koyu tema sistem rengiyle aynı vurguyu kullanır.</p></div></div>
        <div className="theme-options">{themes.map(({ id, label, description, icon: Icon }) => <button key={id} className={`theme-option ${preferences.theme === id ? 'active' : ''}`} onClick={() => update('theme', id)} aria-pressed={preferences.theme === id}><Icon size={20} /><span>{label}</span><small>{description}</small>{preferences.theme === id && <Check size={15} className="theme-check" />}</button>)}</div>
      </section>
      <section className="settings-section"><div className="settings-section-title"><Zap size={19} /><div><h2>Performans</h2><p>Düzenleme motoru cihazında çalışır.</p></div></div>
        <div className="settings-facts"><div><span>Önizleme</span><strong>Ekran için ölçekli</strong></div><div><span>Dışa aktarma</span><strong>En fazla 4096 px</strong></div><div><span>Hareket</span><strong>Sistem tercihine uyumlu</strong></div></div>
      </section>
      <section className="settings-section"><div className="settings-section-title"><Database size={19} /><div><h2>Yerel depolama</h2><p>Projeler ve fotoğraf kopyaları IndexedDB içinde saklanır.</p></div></div><p className="settings-note">Uygulama verilerini silmek veya uygulamayı kaldırmak projeleri de silebilir. Önemli çalışmalarını dışa aktar.</p></section>
      <div className="settings-version">My Vision 1.4.0 · Ayarlar anında kaydedilir</div>
    </div>
  </div>;
}
