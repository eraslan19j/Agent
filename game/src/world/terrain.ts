/* =========================================================
   AETHERION — procedural terrain
   Analytic height field: the same function feeds both the mesh
   and the collision queries, so the ground is always exact.
   ========================================================= */
import * as THREE from 'three';
import { clamp, fbm2, ridge2, smoothstep, lerp, mulberry32, valueNoise2 } from '../core/utils';
import { BIOME_COLORS, Biome, FLAT_ZONES, WORLD } from '../data/world';

interface FlatZone {
  x: number;
  z: number;
  radius: number;
  height: number;
}

interface Chunk {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh | null;
  built: boolean;
}

const CHUNK_SEGMENTS = 26;

export class Terrain {
  readonly group = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private flatZones: FlatZone[] = [];
  private material: THREE.MeshStandardMaterial;
  private buildBudget = 1;
  private tmpColor = new THREE.Color();
  readonly size = WORLD.chunkSize;

  constructor() {
    this.group.name = 'terrain';
    for (const z of FLAT_ZONES) {
      this.flatZones.push({
        x: z.x,
        z: z.z,
        radius: z.radius,
        height: this.rawHeight(z.x, z.z),
      });
    }
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: false,
    });
  }

  /** Pre-flattening height. */
  rawHeight(x: number, z: number): number {
    const s = WORLD.seed;
    let h = 4.5 + fbm2(x * 0.0030, z * 0.0030, 4, s) * 25;

    // broad rolling waves
    h += Math.sin(x * 0.0041 + fbm2(x * 0.002, z * 0.002, 2, s + 5) * 3.4) * 3.0;

    // summit ridge (north-east)
    const md = Math.hypot((x - 152) / 218, (z + 182) / 205);
    const mask = Math.exp(-md * md * 1.5);
    h += ridge2(x * 0.0052, z * 0.0052, 4, s + 9) * 66 * mask * mask;
    h += ridge2(x * 0.011, z * 0.011, 3, s + 31) * 9 * mask;

    // lake basin (south-west)
    const ld = Math.hypot(x + 140, z - 130) / 108;
    if (ld < 1) h -= (1 - ld * ld) * 34;

    // boss crater
    const cd = Math.hypot(x, z + 205) / 66;
    if (cd < 1) h -= (1 - cd * cd) * 9;

    // fine detail
    h += (fbm2(x * 0.028, z * 0.028, 2, s + 3) - 0.5) * 1.35;
    return h;
  }

  /** Final height with flattened gameplay plateaus. */
  heightAt = (x: number, z: number): number => {
    let h = this.rawHeight(x, z);
    for (let i = 0; i < this.flatZones.length; i++) {
      const f = this.flatZones[i];
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.radius) {
        const t = smoothstep(1 - d / f.radius);
        h = lerp(h, f.height, t * 0.94);
      }
    }
    return h;
  };

  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = 0.6;
    const hL = this.heightAt(x - e, z);
    const hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e);
    const hU = this.heightAt(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  /** 0 = flat, 1 = vertical wall. */
  slopeAt(x: number, z: number): number {
    const e = 0.7;
    const hL = this.heightAt(x - e, z);
    const hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e);
    const hU = this.heightAt(x, z + e);
    const gx = (hR - hL) / (2 * e);
    const gz = (hU - hD) / (2 * e);
    return clamp(Math.hypot(gx, gz) / 1.4, 0, 1);
  }

  isWater(x: number, z: number) {
    return this.heightAt(x, z) < WORLD.waterLevel - 0.25;
  }

  biomeAt(x: number, z: number): Biome {
    return this.biomeFrom(x, z, this.heightAt(x, z), this.slopeAt(x, z));
  }

  /** Cheap biome lookup when height & slope are already known. */
  biomeFrom(x: number, z: number, h: number, slope: number): Biome {
    const ash = Math.hypot(x, z + 205) < 58;
    if (ash && h > 0.5 && slope < 0.55) return 'ash';
    if (h < WORLD.waterLevel + 1.8) return 'water';
    if (h < WORLD.waterLevel + 3.2) return 'sand';
    if (h > 44) return 'snow';
    if (h > 26) return 'highland';
    if (slope > 0.62) return 'highland';
    const forest = fbm2(x * 0.006 + 11, z * 0.006 - 7, 2, WORLD.seed + 77);
    if (forest > 0.58) return 'forest';
    return 'meadow';
  }

  private colorFor(biome: Biome, slope: number, x: number, z: number, out: THREE.Color) {
    const base = BIOME_COLORS[biome];
    const rock = BIOME_COLORS.highland;
    const mix = clamp((slope - 0.45) * 1.9, 0, 1);
    const v = 0.94 + valueNoise2(x * 0.09, z * 0.09, 5) * 0.12;
    out.setRGB(
      lerp(base[0], rock[0], mix) * v,
      lerp(base[1], rock[1], mix) * v,
      lerp(base[2], rock[2], mix) * v,
    );
    return out;
  }

  private key(cx: number, cz: number) {
    return `${cx},${cz}`;
  }

  private buildChunk(cx: number, cz: number): Chunk {
    const key = this.key(cx, cz);
    const size = this.size;
    const originX = cx * size - size / 2;
    const originZ = cz * size - size / 2;

    const seg = CHUNK_SEGMENTS;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    // Pass 1: heights only (one noise evaluation per vertex).
    const side = seg + 1;
    const heights = new Float32Array(side * side);
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        // PlaneGeometry vertices are laid out row-major (j rows of i columns)
        const idx = j * side + i;
        const lx = -size / 2 + (i / seg) * size;
        const lz = -size / 2 + (j / seg) * size;
        heights[idx] = this.heightAt(originX + lx + size / 2, originZ + lz + size / 2);
      }
    }

    // Pass 2: write positions + vertex colours using the cached heights.
    const step = size / seg;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = originX + lx + size / 2;
      const wz = originZ + lz + size / 2;
      const gi = Math.round((lx + size / 2) / step);
      const gj = Math.round((lz + size / 2) / step);
      const h = heights[gj * side + gi];
      pos.setY(i, h);

      const hL = heights[gj * side + Math.max(0, gi - 1)];
      const hR = heights[gj * side + Math.min(side - 1, gi + 1)];
      const hD = heights[Math.max(0, gj - 1) * side + gi];
      const hU = heights[Math.min(side - 1, gj + 1) * side + gi];
      const slope = clamp(Math.hypot((hR - hL) / (2 * step), (hU - hD) / (2 * step)) / 1.4, 0, 1);

      const biome = this.biomeFrom(wx, wz, h, slope);
      this.colorFor(biome, slope, wx, wz, c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(originX + size / 2, 0, originZ + size / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.visible = false;
    this.group.add(mesh);

    const chunk: Chunk = { key, cx, cz, mesh, built: true };
    this.chunks.set(key, chunk);
    return chunk;
  }

  /** Stream chunks around a position. Returns true when the visible set changed. */
  update(px: number, pz: number, viewChunks = WORLD.viewChunks): boolean {
    const size = this.size;
    const ccx = Math.round(px / size);
    const ccz = Math.round(pz / size);
    let changed = false;
    let built = 0;
    let visibleCount = 0;

    for (let dz = -viewChunks; dz <= viewChunks; dz++) {
      for (let dx = -viewChunks; dx <= viewChunks; dx++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        if (Math.hypot(dx, dz) > viewChunks + 0.35) continue;
        const key = this.key(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          if (built >= this.buildBudget) continue;
          chunk = this.buildChunk(cx, cz);
          built++;
          changed = true;
        }
        if (chunk.mesh) {
          chunk.mesh.visible = true;
          visibleCount++;
        }
      }
    }

    // cull far chunks
    for (const chunk of this.chunks.values()) {
      if (!chunk.mesh) continue;
      const d = Math.hypot(chunk.cx - ccx, chunk.cz - ccz);
      if (d > viewChunks + 1.6) {
        chunk.mesh.visible = false;
        if (d > viewChunks + 4) {
          this.group.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh = null;
          chunk.built = false;
          this.chunks.delete(chunk.key);
        }
      }
    }
    return changed;
  }

  /** Deterministic per-chunk RNG helper. */
  chunkRng(cx: number, cz: number) {
    return mulberry32(WORLD.seed + cx * 73856093 + cz * 19349663);
  }

  /** Highest point in a radius — used for camera, spawns and quest hints. */
  highestAround(x: number, z: number, r: number) {
    let best = -Infinity;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      best = Math.max(best, this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    return Math.max(best, this.heightAt(x, z));
  }

  /** Find a walkable spot near a target (used for spawns & POI placement). */
  findFlatSpot(x: number, z: number, radius: number, rngSeed = 1): { x: number; z: number; y: number } {
    const rng = mulberry32(Math.floor(rngSeed * 1000) + 7);
    let best = { x, z, y: this.heightAt(x, z) };
    let bestScore = Infinity;
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      const y = this.heightAt(px, pz);
      if (y < WORLD.waterLevel + 0.8) continue;
      const score = this.slopeAt(px, pz) * 3 + Math.abs(y - (this.heightAt(x, z)));
      if (score < bestScore) {
        bestScore = score;
        best = { x: px, z: pz, y };
      }
    }
    return best;
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) {
        this.group.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
    }
    this.chunks.clear();
    this.material.dispose();
  }
}
