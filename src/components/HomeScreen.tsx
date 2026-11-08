import { ArrowUpRight, Camera, Crown, Folder, ImagePlus, Images, LayoutGrid, ListChecks, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import type { PhotoProject } from '../types';
import { MyVisionLogo } from './MyVisionLogo';

interface HomeScreenProps {
  projects: PhotoProject[];
  isPro: boolean;
  onOpen: (project: PhotoProject) => void;
  onCreate: () => void;
  onCamera: () => void;
  onAuto: () => void;
  onPro: () => void;
  onProjects: () => void;
  onDiscover: () => void;
  onCollage: () => void;
  onBatch: () => void;
}

export function HomeScreen({ projects, isPro, onOpen, onCreate, onCamera, onAuto, onPro, onProjects, onDiscover, onCollage, onBatch }: HomeScreenProps) {
  return (
    <div className="screen home-screen page-enter">
      <header className="home-header">
        <MyVisionLogo variant="wordmark" size={40} className="home-wordmark" />
        <button className="avatar-button glass-button" onClick={onPro} aria-label="My Vision Pro">{isPro ? <Crown size={18} /> : 'MV'}</button>
      </header>
      <section className="home-hero glass-hero">
        <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
        <div className="hero-content">
          <span className="glass-label"><Sparkles size={13} /> MOBİL FOTOĞRAF STÜDYON</span>
          <h1>Görüşünü<br /><em>özgür bırak.</em></h1>
          <p>Işığı, rengi ve dokuyu tek dokunuşla yeniden şekillendir.</p>
          <div className="hero-actions">
            <button className="button button--lime button-large" onClick={onCreate}><ImagePlus size={20} /> Yeni çalışma <ArrowUpRight size={18} /></button>
            <button className="button button--glass button-large" onClick={onDiscover}><Images size={18} /> Keşfet</button>
          </div>
        </div>
        <div className="hero-monogram" aria-hidden="true"><MyVisionLogo size={128} /></div>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><span className="eyebrow">HIZLI BAŞLANGIÇ</span><h2>Nasıl yaratmak istersin?</h2></div></div>
        <div className="quick-grid">
          <button className="quick-card glass-panel" onClick={onCreate}><span className="quick-card__icon quick-card__icon--lime"><ImagePlus size={21} /></span><span><strong>Galeriden seç</strong><small>Kendi fotoğrafınla başla</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-card glass-panel" onClick={onCamera}><span className="quick-card__icon quick-card__icon--violet"><Camera size={21} /></span><span><strong>Fotoğraf çek</strong><small>Anı yakala, anında düzenle</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-card glass-panel" onClick={onAuto}><span className="quick-card__icon quick-card__icon--blue"><WandSparkles size={21} /></span><span><strong>Otomatik iyileştir</strong><small>Dengeli bir başlangıç yap</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-card glass-panel" onClick={onCollage}><span className="quick-card__icon quick-card__icon--lime"><LayoutGrid size={21} /></span><span><strong>Kolaj oluştur</strong><small>Story, Post ve Kapak</small></span><ArrowUpRight size={16} /></button>
          <button className="quick-card glass-panel" onClick={onBatch}><span className="quick-card__icon quick-card__icon--violet"><ListChecks size={21} /></span><span><strong>Toplu işlem</strong><small>Tarif, filigran ve çıktı</small></span><ArrowUpRight size={16} /></button>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className="first-project glass-panel">
          <div className="empty-visual"><MyVisionLogo size={58} /></div>
          <div><span className="eyebrow">İLK KARENİ SEÇ</span><h2>Stüdyon seni bekliyor.</h2><p>Örnek projeler değil, yalnızca kendi çalışmaların burada görünür.</p></div>
          <button className="button button--lime" onClick={onCreate}><ImagePlus size={18} /> Fotoğraf ekle</button>
        </section>
      ) : (
        <section className="section-block recent-section">
          <div className="section-heading"><div><span className="eyebrow">SON ÇALIŞMALAR</span><h2>Kaldığın yerden.</h2></div><button className="text-button" onClick={onProjects}><Folder size={15} /> Tümünü gör</button></div>
          <div className="recent-grid">
            {projects.slice(0, 4).map((project, index) => (
              <button className="recent-card stagger-item" style={{ animationDelay: `${index * 55}ms` }} key={project.id} onClick={() => onOpen(project)}>
                <div className="recent-image"><img src={project.thumbnail || project.source} alt={project.name} /><span className="project-open"><ArrowUpRight size={18} /></span><span className="project-time">{new Date(project.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span></div>
                <div className="recent-meta"><strong>{project.name}</strong><span>{project.settings.presetId === 'original' ? 'Orijinal' : 'Düzenlendi'}{project.settings.rotation ? ` · ${project.settings.rotation}°` : ''}</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!isPro && <button className="pro-banner glass-panel" onClick={onPro}><span className="pro-banner__icon"><Crown size={22} /></span><span><small>MY VISION PRO</small><strong>Sınırları kaldır.</strong><p>Tüm görünümler, Pro araçlar ve 4K dışa aktarma.</p></span><span className="pro-banner__action">Pro’yu keşfet <ArrowUpRight size={17} /></span></button>}
      <p className="privacy-note"><ShieldCheck size={13} /><span /> Fotoğrafların ve projelerin yalnızca bu cihazda saklanır.</p>
    </div>
  );
}
