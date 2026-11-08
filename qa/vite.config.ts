import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(directory, '..');

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  build: {
    target: 'es2022',
    outDir: resolve(root, '.arena/ffmpeg-smoke-dist'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, 'qa/ffmpeg-smoke.html') },
  },
});
