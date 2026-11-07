import type { CSSProperties } from 'react';

interface MyVisionLogoProps {
  variant?: 'symbol' | 'wordmark';
  size?: number;
  className?: string;
  title?: string;
}

/** Generated-image identity; the symbol is never redrawn in code. */
export function MyVisionLogo({ variant = 'symbol', size = 40, className = '', title = 'My Vision' }: MyVisionLogoProps) {
  return (
    <span
      className={`my-vision-logo my-vision-logo--${variant} ${className}`}
      style={{ '--logo-size': `${size}px` } as CSSProperties}
      role="img"
      aria-label={title}
    >
      <img src="/logo.png" width={size} height={size} alt="" aria-hidden="true" draggable={false} />
      {variant === 'wordmark' && <span className="my-vision-logo__word">My Vision<span className="my-vision-logo__dot">.</span></span>}
    </span>
  );
}
