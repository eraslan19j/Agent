import { Brand } from './Brand';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ eyebrow, title, subtitle }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div className="screen-header__mobile-brand"><Brand compact /></div>
      <div className="screen-header__copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  );
}
