/* =========================================================
   AETHERION — vegetation & props scattering
   Everything is instanced: 5 draw calls for the whole biome.
   Scatter is generated from per-chunk deterministic RNG so the
   world always looks identical between sessions.
   ========================================================= */
import * as THREE from 'three';
import type { Terrain } from './terrain';
import { WORLD } from '../data/world';
import { clamp, mulberry32 } from '../core/utils';

const TREE_CAP = 360;
const CANOPY_CAP = 720;
const ROCK_CAP = 260;
const FLOWER_CAP = 320;
const GRASS_CAP = 2100;

export class Scatter {
  readonly group = new THREE.Group();
  private trunk: THREE.InstancedMesh;
  private canopy: THREE.InstancedMesh;
  private canopy2: THREE.InstancedMesh;
  private rocks: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private grass: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private lastCx = NaN;
  private lastCz = NaN;
  private lastGrass = new THREE.Vector2(1e9, 1e9);
  private trunkCount = 0;
  private canopyCount = 0;
  private rockCount = 0;
  private flowerCount = 0;
  private grassCount = 0;

  constructor(private terrain: Terrain) {
    this.group.name = 'scatter';

    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 1, 6, 1);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 0.95, flatShading: true });
    this.trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_CAP);
    this.trunk.castShadow = true;
    this.trunk.receiveShadow = true;

    const canopyGeo = new THREE.ConeGeometry(1, 1, 7, 1);
    canopyGeo.translate(0, 0.5, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, vertexColors: false });
    this.canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, CANOPY_CAP);
    this.canopy.castShadow = true;
    this.canopy2 = new THREE.InstancedMesh(canopyGeo, canopyMat, CANOPY_CAP);
    this.canopy2.castShadow = true;

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x77787a, roughness: 0.92, flatShading: true });
    this.rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCK_CAP);
    this.rocks.castShadow = true;
    this.rocks.receiveShadow = true;

    const flowerGeo = new THREE.OctahedronGeometry(0.16, 0);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0x9ff5e0, emissive: 0x2ea88c, emissiveIntensity: 1.5, roughness: 0.3,
    });
    this.flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWER_CAP);

    const grassGeo = new THREE.ConeGeometry(0.045, 0.62, 3, 1, true);
    grassGeo.translate(0, 0.31, 0);
    const grassMat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    this.grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_CAP);

    for (const m of [this.trunk, this.canopy, this.canopy2, this.rocks, this.flowers, this.grass]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    this.canopy2.castShadow = false;
  }

  /** Rebuild trees/rocks/flowers for the chunk ring around (cx,cz). */
  private buildStatic(cx: number, cz: number) {
    let tc = 0, cc = 0, rc = 0, fc = 0;
    const R = WORLD.viewChunks;

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (Math.hypot(dx, dz) > R + 0.4) continue;
        const chx = cx + dx;
        const chz = cz + dz;
        const rng = this.terrain.chunkRng(chx, chz);
        const size = WORLD.chunkSize;
        const baseX = chx * size - size / 2;
        const baseZ = chz * size - size / 2;

        // ---- trees ----
        for (let i = 0; i < 10 && tc < TREE_CAP; i++) {
          const x = baseX + rng() * size;
          const z = baseZ + rng() * size;
          const biome = this.terrain.biomeAt(x, z);
          if (biome !== 'forest' && !(biome === 'meadow' && rng() < 0.14)) continue;
          const slope = this.terrain.slopeAt(x, z);
          if (slope > 0.5) continue;
          const y = this.terrain.heightAt(x, z);
          if (y < WORLD.waterLevel + 1.2) continue;
          const h = 3.4 + rng() * 3.6;
          const w = 0.85 + rng() * 0.5;
          this.dummy.position.set(x, y - 0.15, z);
          this.dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.06);
          this.dummy.scale.set(w, h * 0.45, w);
          this.dummy.updateMatrix();
          this.trunk.setMatrixAt(tc, this.dummy.matrix);

          // two canopy layers
          const hueShift = (rng() - 0.5) * 0.06;
          this.color.setHSL(0.29 + hueShift, 0.42 + rng() * 0.16, 0.24 + rng() * 0.1);
          this.canopy.setColorAt(tc, this.color);
          this.dummy.position.set(x, y + h * 0.34, z);
          this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          this.dummy.scale.set(2.1 * w, h * 0.62, 2.1 * w);
          this.dummy.updateMatrix();
          this.canopy.setMatrixAt(tc, this.dummy.matrix);

          if (cc < CANOPY_CAP) {
            this.color.setHSL(0.3 + hueShift, 0.46, 0.19 + rng() * 0.08);
            this.canopy2.setColorAt(cc, this.color);
            this.dummy.position.set(x, y + h * 0.62, z);
            this.dummy.scale.set(1.45 * w, h * 0.5, 1.45 * w);
            this.dummy.updateMatrix();
            this.canopy2.setMatrixAt(cc, this.dummy.matrix);
            cc++;
          }
          tc++;
        }

        // ---- rocks ----
        for (let i = 0; i < 3 && rc < ROCK_CAP; i++) {
          const x = baseX + rng() * size;
          const z = baseZ + rng() * size;
          const y = this.terrain.heightAt(x, z);
          if (y < WORLD.waterLevel - 0.5) continue;
          const s = 0.5 + rng() * 1.5;
          this.dummy.position.set(x, y + s * 0.32, z);
          this.dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
          this.dummy.scale.set(s, s * (0.6 + rng() * 0.5), s);
          this.dummy.updateMatrix();
          this.rocks.setMatrixAt(rc, this.dummy.matrix);
          this.color.setHSL(0.1, 0.04, 0.34 + rng() * 0.18);
          this.rocks.setColorAt(rc, this.color);
          rc++;
        }

        // ---- flowers (harvestable nodes are separate world objects) ----
        for (let i = 0; i < 6 && fc < FLOWER_CAP; i++) {
          const x = baseX + rng() * size;
          const z = baseZ + rng() * size;
          const biome = this.terrain.biomeAt(x, z);
          if (biome !== 'meadow' && biome !== 'forest') continue;
          if (this.terrain.slopeAt(x, z) > 0.42) continue;
          const y = this.terrain.heightAt(x, z);
          if (y < WORLD.waterLevel + 1) continue;
          this.dummy.position.set(x, y + 0.22 + rng() * 0.15, z);
          this.dummy.rotation.set(rng(), rng() * 6, rng());
          const s = 0.7 + rng() * 0.8;
          this.dummy.scale.setScalar(s);
          this.dummy.updateMatrix();
          this.flowers.setMatrixAt(fc, this.dummy.matrix);
          this.color.setHSL(0.42 + rng() * 0.1, 0.7, 0.62);
          this.flowers.setColorAt(fc, this.color);
          fc++;
        }
      }
    }

    this.trunkCount = tc;
    this.canopyCount = tc;
    this.rockCount = rc;
    this.flowerCount = fc;
    this.trunk.count = tc;
    this.canopy.count = tc;
    this.canopy2.count = cc;
    this.rocks.count = rc;
    this.flowers.count = fc;
    for (const m of [this.trunk, this.canopy, this.canopy2, this.rocks, this.flowers]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Local grass carpet that follows the player (tile rebuild). */
  private buildGrass(px: number, pz: number) {
    const rng = mulberry32(Math.floor(px * 13.7) * 374761393 + Math.floor(pz * 7.3) * 668265263);
    let gc = 0;
    const radius = 30;
    for (let i = 0; i < GRASS_CAP * 2 && gc < GRASS_CAP; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      const y = this.terrain.heightAt(x, z);
      if (y < WORLD.waterLevel + 0.8 || y > 26) continue;
      const s = 0.7 + rng() * 0.9;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35);
      this.dummy.scale.set(s, s * (0.8 + rng() * 0.7), s);
      this.dummy.updateMatrix();
      this.grass.setMatrixAt(gc, this.dummy.matrix);
      this.color.setHSL(0.26 + rng() * 0.06, 0.45 + rng() * 0.2, 0.22 + rng() * 0.16);
      this.grass.setColorAt(gc, this.color);
      gc++;
    }
    this.grassCount = gc;
    this.grass.count = gc;
    this.grass.instanceMatrix.needsUpdate = true;
    if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
  }

  update(px: number, pz: number) {
    const size = WORLD.chunkSize;
    const cx = Math.round(px / size);
    const cz = Math.round(pz / size);
    if (cx !== this.lastCx || cz !== this.lastCz) {
      this.lastCx = cx;
      this.lastCz = cz;
      this.buildStatic(cx, cz);
    }
    if (this.lastGrass.distanceToSquared(new THREE.Vector2(px, pz)) > 484) {
      this.lastGrass.set(px, pz);
      this.buildGrass(px, pz);
    }
  }

  setQuality(q: 'low' | 'medium' | 'high') {
    const ratio = q === 'low' ? 0.35 : q === 'medium' ? 0.7 : 1;
    this.grass.count = Math.floor(this.grassCount * ratio);
  }

  /** Nearest tree position — used for climbing hints and ambience. */
  get stats() {
    return { trees: this.trunkCount, rocks: this.rockCount, flowers: this.flowerCount, grass: this.grassCount };
  }

  dispose() {
    for (const m of [this.trunk, this.canopy, this.canopy2, this.rocks, this.flowers, this.grass]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

export const SCATTER_LIMITS = { TREE_CAP, ROCK_CAP, FLOWER_CAP, GRASS_CAP };
export { clamp };
