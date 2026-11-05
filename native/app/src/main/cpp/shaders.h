// ============================================================
// AETHERION NATIVE — GLSL ES 3.0 shader sources
// ============================================================
#pragma once

namespace shaders {

// ---------------------------------------------------------------- common
static const char* COMMON = R"GLSL(
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;
uniform float uExposure;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 applyFog(vec3 col, float dist, vec3 viewDir) {
  float f = 1.0 - exp(-uFogDensity * dist * dist * 0.16 - uFogDensity * dist * 0.30);
  f = clamp(f, 0.0, 1.0);
  vec3 fogCol = mix(uFogColor, uSkyColor, clamp(viewDir.y * 1.4 + 0.25, 0.0, 1.0));
  return mix(col, fogCol, f);
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
)GLSL";

// ---------------------------------------------------------------- sky
static const char* SKY_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.9999, 1.0); }
)GLSL";

static const char* SKY_FS = R"GLSL(
#version 300 es
)GLSL";  // merged at runtime with COMMON

static const char* SKY_BODY = R"GLSL(
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalf;
uniform float uAspect;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;

float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * hash21(floor(p)); p *= 2.02; a *= 0.5; }
  return s;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uCamFwd + uCamRight * ndc.x * uTanHalf * uAspect + uCamUp * ndc.y * uTanHalf);
  float up = clamp(dir.y, -0.2, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(up, 0.0, 1.0), 0.62));
  // sun disk + glow
  float sd = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * pow(sd, 620.0) * 9.0 * uSunIntensity;
  col += uSunColor * pow(sd, 12.0) * 0.30 * uSunIntensity;
  col += uSunColor * pow(sd, 3.0) * 0.055 * uSunIntensity;
  // clouds
  if (dir.y > 0.02) {
    vec2 cuv = dir.xz / (dir.y + 0.16) * 0.55 + vec2(uTime * 0.006, uTime * 0.003);
    float c = fbm2(cuv * 2.1);
    float cover = smoothstep(0.52, 0.86, c) * smoothstep(0.02, 0.35, dir.y);
    vec3 cloudCol = mix(vec3(0.72, 0.76, 0.84), vec3(1.05, 1.02, 0.98), clamp(c * 1.3, 0.0, 1.0));
    cloudCol *= mix(0.45, 1.0, clamp(up * 2.2, 0.0, 1.0));
    col = mix(col, cloudCol * (0.55 + uSunIntensity * 0.22), cover * 0.85);
  }
  // stars at night
  float night = clamp(0.28 - uSunDir.y * 2.0, 0.0, 1.0);
  if (night > 0.01 && dir.y > 0.05) {
    vec2 sp = floor(dir.xz / max(dir.y, 0.2) * 190.0);
    float st = step(0.9955, hash21(sp));
    col += vec3(st) * night * (0.8 + 0.5 * hash21(sp + 3.0));
  }
  col += vec3(0.015, 0.02, 0.045) * night;
  fragColor = vec4(col, 1.0);
}
)GLSL";

// ---------------------------------------------------------------- static lit geometry (terrain, props)
static const char* LIT_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in vec3 aCol;
uniform mat4 uVP;
uniform mat4 uLightVP;
out vec3 vWorld;
out vec3 vNrm;
out vec3 vCol;
out vec4 vLightPos;
void main() {
  vec4 w = vec4(aPos, 1.0);
  vWorld = aPos;
  vNrm = aNrm;
  vCol = aCol;
  vLightPos = uLightVP * w;
  gl_Position = uVP * w;
}
)GLSL";

static const char* LIT_FS_BODY = R"GLSL(
in vec3 vWorld;
in vec3 vNrm;
in vec3 vCol;
in vec4 vLightPos;
out vec4 fragColor;
uniform sampler2D uShadow;
uniform float uShadowTexel;
uniform float uWaterLevel;

float shadowFactor(vec4 lp, vec3 n) {
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0018 + 0.0035 * (1.0 - clamp(dot(n, uSunDir), 0.0, 1.0));
  float sum = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      float d = texture(uShadow, p.xy + vec2(float(x), float(y)) * uShadowTexel).r;
      sum += (p.z - bias > d) ? 0.0 : 1.0;
    }
  return sum / 9.0;
}

void main() {
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(uCamPos - vWorld);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sh = shadowFactor(vLightPos, n);

  vec3 amb = mix(uGroundColor, uSkyColor, clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * 0.42;
  // wrap lighting keeps shaded slopes readable instead of black
  float wrap = clamp((dot(n, uSunDir) + 0.35) / 1.35, 0.0, 1.0);
  vec3 direct = uSunColor * uSunIntensity * mix(ndl, wrap * 0.55, 0.45) * sh;
  vec3 col = vCol * (amb + direct);

  // wetness / height tint near the waterline
  float nearWater = smoothstep(1.6, 0.0, vWorld.y - uWaterLevel);
  col = mix(col, col * vec3(0.86, 0.92, 0.98), nearWater * 0.55);

  float dist = length(uCamPos - vWorld);
  col = applyFog(col, dist, -viewDir);
  fragColor = vec4(col * uExposure, 1.0);
}
)GLSL";

// ---------------------------------------------------------------- skinned characters
static const char* SKIN_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in vec3 aCol;
layout(location = 3) in vec2 aJoints;
layout(location = 4) in float aWeight;
uniform mat4 uVP;
uniform mat4 uLightVP;
uniform mat4 uBones[21];
out vec3 vWorld;
out vec3 vNrm;
out vec3 vCol;
out vec4 vLightPos;
out vec3 vLocal;
void main() {
  int i0 = int(aJoints.x);
  int i1 = int(aJoints.y);
  mat4 m0 = uBones[i0];
  mat4 m1 = uBones[i1];
  mat4 sk = m0 * aWeight + m1 * (1.0 - aWeight);
  vec4 wp = sk * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNrm = normalize(mat3(sk) * aNrm);
  vCol = aCol;
  vLocal = aPos;
  vLightPos = uLightVP * wp;
  gl_Position = uVP * wp;
}
)GLSL";

static const char* SKIN_FS_BODY = R"GLSL(
in vec3 vWorld;
in vec3 vNrm;
in vec3 vCol;
in vec4 vLightPos;
in vec3 vLocal;
out vec4 fragColor;
uniform sampler2D uShadow;
uniform float uShadowTexel;
uniform vec3 uCloth;
uniform vec3 uAccent;
uniform vec3 uSkinTone;
uniform vec3 uHair;
uniform float uHitFlash;
uniform float uGlow;

float shadowFactor(vec4 lp, vec3 n) {
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0022;
  float d = texture(uShadow, p.xy).r;
  return (p.z - bias > d) ? 0.35 : 1.0;
}

void main() {
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(uCamPos - vWorld);

  // vertex colour selects a palette slot (see buildCharacterModel)
  vec3 base;
  if (vCol.r > 0.9) base = uCloth;
  else if (vCol.g > 0.9) base = uSkinTone;
  else if (vCol.b > 0.9) base = uAccent;
  else base = uHair;

  float ndl = dot(n, uSunDir);
  float sh = shadowFactor(vLightPos, n);
  // soft two-band terminator for a stylised, readable look
  float ramp = smoothstep(-0.08, 0.40, ndl);
  ramp = mix(ramp, smoothstep(0.28, 0.72, ndl), 0.30);
  vec3 amb = mix(uGroundColor, uSkyColor, clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * 0.58;
  vec3 col = base * (amb + uSunColor * uSunIntensity * ramp * sh * 0.74);

  // rim light for silhouette pop
  float rim = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
  col += uAccent * rim * 0.55;

  col += base * uHitFlash * 1.7;
  col = mix(col, uAccent * 1.9, uGlow * 0.30);

  float dist = length(uCamPos - vWorld);
  col = applyFog(col, dist, -viewDir);
  fragColor = vec4(col * uExposure, 1.0);
}
)GLSL";

// ---------------------------------------------------------------- shadow depth only
static const char* DEPTH_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uLightVP;
void main() { gl_Position = uLightVP * vec4(aPos, 1.0); }
)GLSL";

static const char* DEPTH_SKIN_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 3) in vec2 aJoints;
layout(location = 4) in float aWeight;
uniform mat4 uLightVP;
uniform mat4 uBones[21];
void main() {
  mat4 m0 = uBones[int(aJoints.x)];
  mat4 m1 = uBones[int(aJoints.y)];
  mat4 sk = m0 * aWeight + m1 * (1.0 - aWeight);
  gl_Position = uLightVP * (sk * vec4(aPos, 1.0));
}
)GLSL";

static const char* DEPTH_FS = R"GLSL(
#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }
)GLSL";

// ---------------------------------------------------------------- water
static const char* WATER_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uVP;
uniform float uTime;
out vec3 vWorld;
out vec3 vNrm;
void main() {
  vec3 p = aPos;
  float w1 = sin(p.x * 0.11 + uTime * 1.3) * cos(p.z * 0.09 - uTime * 0.9);
  float w2 = sin(p.x * 0.37 - uTime * 2.1 + p.z * 0.22) * 0.5;
  p.y += (w1 + w2) * 0.16;
  vec3 dx = vec3(1.0, 0.0, 0.0);
  vec3 dz = vec3(0.0, 0.0, 1.0);
  float hx = cos(p.x * 0.11 + uTime * 1.3) * 0.11 * 0.16;
  float hz = -sin(p.z * 0.09 - uTime * 0.9) * 0.09 * 0.16;
  vNrm = normalize(vec3(-hx * 8.0, 1.0, -hz * 8.0));
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}
)GLSL";

static const char* WATER_FS_BODY = R"GLSL(
in vec3 vWorld;
in vec3 vNrm;
out vec4 fragColor;
uniform float uWaterLevel;
uniform vec3 uSkyTop;
void main() {
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
  vec3 deep = vec3(0.05, 0.20, 0.28);
  vec3 skyRefl = mix(uSkyColor, uSkyTop, 0.35);
  vec3 col = mix(deep, skyRefl, clamp(fres * 1.25, 0.0, 0.92));
  // sun sparkle
  vec3 h = normalize(uSunDir + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 220.0);
  col += uSunColor * spec * uSunIntensity * 1.6;
  float dist = length(uCamPos - vWorld);
  col = applyFog(col, dist, -viewDir);
  fragColor = vec4(col * uExposure, 0.86);
}
)GLSL";

// ---------------------------------------------------------------- particles
static const char* PART_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;
layout(location = 2) in float aSize;
uniform mat4 uVP;
out vec4 vColor;
void main() {
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  float dist = max(0.2, p.w);
  gl_PointSize = clamp(aSize * 640.0 / dist, 1.0, 90.0);
  vColor = aColor;
}
)GLSL";

static const char* PART_FS = R"GLSL(
#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.02, d);
  a *= a;
  if (a <= 0.003) discard;
  fragColor = vec4(vColor.rgb * a * vColor.a, a * vColor.a);
}
)GLSL";

// ---------------------------------------------------------------- sword trail
static const char* TRAIL_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aAlpha;
uniform mat4 uVP;
out float vAlpha;
void main() { vAlpha = aAlpha; gl_Position = uVP * vec4(aPos, 1.0); }
)GLSL";

static const char* TRAIL_FS = R"GLSL(
#version 300 es
precision highp float;
in float vAlpha;
out vec4 fragColor;
uniform vec3 uColor;
void main() { fragColor = vec4(uColor * vAlpha * 1.8, vAlpha * 0.85); }
)GLSL";

// ---------------------------------------------------------------- post
static const char* QUAD_VS = R"GLSL(
#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
)GLSL";

static const char* BRIGHT_FS = R"GLSL(
#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(0.0, l - uThreshold) / max(l, 0.0001);
  fragColor = vec4(c * k, 1.0);
}
)GLSL";

static const char* BLUR_FS = R"GLSL(
#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;
  sum += texture(uTex, vUv + uDir * 1.3846).rgb * 0.316216;
  sum += texture(uTex, vUv - uDir * 1.3846).rgb * 0.316216;
  sum += texture(uTex, vUv + uDir * 3.2308).rgb * 0.070270;
  sum += texture(uTex, vUv - uDir * 3.2308).rgb * 0.070270;
  fragColor = vec4(sum, 1.0);
}
)GLSL";

static const char* COMPOSITE_FS = R"GLSL(
#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uBrightness;
uniform float uVignette;
uniform float uDamage;
uniform float uTime;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 c = texture(uScene, vUv).rgb;
  vec3 b = texture(uBloom, vUv).rgb;
  c += b * uBloomStrength;
  c = aces(c);
  // filmic contrast + slight saturation lift
  c = pow(c, vec3(0.96));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.12);
  // vignette
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * uVignette;
  // damage vignette
  c = mix(c, vec3(0.75, 0.10, 0.10), uDamage * smoothstep(0.18, 0.75, length(d)) * 0.55);
  c *= uBrightness;
  // dither to avoid banding on 8-bit output
  c += (fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(c, 1.0);
}
)GLSL";

}  // namespace shaders
