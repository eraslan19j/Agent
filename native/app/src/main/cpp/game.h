// ============================================================
// AETHERION BLOX — blocky sandbox core (pure C++, no GL here)
// ============================================================
#pragma once
#include <cmath>
#include <cstdint>
#include <vector>

namespace blox {

constexpr float PI = 3.14159265358979f;

struct Vec3 {
  float x = 0, y = 0, z = 0;
  Vec3() = default;
  Vec3(float a, float b, float c) : x(a), y(b), z(c) {}
  Vec3 operator+(const Vec3& o) const { return Vec3(x + o.x, y + o.y, z + o.z); }
  Vec3 operator-(const Vec3& o) const { return Vec3(x - o.x, y - o.y, z - o.z); }
  Vec3 operator*(float s) const { return Vec3(x * s, y * s, z * s); }
  Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }
  float dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  Vec3 cross(const Vec3& o) const {
    return Vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x);
  }
  float len() const { return std::sqrt(dot(*this)); }
  Vec3 norm() const { float l = len(); return l > 1e-6f ? (*this) * (1.f / l) : Vec3(0, 0, 0); }
};

// column-major 4x4
struct Mat4 {
  float m[16];
  Mat4() { identity(); }
  void identity() {
    for (int i = 0; i < 16; i++) m[i] = (i % 5 == 0) ? 1.f : 0.f;
  }
};

Mat4 mul(const Mat4& a, const Mat4& b);
Mat4 perspective(float fovyRad, float aspect, float zn, float zf);
Mat4 lookAt(const Vec3& eye, const Vec3& center, const Vec3& up);
Mat4 translate(const Vec3& t);
Mat4 scaleV(const Vec3& s);
Mat4 rotateX(float a);
Mat4 rotateY(float a);

struct Vertex {
  float x, y, z;
  float r, g, b;
};

struct Box {
  Vec3 c;              // centre
  Vec3 h;              // half extents
  Vec3 col;
  bool solid = true;
  bool pad = false;    // jump pad
};

struct Coin {
  Vec3 pos;
  bool taken = false;
};

struct Player {
  Vec3 pos;            // feet centre
  Vec3 vel;
  float yaw = 0.f;
  bool grounded = false;
  float walkPhase = 0.f;
  float jumpBuffer = 0.f;
  float airTime = 0.f;
};

struct Game {
  // world
  std::vector<Box> solids;     // colliders
  std::vector<Box> pads;
  std::vector<Vertex> world;   // baked static mesh
  std::vector<Coin> coins;

  Player player;
  Vec3 spawn;

  // camera (orbit)
  float camYaw = 0.f;
  float camPitch = 0.30f;
  float camDist = 6.4f;

  // input
  float moveX = 0.f;
  float moveY = 0.f;
  bool sprint = false;

  // run state
  float time = 0.f;
  int collected = 0;
  bool won = false;
  int respawns = 0;
  float respawnFlash = 0.f;
  float coinSpin = 0.f;
  float bob = 0.f;

  void build();
  void reset();
  void jump();
  void update(float dt);

  Vec3 camFwd() const;
  Vec3 camRight() const;
  Vec3 camEye() const;
  Vec3 camTarget() const;

  void addBox(const Vec3& c, const Vec3& h, const Vec3& col, bool solid,
              bool pad = false);
  void addFlat(const Vec3& c, const Vec3& h, const Vec3& col);  // top-face only tile
  void addStairs(const Vec3& base, int steps, float rise, float run, float width,
                 const Vec3& col, int axis);                 // axis: -1 = -Z, +1 = +Z, 2 = +X
  void addCoin(const Vec3& p);
  void bakeBoxFaces(const Vec3& c, const Vec3& h, const Vec3& col);
};

Game& instance();

// ---- palette (Roblox-ish, flat and bright) ----
namespace pal {
const Vec3 GRASS_A(0.39f, 0.72f, 0.29f);
const Vec3 GRASS_B(0.35f, 0.66f, 0.26f);
const Vec3 PLATE(0.55f, 0.57f, 0.60f);
const Vec3 STONE(0.66f, 0.68f, 0.72f);
const Vec3 RED(0.90f, 0.22f, 0.22f);
const Vec3 ORANGE(0.98f, 0.55f, 0.16f);
const Vec3 YELLOW(0.98f, 0.84f, 0.18f);
const Vec3 BLUE(0.20f, 0.48f, 0.92f);
const Vec3 CYAN(0.16f, 0.80f, 0.86f);
const Vec3 GREEN(0.24f, 0.78f, 0.38f);
const Vec3 PURPLE(0.62f, 0.34f, 0.88f);
const Vec3 PINK(0.96f, 0.45f, 0.70f);
const Vec3 BROWN(0.55f, 0.36f, 0.20f);
const Vec3 SKIN(0.98f, 0.83f, 0.36f);
const Vec3 SHIRT(0.16f, 0.52f, 0.90f);
const Vec3 PANTS(0.18f, 0.22f, 0.34f);
const Vec3 DARK(0.12f, 0.13f, 0.16f);
const Vec3 WHITE(0.96f, 0.97f, 0.98f);
const Vec3 GOLD(1.00f, 0.80f, 0.16f);
}  // namespace pal

// player box
constexpr float PLAYER_R = 0.30f;   // half width / depth
constexpr float PLAYER_H = 1.80f;   // total height
constexpr float GRAVITY = 30.f;
constexpr float JUMP_V = 10.4f;
constexpr float WALK_SPEED = 5.2f;
constexpr float RUN_SPEED = 8.0f;

}  // namespace blox
