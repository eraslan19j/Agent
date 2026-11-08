import express from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = process.env.MY_VISION_DATA_DIR ? path.resolve(process.env.MY_VISION_DATA_DIR) : path.join(root, '.data');
const photoDirectory = path.join(dataRoot, 'shared-photos');
const metadataFile = path.join(dataRoot, 'shared-photos.json');
const distDirectory = path.join(root, 'dist');
const port = Number(process.env.PORT || 8787);
const maxFileSize = 12 * 1024 * 1024;
const clientOrigin = process.env.CLIENT_ORIGIN || '';

await mkdir(photoDirectory, { recursive: true });
let photos = [];
try {
  const parsed = JSON.parse(await readFile(metadataFile, 'utf8'));
  if (Array.isArray(parsed)) photos = parsed.filter(photo => photo && typeof photo.id === 'string' && typeof photo.storedName === 'string');
} catch (error) {
  if (error?.code !== 'ENOENT') throw new Error('Paylaşılan fotoğraf metadata dosyası okunamadı.', { cause: error });
}

let metadataQueue = Promise.resolve();
function persistMetadata() {
  const snapshot = JSON.stringify(photos, null, 2);
  metadataQueue = metadataQueue.then(async () => {
    const temporary = `${metadataFile}.${process.pid}.tmp`;
    await writeFile(temporary, snapshot, { mode: 0o600 });
    await rename(temporary, metadataFile);
  });
  return metadataQueue;
}

const publicPhoto = photo => ({
  id: photo.id,
  name: photo.name,
  caption: photo.caption,
  mimeType: photo.mimeType,
  size: photo.size,
  createdAt: photo.createdAt,
  url: `/api/photos/${photo.id}/content`,
  shareUrl: `/share/${photo.id}`,
});

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', mimeType: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { extension: 'png', mimeType: 'image/png' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { extension: 'webp', mimeType: 'image/webp' };
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1, fields: 2, fieldSize: 256, fieldNameSize: 32 },
  fileFilter: (_request, file, callback) => callback(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)),
});

const uploadTimes = new Map();
function uploadRateLimit(request, response, next) {
  const now = Date.now(); const key = request.ip || 'local'; const recent = (uploadTimes.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
  if (recent.length >= 30) { response.status(429).json({ error: 'Çok sık yükleme yapıldı. Birkaç dakika sonra tekrar deneyin.' }); return; }
  recent.push(now); uploadTimes.set(key, recent);
  if (uploadTimes.size > 1000) for (const [ip, times] of uploadTimes) if (!times.some(time => now - time < 15 * 60 * 1000)) uploadTimes.delete(ip);
  next();
}

const app = express();
app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Cross-Origin-Resource-Policy', clientOrigin ? 'cross-origin' : 'same-origin');
  if (clientOrigin) {
    response.setHeader('Access-Control-Allow-Origin', clientOrigin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Vary', 'Origin');
  }
  next();
});
app.options('/api/*path', (_request, response) => response.sendStatus(clientOrigin ? 204 : 405));
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', photoCount: photos.length }));
app.get('/api/photos', (request, response) => {
  const requested = Number(request.query.limit || 60); const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.floor(requested))) : 60;
  response.json({ photos: [...photos].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(publicPhoto) });
});
app.get('/api/photos/:id', (request, response) => {
  const photo = photos.find(item => item.id === request.params.id);
  if (!photo) { response.status(404).json({ error: 'Paylaşılan fotoğraf bulunamadı.' }); return; }
  response.json({ photo: publicPhoto(photo) });
});
app.get('/api/photos/:id/content', (request, response) => {
  const photo = photos.find(item => item.id === request.params.id);
  if (!photo) { response.status(404).json({ error: 'Paylaşılan fotoğraf bulunamadı.' }); return; }
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  response.setHeader('Content-Disposition', `inline; filename="my-vision-${photo.id}.${detectImageExtension(photo)}"`);
  response.type(photo.mimeType);
  response.setHeader('Content-Length', photo.size);
  const stream = createReadStream(path.join(photoDirectory, photo.storedName));
  stream.on('error', () => { if (response.headersSent) response.destroy(); else response.status(404).json({ error: 'Fotoğraf dosyası açılamadı.' }); });
  stream.pipe(response);
});
function detectImageExtension(photo) { return photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg'; }

app.post('/api/photos', uploadRateLimit, (request, response) => {
  upload.single('photo')(request, response, async error => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'Fotoğraf 12 MB sınırını aşıyor.' : 'Fotoğraf yüklenemedi. JPEG, PNG veya WebP deneyin.';
      response.status(error instanceof multer.MulterError ? 400 : 500).json({ error: message }); return;
    }
    if (!request.file) { response.status(400).json({ error: 'JPEG, PNG veya WebP fotoğraf seçin.' }); return; }
    const detected = detectImage(request.file.buffer);
    if (!detected) { response.status(415).json({ error: 'Dosya içeriği desteklenen bir fotoğraf değil.' }); return; }
    const id = randomUUID(); const storedName = `${id}.${detected.extension}`;
    const name = String(request.body.name || request.file.originalname || 'Paylaşılan fotoğraf').replace(/\.[^.]+$/, '').trim().slice(0, 60) || 'Paylaşılan fotoğraf';
    const caption = String(request.body.caption || '').trim().slice(0, 120);
    const photo = { id, storedName, name, caption, mimeType: detected.mimeType, size: request.file.size, sha256: createHash('sha256').update(request.file.buffer).digest('hex'), createdAt: new Date().toISOString() };
    const destination = path.join(photoDirectory, storedName);
    try {
      await writeFile(destination, request.file.buffer, { flag: 'wx', mode: 0o600 });
      photos.push(photo);
      await persistMetadata();
      response.status(201).json({ photo: publicPhoto(photo) });
    } catch (writeError) {
      photos = photos.filter(item => item.id !== id);
      await unlink(destination).catch(() => undefined);
      console.error('[photo-upload]', writeError);
      response.status(500).json({ error: 'Fotoğraf sunucuya kaydedilemedi.' });
    }
  });
});

app.use('/api', (_request, response) => response.status(404).json({ error: 'API yolu bulunamadı.' }));
app.use('/ffmpeg', (request, response, next) => {
  if (request.path.endsWith('.br')) {
    response.setHeader('Content-Encoding', 'br');
    if (request.path.endsWith('.wasm.br')) response.type('application/wasm');
    else if (request.path.endsWith('.js.br')) response.type('text/javascript');
  }
  next();
});
if (existsSync(distDirectory)) app.use(express.static(distDirectory, { index: false, maxAge: '1h' }));
app.use((request, response, next) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
  const index = path.join(distDirectory, 'index.html');
  if (!existsSync(index)) { response.status(503).send('My Vision production build bulunamadı. Önce npm run build çalıştırın.'); return; }
  response.setHeader('Cache-Control', 'no-cache');
  response.sendFile(index);
});

const server = app.listen(port, '0.0.0.0', () => { const address = server.address(); const actualPort = typeof address === 'object' && address ? address.port : port; console.log(`My Vision server http://0.0.0.0:${actualPort} · ${photos.length} shared photos`); });
function shutdown() { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
