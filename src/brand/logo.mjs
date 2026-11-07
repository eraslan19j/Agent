export const BRAND_COLORS = {
  yellow: '#FFC400',
  black: '#0A0A0A',
  white: '#F7F7F5',
};

export const SYMBOL_CONTENT = `
  <path d="M7 32 17.5 18 32 10.5 46.5 18 57 32 46.5 46 32 53.5 17.5 46Z" fill="none" stroke="#0A0A0A" stroke-width="3.2" stroke-linejoin="miter"/>
  <circle cx="32" cy="32" r="12.2" fill="none" stroke="#0A0A0A" stroke-width="2.7"/>
  <path d="m32 19.8 3.8 8.1M44.2 32h-8.8m3.2 10.2-5.1-7.5M32 44.2l-3.8-8.1M19.8 32h8.8m-3.2-10.2 5.1 7.5" fill="none" stroke="#0A0A0A" stroke-width="2.7" stroke-linecap="square"/>
  <path d="m32 27 4.4 2.5v5L32 37l-4.4-2.5v-5Z" fill="#0A0A0A"/>
`;

export const WORDMARK_CONTENT = `
  ${SYMBOL_CONTENT}
  <text x="76" y="42" fill="#F7F7F5" font-family="Manrope,Arial,sans-serif" font-size="27" font-weight="800" letter-spacing="-1.2">My Vision</text>
  <rect x="202" y="34" width="6" height="6" rx="1" fill="#FFC400"/>
`;

export function createLogoSvg(variant = 'symbol', size = 64, includeBackground = true) {
  const isWordmark = variant === 'wordmark';
  const viewBox = isWordmark ? '0 0 224 64' : '0 0 64 64';
  const width = isWordmark ? size * 3.5 : size;
  const background = includeBackground ? `<rect width="${isWordmark ? 64 : 64}" height="64" rx="15" fill="#FFC400"/>` : '';
  const content = isWordmark ? WORDMARK_CONTENT : SYMBOL_CONTENT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size}" viewBox="${viewBox}">${background}${content}</svg>`;
}
