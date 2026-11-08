import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const root = resolve('.arena/ffmpeg-smoke-dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/qa/ffmpeg-smoke.html' : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) throw new Error('Invalid path');
    const info = await stat(path);
    response.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'Content-Length': info.size,
      ...(path.endsWith('.br') ? { 'Content-Encoding': 'br', 'Content-Type': 'application/wasm', 'Vary': 'Accept-Encoding' } : {}),
      'Cache-Control': 'no-store',
    });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server could not start');
const origin = `http://127.0.0.1:${address.port}`;
let browser;
try {
  chromium.setGraphicsMode = false;
  if (existsSync('/tmp/al2023/lib')) process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`;
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || await chromium.executablePath(),
    headless: true,
    args: [...chromium.args.filter(argument => argument !== '--disable-web-security'), '--no-sandbox'],
  });
  const page = await browser.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('requestfailed', request => browserErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.ffmpegSmoke?.status !== 'running', { timeout: 240000, polling: 500 });
  const outcome = await page.evaluate(() => window.ffmpegSmoke);
  await writeFile('.arena/ffmpeg-smoke-report.json', `${JSON.stringify({ ...outcome, browserErrors }, null, 2)}\n`);
  console.log(JSON.stringify({ ...outcome, browserErrors }, null, 2));
  if (outcome?.status !== 'passed' || browserErrors.length) throw new Error(outcome?.error || browserErrors.join('\n') || 'FFmpeg smoke test failed');
  console.log('FFmpeg Worker + Brotli core + WebM→MP4 export + browser playback PASS');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
