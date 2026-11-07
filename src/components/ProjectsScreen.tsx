import { useMemo, useState } from 'react';
import { ArrowUpRight, Clock, FolderOpen, ImagePlus, LayoutGrid, Search, Trash2 } from 'lucide-react';
import type { PhotoProject } from '../types';
import { MyVisionLogo } from './MyVisionLogo';
import { ScreenHeader } from './ScreenHeader';

type SortMode = 'recent' | 'name' | 'created';
interface ProjectsScreenProps {
  projects: PhotoProject[];
  isPro: boolean;
  onOpen: (project: PhotoProject) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onPro: () => void;
  onNotifications: () => void;
}

export function ProjectsScreen({ projects, isPro, onOpen, onCreate, onDelete, onPro, onNotifications }: ProjectsScreenProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const visible = useMemo(() => projects.filter((p) => p.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'tr') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt), [projects, query, sort]);
  return (
    <div className="screen projects-screen page-enter">
      <ScreenHeader eyebrow="KİŞİSEL ARŞİVİN" title="Projeler" subtitle="Yalnızca senin çalışmaların. Bu cihazda, senin kontrolünde." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <div className="project-summary glass-panel"><span className="summary-icon"><FolderOpen size={24} /></span><div><strong>{projects.length}</strong><span>kayıtlı çalışma</span></div><button className="button button--lime button--small" onClick={onCreate}><ImagePlus size={17} /> Yeni proje</button></div>
      {projects.length > 0 && <>
        <label className="search-field glass-field"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Projelerinde ara" /></label>
        <div className="project-controls"><span><LayoutGrid size={15} /> {visible.length} proje</span><select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="Projeleri sırala"><option value="recent">Son düzenlenen</option><option value="created">Oluşturulma</option><option value="name">İsim</option></select></div>
      </>}
      {visible.length > 0 ? <div className="projects-grid">{visible.map((project, index) => (
        <article className="library-card stagger-item" style={{ animationDelay: `${Math.min(index * 45, 300)}ms` }} key={project.id}>
          <button className="library-card__image" onClick={() => onOpen(project)}><img src={project.thumbnail || project.source} alt={project.name} /><span className="library-card__badge">CİHAZINDA</span><span className="project-open"><ArrowUpRight size={19} /></span></button>
          <div className="library-card__info"><button onClick={() => onOpen(project)}><strong>{project.name}</strong><small><Clock size={12} /> {new Date(project.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</small></button><button className="icon-button small" onClick={() => onDelete(project.id)} aria-label={`${project.name} projesini sil`}><Trash2 size={16} /></button></div>
        </article>
      ))}</div> : projects.length === 0 ? (
        <div className="empty-state glass-panel"><div className="empty-logo"><MyVisionLogo size={76} /></div><span className="eyebrow">HENÜZ BİR PROJE YOK</span><h2>İlk görüşünü oluştur.</h2><p>Galerinden bir fotoğraf seç. Çalışmaların bu cihazda saklanır ve burada listelenir.</p><button className="button button--lime" onClick={onCreate}><ImagePlus size={19} /> Fotoğraf ekle</button></div>
      ) : <div className="empty-state glass-panel"><Search size={32} /><h2>Sonuç bulunamadı.</h2><p>“{query}” ile eşleşen bir proje yok.</p><button className="button button--outline" onClick={() => setQuery('')}>Aramayı temizle</button></div>}
    </div>
  );
}
