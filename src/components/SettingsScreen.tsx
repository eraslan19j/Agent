import { Capacitor } from '@capacitor/core';
import { ChevronLeft, Check, Monitor, Moon, Sun, Circle, RotateCcw, Palette, Layers3, Zap, Play } from 'lucide-react';
import { DEFAULT_PREFERENCES, type AccentPreference, type AppPreferences, type InterfaceStyle, type ThemePreference } from '../lib/preferences';

interface Props {
  preferences: AppPreferences;
  onChange: (preferences: AppPreferences) => void;
  onBack: () => void;
}

const themes: { id: ThemePreference; label: string; description: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Koyu', description: 'Dengeli kontrast', icon: Moon },
  { id: 'amoled', label: 'AMOLED', description: 'Saf siyah', icon: Circle },
  { id: 'light', label: 'Açık', description: 'Gün ışığı', icon: Sun },
  { id: 'system', label: 'Sistem', description: 'Cihazı takip et', icon: Monitor },
];
const accents: { id: AccentPreference; label: string; color: string }[] = [
  { id: 'yellow', label: 'Sarı', color: '#FFC400' }, { id: 'blue', label: 'Mavi', color: '#56A8FF' },
  { id: 'green', label: 'Yeşil', color: '#58D68D' }, { id: 'red', label: 'Kırmızı', color: '#FF6B6B' },
  { id: 'purple', label: 'Mor', color: '#B89CFF' }, { id: 'dynamic', label: 'Dinamik', color: 'conic-gradient(#56A8FF,#B89CFF,#58D68D,#FFC400,#56A8FF)' },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`setting-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

export default function SettingsScreen({ preferences, onChange, onBack }: Props) {
  const update = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => onChange({ ...preferences, [key]: value });
  return <div className="settings-screen screen-enter">
    <header className="settings-header"><button className="icon-btn" onClick={onBack} aria-label="Geri"><ChevronLeft size={22} /></button><div><span className="settings-eyebrow">MY VISION</span><h1>Ayarlar</h1></div><button className="icon-btn" onClick={() => onChange({ ...DEFAULT_PREFERENCES })} aria-label="Görünümü sıfırla"><RotateCcw size={18} /></button></header>
    <div className="settings-scroll">
      <section className="settings-section"><div className="settings-section-title"><Palette size={18} /><div><h2>Görünüm</h2><p>Temayı ve uygulamanın vurgu rengini seç.</p></div></div>
        <div className="theme-options">{themes.map(({ id, label, description, icon: Icon }) => <button key={id} className={`theme-option ${preferences.theme === id ? 'active' : ''}`} onClick={() => update('theme', id)} aria-pressed={preferences.theme === id}><Icon size={19} /><span>{label}</span><small>{description}</small>{preferences.theme === id && <Check size={14} className="theme-check" />}</button>)}</div>
        <div className="accent-options">{accents.map(accent => <button key={accent.id} className={`accent-option ${preferences.accent === accent.id ? 'active' : ''}`} onClick={() => update('accent', accent.id)} aria-label={`${accent.label} vurgu`} aria-pressed={preferences.accent === accent.id} disabled={accent.id === 'dynamic' && !Capacitor.isNativePlatform()} title={accent.id === 'dynamic' && !Capacitor.isNativePlatform() ? 'Dinamik renk Android 12 ve üzerinde kullanılabilir' : accent.label}><span style={{ background: accent.color }} />{preferences.accent === accent.id && <Check size={13} />}<small>{accent.label}</small></button>)}</div>
        <p className="settings-note">Dinamik vurgu, desteklenen Android 12+ cihazlarda sistem rengini kullanır.</p>
      </section>

      <section className="settings-section"><div className="settings-section-title"><Layers3 size={18} /><div><h2>Arayüz</h2><p>Efektleri cihazına ve zevkine göre ayarla.</p></div></div>
        <div className="settings-segmented">{(['glass', 'simple'] as InterfaceStyle[]).map(style => <button key={style} className={preferences.interfaceStyle === style ? 'active' : ''} onClick={() => update('interfaceStyle', style)} aria-pressed={preferences.interfaceStyle === style}>{style === 'glass' ? 'Liquid Glass' : 'Sade'}</button>)}</div>
        <div className="setting-row"><div><strong>Bulanıklığı azalt</strong><span>Arka plan bulanıklığını kapatır; düzenlemeleri etkilemez.</span></div><Switch checked={preferences.reduceBlur} onChange={() => update('reduceBlur', !preferences.reduceBlur)} label="Bulanıklığı azalt" /></div>
        <div className="setting-row"><div><strong>Açılış animasyonu</strong><span>Uygulama hazır olduğunda kısa marka geçişini göster.</span></div><Switch checked={preferences.splashAnimation} onChange={() => update('splashAnimation', !preferences.splashAnimation)} label="Açılış animasyonu" /></div>
      </section>

      <section className="settings-section"><div className="settings-section-title"><Zap size={18} /><div><h2>Performans</h2><p>Düzenleme motoru cihazında çalışır.</p></div></div>
        <div className="settings-facts"><div><span>Önizleme</span><strong>Ekran için ölçekli</strong></div><div><span>Dışa aktarma</span><strong>Kaynak çözünürlüğü</strong></div><div><span>Animasyon</span><strong>Transform + opacity</strong></div></div>
      </section>
      <div className="settings-version"><Play size={13} /><span>My Vision 1.2.0 · Ayarlar anında kaydedilir</span></div>
    </div>
  </div>;
}
