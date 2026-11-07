import { SYMBOL_CONTENT, WORDMARK_CONTENT } from '../brand/logo.mjs';

interface MyVisionLogoProps {
  variant?: 'symbol' | 'wordmark';
  size?: number;
  className?: string;
  title?: string;
}

/** Single inline-SVG brand component. No image request or icon font is used. */
export function MyVisionLogo({ variant = 'symbol', size = 40, className = '', title = 'My Vision' }: MyVisionLogoProps) {
  const wordmark = variant === 'wordmark';
  const content = (wordmark ? WORDMARK_CONTENT : SYMBOL_CONTENT)
    .replaceAll('#FFC400', 'var(--brand-yellow)')
    .replaceAll('#0A0A0A', 'var(--brand-black)')
    .replaceAll('#F7F7F5', 'var(--brand-white)');
  return (
    <svg
      className={`my-vision-logo ${className}`}
      width={wordmark ? size * 3.5 : size}
      height={size}
      viewBox={wordmark ? '0 0 224 64' : '0 0 64 64'}
      role="img"
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: `<rect width="64" height="64" rx="15" fill="var(--brand-yellow)"/>${content}` }}
    />
  );
}
