import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

const SOURCE = 'resources/generated-vision-icon.png';
const ACCENT = '#007AFF';
const BLACK = '#000000';
const WHITE = '#F5F5F7';
await mkdir('resources', { recursive: true });
await mkdir('public/icons', { recursive: true });
await mkdir('store', { recursive: true });

// The selected AI-generated image is the sole symbol source. We only separate
// its luminance into an antialiased alpha channel and normalize brand colors.
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alpha = Buffer.alloc(info.width * info.height * 4);
for (let index = 0; index < data.length; index += 4) {
  const luminance = data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722;
  const opacity = Math.max(0, Math.min(1, (174 - luminance) / 116));
  alpha[index] = 10; alpha[index + 1] = 10; alpha[index + 2] = 10;
  alpha[index + 3] = Math.round(opacity * 255);
}
const blackSymbol = await sharp(alpha, { raw: info }).png().toBuffer();
const accentAlpha = Buffer.from(alpha);
for (let index = 0; index < accentAlpha.length; index += 4) {
  accentAlpha[index] = 255; accentAlpha[index + 1] = 196; accentAlpha[index + 2] = 0;
}
const accentSymbol = await sharp(accentAlpha, { raw: info }).png().toBuffer();

function canvas(size, color = { r: 0, g: 0, b: 0, alpha: 0 }) {
  return sharp({ create: { width: size, height: size, channels: 4, background: color } });
}
async function fullIcon(size) {
  return canvas(size, ACCENT).composite([{ input: await sharp(blackSymbol).resize(size, size).png().toBuffer() }]).png().toBuffer();
}
async function foreground(size, color = 'black') {
  const input = await sharp(color === 'accent' ? accentSymbol : blackSymbol).resize(Math.round(size * .78), Math.round(size * .78)).png().toBuffer();
  return canvas(size).composite([{ input, gravity: 'center' }]).png().toBuffer();
}
async function roundIcon(size) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
  const base = await canvas(size, ACCENT).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(base).composite([{ input: await sharp(blackSymbol).resize(size, size).png().toBuffer() }]).png().toBuffer();
}

await writeFile('public/favicon.png', await fullIcon(64));
await writeFile('public/favicon-32.png', await fullIcon(32));
await writeFile('public/logo.png', await fullIcon(512));
await writeFile('public/icons/icon-192.png', await fullIcon(192));
await writeFile('public/icons/icon-512.png', await fullIcon(512));
await writeFile('public/icons/icon-maskable-512.png', await fullIcon(512));
await writeFile('store/icon-512.png', await fullIcon(512));
await writeFile('resources/icon-only.png', await fullIcon(1024));
await writeFile('resources/icon-background.png', await canvas(1024, ACCENT).png().toBuffer());
await writeFile('resources/icon-foreground.png', await foreground(1024));
await writeFile('resources/icon-monochrome.png', await foreground(1024));

const res = 'android/app/src/main/res';
const densities = { 'mipmap-ldpi': 36, 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
for (const [folder, size] of Object.entries(densities)) {
  const directory = `${res}/${folder}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/ic_launcher.png`, await fullIcon(size));
  await writeFile(`${directory}/ic_launcher_round.png`, await roundIcon(size));
  await writeFile(`${directory}/ic_launcher_background.png`, await canvas(size, ACCENT).png().toBuffer());
  await writeFile(`${directory}/ic_launcher_foreground.png`, await foreground(size));
  await writeFile(`${directory}/ic_launcher_monochrome.png`, await foreground(size));
}
await writeFile(`${res}/drawable/splash_icon.png`, await foreground(512, 'accent'));
await writeFile(`${res}/drawable/splash_icon_dark.png`, await foreground(512));

async function brandText(color = WHITE) {
  return Buffer.from(`<svg width="350" height="130" xmlns="http://www.w3.org/2000/svg"><text x="0" y="84" fill="${color}" font-family="Arial,sans-serif" font-size="72" font-weight="800" letter-spacing="-3">My Vision</text><rect x="332" y="65" width="12" height="12" rx="2" fill="${ACCENT}"/></svg>`);
}

async function splash(width, height, dark = true, amoled = false) {
  const background = dark ? (amoled ? '#000000' : BLACK) : WHITE;
  const symbol = await sharp(dark ? accentSymbol : blackSymbol).resize(Math.round(Math.min(width, height) * .23), Math.round(Math.min(width, height) * .23)).png().toBuffer();
  const textWidth = Math.round(Math.min(width, height) * .45);
  const text = await sharp(await brandText(dark ? WHITE : BLACK)).resize(textWidth, Math.round(textWidth * 130 / 350)).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background } }).composite([
    { input: symbol, top: Math.round(height * .34), left: Math.round((width - Math.min(width, height) * .23) / 2) },
    { input: text, top: Math.round(height * .34 + Math.min(width, height) * .26), left: Math.round((width - textWidth) / 2) },
  ]).png().toBuffer();
}
await writeFile('resources/splash.png', await splash(2732, 2732));
await writeFile('resources/splash-dark.png', await splash(2732, 2732));
for (const entry of await readdir(res, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
  const path = `${res}/${entry.name}/splash.png`;
  try {
    const { width, height } = await sharp(path).metadata();
    if (width && height) await writeFile(path, await splash(width, height));
    if (width && height && !entry.name.includes('night')) await writeFile(`${res}/${entry.name}/splash_amoled.png`, await splash(width, height, true, true));
    if (width && height && !entry.name.includes('night')) await writeFile(`${res}/${entry.name}/splash_light.png`, await splash(width, height, false));
  } catch { /* Not a splash directory. */ }
}

const featureBase = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="500" fill="${BLACK}"/><circle cx="860" cy="250" r="310" fill="${ACCENT}" opacity=".08"/>
  <text x="190" y="119" fill="${WHITE}" font-family="Arial,sans-serif" font-size="46" font-weight="700" letter-spacing="-2">My Vision</text>
  <text x="65" y="265" fill="${WHITE}" font-family="Arial,sans-serif" font-size="66" font-weight="700" letter-spacing="-2">GÖRÜŞÜNÜ</text>
  <text x="65" y="338" fill="${ACCENT}" font-family="Arial,sans-serif" font-size="66" font-weight="700" letter-spacing="-2">YARAT.</text>
  <text x="68" y="390" fill="#A6A6A1" font-family="Arial,sans-serif" font-size="20">Cihazında çalışan yaratıcı fotoğraf stüdyon.</text>
  <rect x="66" y="432" width="210" height="36" rx="18" fill="${ACCENT}"/><text x="171" y="456" text-anchor="middle" fill="${BLACK}" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2">PHOTO STUDIO</text>
</svg>`);
await sharp(featureBase).composite([
  { input: await fullIcon(100), top: 45, left: 65 },
  { input: await foreground(440, 'accent'), top: 32, left: 610 },
]).png().toFile('store/feature-graphic.png');
console.log('Generated-image identity exported to Android, monochrome, splash, PWA, favicon and Play Store assets.');
