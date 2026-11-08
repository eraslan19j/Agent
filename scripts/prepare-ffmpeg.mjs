import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib';
import { createHash as hash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const coreDirectory = 'node_modules/@ffmpeg/core/dist/esm';
const outputDirectory = 'public/ffmpeg';
const source = await readFile(`${coreDirectory}/ffmpeg-core.wasm`);
const sourceSha256 = hash('sha256').update(source).digest('hex');
try {
  const existingManifest = JSON.parse(await readFile(`${outputDirectory}/manifest.json`, 'utf8'));
  const existingCompressed = await readFile(`${outputDirectory}/ffmpeg-core.wasm.br`);
  if (existingManifest.wasmSha256 === sourceSha256 && hash('sha256').update(brotliDecompressSync(existingCompressed)).digest('hex') === sourceSha256) {
    console.log(`FFmpeg ${existingManifest.version}: verified existing ${(existingCompressed.length / 1048576).toFixed(2)} MiB Brotli asset`);
    process.exit(0);
  }
} catch { /* Missing or stale assets are rebuilt below. */ }
const coreScript = await readFile(`${coreDirectory}/ffmpeg-core.js`);
const compressed = brotliCompressSync(source, {
  params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
});
const packageJson = JSON.parse(await readFile('node_modules/@ffmpeg/core/package.json', 'utf8'));
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(`${outputDirectory}/ffmpeg-core.js`, coreScript),
  writeFile(`${outputDirectory}/ffmpeg-core.wasm.br`, compressed),
  writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify({
    version: packageJson.version,
    threading: 'single',
    encoding: 'br',
    uncompressedBytes: source.length,
    compressedBytes: compressed.length,
    wasmSha256: sourceSha256,
  }, null, 2)}\n`),
]);
console.log(`FFmpeg ${packageJson.version}: ${(source.length / 1048576).toFixed(2)} MiB WASM → ${(compressed.length / 1048576).toFixed(2)} MiB Brotli`);
