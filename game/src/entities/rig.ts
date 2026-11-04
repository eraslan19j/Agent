/* =========================================================
   AETHERION — procedural character & creature rigs
   No external model files: every mesh is built in code and
   animated with a hand-authored procedural rig. This keeps the
   APK small and the art direction perfectly consistent.
   ========================================================= */
import * as THREE from 'three';
import type { CharacterDef, Palette, WeaponType } from '../data/characters';
import type { EnemyDef } from '../data/enemies';
import { clamp, damp, DEG, lerp, TAU } from '../core/utils';

/* ---------- shared assets ---------- */
let gradientMap: THREE.DataTexture | null = null;
function getGradientMap(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([70, 130, 190, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  gradientMap = tex;
  return tex;
}

const matCache = new Map<string, THREE.Material>();
function toonColor(hex: string, emissive = '#000000', emissiveIntensity = 0): THREE.MeshToonMaterial {
  const key = `t:${hex}:${emissive}:${emissiveIntensity}`;
  let m = matCache.get(key) as THREE.MeshToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: new THREE.Color(hex),
      gradientMap: getGradientMap(),
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
    });
    matCache.set(key, m);
  }
  return m;
}
function metalColor(hex: string, metalness = 0.85, roughness = 0.32) {
  const key = `m:${hex}:${metalness}:${roughness}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), metalness, roughness });
    matCache.set(key, m);
  }
  return m;
}
function glowBasic(hex: string, opacity = 1) {
  const key = `g:${hex}:${opacity}`;
  let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: opacity < 1, opacity });
    matCache.set(key, m);
  }
  return m;
}

const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 8);

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, scale: [number, number, number], pos: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(scale[0], scale[1], scale[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/* =========================================================
   Weapons
   ========================================================= */
export function buildWeapon(type: WeaponType, palette: Palette): THREE.Group {
  const g = new THREE.Group();
  const blade = metalColor(palette.metal, 0.9, 0.25);
  const accent = toonColor(palette.accent, palette.accent, 0.55);
  const grip = toonColor(palette.clothDark);

  if (type === 'sword') {
    g.add(mesh(BOX, blade, [0.055, 0.86, 0.014], [0, -0.52, 0]));
    g.add(mesh(CONE, blade, [0.038, 0.12, 0.012], [0, -1.0, 0]));
    g.add(mesh(BOX, accent, [0.2, 0.03, 0.04], [0, -0.09, 0]));
    g.add(mesh(CYL, grip, [0.025, 0.18, 0.025], [0, 0.01, 0]));
    g.add(mesh(SPHERE, accent, [0.035, 0.035, 0.035], [0, 0.1, 0]));
  } else if (type === 'claymore') {
    g.add(mesh(BOX, blade, [0.14, 1.12, 0.035], [0, -0.66, 0]));
    g.add(mesh(CONE, blade, [0.1, 0.16, 0.03], [0, -1.28, 0]));
    g.add(mesh(BOX, accent, [0.3, 0.045, 0.06], [0, -0.08, 0]));
    g.add(mesh(CYL, grip, [0.032, 0.26, 0.032], [0, 0.02, 0]));
    g.add(mesh(SPHERE, glowBasic(palette.accent, 0.85), [0.04, 0.04, 0.04], [0, 0.16, 0]));
  } else if (type === 'polearm') {
    g.add(mesh(CYL, toonColor(palette.clothDark), [0.024, 1.9, 0.024], [0, -0.65, 0]));
    g.add(mesh(CONE, blade, [0.06, 0.42, 0.02], [0, -1.68, 0]));
    g.add(mesh(BOX, accent, [0.12, 0.05, 0.05], [0, -1.45, 0]));
    g.add(mesh(BOX, accent, [0.05, 0.14, 0.02], [0.06, -1.58, 0]).rotateZ(0.4));
  } else if (type === 'bow') {
    const curve = new THREE.TorusGeometry(0.42, 0.022, 6, 16, Math.PI * 1.1);
    const m = new THREE.Mesh(curve, blade);
    m.rotation.z = Math.PI * 0.45;
    m.position.set(0, -0.2, 0);
    m.castShadow = true;
    g.add(m);
    g.add(mesh(BOX, accent, [0.01, 0.9, 0.01], [0.28, -0.22, 0]));
  } else {
    // catalyst: floating sigil + orb
    const orb = mesh(SPHERE, glowBasic(palette.accent, 0.95), [0.12, 0.12, 0.12], [0, -0.28, 0]);
    g.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 5, 18), accent);
    ring.rotation.x = Math.PI / 2.6;
    ring.position.set(0, -0.28, 0);
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 4, 18), glowBasic(palette.accent, 0.5));
    ring2.rotation.x = Math.PI / 1.7;
    ring2.position.set(0, -0.28, 0);
    g.add(ring2);
    (g as any).__orb = orb;
  }
  return g;
}

/* =========================================================
   Humanoid rig (players + humanoid enemies)
   ========================================================= */
export interface RigPose {
  state: 'idle' | 'run' | 'sprint' | 'jump' | 'fall' | 'glide' | 'climb' | 'swim' | 'attack' | 'skill' | 'burst' | 'hurt' | 'dead';
  speed: number;
  attackProgress?: number;
  attackKind?: 'light' | 'heavy';
  time: number;
  dead?: boolean;
}

export class HumanoidRig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly hips = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly head = new THREE.Group();
  readonly armL = new THREE.Group();
  readonly armR = new THREE.Group();
  readonly legL = new THREE.Group();
  readonly legR = new THREE.Group();
  readonly weaponAnchor = new THREE.Group();
  weapon: THREE.Group | null = null;
  private hairPivot = new THREE.Group();
  private cape: THREE.Mesh | null = null;
  private elapsed = 0;
  private armLBase = 0;
  private orb: THREE.Object3D | null = null;
  readonly accentColor: string;

  constructor(readonly palette: Palette, weaponType: WeaponType | null, scale = 1, accent = '#ffffff') {
    this.accentColor = accent;
    this.root.name = 'rig';
    this.root.add(this.body);
    this.body.add(this.hips);
    this.hips.add(this.torso);
    this.torso.add(this.head);
    this.torso.add(this.armL, this.armR);
    this.hips.add(this.legL, this.legR);

    const cloth = toonColor(palette.cloth);
    const clothDark = toonColor(palette.clothDark);
    const skin = toonColor(palette.skin);
    const hairMat = toonColor(palette.hair);
    const hairDark = toonColor(palette.hairDark);
    const accentMat = toonColor(palette.accent, palette.accent, 0.7);

    // ---- torso ----
    const chest = mesh(BOX, cloth, [0.36, 0.34, 0.22], [0, 0.44, 0]);
    const waist = mesh(BOX, clothDark, [0.28, 0.18, 0.19], [0, 0.20, 0]);
    const collar = mesh(BOX, accentMat, [0.34, 0.05, 0.23], [0, 0.59, 0]);
    this.torso.add(chest, waist, collar);
    this.torso.position.y = 0.88;

    // shoulder pads
    this.torso.add(mesh(SPHERE, accentMat, [0.1, 0.075, 0.1], [0.2, 0.55, 0]));
    this.torso.add(mesh(SPHERE, accentMat, [0.1, 0.075, 0.1], [-0.2, 0.55, 0]));

    // ---- head ----
    this.head.position.y = 0.66;
    const skull = mesh(SPHERE, skin, [0.155, 0.175, 0.16], [0, 0.14, 0]);
    const jaw = mesh(SPHERE, skin, [0.115, 0.1, 0.13], [0, 0.055, 0.02]);
    this.head.add(skull, jaw);

    // eyes (anime style: bright emissive plates)
    const eyeMat = glowBasic(palette.accent);
    this.head.add(mesh(SPHERE, eyeMat, [0.028, 0.036, 0.012], [0.058, 0.13, 0.145]));
    this.head.add(mesh(SPHERE, eyeMat, [0.028, 0.036, 0.012], [-0.058, 0.13, 0.145]));

    // hair: cap + bangs + back tuft
    const hairCap = mesh(SPHERE, hairMat, [0.165, 0.16, 0.17], [0, 0.19, -0.012]);
    this.head.add(hairCap);
    for (let i = 0; i < 5; i++) {
      const a = -0.5 + i * 0.25;
      const bang = mesh(CONE, i % 2 ? hairMat : hairDark, [0.035, 0.13, 0.035], [Math.sin(a) * 0.13, 0.09, 0.14]);
      bang.rotation.x = Math.PI * 0.92;
      bang.rotation.z = a * 0.4;
      this.head.add(bang);
    }
    this.hairPivot.position.set(0, 0.2, -0.12);
    this.head.add(this.hairPivot);
    const backHair = mesh(CONE, hairDark, [0.13, 0.34, 0.12], [0, -0.1, -0.03]);
    backHair.rotation.x = Math.PI;
    this.hairPivot.add(backHair);
    const pony = mesh(CONE, hairMat, [0.055, 0.42, 0.05], [0, -0.16, -0.03]);
    pony.rotation.x = Math.PI * 1.06;
    this.hairPivot.add(pony);

    // ---- limbs ----
    const buildArm = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.215, 0.55, 0);
      const upper = mesh(CYL, cloth, [0.052, 0.26, 0.052], [0, -0.13, 0]);
      const fore = mesh(CYL, clothDark, [0.045, 0.24, 0.045], [0, -0.38, 0]);
      const hand = mesh(SPHERE, skin, [0.048, 0.055, 0.045], [0, -0.52, 0]);
      g.add(upper, fore, hand);
      return g;
    };
    this.armL.add(buildArm(-1));
    this.armR.add(buildArm(1));
    this.armL.position.set(-0.215, 0.55, 0);
    this.armR.position.set(0.215, 0.55, 0);
    this.torso.add(this.armL, this.armR);

    const buildLeg = (side: number) => {
      const g = new THREE.Group();
      const thigh = mesh(CYL, clothDark, [0.062, 0.42, 0.062], [0, -0.21, 0]);
      const shin = mesh(CYL, cloth, [0.052, 0.4, 0.052], [0, -0.62, 0]);
      const foot = mesh(BOX, clothDark, [0.085, 0.07, 0.19], [0, -0.85, 0.045]);
      g.add(thigh, shin, foot);
      return g;
    };
    this.legL.add(buildLeg(-1));
    this.legR.add(buildLeg(1));
    this.legL.position.set(-0.1, 0.86, 0);
    this.legR.position.set(0.1, 0.86, 0);
    this.hips.add(this.legL, this.legR);
    this.hips.position.y = 0.0;

    // ---- weapon ----
    if (weaponType) {
      this.weaponAnchor.position.set(0, -0.55, 0.02);
      this.weaponAnchor.rotation.x = -0.2;
      this.armR.add(this.weaponAnchor);
      this.weapon = buildWeapon(weaponType, palette);
      this.weapon.scale.setScalar(weaponType === 'claymore' ? 1.15 : 1);
      this.weaponAnchor.add(this.weapon);
      this.orb = (this.weapon as any).__orb ?? null;
    }

    // ---- cape / scarf ----
    const capeGeo = new THREE.PlaneGeometry(0.42, 0.7, 4, 6);
    capeGeo.translate(0, -0.35, 0);
    const capeMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(palette.accent), side: THREE.DoubleSide,
      gradientMap: getGradientMap(), transparent: true, opacity: 0.85,
    });
    this.cape = new THREE.Mesh(capeGeo, capeMat);
    this.cape.position.set(0, 0.55, -0.13);
    this.cape.rotation.x = 0.18;
    this.cape.castShadow = true;
    this.torso.add(this.cape);

    this.root.scale.setScalar(scale);
  }

  get object() {
    return this.root;
  }

  update(dt: number, pose: RigPose) {
    this.elapsed += dt;
    const t = this.elapsed;
    const { state, speed } = pose;
    const swing = Math.sin(t * 11) * 0.6;

    // reset targets
    let torsoX = 0, torsoY = 0;
    let armLX = 0, armRX = 0, armLZ = 0.12, armRZ = -0.12;
    let legLX = 0, legRX = 0, legLZ = 0, legRZ = 0;
    let bodyY = 0;
    let headY = 0;

    if (pose.dead || state === 'dead') {
      this.body.rotation.x = damp(this.body.rotation.x, -1.35, 6, dt);
      this.body.position.y = damp(this.body.position.y, 0.25, 5, dt);
      return;
    }

    switch (state) {
      case 'idle': {
        bodyY = Math.sin(t * 2.1) * 0.012;
        torsoX = Math.sin(t * 2.1) * 0.02;
        armLZ = 0.16 + Math.sin(t * 2.1) * 0.02;
        armRZ = -0.16 - Math.sin(t * 2.1) * 0.02;
        armLX = Math.sin(t * 1.6) * 0.05;
        armRX = Math.sin(t * 1.6 + 1) * 0.05;
        headY = Math.sin(t * 0.8) * 0.12;
        break;
      }
      case 'run':
      case 'sprint': {
        const f = state === 'sprint' ? 15 : 11;
        const amp = state === 'sprint' ? 0.95 : 0.7;
        const s = Math.sin(t * f);
        const c = Math.cos(t * f);
        legLX = s * amp;
        legRX = -s * amp;
        armLX = -s * amp * 0.85;
        armRX = s * amp * 0.85;
        torsoX = 0.14 + (state === 'sprint' ? 0.12 : 0);
        bodyY = Math.abs(c) * 0.055;
        headY = 0;
        break;
      }
      case 'jump':
        legLX = -0.5; legRX = 0.35; armLX = -1.4; armRX = -1.1; torsoX = 0.1; bodyY = 0.03;
        break;
      case 'fall':
        legLX = -0.25; legRX = 0.2; armLX = -1.9; armRX = -1.7; armLZ = 0.5; armRZ = -0.5; torsoX = -0.1;
        break;
      case 'glide':
        armLX = -2.5; armRX = -2.5; armLZ = 0.85; armRZ = -0.85;
        legLX = -0.28; legRX = 0.12; torsoX = -0.22; bodyY = 0.06;
        break;
      case 'climb': {
        const s = Math.sin(t * 6);
        armLX = -2.3 + s * 0.35; armRX = -2.3 - s * 0.35;
        armLZ = 0.28; armRZ = -0.28;
        legLX = -0.5 + s * 0.3; legRX = -0.5 - s * 0.3;
        torsoX = 0.15;
        break;
      }
      case 'swim': {
        const s = Math.sin(t * 4.5);
        armLX = -1.4 + s * 0.5; armRX = -1.4 - s * 0.5;
        legLX = s * 0.4; legRX = -s * 0.4;
        torsoX = 0.55; bodyY = -0.05;
        break;
      }
      case 'hurt':
        torsoX = -0.28; armLX = -0.5; armRX = -0.4; armLZ = 0.6; armRZ = -0.6; headY = 0.2;
        break;
      case 'skill':
      case 'burst': {
        const p = clamp(pose.attackProgress ?? 0.5, 0, 1);
        const s = Math.sin(p * Math.PI);
        armLX = -1.2 * s; armRX = -2.2 * s;
        armLZ = 0.9 * s; armRZ = -0.9 * s;
        torsoX = -0.2 * s;
        bodyY = 0.05 * s;
        break;
      }
      case 'attack': {
        const p = clamp(pose.attackProgress ?? 0, 0, 1);
        // three phase: windup (0-0.28), strike (0.28-0.55), recover (0.55-1)
        let angle: number;
        if (p < 0.28) angle = lerp(-0.4, -2.1, p / 0.28);
        else if (p < 0.55) angle = lerp(-2.1, 1.15, (p - 0.28) / 0.27);
        else angle = lerp(1.15, 0.1, (p - 0.55) / 0.45);
        armRX = angle;
        armRZ = -0.1;
        armLX = -0.35 + Math.sin(p * Math.PI) * -0.3;
        torsoY = p < 0.55 ? lerp(0.35, -0.6, clamp((p - 0.2) / 0.35, 0, 1)) : lerp(-0.6, 0, (p - 0.55) / 0.45);
        torsoX = 0.12;
        legLX = -0.2; legRX = 0.25;
        break;
      }
    }

    // smooth towards targets
    const k = state === 'attack' || state === 'skill' || state === 'burst' ? 26 : 14;
    this.armL.rotation.x = damp(this.armL.rotation.x, armLX, k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, armRX, k, dt);
    this.armL.rotation.z = damp(this.armL.rotation.z, armLZ, k, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, armRZ, k, dt);
    this.legL.rotation.x = damp(this.legL.rotation.x, legLX, k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, legRX, k, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, torsoX, 10, dt);
    this.torso.rotation.y = damp(this.torso.rotation.y, torsoY, 14, dt);
    this.head.rotation.y = damp(this.head.rotation.y, headY, 6, dt);
    this.body.position.y = damp(this.body.position.y, bodyY, 12, dt);
    this.body.rotation.x = damp(this.body.rotation.x, 0, 8, dt);

    // cape flutter
    if (this.cape) {
      const flutter = Math.sin(t * 6 + Math.sin(t * 2)) * 0.12 + speed * 0.05;
      this.cape.rotation.x = 0.18 + flutter;
      this.cape.rotation.z = Math.sin(t * 4.3) * 0.06;
    }
    // hair inertia
    this.hairPivot.rotation.x = Math.sin(t * 3.1) * 0.07 + speed * 0.05;
    this.hairPivot.rotation.z = Math.sin(t * 2.4) * 0.05;

    // catalyst orb orbit
    if (this.orb) {
      this.orb.position.y = -0.28 + Math.sin(t * 2.6) * 0.03;
      this.orb.rotation.y += dt * 2;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry !== SPHERE && m.geometry !== CYL && m.geometry !== BOX && m.geometry !== CONE) {
        m.geometry.dispose();
      }
    });
  }
}

/* =========================================================
   Enemy / creature models
   ========================================================= */
export interface CreatureModel {
  root: THREE.Group;
  core: THREE.Group;
  update(dt: number, t: number, state: string, charge: number): void;
  hitFlash(duration?: number): void;
  dispose(): void;
}

class HitFlashable {
  private entries: { mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
  private flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  flashTime = 0;

  collect(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) this.entries.push({ mesh: m, mat: m.material as THREE.Material | THREE.Material[] });
    });
  }

  /** Swap materials (never mutate shared materials!). */
  set(on: boolean) {
    for (const e of this.entries) {
      e.mesh.material = on ? this.flashMat : e.mat;
    }
  }

  dispose() {
    this.flashMat.dispose();
    this.entries.length = 0;
  }
}

export function buildEnemyModel(def: EnemyDef): CreatureModel {
  const root = new THREE.Group();
  const core = new THREE.Group();
  root.add(core);
  const body = toonColor(def.color.body);
  const accent = toonColor(def.color.accent, def.color.accent, 0.8);
  const glow = glowBasic(def.color.glow);
  const flash = new HitFlashable();

  let animate: (dt: number, t: number, state: string, charge: number) => void = () => {};

  if (def.model === 'humanoid') {
    const hips = new THREE.Group();
    core.add(hips);
    const torso = mesh(BOX, body, [0.42, 0.5, 0.26], [0, 0.5, 0]);
    const head = mesh(SPHERE, body, [0.17, 0.19, 0.17], [0, 0.86, 0.02]);
    const mask = mesh(BOX, accent, [0.2, 0.07, 0.04], [0, 0.87, 0.16]);
    const eyeL = mesh(SPHERE, glow, [0.03, 0.022, 0.01], [0.06, 0.88, 0.19]);
    const eyeR = mesh(SPHERE, glow, [0.03, 0.022, 0.01], [-0.06, 0.88, 0.19]);
    hips.add(torso, head, mask, eyeL, eyeR);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.28, 0.68, 0);
    armR.position.set(0.28, 0.68, 0);
    armL.add(mesh(CYL, body, [0.06, 0.42, 0.06], [0, -0.21, 0]));
    armR.add(mesh(CYL, body, [0.06, 0.42, 0.06], [0, -0.21, 0]));
    armL.add(mesh(CONE, accent, [0.05, 0.16, 0.05], [0, -0.46, 0.03]));
    armR.add(mesh(CONE, accent, [0.05, 0.16, 0.05], [0, -0.46, 0.03]));
    hips.add(armL, armR);
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.13, 0.34, 0); legR.position.set(0.13, 0.34, 0);
    legL.add(mesh(CYL, body, [0.07, 0.36, 0.07], [0, -0.18, 0]));
    legR.add(mesh(CYL, body, [0.07, 0.36, 0.07], [0, -0.18, 0]));
    hips.add(legL, legR);
    core.position.y = 0.35;

    animate = (dt, t, state, charge) => {
      const walk = state === 'chase' ? Math.sin(t * 8) * 0.55 : 0;
      legL.rotation.x = damp(legL.rotation.x, walk, 12, dt);
      legR.rotation.x = damp(legR.rotation.x, -walk, 12, dt);
      armL.rotation.x = damp(armL.rotation.x, state === 'windup' ? -2.2 : -walk * 0.7 + 0.2, 12, dt);
      armR.rotation.x = damp(armR.rotation.x, state === 'windup' ? -2.2 : walk * 0.7 + 0.2, 12, dt);
      hips.position.y = Math.abs(Math.sin(t * 8)) * 0.05 * (state === 'chase' ? 1 : 0.2);
      core.rotation.z = Math.sin(t * 1.7) * 0.02;
      const c = clamp(charge, 0, 1);
      (mask.material as THREE.Material); // keep reference
      eyeL.scale.setScalar(1 + c * 1.2);
      eyeR.scale.setScalar(1 + c * 1.2);
      core.rotation.x = damp(core.rotation.x, state === 'attack' ? 0.35 : 0, 8, dt);
    };
  } else if (def.model === 'blob') {
    const shell = mesh(SPHERE, toonColor(def.color.body, def.color.glow, 0.22), [0.55, 0.5, 0.55], [0, 0.5, 0]);
    const inner = mesh(SPHERE, glow, [0.24, 0.22, 0.24], [0, 0.42, 0]);
    const eyes: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const e = mesh(SPHERE, glowBasic('#ffffff'), [0.05, 0.06, 0.02], [s * 0.16, 0.6, 0.48]);
      eyes.push(e);
      core.add(e);
    }
    core.add(shell, inner);
    animate = (dt, t, state, charge) => {
      const hop = state === 'chase' || state === 'attack' ? Math.abs(Math.sin(t * 6)) * 0.28 : Math.sin(t * 2) * 0.05;
      core.position.y = hop;
      const squash = state === 'windup' ? 0.72 : 1 + Math.sin(t * 6) * 0.06;
      shell.scale.set(0.55 / squash, 0.5 * squash, 0.55 / squash);
      inner.scale.setScalar(0.9 + clamp(charge, 0, 1) * 0.6);
      core.rotation.y = Math.sin(t * 0.9) * 0.3;
    };
  } else if (def.model === 'golem') {
    const torso = mesh(BOX, toonColor('#5b5347'), [0.9, 0.95, 0.7], [0, 1.1, 0]);
    const head = mesh(BOX, toonColor('#6b6255'), [0.42, 0.38, 0.4], [0, 1.78, 0.05]);
    const coreGem = mesh(new THREE.OctahedronGeometry(0.17, 0), accent, [1, 1, 1], [0, 1.25, 0.38]);
    const eyeGlow = mesh(BOX, glow, [0.3, 0.06, 0.02], [0, 1.8, 0.24]);
    core.add(torso, head, coreGem, eyeGlow);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.58, 1.5, 0); armR.position.set(0.58, 1.5, 0);
    for (const [arm, s] of [[armL, -1], [armR, 1]] as const) {
      arm.add(mesh(BOX, toonColor('#4c453b'), [0.26, 0.8, 0.26], [0, -0.4, 0]));
      arm.add(mesh(BOX, toonColor('#5b5347'), [0.34, 0.3, 0.34], [0, -0.82, 0]));
      core.add(arm);
    }
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.28, 0.62, 0); legR.position.set(0.28, 0.62, 0);
    legL.add(mesh(BOX, toonColor('#443d34'), [0.3, 0.62, 0.3], [0, -0.31, 0]));
    legR.add(mesh(BOX, toonColor('#443d34'), [0.3, 0.62, 0.3], [0, -0.31, 0]));
    core.add(legL, legR);
    const runeRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 4, 20), glow);
    runeRing.rotation.x = Math.PI / 2;
    runeRing.position.y = 0.1;
    core.add(runeRing);

    animate = (dt, t, state, charge) => {
      const walk = state === 'chase' ? Math.sin(t * 4.5) * 0.35 : 0;
      legL.rotation.x = damp(legL.rotation.x, walk, 8, dt);
      legR.rotation.x = damp(legR.rotation.x, -walk, 8, dt);
      armL.rotation.x = damp(armL.rotation.x, state === 'windup' ? -2.4 : -walk, 8, dt);
      armR.rotation.x = damp(armR.rotation.x, state === 'windup' ? -2.4 : walk, 8, dt);
      runeRing.rotation.z += dt * (0.6 + charge);
      runeRing.position.y = 0.1 + Math.sin(t * 1.4) * 0.04;
      coreGem.rotation.y += dt * 1.5;
      const c = clamp(charge, 0, 1);
      coreGem.scale.setScalar(1 + c * 0.8);
      core.position.y = Math.abs(Math.sin(t * 4.5)) * 0.05 * (state === 'chase' ? 1 : 0);
    };
  } else if (def.model === 'spirit') {
    const orb = mesh(SPHERE, toonColor(def.color.body, def.color.glow, 0.9), [0.32, 0.34, 0.32], [0, 1.0, 0]);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 4, 20), glow);
    halo.rotation.x = Math.PI / 2.4;
    halo.position.y = 1.0;
    const tail1 = mesh(CONE, toonColor(def.color.accent, def.color.glow, 0.4), [0.12, 0.5, 0.12], [0, 0.62, 0]);
    tail1.rotation.x = Math.PI;
    core.add(orb, halo, tail1);
    animate = (dt, t, state, charge) => {
      core.position.y = Math.sin(t * 2.2) * 0.14;
      halo.rotation.z += dt * 1.6;
      halo.scale.setScalar(1 + clamp(charge, 0, 1) * 0.5);
      orb.scale.setScalar(1 + Math.sin(t * 3.1) * 0.04 + clamp(charge, 0, 1) * 0.18);
      core.rotation.y = Math.sin(t * 0.7) * 0.5;
    };
  } else {
    // boss
    const hips = new THREE.Group();
    core.add(hips);
    const torso = mesh(BOX, toonColor(def.color.body), [0.95, 0.95, 0.6], [0, 1.25, 0]);
    const shoulderL = mesh(BOX, accent, [0.4, 0.28, 0.42], [-0.62, 1.62, 0]);
    const shoulderR = mesh(BOX, accent, [0.4, 0.28, 0.42], [0.62, 1.62, 0]);
    const head = mesh(BOX, toonColor('#1a2030'), [0.4, 0.38, 0.42], [0, 1.9, 0]);
    const eyeGlow = mesh(BOX, glow, [0.32, 0.06, 0.02], [0, 1.92, 0.22]);
    const hornL = mesh(CONE, accent, [0.07, 0.42, 0.07], [-0.2, 2.16, -0.05]);
    const hornR = mesh(CONE, accent, [0.07, 0.42, 0.07], [0.2, 2.16, -0.05]);
    hornL.rotation.z = 0.35; hornR.rotation.z = -0.35;
    hips.add(torso, shoulderL, shoulderR, head, eyeGlow, hornL, hornR);
    const arms: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.78, 1.55, 0);
      arm.add(mesh(BOX, toonColor(def.color.body), [0.24, 0.85, 0.24], [0, -0.42, 0]));
      arm.add(mesh(BOX, accent, [0.3, 0.24, 0.3], [0, -0.9, 0]));
      hips.add(arm);
      arms.push(arm);
    }
    const legs: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.3, 0.8, 0);
      leg.add(mesh(BOX, toonColor('#141a26'), [0.3, 0.8, 0.3], [0, -0.4, 0]));
      hips.add(leg);
      legs.push(leg);
    }
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const sh = mesh(new THREE.OctahedronGeometry(0.1, 0), glow, [1, 1, 1], [0, 1.2, 0]);
      core.add(sh);
      shards.push(sh);
    }
    const auraRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 4, 24), glow);
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 0.05;
    core.add(auraRing);
    core.position.y = 0.1;

    animate = (dt, t, state, charge) => {
      const walk = state === 'chase' ? Math.sin(t * 3.4) * 0.4 : 0;
      legs[0].rotation.x = damp(legs[0].rotation.x, walk, 8, dt);
      legs[1].rotation.x = damp(legs[1].rotation.x, -walk, 8, dt);
      arms[0].rotation.x = damp(arms[0].rotation.x, state === 'windup' ? -2.6 : -walk * 0.6, 8, dt);
      arms[1].rotation.x = damp(arms[1].rotation.x, state === 'windup' ? -2.6 : walk * 0.6, 8, dt);
      auraRing.rotation.z += dt * 1.2;
      auraRing.scale.setScalar(1 + Math.sin(t * 1.8) * 0.05);
      shards.forEach((s, i) => {
        const a = t * 0.9 + (i / shards.length) * TAU;
        s.position.set(Math.cos(a) * 1.15, 1.2 + Math.sin(t * 2 + i) * 0.2, Math.sin(a) * 1.15);
        s.rotation.y += dt * 2;
      });
      eyeGlow.scale.setScalar(1 + clamp(charge, 0, 1) * 1.5);
      hips.position.y = Math.abs(Math.sin(t * 3.4)) * 0.04;
    };
  }

  flash.collect(core);

  return {
    root,
    core,
    update(dt, t, state, charge) {
      animate(dt, t, state, charge);
      if (flash.flashTime > 0) {
        flash.flashTime -= dt;
        const on = flash.flashTime > 0;
        if (on !== (flash as any).__on) {
          (flash as any).__on = on;
          flash.set(on);
        }
      } else if ((flash as any).__on) {
        (flash as any).__on = false;
        flash.set(false);
      }
    },
    hitFlash(duration = 0.12) {
      flash.flashTime = duration;
    },
    dispose() {
      flash.set(false);
      flash.dispose();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry !== SPHERE && m.geometry !== CYL && m.geometry !== BOX && m.geometry !== CONE) {
          m.geometry.dispose();
        }
      });
    },
  };
}

export function buildCharacterRig(def: CharacterDef): HumanoidRig {
  return new HumanoidRig(def.palette, def.weapon, 1, def.palette.accent);
}
