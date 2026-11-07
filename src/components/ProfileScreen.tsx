import { ArrowRight, Bell, ChevronRight, CircleHelp, CloudOff, Crown, FileText, Folder, Heart, Image, Languages, RotateCcw, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { PhotoProject } from '../types';
import { ScreenHeader } from './ScreenHeader';

export type InfoTopic = 'privacy' | 'help' | 'about' | 'language' | 'notifications' | 'credits';

interface ProfileScreenProps {
  projects: PhotoProject[];
  isPro: boolean;
  onPro: () => void;
  onInfo: (topic: InfoTopic) => void;
  onNotifications: () => void;
  onRestore: () => void;
}

export function ProfileScreen({ projects, isPro, onPro, onInfo, onNotifications, onRestore }: ProfileScreenProps) {
  const edits = projects.reduce((count, project) => count + (project.settings.presetId === 'original' ? 0 : 1), 0);
  return (
    <div className="screen profile-screen page-enter">
      <ScreenHeader eyebrow="SENİN ALANIN" title="Profil" subtitle="Stüdyonu ve aboneliğini yönet." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <section className="profile-card">
        <div className="profile-avatar"><span>V</span><i /></div>
        <div className="profile-card__identity"><h2>Vision Creator <span>{isPro ? 'PRO' : 'FREE'}</span></h2><p>Yerel stüdyo · Türkiye</p></div>
        <span className="profile-card__status"><i /> Çevrimdışı hazır</span>
      </section>
      <section className="stats-grid">
        <div><span><Folder size={20} /></span><strong>{projects.length}</strong><small>Kayıtlı proje</small></div>
        <div><span><Image size={20} /></span><strong>{edits}</strong><small>Görünüm uygulandı</small></div>
        <div><span><Heart size={20} /></span><strong>{new Set(projects.map((project) => project.settings.presetId)).size}</strong><small>Farklı stil</small></div>
      </section>
      {!isPro ? <button className="profile-pro-card" onClick={onPro}><div className="profile-pro-card__glow" /><span className="profile-pro-card__crown"><Crown size={26} /></span><span><small>MY VISION PRO</small><strong>Her pikselde daha fazlası.</strong><p>Tüm görünümleri ve 4K çıktıyı aç.</p></span><span className="button button--lime button--small">Pro’yu keşfet <ArrowRight size={16} /></span></button> : <section className="active-plan"><span><Crown size={24} /></span><div><small>MY VISION PRO</small><strong>Yaratıcılığının önünde sınır yok.</strong><p>Tüm premium özellikler bu cihazda açık.</p></div><Sparkles size={25} /></section>}
      <section className="settings-section">
        <span className="eyebrow">STÜDYO AYARLARI</span>
        <div className="settings-card">
          <button onClick={() => onInfo('language')}><span className="settings-icon"><Languages size={19} /></span><span><strong>Dil</strong><small>Uygulama dili</small></span><b>Türkçe</b><ChevronRight size={17} /></button>
          <button onClick={() => onInfo('notifications')}><span className="settings-icon"><Bell size={19} /></span><span><strong>Bildirimler</strong><small>Yeni görünümler ve ipuçları</small></span><b>Uygulama içi</b><ChevronRight size={17} /></button>
          <button onClick={() => onInfo('privacy')}><span className="settings-icon"><ShieldCheck size={19} /></span><span><strong>Gizlilik ve veriler</strong><small>Fotoğraflarının kontrolü sende</small></span><ChevronRight size={17} /></button>
        </div>
      </section>
      <section className="settings-section">
        <span className="eyebrow">DESTEK</span>
        <div className="settings-card">
          <button onClick={() => onInfo('help')}><span className="settings-icon"><CircleHelp size={19} /></span><span><strong>Yardım merkezi</strong><small>Sık sorulan sorular ve ipuçları</small></span><ChevronRight size={17} /></button>
          <button onClick={() => onInfo('about')}><span className="settings-icon"><FileText size={19} /></span><span><strong>My Vision hakkında</strong><small>Sürüm 1.2.0 · koşullar ve lisanslar</small></span><ChevronRight size={17} /></button>
          <a href="mailto:support@myvision.app?subject=My%20Vision%20geri%20bildirim"><span className="settings-icon"><Star size={19} /></span><span><strong>Geri bildirim gönder</strong><small>Birlikte daha iyiye taşıyalım</small></span><ChevronRight size={17} /></a>
          {isPro && <button onClick={onRestore}><span className="settings-icon"><RotateCcw size={19} /></span><span><strong>Satın alımı geri yükle</strong><small>Mevcut Google Play aboneliğini doğrula</small></span><ChevronRight size={17} /></button>}
        </div>
      </section>
      <div className="local-storage-note"><CloudOff size={18} /><span><strong>Bulut değil, cihaz.</strong> Orijinal fotoğrafların ve projelerin yalnızca bu cihazda saklanır.</span></div>
      <button className="credits-link" onClick={() => onInfo('credits')}>Fotoğraf kredileri ve açık kaynak notları</button>
    </div>
  );
}
