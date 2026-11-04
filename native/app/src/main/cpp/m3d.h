// ============================================================
// AETHERION NATIVE — minimal math library (no dependencies)
// ============================================================
#pragma once
#include <cmath>
#include <cstring>

namespace m3 {

constexpr float PI = 3.14159265358979f;
constexpr float TAU = 6.28318530717959f;

inline float clampf(float v, float a, float b) { return v < a ? a : (v > b ? b : v); }
inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
inline float smoothstep(float a, float b, float x) {
  float t = clampf((x - a) / (b - a + 1e-9f), 0.f, 1.f);
  return t * t * (3.f - 2.f * t);
}
/** frame-rate independent exponential approach */
inline float damp(float a, float b, float lambda, float dt) {
  return lerpf(a, b, 1.f - std::exp(-lambda * dt));
}
inline float dampAngle(float a, float b, float lambda, float dt) {
  float d = b - a;
  while (d > PI) d -= TAU;
  while (d < -PI) d += TAU;
  return a + d * (1.f - std::exp(-lambda * dt));
}
inline float easeOutCubic(float t) { float u = 1.f - t; return 1.f - u * u * u; }
inline float easeInCubic(float t) { return t * t * t; }
inline float easeOutBack(float t) { const float c1 = 1.70158f, c3 = c1 + 1.f; float u = t - 1.f; return 1.f + c3 * u * u * u + c1 * u * u; }

struct Vec2 {
  float x = 0, y = 0;
  Vec2() = default;
  Vec2(float x_, float y_) : x(x_), y(y_) {}
  Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
  Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
  Vec2 operator*(float s) const { return {x * s, y * s}; }
  float len() const { return std::sqrt(x * x + y * y); }
};

struct Vec3 {
  float x = 0, y = 0, z = 0;
  Vec3() = default;
  Vec3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}
  explicit Vec3(float s) : x(s), y(s), z(s) {}
  Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec3 operator-() const { return {-x, -y, -z}; }
  Vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
  Vec3 operator*(const Vec3& o) const { return {x * o.x, y * o.y, z * o.z}; }
  Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }
  Vec3& operator-=(const Vec3& o) { x -= o.x; y -= o.y; z -= o.z; return *this; }
  Vec3& operator*=(float s) { x *= s; y *= s; z *= s; return *this; }
  float dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  Vec3 cross(const Vec3& o) const { return {y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x}; }
  float len() const { return std::sqrt(x * x + y * y + z * z); }
  float lenXZ() const { return std::sqrt(x * x + z * z); }
  Vec3 norm() const { float l = len(); return l > 1e-6f ? Vec3(x / l, y / l, z / l) : Vec3(0, 0, 0); }
  static Vec3 lerp(const Vec3& a, const Vec3& b, float t) {
    return {a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t};
  }
  float& operator[](int i) { return (&x)[i]; }
  const float& operator[](int i) const { return (&x)[i]; }
};

/** Column-major 4x4 matrix (OpenGL layout). */
struct Mat4 {
  float m[16];
  Mat4() { identity(); }
  void identity() { std::memset(m, 0, sizeof(m)); m[0] = m[5] = m[10] = m[15] = 1.f; }
  static Mat4 zero() { Mat4 r; std::memset(r.m, 0, sizeof(r.m)); return r; }

  Mat4 operator*(const Mat4& o) const {
    Mat4 r = zero();
    for (int c = 0; c < 4; c++)
      for (int rr = 0; rr < 4; rr++) {
        float s = 0;
        for (int k = 0; k < 4; k++) s += m[k * 4 + rr] * o.m[c * 4 + k];
        r.m[c * 4 + rr] = s;
      }
    return r;
  }
  Vec3 transformPoint(const Vec3& p) const {
    return {m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
            m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
            m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]};
  }
  Vec3 transformDir(const Vec3& p) const {
    return {m[0] * p.x + m[4] * p.y + m[8] * p.z,
            m[1] * p.x + m[5] * p.y + m[9] * p.z,
            m[2] * p.x + m[6] * p.y + m[10] * p.z};
  }

  static Mat4 translate(const Vec3& t) {
    Mat4 r; r.m[12] = t.x; r.m[13] = t.y; r.m[14] = t.z; return r;
  }
  static Mat4 scale(const Vec3& s) {
    Mat4 r; r.m[0] = s.x; r.m[5] = s.y; r.m[10] = s.z; return r;
  }
  static Mat4 rotX(float a) { Mat4 r; float c = std::cos(a), s = std::sin(a); r.m[5] = c; r.m[6] = s; r.m[9] = -s; r.m[10] = c; return r; }
  static Mat4 rotY(float a) { Mat4 r; float c = std::cos(a), s = std::sin(a); r.m[0] = c; r.m[2] = -s; r.m[8] = s; r.m[10] = c; return r; }
  static Mat4 rotZ(float a) { Mat4 r; float c = std::cos(a), s = std::sin(a); r.m[0] = c; r.m[1] = s; r.m[4] = -s; r.m[5] = c; return r; }
  /** YXZ euler, radians */
  static Mat4 euler(float x, float y, float z) { return rotY(y) * rotX(x) * rotZ(z); }

  static Mat4 perspective(float fovyRad, float aspect, float znear, float zfar) {
    Mat4 r = zero();
    float f = 1.f / std::tan(fovyRad * 0.5f);
    r.m[0] = f / aspect;
    r.m[5] = f;
    r.m[10] = (zfar + znear) / (znear - zfar);
    r.m[11] = -1.f;
    r.m[14] = (2.f * zfar * znear) / (znear - zfar);
    return r;
  }
  static Mat4 ortho(float l, float r_, float b, float t, float n, float f) {
    Mat4 r = zero();
    r.m[0] = 2.f / (r_ - l);
    r.m[5] = 2.f / (t - b);
    r.m[10] = -2.f / (f - n);
    r.m[12] = -(r_ + l) / (r_ - l);
    r.m[13] = -(t + b) / (t - b);
    r.m[14] = -(f + n) / (f - n);
    r.m[15] = 1.f;
    return r;
  }
  static Mat4 lookAt(const Vec3& eye, const Vec3& center, const Vec3& up) {
    Vec3 f = (center - eye).norm();
    Vec3 s = f.cross(up).norm();
    Vec3 u = s.cross(f);
    Mat4 r;
    r.m[0] = s.x; r.m[4] = s.y; r.m[8] = s.z;
    r.m[1] = u.x; r.m[5] = u.y; r.m[9] = u.z;
    r.m[2] = -f.x; r.m[6] = -f.y; r.m[10] = -f.z;
    r.m[12] = -s.dot(eye);
    r.m[13] = -u.dot(eye);
    r.m[14] = f.dot(eye);
    r.m[15] = 1.f;
    return r;
  }
  static Mat4 trs(const Vec3& t, const Vec3& eulerYXZ, const Vec3& s) {
    return translate(t) * euler(eulerYXZ.x, eulerYXZ.y, eulerYXZ.z) * scale(s);
  }
};

/** Deterministic hash noise helpers (CPU side). */
inline float hash2(float x, float y) {
  float h = std::sin(x * 127.1f + y * 311.7f) * 43758.5453f;
  return h - std::floor(h);
}
inline float valueNoise(float x, float y) {
  float xi = std::floor(x), yi = std::floor(y);
  float xf = x - xi, yf = y - yi;
  float u = xf * xf * (3.f - 2.f * xf);
  float v = yf * yf * (3.f - 2.f * yf);
  float a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerpf(lerpf(a, b, u), lerpf(c, d, u), v);
}
inline float fbm(float x, float y, int oct = 5) {
  float s = 0, amp = 0.5f, f = 1.f;
  for (int i = 0; i < oct; i++) {
    s += valueNoise(x * f, y * f) * amp;
    f *= 2.03f;
    amp *= 0.5f;
  }
  return s;
}

}  // namespace m3
