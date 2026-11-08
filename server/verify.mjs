import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dataDirectory = await mkdtemp(path.join(tmpdir(), 'my-vision-server-'));
let child;
async function start() {
  child = spawn(process.execPath, ['server/index.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: '0', MY_VISION_DATA_DIR: dataDirectory }, stdio: ['ignore','pipe','pipe'] });
  const origin = await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/0\.0\.0\.0:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
    child.stderr.on('data', chunk => { output += chunk; }); child.once('error', reject); child.once('exit', code => { if (code) { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); } });
  });
  return origin;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited;
}
async function upload(origin, buffer, type = 'image/jpeg') {
  const body = new FormData(); body.append('photo', new File([buffer], 'fixture.jpg', { type })); body.append('caption', 'Integration QA');
  return fetch(`${origin}/api/photos`, { method: 'POST', body });
}

try {
  let origin = await start();
  const wasm = await fetch(`${origin}/ffmpeg/ffmpeg-core.wasm.br`, { method: 'HEAD' });
  assert.equal(wasm.headers.get('content-encoding'), 'br'); assert.match(wasm.headers.get('content-type') || '', /application\/wasm/);
  const invalid = await upload(origin, Buffer.from('not an image')); assert.equal(invalid.status, 415);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const created = await upload(origin, png, 'image/png'); assert.equal(created.status, 201);
  const { photo } = await created.json(); assert.equal(photo.caption, 'Integration QA');
  const content = await fetch(`${origin}${photo.url}`); assert.equal(content.status, 200); assert.deepEqual(Buffer.from(await content.arrayBuffer()), png);
  const list = await fetch(`${origin}/api/photos`).then(response => response.json()); assert.equal(list.photos.length, 1);
  await stop(); origin = await start();
  const health = await fetch(`${origin}/api/health`).then(response => response.json()); assert.equal(health.photoCount, 1);
  const persisted = await fetch(`${origin}${photo.url}`); assert.equal(persisted.status, 200); assert.deepEqual(Buffer.from(await persisted.arrayBuffer()), png);
  console.log('PASS server signature validation, upload, byte-identical content, list and restart persistence');
} finally { await stop(); await rm(dataDirectory, { recursive: true, force: true }); }
