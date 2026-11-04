/* =========================================================
   AETHERION — third person orbit camera
   Smooth follow, terrain avoidance, aim assist, FOV kick, shake.
   ========================================================= */
import * as THREE from 'three';
import { clamp, damp, dampAngle, DEG } from './utils';

export interface CameraTargets {
  position: THREE.Vector3;
  height: number;
  speed: number;
}

export class ThirdPersonCamera {
  yaw = Math.PI;
  pitch = 0.22;
  distance = 5.2;
  private targetDistance = 5.2;
  private currentPos = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  baseFov = 62;
  fovBoost = 0;
  sensitivity = 1;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private heightAt: (x: number, z: number) => number,
  ) {
    this.smoothedTarget.set(0, 2, 0);
  }

  addLook(dx: number, dy: number) {
    const s = 0.0032 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s, -0.62, 1.12);
  }

  update(
    dt: number,
    target: THREE.Vector3,
    look: { x: number; y: number },
    opts: { speed: number; shake: number; zoomBias?: number; lockOn?: THREE.Vector3 | null },
  ) {
    if (look.x || look.y) this.addLook(look.x, look.y);

    // soft lock-on: bias yaw toward the target without taking control away
    if (opts.lockOn) {
      const dx = opts.lockOn.x - target.x;
      const dz = opts.lockOn.z - target.z;
      const want = Math.atan2(dx, dz) + Math.PI;
      let d = ((want - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(d) < 1.15) this.yaw += d * Math.min(1, dt * 2.6);
    }

    this.targetDistance = this.distance + (opts.zoomBias ?? 0);
    const focus = this.smoothedTarget;
    const wantFocus = new THREE.Vector3(target.x, target.y + 1.55, target.z);
    focus.x = damp(focus.x, wantFocus.x, 14, dt);
    focus.y = damp(focus.y, wantFocus.y, 9, dt);
    focus.z = damp(focus.z, wantFocus.z, 14, dt);

    const cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosP,
    ).multiplyScalar(this.targetDistance);

    const desired = focus.clone().add(offset);

    // terrain collision: keep camera above ground, pull in when blocked
    const ground = this.heightAt(desired.x, desired.z);
    if (desired.y < ground + 0.6) desired.y = ground + 0.6;

    // sample a few points along the boom to avoid clipping into hills
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      const p = focus.clone().lerp(desired, t);
      const g = this.heightAt(p.x, p.z) + 0.45;
      if (p.y < g) {
        desired.copy(focus.clone().lerp(desired, Math.max(0.25, t - 0.16)));
        desired.y = Math.max(desired.y, g);
        break;
      }
    }

    this.currentPos.x = damp(this.currentPos.x, desired.x, 18, dt);
    this.currentPos.y = damp(this.currentPos.y, desired.y, 18, dt);
    this.currentPos.z = damp(this.currentPos.z, desired.z, 18, dt);

    // shake
    const s = Math.min(0.6, opts.shake);
    const shakeVec = new THREE.Vector3(
      (Math.random() - 0.5) * s * 0.45,
      (Math.random() - 0.5) * s * 0.4,
      (Math.random() - 0.5) * s * 0.45,
    );

    this.camera.position.copy(this.currentPos).add(shakeVec);
    this.camera.lookAt(focus);

    // sprint / burst FOV kick
    const wantFov = this.baseFov + this.fovBoost;
    this.camera.fov = damp(this.camera.fov, wantFov, 6, dt);
    this.camera.updateProjectionMatrix();

    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x);

    return this.camera;
  }

  /** Movement basis on the XZ plane derived from camera yaw. */
  getMoveBasis(x: number, y: number, out: THREE.Vector3) {
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.sin(this.yaw - Math.PI / 2), 0, Math.cos(this.yaw - Math.PI / 2));
    out.set(0, 0, 0).addScaledVector(fwd, -y).addScaledVector(right, x);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  /** Direction the camera is looking (flat XZ) — used for attacks & aim. */
  getLookDirection(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  snapTo(target: THREE.Vector3) {
    const cosP = Math.cos(this.pitch);
    this.smoothedTarget.set(target.x, target.y + 1.55, target.z);
    this.currentPos.set(
      target.x + Math.sin(this.yaw) * cosP * this.targetDistance,
      target.y + 1.55 + Math.sin(this.pitch) * this.targetDistance,
      target.z + Math.cos(this.yaw) * cosP * this.targetDistance,
    );
  }
}
