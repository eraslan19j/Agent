/* =========================================================
   AETHERION — VFX system
   One additive particle buffer + pooled rings / slashes / beams.
   Zero allocations at runtime, mobile friendly.
   ========================================================= */
import * as THREE from 'three';
import { clamp, Pool, TAU } from '../core/utils';

const MAX_PARTICLES = 1400;

interface Particle {
  vx: number; vy: number; vz: number;
  life: number; maxLife: number; drag: number; gravity: number;
  r: number; g: number; b: number;
}

export class Effects {
  readonly group = new THREE.Group();
  private positions: Float32Array;
  private colors: Float32Array;
  private particleData: Particle[] = [];
  private head = 0;
  private points: THREE.Points;
  private pointsMat: THREE.PointsMaterial;
  private color = new THREE.Color();

  private ringPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private ringActive: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; maxLife: number; from: number; to: number; follow?: THREE.Vector3 }[] = [];

  private slashPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private slashActive: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; maxLife: number }[] = [];

  private beamPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private beamActive: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; maxLife: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'fx';
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particleData.push({ vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, drag: 1, gravity: 0, r: 0, g: 0, b: 0 });
      this.positions[i * 3 + 1] = -9999;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.pointsMat = new THREE.PointsMaterial({
      size: 0.34,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      opacity: 0.95,
    });
    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // ring pool
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.ringPool.push({ mesh, mat });
    }

    // slash pool
    const slashGeo = new THREE.RingGeometry(0.55, 1.15, 26, 1, -0.9, 1.8);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(slashGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.slashPool.push({ mesh, mat });
    }

    // beam pool
    const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true);
    beamGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.beamPool.push({ mesh, mat });
    }

    scene.add(this.group);
  }

  private spawn(x: number, y: number, z: number, color: THREE.Color, p: Partial<Particle> & { speed?: number; spread?: number; dir?: THREE.Vector3 }) {
    const i = this.head;
    this.head = (this.head + 1) % MAX_PARTICLES;
    const d = this.particleData[i];
    const speed = p.speed ?? 3;
    let vx: number, vy: number, vz: number;
    if (p.dir) {
      const s = p.spread ?? 0.6;
      vx = (p.dir.x + (Math.random() - 0.5) * s) * speed;
      vy = (p.dir.y + (Math.random() - 0.5) * s) * speed;
      vz = (p.dir.z + (Math.random() - 0.5) * s) * speed;
    } else {
      const a = Math.random() * TAU;
      const el = Math.random() * Math.PI;
      vx = Math.cos(a) * Math.sin(el) * speed;
      vy = Math.cos(el) * speed * 0.6 + speed * 0.25;
      vz = Math.sin(a) * Math.sin(el) * speed;
    }
    d.vx = vx; d.vy = vy; d.vz = vz;
    d.maxLife = p.maxLife ?? 0.7;
    d.life = d.maxLife;
    d.drag = p.drag ?? 1.6;
    d.gravity = p.gravity ?? 6;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    d.r = color.r; d.g = color.g; d.b = color.b;
    this.colors[i * 3] = color.r;
    this.colors[i * 3 + 1] = color.g;
    this.colors[i * 3 + 2] = color.b;
  }

  burst(pos: THREE.Vector3, color: string | number | THREE.Color, count = 24, speed = 4, life = 0.7, gravity = 6) {
    this.color.set(color as any);
    for (let i = 0; i < count; i++) {
      this.spawn(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.4,
        this.color,
        { speed: speed * (0.4 + Math.random() * 0.9), maxLife: life * (0.6 + Math.random() * 0.8), gravity },
      );
    }
  }

  trail(pos: THREE.Vector3, color: string | number, count = 2, spread = 0.35) {
    this.color.set(color as any);
    for (let i = 0; i < count; i++) {
      this.spawn(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + Math.random() * 0.5,
        pos.z + (Math.random() - 0.5) * spread,
        this.color,
        { speed: 0.5, maxLife: 0.45, gravity: -0.6, drag: 2.5 },
      );
    }
  }

  arc(pos: THREE.Vector3, dir: THREE.Vector3, color: string | number, size = 2.6, life = 0.22, tilt = 0) {
    this.color.set(color);
    let slot = this.slashPool.find((p) => p.mesh.visible === false);
    if (!slot) slot = this.slashPool[0];
    const { mesh, mat } = slot;
    mesh.visible = true;
    mesh.position.copy(pos);
    mesh.scale.setScalar(size);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().setY(0.18).normalize());
    mesh.rotateZ(Math.PI * 0.5 + tilt);
    mat.color.copy(this.color);
    mat.opacity = 0.95;
    this.slashActive.push({ mesh, mat, life, maxLife: life });
  }

  ring(pos: THREE.Vector3, color: string | number, from = 0.4, to = 4, life = 0.55, vertical = false) {
    this.color.set(color);
    let slot = this.ringPool.find((p) => p.mesh.visible === false);
    if (!slot) slot = this.ringPool[0];
    const { mesh, mat } = slot;
    mesh.visible = true;
    mesh.position.copy(pos);
    mesh.rotation.set(vertical ? 0 : -Math.PI / 2, 0, 0);
    mesh.scale.setScalar(from);
    mat.color.copy(this.color);
    mat.opacity = 0.9;
    this.ringActive.push({ mesh, mat, life, maxLife: life, from, to });
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, color: string | number, life = 0.25, width = 0.12) {
    this.color.set(color);
    let slot = this.beamPool.find((p) => p.mesh.visible === false);
    if (!slot) slot = this.beamPool[0];
    const { mesh, mat } = slot;
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.01) return;
    mesh.visible = true;
    mesh.position.copy(from);
    mesh.scale.set(width / 0.09, len, width / 0.09);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mat.color.copy(this.color);
    mat.opacity = 0.95;
    this.beamActive.push({ mesh, mat, life, maxLife: life });
  }

  heal(pos: THREE.Vector3) {
    this.color.set('#8ff7b8');
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * 0.7;
      this.spawn(pos.x + Math.cos(a) * r, pos.y + Math.random() * 0.4, pos.z + Math.sin(a) * r, this.color, {
        speed: 1.2, maxLife: 1.1, gravity: -2.2, drag: 1.2,
      });
    }
  }

  lightning(from: THREE.Vector3, to: THREE.Vector3, color = '#b98cff') {
    // jagged bolt built from a few segments
    const steps = 4;
    let prev = from.clone();
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = from.clone().lerp(to, t);
      if (i !== steps) {
        p.x += (Math.random() - 0.5) * 0.9;
        p.z += (Math.random() - 0.5) * 0.9;
        p.y += (Math.random() - 0.5) * 0.4;
      }
      this.beam(prev, p, color, 0.18, 0.07);
      prev = p;
    }
  }

  update(dt: number) {
    // particles
    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.points.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const d = this.particleData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        this.positions[i * 3 + 1] = -9999;
        this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
        continue;
      }
      const f = Math.max(0, 1 - d.drag * dt);
      d.vx *= f; d.vz *= f;
      d.vy = d.vy * f - d.gravity * dt;
      this.positions[i * 3] += d.vx * dt;
      this.positions[i * 3 + 1] += d.vy * dt;
      this.positions[i * 3 + 2] += d.vz * dt;
      const k = clamp(d.life / d.maxLife, 0, 1);
      const fade = k * k;
      this.colors[i * 3] = d.r * fade;
      this.colors[i * 3 + 1] = d.g * fade;
      this.colors[i * 3 + 2] = d.b * fade;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // slashes
    for (let i = this.slashActive.length - 1; i >= 0; i--) {
      const s = this.slashActive[i];
      s.life -= dt;
      const k = clamp(s.life / s.maxLife, 0, 1);
      s.mat.opacity = k * 0.95;
      s.mesh.scale.multiplyScalar(1 + dt * 2.6);
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.slashActive.splice(i, 1);
      }
    }

    // rings
    for (let i = this.ringActive.length - 1; i >= 0; i--) {
      const r = this.ringActive[i];
      r.life -= dt;
      const k = 1 - clamp(r.life / r.maxLife, 0, 1);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * k);
      r.mat.opacity = (1 - k) * 0.9;
      if (r.life <= 0) {
        r.mesh.visible = false;
        this.ringActive.splice(i, 1);
      }
    }

    // beams
    for (let i = this.beamActive.length - 1; i >= 0; i--) {
      const b = this.beamActive[i];
      b.life -= dt;
      const k = clamp(b.life / b.maxLife, 0, 1);
      b.mat.opacity = k * 0.95;
      if (b.life <= 0) {
        b.mesh.visible = false;
        this.beamActive.splice(i, 1);
      }
    }
  }

  clear() {
    for (const d of this.particleData) d.life = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
    }
    for (const r of this.ringActive) r.mesh.visible = false;
    for (const s of this.slashActive) s.mesh.visible = false;
    for (const b of this.beamActive) b.mesh.visible = false;
    this.ringActive.length = 0;
    this.slashActive.length = 0;
    this.beamActive.length = 0;
  }
}
