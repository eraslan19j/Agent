import { Aperture } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="My Vision">
      <span className="brand__mark"><Aperture size={compact ? 19 : 22} strokeWidth={2.4} /></span>
      <span className="brand__word">My Vision<span className="brand__dot">.</span></span>
    </div>
  );
}
