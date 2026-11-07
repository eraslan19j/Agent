import { Bell, Crown } from 'lucide-react';
import { Brand } from './Brand';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  isPro: boolean;
  onPro: () => void;
  onNotifications: () => void;
}

export function ScreenHeader({ eyebrow, title, subtitle, isPro, onPro, onNotifications }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div className="screen-header__mobile-brand"><Brand compact /></div>
      <div className="screen-header__copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="screen-header__actions">
        {!isPro && <button className="pro-pill" onClick={onPro}><Crown size={15} /> Pro’ya geç</button>}
        {isPro && <span className="pro-pill pro-pill--active"><Crown size={15} /> PRO</span>}
        <button className="icon-button notification-button" onClick={onNotifications} aria-label="Bildirimler"><Bell size={20} /><i /></button>
      </div>
    </header>
  );
}
