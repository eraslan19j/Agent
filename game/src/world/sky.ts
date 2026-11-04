/* =========================================================
   AETHERION — sky dome, sun/moon, stars, clouds, day-night cycle
   ========================================================= */
import * as THREE from 'three';
import { clamp, lerp, TAU } from '../core/utils';

const DAY_MINUTES = 1440;
/** Real seconds for one full in-game day. */
const DAY_LENGTH_SECONDS = 900;

const COL = {
  nightTop: new THREE.Color('#050a18'),
  nightBottom: new THREE.Color('#0b1424'),
  dayTop: new THREE.Color('#2f6fb4'),
  dayBottom: new THREE.Color('#c3ddf2'),
  duskTop: new THREE.Color('#3a3f74'),
  duskBottom: new THREE.Color('#ff9a63'),
  fogNight: new THREE.Color('#0b1424'),
  fogDay: new THREE.Color('#b7d3e8'),
  fogDusk: new THREE.Color('#8e8fae'),
};

export class Sky {
  readonly group = new THREE.Group();
  readonly sunLight: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;

  timeMinutes = 8 * 60;
  /** 0 = night, 1 = full day */
  dayFactor = 1;
  readonly sunDirection = new THREE.Vector3(0, 1, 0);

  private dome: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;
  private stars: THREE.Points;
  private moon: THREE.Sprite;
  private clouds: THREE.Sprite[] = [];
  private cloudDrift: number[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, quality: 'low' | 'medium' | 'high' = 'high') {
    this.scene = scene;
    this.group.name = 'sky';

    this.uniforms = {
      uTop: { value: COL.dayTop.clone() },
      uBottom: { value: COL.dayBottom.clone() },
      uSunColor: { value: new THREE.Color('#fff2d6') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };

    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uNight;
        uniform float uTime;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(h, 0.9));

          vec3 sd = normalize(uSunDir);
          float sun = max(dot(d, sd), 0.0);
          col += uSunColor * pow(sun, 320.0) * 2.2;
          col += uSunColor * pow(sun, 9.0) * 0.30;
          col += uSunColor * pow(sun, 2.0) * 0.05;

          // horizon haze
          float haze = pow(1.0 - abs(d.y), 6.0);
          col += vec3(0.16, 0.20, 0.26) * haze * 0.55;

          // stars
          if (uNight > 0.02 && d.y > 0.02) {
            vec2 sp = floor(d.xz / max(0.012, 0.0016 * (1.0 - d.y)));
            float s = hash(sp);
            float star = smoothstep(0.9975, 1.0, s) * (0.55 + 0.45 * sin(uTime * 2.0 + s * 40.0));
            col += vec3(0.85, 0.92, 1.0) * star * uNight * 1.4 * smoothstep(0.02, 0.35, d.y);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), domeMat);
    this.dome.scale.setScalar(900);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    // ---- stars (points, fade with day) ----
    const starCount = quality === 'low' ? 260 : 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * TAU;
      const y = Math.random() * 0.9 + 0.06;
      const r = Math.sqrt(1 - y * y);
      starPos[i * 3] = Math.cos(a) * r * 820;
      starPos[i * 3 + 1] = y * 820;
      starPos[i * 3 + 2] = Math.sin(a) * r * 820;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xdfe9ff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // ---- moon ----
    const moonTex = this.makeGlowTexture('#ffffff', '#9fc4ff');
    const moonMat = new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    this.moon = new THREE.Sprite(moonMat);
    this.moon.scale.setScalar(70);
    this.group.add(this.moon);

    // ---- clouds ----
    const cloudTex = this.makeCloudTexture();
    const cloudCount = quality === 'low' ? 5 : 11;
    for (let i = 0; i < cloudCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false,
        opacity: 0.42 + Math.random() * 0.26, color: 0xffffff,
      });
      const sprite = new THREE.Sprite(mat);
      const s = 90 + Math.random() * 150;
      sprite.scale.set(s, s * (0.35 + Math.random() * 0.2), 1);
      sprite.position.set(
        (Math.random() - 0.5) * 1100,
        150 + Math.random() * 110,
        (Math.random() - 0.5) * 1100,
      );
      this.clouds.push(sprite);
      this.cloudDrift.push(1.5 + Math.random() * 3.5);
      this.group.add(sprite);
    }

    // ---- lights ----
    this.sunLight = new THREE.DirectionalLight(0xfff2d6, 2.4);
    this.sunLight.castShadow = quality !== 'low';
    const shadowSize = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sunLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = -46;
    sc.right = 46;
    sc.top = 46;
    sc.bottom = -46;
    sc.near = 1;
    sc.far = 280;
    this.sunLight.shadow.bias = -0.0009;
    this.sunLight.shadow.normalBias = 0.035;
    this.sunLight.target.position.set(0, 0, 0);
    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0xbcd9ef, 0x4a5a3a, 0.85);
    this.group.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x334455, 0.35);
    this.group.add(this.ambient);

    scene.add(this.group);
    this.apply();
  }

  private makeGlowTexture(inner: string, outer: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.42, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private makeCloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 22; i++) {
      const x = 30 + Math.random() * 196;
      const y = 40 + Math.random() * 50;
      const r = 18 + Math.random() * 34;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setTime(minutes: number) {
    this.timeMinutes = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    this.apply();
  }

  advance(dt: number, rate = 1) {
    this.timeMinutes += (dt / DAY_LENGTH_SECONDS) * DAY_MINUTES * rate;
    if (this.timeMinutes >= DAY_MINUTES) this.timeMinutes -= DAY_MINUTES;
  }

  private apply() {
    const t = this.timeMinutes / DAY_MINUTES;
    // sun elevation: -1 (midnight) .. 1 (noon)
    const elevation = Math.sin((t - 0.25) * TAU);
    const azimuth = (t - 0.25) * TAU;
    const cosEl = Math.cos((t - 0.25) * TAU);
    this.sunDirection.set(Math.cos(azimuth) * 0.55, elevation, Math.sin(azimuth) * 0.55).normalize();

    const dayFactor = clamp(Math.sin(clamp(elevation, 0, 1) * Math.PI * 0.5) * 1.6, 0, 1);
    this.dayFactor = dayFactor;
    const nightFactor = 1 - clamp((elevation + 0.12) * 4.0, 0, 1);
    const twilight = clamp(1 - Math.abs(elevation) / 0.3, 0, 1);

    // sky colors
    const top = COL.nightTop.clone().lerp(COL.dayTop, dayFactor);
    const bottom = COL.nightBottom.clone().lerp(COL.dayBottom, dayFactor);
    if (twilight > 0.01) {
      top.lerp(COL.duskTop, twilight * 0.55);
      bottom.lerp(COL.duskBottom, twilight * 0.8);
    }
    (this.uniforms.uTop.value as THREE.Color).copy(top);
    (this.uniforms.uBottom.value as THREE.Color).copy(bottom);
    (this.uniforms.uSunDir.value as THREE.Vector3).copy(this.sunDirection);
    (this.uniforms.uNight.value as number);
    this.uniforms.uNight.value = nightFactor;
    (this.uniforms.uSunColor.value as THREE.Color).setRGB(
      lerp(1.0, 1.0, dayFactor),
      lerp(0.62, 0.95, dayFactor),
      lerp(0.42, 0.9, dayFactor),
    );

    // lights
    this.sunLight.color.setRGB(
      lerp(1.0, 1.0, dayFactor),
      lerp(0.66, 0.95, dayFactor),
      lerp(0.46, 0.88, dayFactor),
    );
    this.sunLight.intensity = 0.05 + dayFactor * 2.5;
    this.hemi.intensity = 0.16 + dayFactor * 0.8;
    this.hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.35);
    this.hemi.groundColor.setRGB(0.16 + 0.1 * dayFactor, 0.19 + 0.14 * dayFactor, 0.14 + 0.08 * dayFactor);
    this.ambient.intensity = 0.18 + dayFactor * 0.22;

    // moon opposite the sun
    this.moon.position.copy(this.sunDirection).multiplyScalar(-760);
    (this.moon.material as THREE.SpriteMaterial).opacity = nightFactor * 0.95;
    this.moon.visible = nightFactor > 0.05;

    (this.stars.material as THREE.PointsMaterial).opacity = nightFactor * 0.95;
    this.stars.visible = nightFactor > 0.05;

    // fog
    const fogColor = COL.fogNight.clone().lerp(COL.fogDay, dayFactor);
    if (twilight > 0.01) fogColor.lerp(COL.fogDusk, twilight * 0.6);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = 0.0026 + nightFactor * 0.0022;
    }
    this.scene.background = null;
    this.rendererClear = fogColor;
  }

  rendererClear = new THREE.Color('#b7d3e8');

  update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera) {
    this.advance(dt);
    this.apply();
    this.uniforms.uTime.value += dt;

    this.dome.position.copy(camera.position);
    this.stars.position.set(playerPos.x, 0, playerPos.z);
    this.moon.position.set(
      playerPos.x + this.sunDirection.x * -760,
      this.sunDirection.y * -760,
      playerPos.z + this.sunDirection.z * -760,
    );

    // sun light follows the player so shadows stay crisp
    this.sunLight.position.set(
      playerPos.x + this.sunDirection.x * 110,
      playerPos.y + Math.max(30, this.sunDirection.y * 110),
      playerPos.z + this.sunDirection.z * 110,
    );
    this.sunLight.target.position.set(playerPos.x, playerPos.y, playerPos.z);
    this.sunLight.target.updateMatrixWorld();

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += this.cloudDrift[i] * dt;
      if (c.position.x - playerPos.x > 620) c.position.x -= 1240;
      if (c.position.x - playerPos.x < -620) c.position.x += 1240;
      if (c.position.z - playerPos.z > 620) c.position.z -= 1240;
      if (c.position.z - playerPos.z < -620) c.position.z += 1240;
      const m = c.material as THREE.SpriteMaterial;
      m.color.setRGB(0.35 + 0.65 * this.dayFactor, 0.36 + 0.62 * this.dayFactor, 0.4 + 0.6 * this.dayFactor);
    }

    this.dome.position.set(camera.position.x, 0, camera.position.z);
  }

  get timeLabel() {
    const h = Math.floor(this.timeMinutes / 60) % 24;
    const m = Math.floor(this.timeMinutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  setQuality(q: 'low' | 'medium' | 'high') {
    this.sunLight.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : q === 'medium' ? 1024 : 512;
    if (this.sunLight.shadow.mapSize.x !== size) {
      this.sunLight.shadow.mapSize.set(size, size);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null as any;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.dome.geometry.dispose();
    (this.dome.material as THREE.Material).dispose();
  }
}
