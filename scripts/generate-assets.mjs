import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createLogoSvg, SYMBOL_CONTENT, WORDMARK_CONTENT } from '../src/brand/logo.mjs';

await mkdir('resources', { recursive: true });
await mkdir('public/icons', { recursive: true });
await mkdir('store', { recursive: true });

const symbol = (size = 1024, background = true) => Buffer.from(createLogoSvg('symbol', size, background));
await writeFile('public/favicon.svg', createLogoSvg('symbol', 64));
await writeFile('public/logo.svg', createLogoSvg('symbol', 64));
await writeFile('public/logo-wordmark.svg', createLogoSvg('wordmark', 64));

await sharp(symbol()).png().toFile('resources/icon-only.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFC400' } }).png().toFile('resources/icon-background.png');
const foreground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(112 112) scale(.78)">${SYMBOL_CONTENT}</g></svg>`);
await sharp(foreground).png().toFile('resources/icon-foreground.png');

const splashSvg = Buffer.from(`<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <rect width="2732" height="2732" fill="#0A0A0A"/>
  <circle cx="1366" cy="1250" r="620" fill="#FFC400" opacity=".045"/>
  <circle cx="1366" cy="1250" r="410" fill="#FFC400" opacity=".04"/>
  <g transform="translate(806 1080) scale(5)"><rect width="64" height="64" rx="15" fill="#FFC400"/>${WORDMARK_CONTENT}</g>
  <text x="1366" y="1595" text-anchor="middle" fill="#8C8C88" font-family="sans-serif" font-size="25" letter-spacing="9">GÖRÜŞÜNÜ YARAT</text>
</svg>`);
await sharp(splashSvg).png().toFile('resources/splash.png');
await sharp(splashSvg).png().toFile('resources/splash-dark.png');
await sharp(symbol()).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(symbol()).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(symbol()).resize(512, 512).png().toFile('store/icon-512.png');

const outlineSymbol = SYMBOL_CONTENT.replaceAll('#0A0A0A', '#FFC400');
const featureSvg = Buffer.from(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow"><stop stop-color="#FFC400" stop-opacity=".13"/><stop offset="1" stop-color="#0A0A0A" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" x2="1"><stop stop-color="#FFC400" stop-opacity=".35"/><stop offset="1" stop-color="#FFC400" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1024" height="500" fill="#0A0A0A"/>
  <circle cx="830" cy="250" r="370" fill="url(#glow)"/>
  <g transform="translate(675 70) scale(5.5)" opacity=".18">${outlineSymbol}</g>
  <g transform="translate(62 54) scale(.85)"><rect width="64" height="64" rx="15" fill="#FFC400"/>${WORDMARK_CONTENT}</g>
  <rect x="64" y="163" width="80" height="3" fill="url(#line)"/>
  <text x="64" y="253" fill="#F7F7F5" font-family="sans-serif" font-size="66" font-weight="700" letter-spacing="-2">GÖRÜŞÜNÜ</text>
  <text x="64" y="326" fill="#FFC400" font-family="sans-serif" font-size="66" font-weight="700" letter-spacing="-2">YARAT.</text>
  <text x="68" y="380" fill="#A6A6A1" font-family="sans-serif" font-size="20">Liquid Glass fotoğraf stüdyon. Her zaman yanında.</text>
  <rect x="66" y="422" width="200" height="36" rx="18" fill="#FFC400"/>
  <text x="166" y="446" text-anchor="middle" fill="#0A0A0A" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="2">PHOTO STUDIO</text>
</svg>`);
await sharp(featureSvg).png().toFile('store/feature-graphic.png');

// Keep native launcher icons in sync without adding an asset-generation runtime dependency.
const androidRes = 'android/app/src/main/res';
const densities = { 'mipmap-ldpi': 36, 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
for (const [folder, size] of Object.entries(densities)) {
  const directory = `${androidRes}/${folder}`;
  await mkdir(directory, { recursive: true });
  await sharp(symbol()).resize(size, size).png().toFile(`${directory}/ic_launcher.png`);
  await sharp({ create: { width: size, height: size, channels: 4, background: '#FFC400' } }).png().toFile(`${directory}/ic_launcher_background.png`);
  const foregroundSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><g transform="translate(7 7) scale(.78)">${SYMBOL_CONTENT}</g></svg>`);
  await sharp(foregroundSvg).png().toFile(`${directory}/ic_launcher_foreground.png`);
  const roundSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#FFC400"/>${SYMBOL_CONTENT}</svg>`);
  await sharp(roundSvg).png().toFile(`${directory}/ic_launcher_round.png`);
}

function nativeSplash(width, height) {
  const scale = Math.min(width * .72 / 224, height * .34 / 64);
  const x = (width - 224 * scale) / 2;
  const y = (height - 64 * scale) / 2 - height * .025;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#0A0A0A"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width,height) * .48}" fill="#FFC400" opacity=".045"/>
    <g transform="translate(${x} ${y}) scale(${scale})"><rect width="64" height="64" rx="15" fill="#FFC400"/>${WORDMARK_CONTENT}</g>
    <text x="${width / 2}" y="${y + 64 * scale + Math.max(25,height * .055)}" text-anchor="middle" fill="#92928C" font-family="sans-serif" font-size="${Math.max(8,width * .018)}" letter-spacing="${Math.max(2,width * .005)}">GÖRÜŞÜNÜ YARAT</text>
  </svg>`);
}
for (const entry of await readdir(androidRes, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
  const path = `${androidRes}/${entry.name}/splash.png`;
  try {
    const { width, height } = await sharp(path).metadata();
    if (width && height) await sharp(nativeSplash(width, height)).png().toFile(path);
  } catch { /* Directory has no splash variant. */ }
}

console.log('Single-source eye/aperture identity exported to app, Android, PWA, splash and Play Store assets.');
