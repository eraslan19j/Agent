import { useMemo, useState } from 'react';
import { ArrowUpRight, Clock, FolderOpen, Heart, ImagePlus, LayoutGrid, Pencil, Search, Tag, Trash2 } from 'lucide-react';
import type { PhotoProject } from '../types';
import { MyVisionLogo } from './MyVisionLogo';
import { ScreenHeader } from './ScreenHeader';
import { Modal } from './Modal';

type SortMode = 'recent' | 'name' | 'created';
interface ProjectsScreenProps {
  projects: PhotoProject[]; isPro: boolean; onOpen: (project: PhotoProject) => void; onCreate: () => void; onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PhotoProject>) => void; onPro: () => void; onNotifications: () => void;
}
export function ProjectsScreen({ projects, isPro, onOpen, onCreate, onDelete, onUpdate, onPro, onNotifications }: ProjectsScreenProps) {
  const [query, setQuery] = useState(''); const [sort, setSort] = useState<SortMode>('recent');
  const [filter, setFilter] = useState<'all' | 'favorites'>('all'); const [album, setAlbum] = useState('all');
  const [editing, setEditing] = useState<PhotoProject | null>(null); const [editAlbum, setEditAlbum] = useState(''); const [editTags, setEditTags] = useState('');
  const albums = useMemo(() => [...new Set(projects.map(project => project.album?.trim()).filter(Boolean))] as string[], [projects]);
  const visible = useMemo(() => projects.filter(project => {
    const haystack = [project.name, project.album, ...(project.tags ?? [])].join(' ').toLocaleLowerCase('tr');
    return haystack.includes(query.toLocaleLowerCase('tr')) && (filter === 'all' || project.favorite) && (album === 'all' || project.album === album);
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'tr') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt), [projects, query, sort, filter, album]);
  const edit = (project: PhotoProject) => { setEditing(project); setEditAlbum(project.album ?? ''); setEditTags((project.tags ?? []).join(', ')); };
  return <div className="screen projects-screen page-enter">
    <ScreenHeader eyebrow="KİŞİSEL ARŞİVİN" title="Projeler" subtitle="Yalnızca senin çalışmaların. Bu cihazda, senin kontrolünde." isPro={isPro} onPro={onPro} onNotifications={onNotifications} />
    <div className="project-summary glass-panel"><span className="summary-icon"><FolderOpen size={24} /></span><div><strong>{projects.length}</strong><span>kayıtlı çalışma</span></div><button className="button button--lime button--small" onClick={onCreate}><ImagePlus size={17} /> Yeni proje</button></div>
    {projects.length > 0 && <>
      <label className="search-field glass-field"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="İsim, albüm veya etiket ara" aria-label="Projelerde ara" /></label>
      <div className="archive-filters"><div className="settings-segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button><button className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}><Heart size={13} /> Favoriler</button></div>{albums.length > 0 && <select value={album} onChange={event => setAlbum(event.target.value)} aria-label="Albüm filtresi"><option value="all">Tüm albümler</option>{albums.map(value => <option key={value}>{value}</option>)}</select>}</div>
      <div className="project-controls"><span><LayoutGrid size={15} /> {visible.length} proje</span><select value={sort} onChange={event => setSort(event.target.value as SortMode)} aria-label="Projeleri sırala"><option value="recent">Son düzenlenen</option><option value="created">Oluşturulma</option><option value="name">İsim</option></select></div>
    </>}
    {visible.length > 0 ? <div className="projects-grid">{visible.map((project, index) => <article className="library-card stagger-item" style={{ animationDelay: `${Math.min(index * 45, 300)}ms` }} key={project.id}>
      <button className="library-card__image" onClick={() => onOpen(project)}><img src={project.thumbnail || project.source} alt={project.name} /><span className="library-card__badge">{project.album || 'CİHAZINDA'}</span><span className="project-open"><ArrowUpRight size={19} /></span></button>
      <div className="library-card__info"><button onClick={() => onOpen(project)}><strong>{project.name}</strong><small><Clock size={12} /> {new Date(project.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</small>{project.tags?.length ? <small className="project-tags"><Tag size={11} />{project.tags.join(' · ')}</small> : null}</button><div className="project-card-actions"><button className={`icon-button small ${project.favorite ? 'favorite-active' : ''}`} onClick={() => onUpdate(project.id, { favorite: !project.favorite })} aria-label={project.favorite ? `${project.name} favorilerden çıkar` : `${project.name} favorilere ekle`}><Heart size={16} fill={project.favorite ? 'currentColor' : 'none'} /></button><button className="icon-button small" onClick={() => edit(project)} aria-label={`${project.name} albüm ve etiketlerini düzenle`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => onDelete(project.id)} aria-label={`${project.name} projesini sil`}><Trash2 size={16} /></button></div></div>
    </article>)}</div> : projects.length === 0 ? <div className="empty-state glass-panel"><div className="empty-logo"><MyVisionLogo size={76} /></div><span className="eyebrow">HENÜZ BİR PROJE YOK</span><h2>İlk görüşünü oluştur.</h2><p>Galerinden bir fotoğraf seç. Çalışmaların bu cihazda saklanır ve burada listelenir.</p><button className="button button--lime" onClick={onCreate}><ImagePlus size={19} /> Fotoğraf ekle</button></div> : <div className="empty-state glass-panel"><Search size={32} /><h2>Sonuç bulunamadı.</h2><p>Arama ve filtrelerle eşleşen bir proje yok.</p><button className="button button--outline" onClick={() => { setQuery(''); setFilter('all'); setAlbum('all'); }}>Filtreleri temizle</button></div>}
    {editing && <Modal title="Albüm ve etiketler" onClose={() => setEditing(null)}><div className="metadata-form"><label>Albüm<input value={editAlbum} onChange={event => setEditAlbum(event.target.value.slice(0, 40))} placeholder="Örn. Ege tatili" /></label><label>Etiketler<input value={editTags} onChange={event => setEditTags(event.target.value.slice(0, 120))} placeholder="portre, gün batımı, aile" /><small>Etiketleri virgülle ayır.</small></label><button className="button button--lime" onClick={() => { onUpdate(editing.id, { album: editAlbum.trim() || undefined, tags: [...new Set(editTags.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 8) }); setEditing(null); }}>Kaydet</button></div></Modal>}
  </div>;
}
