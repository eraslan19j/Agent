/* =========================================================
   AETHERION — entry point
   ========================================================= */
import './style.css';
import { Game } from './game';

function showFatal(err: unknown) {
  const el = document.getElementById('fatal');
  const msg = document.getElementById('fatal-msg');
  if (el && msg) {
    el.classList.remove('hidden');
    msg.textContent = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  }
}

window.addEventListener('error', (e) => {
  console.error('[aetherion]', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[aetherion] unhandled', e.reason);
});

function checkOrientation() {
  const rotate = document.getElementById('rotate');
  if (!rotate) return;
  const portrait = window.innerHeight > window.innerWidth * 1.02;
  rotate.classList.toggle('hidden', !portrait);
}

// prevent iOS/Android pinch zoom & double tap zoom inside the game
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

async function main() {
  const container = document.getElementById('stage');
  if (!container) throw new Error('#stage bulunamadı');

  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 150));

  // keep the WebGL context alive when the app is backgrounded on Android
  const canvasHost = container;

  const game = new Game(canvasHost);
  (window as any).__AETHERION__ = game;

  try {
    await game.boot();
  } catch (err) {
    console.error(err);
    showFatal(err);
    return;
  }

  // fullscreen on first tap (mobile browsers)
  const enterFullscreen = () => {
    const el = document.documentElement as any;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
    window.removeEventListener('pointerdown', enterFullscreen);
  };
  window.addEventListener('pointerdown', enterFullscreen, { once: true });

  window.addEventListener('pagehide', () => game.save?.flush?.());
}

main().catch(showFatal);
