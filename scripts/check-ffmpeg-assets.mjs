import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const LIMIT = 25 * 1024 * 1024;
const directory = process.argv.includes('--dist') ? 'dist/ffmpeg' : 'public/ffmpeg';
const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
const compressed = await readFile(`${directory}/ffmpeg-core.wasm.br`);
const source = brotliDecompressSync(compressed);
if (compressed.length > LIMIT) throw new Error(`FFmpeg asset exceeds Cloudflare Pages 25 MiB limit: ${compressed.length}`);
if (source.length !== manifest.uncompressedBytes || compressed.length !== manifest.compressedBytes) throw new Error('FFmpeg manifest size mismatch.');
if (createHash('sha256').update(source).digest('hex') !== manifest.wasmSha256) throw new Error('FFmpeg WASM checksum mismatch.');
if (process.argv.includes('--dist')) {
  async function verifyFiles(folder) {
    for (const entry of await readdir(folder)) {
      const path = join(folder, entry);
      const info = await stat(path);
      if (info.isDirectory()) await verifyFiles(path);
      else if (info.size > LIMIT) throw new Error(`Production asset exceeds 25 MiB: ${path} (${info.size} bytes)`);
    }
  }
  await verifyFiles('dist');
  console.log(`Production asset check PASS; largest allowed size ${LIMIT} bytes.`);
}
console.log(`FFmpeg asset check PASS: ${compressed.length} bytes compressed, ${source.length} bytes verified after Brotli decoding.`);
