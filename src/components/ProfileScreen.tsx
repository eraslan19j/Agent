import { ChevronRight, CircleHelp, CloudOff, FileText, Folder, Image, Languages, Settings2, ShieldCheck } from 'lucide-react';
import type { PhotoProject } from '../types';
import { ScreenHeader } from './ScreenHeader';

export type InfoTopic = 'privacy' | 'help' | 'about' | 'language' | 'credits';

interface ProfileScreenProps {
  projects: PhotoProject[];
  onInfo: (topic: InfoTopic) => void;
  onSettings: () => void;
}

export function ProfileScreen({ projects, onInfo, onSettings }: ProfileScreenProps) {
  const edits = projects.filter((project) => project.settings.presetId !== 'original').length;
  return (
    <div className="screen profile-screen page-enter">
      <ScreenHeader eyebrow="SENİN ALANIN" title="Profil" subtitle="Yerel stüdyonu ve tercihlerini yönet." />
      <section className="profile-card">
        <div className="profile-avatar"><span>MV</span></div>
        <div className="profile-card__identity"><h2>Yerel stüdyo</h2><p>Hesap gerekmez · Fotoğraflar bu cihazda</p></div>
        <span className="profile-card__status"><i /> Çevrimdışı hazır</span>
      </section>
      <section className="stats-grid" aria-label="Proje özeti">
        <div><span><Folder size={20} /></span><strong>{projects.length}</strong><small>Kayıtlı proje</small></div>
        <div><span><Image size={20} /></span><strong>{edits}</strong><small>Görünüm uygulandı</small></div>
        <div><span><Image size={20} /></span><strong>{new Set(projects.map((project) => project.settings.presetId)).size}</strong><small>Farklı stil</small></div>
      </section>
      <section className="settings-section">
        <span className="eyebrow">STÜDYO AYARLARI</span>
        <div className="settings-card">
          <button onClick={onSettings}><span className="settings-icon"><Settings2 size={19} /></span><span><strong>Görünüm ve uygulama</strong><small>Açık/koyu tema ve performans</small></span><ChevronRight size={17} /></button>
          <button onClick={onSettings}><span className="settings-icon"><Languages size={19} /></span><span><strong>Dil / Language</strong><small>Uygulama dili · App language</small></span><b>TR / EN</b><ChevronRight size={17} /></button>
          <button onClick={() => onInfo('privacy')}><span className="settings-icon"><ShieldCheck size={19} /></span><span><strong>Gizlilik ve veriler</strong><small>Fotoğraflarının kontrolü sende</small></span><ChevronRight size={17} /></button>
        </div>
      </section>
      <section className="settings-section">
        <span className="eyebrow">DESTEK</span>
        <div className="settings-card">
          <button onClick={() => onInfo('help')}><span className="settings-icon"><CircleHelp size={19} /></span><span><strong>Yardım merkezi</strong><small>Sık sorulan sorular ve ipuçları</small></span><ChevronRight size={17} /></button>
          <button onClick={() => onInfo('about')}><span className="settings-icon"><FileText size={19} /></span><span><strong>My Vision hakkında</strong><small>Sürüm 1.4.0 · koşullar ve lisanslar</small></span><ChevronRight size={17} /></button>
        </div>
      </section>
      <div className="local-storage-note"><CloudOff size={18} /><span><strong>Bulut değil, cihaz.</strong> Orijinal fotoğrafların ve projelerin yalnızca bu cihazda saklanır.</span></div>
      <button className="credits-link" onClick={() => onInfo('credits')}>Açık kaynak notları</button>
    </div>
  );
}
