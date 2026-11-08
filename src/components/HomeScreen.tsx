import { ArrowRight, Camera, Folder, ImagePlus, LayoutGrid, ListChecks, ShieldCheck, WandSparkles } from 'lucide-react';
import type { PhotoProject } from '../types';
import { Brand } from './Brand';

interface HomeScreenProps {
  projects: PhotoProject[];
  onOpen: (project: PhotoProject) => void;
  onCreate: () => void;
  onCamera: () => void;
  onAuto: () => void;
  onProjects: () => void;
  onCollage: () => void;
  onBatch: () => void;
}

export function HomeScreen({ projects, onOpen, onCreate, onCamera, onAuto, onProjects, onCollage, onBatch }: HomeScreenProps) {
  return (
    <div className="screen home-screen page-enter">
      <header className="home-header"><Brand /></header>
      <section className="home-hero">
        <span className="eyebrow">FOTOĞRAF STÜDYOSU</span>
        <h1>Fotoğrafların.<br />Senin tarzın.</h1>
        <p>Görünümler, hassas renk kontrolleri ve kolaj araçlarıyla fotoğraflarını cihazında düzenle.</p>
        <div className="hero-actions">
          <button className="button button--primary button-large" onClick={onCreate}><ImagePlus size={20} /> Fotoğraf seç</button>
          <button className="button button--secondary button-large" onClick={onCamera}><Camera size={19} /> Fotoğraf çek</button>
        </div>
      </section>

      <section className="quick-section" aria-labelledby="quick-title">
        <div className="section-heading"><div><span className="eyebrow">ARAÇLAR</span><h2 id="quick-title">Nasıl başlamak istersin?</h2></div></div>
        <div className="quick-grid">
          <button className="quick-card" onClick={onAuto}><WandSparkles size={22} /><span><strong>Otomatik iyileştir</strong><small>Dengeli ışık ve renkle başla</small></span><ArrowRight size={17} /></button>
          <button className="quick-card" onClick={onCollage}><LayoutGrid size={22} /><span><strong>Kolaj oluştur</strong><small>2–6 fotoğrafı bir araya getir</small></span><ArrowRight size={17} /></button>
          <button className="quick-card" onClick={onBatch}><ListChecks size={22} /><span><strong>Toplu işlem</strong><small>Aynı ayarı 12 fotoğrafa uygula</small></span><ArrowRight size={17} /></button>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className="first-project">
          <div><span className="eyebrow">İLK PROJEN</span><h2>Çalışmaların burada görünecek.</h2><p>Kaydettiğin projeler yalnızca bu cihazda saklanır.</p></div>
          <button className="button button--primary" onClick={onCreate}><ImagePlus size={18} /> Fotoğraf ekle</button>
        </section>
      ) : (
        <section className="section-block recent-section">
          <div className="section-heading"><div><span className="eyebrow">SON ÇALIŞMALAR</span><h2>Kaldığın yerden devam et.</h2></div><button className="text-button" onClick={onProjects}><Folder size={16} /> Tümünü gör</button></div>
          <div className="recent-grid">
            {projects.slice(0, 4).map((project) => (
              <button className="recent-card" key={project.id} onClick={() => onOpen(project)}>
                <div className="recent-image"><img src={project.thumbnail || project.source} alt={project.name} /><span className="project-open"><ArrowRight size={18} /></span><span className="project-time">{new Date(project.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span></div>
                <div className="recent-meta"><strong>{project.name}</strong><span>{project.settings.presetId === 'original' ? 'Orijinal' : 'Düzenlendi'}{project.settings.rotation ? ` · ${project.settings.rotation}°` : ''}</span></div>
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="privacy-note"><ShieldCheck size={15} /> Fotoğrafların ve projelerin yalnızca bu cihazda saklanır.</p>
    </div>
  );
}
