import { Compass, Folder, Home, Plus, UserRound } from 'lucide-react';
import type { AppView } from '../types';
import { Brand } from './Brand';

interface NavigationProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  onCreate: () => void;
}

const items = [
  { id: 'home' as const, label: 'Ana sayfa', icon: Home },
  { id: 'discover' as const, label: 'Keşfet', icon: Compass },
  { id: 'projects' as const, label: 'Projeler', icon: Folder },
  { id: 'profile' as const, label: 'Profil', icon: UserRound },
];

export function Navigation({ view, onNavigate, onCreate }: NavigationProps) {
  return (
    <>
      <aside className="sidebar">
        <Brand />
        <button className="sidebar__create" onClick={onCreate}><Plus size={19} /> Yeni proje</button>
        <nav className="sidebar__nav" aria-label="Ana navigasyon">
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => onNavigate(id)}>
              <Icon size={20} strokeWidth={view === id ? 2.4 : 1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="mini-avatar">MV</div>
          <div><strong>Yaratıcı alan</strong><span>Fotoğraflar cihazında güvende</span></div>
        </div>
      </aside>
      <nav className="bottom-nav" aria-label="Ana navigasyon">
        {items.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => onNavigate(id)} aria-label={label}>
            <Icon size={21} /><span>{label}</span>
          </button>
        ))}
        <button className="bottom-nav__create" onClick={onCreate} aria-label="Yeni proje"><Plus size={26} /></button>
        {items.slice(2).map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => onNavigate(id)} aria-label={label}>
            <Icon size={21} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
