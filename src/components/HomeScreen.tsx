import { ArrowRight, Camera, ChevronRight, Crown, FolderOpen, ImagePlus, Sparkles, WandSparkles } from 'lucide-react';
import { PRESETS } from '../data/presets';
import { SAMPLE_PROJECTS } from '../data/samples';
import { buildCssFilter } from '../lib/imageEngine';
import type { EditorSession, PhotoProject } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface HomeScreenProps {
  projects: PhotoProject[];
  isPro: boolean;
  onOpen: (session: EditorSession) => void;
  onCreate: () => void;
  onCamera: () => void;
  onAuto: () => void;
  onPro: () => void;
  onProjects: () => void;
  onPreset: (presetId: string) => void;
  onNotifications: () => void;
}

const hour = new Date().getHours();
const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

export function HomeScreen({ projects, isPro, onOpen, onCreate, onCamera, onAuto, onPro, onProjects, onPreset, onNotifications }: HomeScreenProps) {
  const recent = [...projects, ...SAMPLE_PROJECTS].slice(0, 4);
  return (
    <div className="screen home-screen page-enter">
      <ScreenHeader
        eyebrow="MY VISION STUDIO"
        title={`${greeting}, yaratıcı.`}
        subtitle="Bugün hangi hikâyeyi anlatmak istersin?"
        isPro={isPro}
        onPro={onPro}
        onNotifications={onNotifications}
      />

      <section className="hero-card">
        <img src="/images/santorini.jpg" alt="Gün batımında Santorini" />
        <div className="hero-card__shade" />
        <div className="hero-card__content">
          <span className="glass-label"><Sparkles size={13} /> YENİ NESİL FOTOĞRAF STÜDYOSU</span>
          <h2>Her kare,<br /><em>senin imzan.</em></h2>
          <p>Profesyonel görünümler. Hassas kontroller.<br />Sınırsız yaratıcılık.</p>
          <button className="button button--lime" onClick={onCreate}>Fotoğrafını dönüştür <ArrowRight size={18} /></button>
        </div>
        <div className="hero-card__meta"><span>01</span><i /><span>EGE SERİSİ</span></div>
      </section>

      <section className="quick-section">
        <div className="section-heading"><div><span className="eyebrow">HIZLI BAŞLANGIÇ</span><h2>Nasıl başlayalım?</h2></div></div>
        <div className="quick-grid">
          <button className="quick-card" onClick={onCreate}>
            <span className="quick-card__icon quick-card__icon--lime"><ImagePlus size={22} /></span>
            <span><strong>Fotoğraf düzenle</strong><small>Galerinden bir kare seç</small></span>
            <ChevronRight size={17} />
          </button>
          <button className="quick-card" onClick={onAuto}>
            <span className="quick-card__icon quick-card__icon--violet"><WandSparkles size={22} /></span>
            <span><strong>Otomatik iyileştir</strong><small>Dengeli tonlar, tek dokunuş</small></span>
            <ChevronRight size={17} />
          </button>
          <button className="quick-card" onClick={onCamera}>
            <span className="quick-card__icon quick-card__icon--blue"><Camera size={22} /></span>
            <span><strong>Fotoğraf çek</strong><small>Anı yakala, hemen düzenle</small></span>
            <ChevronRight size={17} />
          </button>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div><span className="eyebrow">KALDIĞIN YERDEN</span><h2>Son projeler</h2></div>
          <button className="text-button" onClick={onProjects}>Tümünü gör <ArrowRight size={15} /></button>
        </div>
        <div className="recent-grid">
          {recent.map((project) => (
            <button className="project-card" key={project.id} onClick={() => onOpen({ source: project.source, name: project.name, projectId: project.id, initialSettings: project.settings })}>
              <div className="project-card__image">
                <img src={project.thumbnail || project.source} alt={project.name} style={{ filter: project.thumbnail ? undefined : buildCssFilter(project.settings) }} />
                <span className="project-card__open"><FolderOpen size={17} /></span>
              </div>
              <strong>{project.name}</strong>
              <small>{project.isSample ? 'Örnek proje' : 'Cihazına kaydedildi'}</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading"><div><span className="eyebrow">TEK DOKUNUŞLA</span><h2>İmza görünümler</h2></div></div>
        <div className="preset-showcase">
          {PRESETS.slice(1, 7).map((preset) => (
            <button className="preset-showcase__card" key={preset.id} onClick={() => onPreset(preset.id)}>
              <img src={preset.image} alt={preset.name} style={{ filter: buildCssFilter({ ...SAMPLE_PROJECTS[0].settings, presetId: preset.id, intensity: 100 }) }} />
              <span className="preset-showcase__shade" />
              {preset.pro && !isPro && <span className="preset-showcase__lock"><Crown size={12} /> PRO</span>}
              <span className="preset-showcase__name">{preset.name}<small>{preset.category}</small></span>
            </button>
          ))}
        </div>
      </section>

      {!isPro && (
        <button className="pro-banner" onClick={onPro}>
          <span className="pro-banner__icon"><Crown size={25} /></span>
          <span><small>MY VISION PRO</small><strong>Vizyonunu sınırlama.</strong><p>Tüm görünümler, filtreler ve 4K dışa aktarma.</p></span>
          <span className="pro-banner__action">7 gün ücretsiz <ArrowRight size={16} /></span>
        </button>
      )}
      <p className="privacy-note"><span /> Fotoğrafların cihazından dışarı gönderilmez.</p>
    </div>
  );
}
