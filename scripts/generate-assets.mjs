import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('resources', { recursive: true });
await mkdir('public/icons', { recursive: true });
await mkdir('store', { recursive: true });

const mark = (size = 1024, background = true) => {
  const scale = size / 1024;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    ${background ? '<rect width="1024" height="1024" rx="220" fill="#d9fb72"/>' : ''}
    <g transform="translate(192 192) scale(26.6667)" fill="none" stroke="#15170f" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="m14.31 8 5.74 9.94M9.69 8h11.48m-13.8 4 5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83m13.79-4-5.74 9.94"/>
    </g>
    <circle cx="793" cy="228" r="34" fill="#15170f"/>
  </svg>`);
};

await sharp(mark()).png().toFile('resources/icon-only.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#d9fb72' } }).png().toFile('resources/icon-background.png');
await sharp(mark(1024, false)).png().toFile('resources/icon-foreground.png');

const splashSvg = Buffer.from(`<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <rect width="2732" height="2732" fill="#0b0b0d"/>
  <circle cx="1366" cy="1240" r="470" fill="#d9fb72" opacity=".035"/>
  <g transform="translate(1186 1040) scale(.3515625)">${mark(1024).toString().replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="1366" y="1575" text-anchor="middle" fill="#f5f5f2" font-family="sans-serif" font-size="96" font-weight="700" letter-spacing="-4">My Vision<tspan fill="#d9fb72">.</tspan></text>
  <text x="1366" y="1650" text-anchor="middle" fill="#74746e" font-family="sans-serif" font-size="24" letter-spacing="8">GÖRÜŞÜNÜ YARAT</text>
</svg>`);
await sharp(splashSvg).png().toFile('resources/splash.png');
await sharp(splashSvg).png().toFile('resources/splash-dark.png');
await sharp(mark()).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(mark()).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(mark()).resize(512, 512).png().toFile('store/icon-512.png');

const featureText = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0b0d09" stop-opacity=".98"/><stop offset=".72" stop-color="#0b0d09" stop-opacity=".25"/><stop offset="1" stop-color="#0b0d09" stop-opacity=".08"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <g transform="translate(64 56) scale(.065)">${mark(1024).toString().replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="142" y="103" fill="#f5f5f2" font-family="sans-serif" font-size="34" font-weight="700">My Vision<tspan fill="#d9fb72">.</tspan></text>
  <text x="64" y="238" fill="#f5f5f2" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="-2">GÖRÜŞÜNÜ</text>
  <text x="64" y="310" fill="#d9fb72" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="-2">YARAT.</text>
  <text x="68" y="365" fill="#d4d8cb" font-family="sans-serif" font-size="20">Profesyonel fotoğraf stüdyon. Her zaman yanında.</text>
  <rect x="66" y="410" width="196" height="35" rx="17" fill="#d9fb72"/>
  <text x="164" y="434" text-anchor="middle" fill="#15170f" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="2">PHOTO STUDIO</text>
</svg>`);
await sharp('public/images/santorini.jpg').resize(1024, 500, { fit: 'cover', position: 'centre' }).composite([{ input: featureText }]).png().toFile('store/feature-graphic.png');

console.log('My Vision icons, splash screens and Play Store artwork generated.');
