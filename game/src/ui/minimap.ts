/* =========================================================
   AETHERION — minimap & world map renderer
   ========================================================= */
import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import { WORLD, ZONE_NAMES } from '../data/world';
import { BIOME_COLORS, type Biome } from '../data/world';
import { clamp } from '../core/utils';

const MAP_RES = 168;

export class Minimap {
  private base: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private metersPerPixel: number;

  constructor(private terrain: Terrain) {
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = MAP_RES;
    this.baseCtx = this.base.getContext('2d')!;
    this.metersPerPixel = (WORLD.half * 2) / MAP_RES;
    this.renderBase();
  }

  private renderBase() {
    const ctx = this.baseCtx;
    const img = ctx.createImageData(MAP_RES, MAP_RES);
    const data = img.data;
    const heights = new Float32Array(MAP_RES * MAP_RES);
    const mpp = this.metersPerPixel;
    // one height probe per pixel
    for (let py = 0; py < MAP_RES; py++) {
      const z = -WORLD.half + py * mpp;
      for (let px = 0; px < MAP_RES; px++) {
        const x = -WORLD.half + px * mpp;
        heights[py * MAP_RES + px] = this.terrain.heightAt(x, z);
      }
    }
    // colour + hillshade from the cached grid
    for (let py = 0; py < MAP_RES; py++) {
      for (let px = 0; px < MAP_RES; px++) {
        const idx = py * MAP_RES + px;
        const h = heights[idx];
        const x = -WORLD.half + px * mpp;
        const z = -WORLD.half + py * mpp;
        let r: number, g: number, b: number;
        if (h < WORLD.waterLevel) {
          const depth = clamp((WORLD.waterLevel - h) / 22, 0, 1);
          r = 0.20 - depth * 0.12;
          g = 0.42 - depth * 0.18;
          b = 0.58 - depth * 0.12;
        } else {
          const biome: Biome =
            h > 44 ? 'snow' : h > 26 ? 'highland' : h < 3.2 ? 'sand' : 'meadow';
          const c = BIOME_COLORS[biome];
          const hL = heights[py * MAP_RES + Math.max(0, px - 1)];
          const hU = heights[Math.max(0, py - 1) * MAP_RES + px];
          const shade = clamp(1 + ((hL - h) + (hU - h)) * 0.06, 0.55, 1.45);
          r = c[0] * shade;
          g = c[1] * shade;
          b = c[2] * shade;
        }
        const i4 = idx * 4;
        data[i4] = clamp(r, 0, 1) * 255;
        data[i4 + 1] = clamp(g, 0, 1) * 255;
        data[i4 + 2] = clamp(b, 0, 1) * 255;
        data[i4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Draw into a circular minimap canvas. */
  drawMinimap(
    canvas: HTMLCanvasElement,
    playerPos: THREE.Vector3,
    playerYaw: number,
    markers: { x: number; z: number; color: string; kind: 'waypoint' | 'quest' | 'enemy' | 'chest' | 'boss' }[],
    viewMeters = 210,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const R = size / 2;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, size, size);

    const pxPerMeterCanvas = size / viewMeters;
    const scale = pxPerMeterCanvas / (1 / this.metersPerPixel);
    const cx = (playerPos.x + WORLD.half) / this.metersPerPixel;
    const cz = (playerPos.z + WORLD.half) / this.metersPerPixel;

    ctx.translate(R, R);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cz);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();

    // markers (clipped to circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    for (const m of markers) {
      const dx = m.x - playerPos.x;
      const dz = m.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > viewMeters * 0.52) continue;
      const sx = R + dx * pxPerMeterCanvas;
      const sy = R + dz * pxPerMeterCanvas;
      ctx.fillStyle = m.color;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 1;
      if (m.kind === 'waypoint') {
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 4, sy);
        ctx.lineTo(sx, sy + 5);
        ctx.lineTo(sx - 4, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (m.kind === 'quest') {
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.strokeStyle = m.color;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (m.kind === 'boss') {
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff5d6c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (m.kind === 'chest') {
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // player arrow
    ctx.save();
    ctx.translate(R, R);
    // keep the arrow pointing "up" for the camera and rotate the world markers instead?
    // north-up map: arrow shows the character facing
    ctx.rotate(Math.PI - playerYaw);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#9fe8ff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // north indicator
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `${Math.round(size * 0.075)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', R, size * 0.11);
  }

  /** Full world map used by the map screen. */
  drawWorldMap(canvas: HTMLCanvasElement, playerPos: THREE.Vector3, waypoints: { x: number; z: number; name: string; active: boolean }[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, w, h);

    const toPx = (x: number, z: number) => ({
      px: ((x + WORLD.half) / (WORLD.half * 2)) * w,
      py: ((z + WORLD.half) / (WORLD.half * 2)) * h,
    });

    // zone labels
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (const zone of ZONE_NAMES) {
      const { px, py } = toPx(zone.x, zone.z);
      ctx.fillStyle = 'rgba(6,10,18,.55)';
      const tw = ctx.measureText(zone.name).width + 8;
      ctx.fillRect(px - tw / 2, py - 8, tw, 13);
      ctx.fillStyle = 'rgba(240,246,255,.85)';
      ctx.fillText(zone.name, px, py + 2);
    }

    for (const wp of waypoints) {
      const { px, py } = toPx(wp.x, wp.z);
      ctx.beginPath();
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px + 5, py);
      ctx.lineTo(px, py + 6);
      ctx.lineTo(px - 5, py);
      ctx.closePath();
      ctx.fillStyle = wp.active ? '#9fe8ff' : '#5b6b80';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.stroke();
      ctx.font = '600 8px Inter, sans-serif';
      ctx.fillStyle = wp.active ? '#cdefff' : 'rgba(200,215,235,.6)';
      ctx.fillText(wp.name, px, py - 10);
    }

    const { px, py } = toPx(playerPos.x, playerPos.z);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#9fe8ff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
