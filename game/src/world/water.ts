/* =========================================================
   AETHERION — stylised water surface
   Gerstner-ish vertex waves + fresnel + sun specular.
   ========================================================= */
import * as THREE from 'three';
import { WORLD } from '../data/world';

export class Water {
  readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;
  private material: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1400, 1400, 72, 72);
    geo.rotateX(-Math.PI / 2);

    this.uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#4f9fb8') },
      uDeep: { value: new THREE.Color('#123a55') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color('#ffe9c0') },
      uNight: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormal2;
        void main() {
          vec3 p = position;
          float w1 = sin(p.x * 0.09 + uTime * 1.1) * 0.16;
          float w2 = cos(p.z * 0.11 + uTime * 0.9) * 0.13;
          float w3 = sin((p.x + p.z) * 0.05 + uTime * 0.55) * 0.22;
          p.y += w1 + w2 + w3;

          float dx = cos(p.x * 0.09 + uTime * 1.1) * 0.09 * 0.16
                   + cos((p.x + p.z) * 0.05 + uTime * 0.55) * 0.05 * 0.22;
          float dz = -sin(p.z * 0.11 + uTime * 0.9) * 0.11 * 0.13
                   + cos((p.x + p.z) * 0.05 + uTime * 0.55) * 0.05 * 0.22;
          vNormal2 = normalize(vec3(-dx * 8.0, 1.0, -dz * 8.0));

          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uNight;
        varying vec3 vWorld;
        varying vec3 vNormal2;

        void main() {
          vec3 n = normalize(vNormal2);
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);

          vec3 col = mix(uDeep, uShallow, clamp(fres * 1.25, 0.0, 1.0));
          col = mix(col, uShallow * 1.15, 0.16);

          // sun glitter
          vec3 h = normalize(normalize(uSunDir) + viewDir);
          float spec = pow(max(dot(n, h), 0.0), 120.0);
          col += uSunColor * spec * 1.5 * (1.0 - uNight * 0.7);

          // gentle sparkle banding
          float band = sin(vWorld.x * 1.7 + uTime * 0.7) * cos(vWorld.z * 1.3 - uTime * 0.5);
          col += vec3(0.05) * smoothstep(0.85, 1.0, band) * (1.0 - uNight * 0.6);

          col = mix(col * vec3(0.55, 0.66, 0.85), col, 1.0 - uNight * 0.35);
          gl_FragColor = vec4(col, 0.90);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WORLD.waterLevel;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(dt: number, cameraPos: THREE.Vector3, sunDir: THREE.Vector3, dayFactor: number) {
    this.uniforms.uTime.value += dt;
    (this.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
    this.uniforms.uNight.value = 1 - dayFactor;
    // keep the sheet centred on the camera (it is 1.4km wide)
    this.mesh.position.x = Math.round(cameraPos.x / 100) * 100;
    this.mesh.position.z = Math.round(cameraPos.z / 100) * 100;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
