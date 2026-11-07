import { useMemo, useState } from 'react';
import { ArrowDownToLine, FolderOpen, ImagePlus, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { SAMPLE_PROJECTS } from '../data/samples';
import { buildCssFilter } from '../lib/imageEngine';
import type { EditorSession, PhotoProject } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface ProjectsScreenProps {
  projects: PhotoProject[];
  isPro: boolean;
  onOpen: (session: EditorSession) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onPro: () => void;
  onNotifications: () => void;
}

export function ProjectsScreen({ projects, isPro, onOpen, onCreate, onDelete, onPro, onNotifications }: ProjectsScreenProps) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'samples'>('all');
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const all = useMemo(() => [...projects, ...SAMPLE_PROJECTS], [projects]);
  const filtered = all.filter((project) =>
    (filter === 'all' || (filter === 'mine' ? !project.isSample : project.isSample)) &&
    project.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')),
  );

  return (
    <div className="screen projects-screen page-enter">
      <ScreenHeader eyebrow="YARATICI ARŞİVİN" title="Projelerim" subtitle={`${projects.length} kişisel proje · Tüm düzenlemeler cihazında`} isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
      <div className="project-toolbar">
        <div className="segmented-control">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
          <button className={filter === 'mine' ? 'active' : ''} onClick={() => setFilter('mine')}>Benimkiler</button>
          <button className={filter === 'samples' ? 'active' : ''} onClick={() => setFilter('samples')}>Örnekler</button>
        </div>
        <div className="project-toolbar__right"><label className="search-box search-box--small"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje ara" aria-label="Proje ara" /></label><button className="button button--lime button--small desktop-only" onClick={onCreate}><Plus size={17} /> Yeni proje</button></div>
      </div>
      {filtered.length ? <div className="projects-grid">
        {filtered.map((project) => (
          <article className="library-card" key={project.id}>
            <button className="library-card__image" onClick={() => onOpen({ source: project.source, name: project.name, projectId: project.id, initialSettings: project.settings })}>
              <img src={project.thumbnail || project.source} alt={project.name} style={{ filter: project.thumbnail ? undefined : buildCssFilter(project.settings) }} />
              <span className="library-card__badge">{project.isSample ? 'ÖRNEK' : 'TASLAK'}</span>
              <span className="library-card__edit"><FolderOpen size={18} /> Düzenlemeye devam et</span>
            </button>
            <div className="library-card__info"><div><strong>{project.name}</strong><small>{new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(project.updatedAt)} · {project.settings.presetId === 'original' ? 'Özel düzenleme' : project.settings.presetId}</small></div><button className="icon-button" onClick={() => setMenuId(menuId === project.id ? null : project.id)} aria-label="Proje seçenekleri"><MoreHorizontal size={20} /></button></div>
            {menuId === project.id && <div className="context-menu"><button onClick={() => onOpen({ source: project.source, name: project.name, projectId: project.id, initialSettings: project.settings })}><ArrowDownToLine size={16} /> Aç ve dışa aktar</button>{!project.isSample && <button className="danger" onClick={() => { onDelete(project.id); setMenuId(null); }}><Trash2 size={16} /> Projeyi sil</button>}</div>}
          </article>
        ))}
        <button className="new-project-tile" onClick={onCreate}><span><ImagePlus size={27} /></span><strong>Yeni bir hikâye başlat</strong><small>Galerinden fotoğraf seç</small></button>
      </div> : <div className="empty-state"><FolderOpen size={36} /><h3>Burada henüz proje yok</h3><p>Yeni bir fotoğraf seçerek ilk düzenlemeni oluştur.</p><button className="button button--lime" onClick={onCreate}><Plus size={18} /> Yeni proje</button></div>}
    </div>
  );
}
