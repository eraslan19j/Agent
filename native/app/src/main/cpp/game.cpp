// ============================================================
// AETHERION BLOX — world building + blocky physics
// ============================================================
#include "game.h"

#include <algorithm>

namespace blox {

// ---------------------------------------------------------------- math
Mat4 mul(const Mat4& a, const Mat4& b) {
  Mat4 r;
  for (int c = 0; c < 4; c++)
    for (int rI = 0; rI < 4; rI++) {
      float s = 0;
      for (int k = 0; k < 4; k++) s += a.m[k * 4 + rI] * b.m[c * 4 + k];
      r.m[c * 4 + rI] = s;
    }
  return r;
}

Mat4 perspective(float fovyRad, float aspect, float zn, float zf) {
  Mat4 r;
  const float f = 1.f / std::tan(fovyRad * 0.5f);
  for (int i = 0; i < 16; i++) r.m[i] = 0.f;
  r.m[0] = f / (aspect > 1e-4f ? aspect : 1.f);
  r.m[5] = f;
  r.m[10] = (zf + zn) / (zn - zf);
  r.m[11] = -1.f;
  r.m[14] = (2.f * zf * zn) / (zn - zf);
  return r;
}

Mat4 lookAt(const Vec3& eye, const Vec3& center, const Vec3& up) {
  Vec3 f = (center - eye).norm();
  Vec3 s = f.cross(up).norm();
  Vec3 u = s.cross(f);
  Mat4 r;
  r.m[0] = s.x;  r.m[4] = s.y;  r.m[8] = s.z;
  r.m[1] = u.x;  r.m[5] = u.y;  r.m[9] = u.z;
  r.m[2] = -f.x; r.m[6] = -f.y; r.m[10] = -f.z;
  r.m[12] = -s.dot(eye);
  r.m[13] = -u.dot(eye);
  r.m[14] = f.dot(eye);
  r.m[15] = 1.f;
  return r;
}

Mat4 translate(const Vec3& t) {
  Mat4 r;
  r.m[12] = t.x;
  r.m[13] = t.y;
  r.m[14] = t.z;
  return r;
}

Mat4 scaleV(const Vec3& s) {
  Mat4 r;
  r.m[0] = s.x;
  r.m[5] = s.y;
  r.m[10] = s.z;
  return r;
}

Mat4 rotateX(float a) {
  Mat4 r;
  const float c = std::cos(a), s = std::sin(a);
  r.m[5] = c;  r.m[6] = s;
  r.m[9] = -s; r.m[10] = c;
  return r;
}

Mat4 rotateY(float a) {
  Mat4 r;
  const float c = std::cos(a), s = std::sin(a);
  r.m[0] = c;  r.m[2] = -s;
  r.m[8] = s;  r.m[10] = c;
  return r;
}

// ---------------------------------------------------------------- world bake
namespace {

void pushVertex(std::vector<Vertex>& out, const Vec3& p, const Vec3& c, float shade) {
  out.push_back(Vertex{p.x, p.y, p.z, c.x * shade, c.y * shade, c.z * shade});
}

void pushQuad(std::vector<Vertex>& out, const Vec3& a, const Vec3& b, const Vec3& c,
              const Vec3& d, const Vec3& col, float shade) {
  pushVertex(out, a, col, shade);
  pushVertex(out, b, col, shade);
  pushVertex(out, c, col, shade);
  pushVertex(out, a, col, shade);
  pushVertex(out, c, col, shade);
  pushVertex(out, d, col, shade);
}

// face brightness: top brightest, bottom darkest (fake roblox-style lighting)
constexpr float SH_TOP = 1.00f;
constexpr float SH_BOT = 0.52f;
constexpr float SH_PX = 0.86f;
constexpr float SH_NX = 0.74f;
constexpr float SH_PZ = 0.92f;
constexpr float SH_NZ = 0.68f;

}  // namespace

void Game::bakeBoxFaces(const Vec3& c, const Vec3& h, const Vec3& col) {
  const float x0 = c.x - h.x, x1 = c.x + h.x;
  const float y0 = c.y - h.y, y1 = c.y + h.y;
  const float z0 = c.z - h.z, z1 = c.z + h.z;
  // top
  pushQuad(world, Vec3(x0, y1, z0), Vec3(x0, y1, z1), Vec3(x1, y1, z1), Vec3(x1, y1, z0), col, SH_TOP);
  // bottom
  pushQuad(world, Vec3(x0, y0, z0), Vec3(x1, y0, z0), Vec3(x1, y0, z1), Vec3(x0, y0, z1), col, SH_BOT);
  // +x
  pushQuad(world, Vec3(x1, y0, z0), Vec3(x1, y1, z0), Vec3(x1, y1, z1), Vec3(x1, y0, z1), col, SH_PX);
  // -x
  pushQuad(world, Vec3(x0, y0, z0), Vec3(x0, y0, z1), Vec3(x0, y1, z1), Vec3(x0, y1, z0), col, SH_NX);
  // +z
  pushQuad(world, Vec3(x0, y0, z1), Vec3(x1, y0, z1), Vec3(x1, y1, z1), Vec3(x0, y1, z1), col, SH_PZ);
  // -z
  pushQuad(world, Vec3(x0, y0, z0), Vec3(x0, y1, z0), Vec3(x1, y1, z0), Vec3(x1, y0, z0), col, SH_NZ);
}

void Game::addBox(const Vec3& c, const Vec3& h, const Vec3& col, bool solid, bool pad) {
  bakeBoxFaces(c, h, col);
  if (solid) {
    Box b;
    b.c = c;
    b.h = h;
    b.col = col;
    b.solid = true;
    b.pad = pad;
    if (pad) pads.push_back(b);
    solids.push_back(b);
  }
}

void Game::addFlat(const Vec3& c, const Vec3& h, const Vec3& col) {
  // single top-facing tile, slightly above the surface it decorates
  const float x0 = c.x - h.x, x1 = c.x + h.x;
  const float z0 = c.z - h.z, z1 = c.z + h.z;
  const float y = c.y + 0.012f;
  pushQuad(world, Vec3(x0, y, z0), Vec3(x0, y, z1), Vec3(x1, y, z1), Vec3(x1, y, z0), col, SH_TOP);
}

void Game::addStairs(const Vec3& base, int steps, float rise, float run, float width,
                     const Vec3& col, int axis) {
  for (int i = 0; i < steps; i++) {
    const float y = base.y + i * rise + rise * 0.5f;
    Vec3 c = base;
    c.y = y;
    Vec3 h(width * 0.5f, rise * 0.5f, run * 0.5f);
    if (axis == -1) {
      c.z = base.z - (i * run + run * 0.5f);
    } else if (axis == 1) {
      c.z = base.z + (i * run + run * 0.5f);
    } else {
      c.x = base.x + (i * run + run * 0.5f);
      h = Vec3(run * 0.5f, rise * 0.5f, width * 0.5f);
    }
    addBox(c, h, col, true);
  }
}

void Game::addCoin(const Vec3& p) {
  Coin c;
  c.pos = p;
  coins.push_back(c);
}

// ---------------------------------------------------------------- build
void Game::build() {
  world.clear();
  solids.clear();
  pads.clear();
  coins.clear();

  // ---- baseplate ----
  addBox(Vec3(0, -0.5f, 0), Vec3(58, 0.5f, 58), pal::PLATE, true);
  const float tile = 3.2f;
  for (int ix = -18; ix <= 18; ix++)
    for (int iz = -18; iz <= 18; iz++) {
      Vec3 c(ix * tile, 0.f, iz * tile);
      Vec3 h(tile * 0.5f, 0.f, tile * 0.5f);
      addFlat(c, h, ((ix + iz) & 1) ? pal::GRASS_A : pal::GRASS_B);
    }

  // ---- spawn plaza ----
  addBox(Vec3(0, 0.20f, 7.f), Vec3(6.5f, 0.20f, 4.0f), pal::STONE, true);
  addBox(Vec3(0, 0.34f, 7.f), Vec3(3.0f, 0.06f, 2.0f), pal::WHITE, false);  // decal pad
  spawn = Vec3(0, 0.42f, 8.4f);

  // jump pad next to the plaza
  addBox(Vec3(4.2f, 0.52f, 7.f), Vec3(1.1f, 0.12f, 1.1f), pal::YELLOW, true, true);

  // ---- stairs up to the obby ----
  addStairs(Vec3(0, 0.40f, 3.6f), 9, 0.5f, 1.1f, 3.6f, pal::CYAN, -1);

  // ---- first platform + narrow bridge ----
  addBox(Vec3(0, 4.65f, -9.5f), Vec3(3.2f, 0.25f, 3.2f), pal::ORANGE, true);
  addBox(Vec3(0, 4.65f, -15.0f), Vec3(0.9f, 0.25f, 2.7f), pal::PINK, true);

  // ---- floating islands ----
  addBox(Vec3(-3.6f, 5.15f, -20.5f), Vec3(2.2f, 0.25f, 2.2f), pal::GREEN, true);
  addBox(Vec3(3.6f, 5.65f, -20.5f), Vec3(2.2f, 0.25f, 2.2f), pal::BLUE, true);

  // ---- stepping stones ----
  addBox(Vec3(0, 6.20f, -24.5f), Vec3(1.0f, 0.25f, 1.0f), pal::PURPLE, true);
  addBox(Vec3(3.2f, 6.90f, -27.0f), Vec3(1.0f, 0.25f, 1.0f), pal::ORANGE, true);
  addBox(Vec3(0, 7.60f, -29.5f), Vec3(1.0f, 0.25f, 1.0f), pal::CYAN, true);
  addBox(Vec3(-3.2f, 8.30f, -32.0f), Vec3(1.0f, 0.25f, 1.0f), pal::PINK, true);

  // ---- finish tower ----
  addBox(Vec3(0, 9.0f, -36.0f), Vec3(4.5f, 0.5f, 4.5f), pal::PURPLE, true);
  addBox(Vec3(0, 12.2f, -36.0f), Vec3(1.2f, 2.8f, 1.2f), pal::GOLD, false);  // trophy block

  // ---- decorative blocks around the plaza ----
  addBox(Vec3(-10, 1.5f, 3), Vec3(1.0f, 1.5f, 1.0f), pal::RED, true);
  addBox(Vec3(-10, 4.0f, 3), Vec3(1.6f, 1.0f, 1.6f), pal::WHITE, false);
  addBox(Vec3(10, 1.5f, 3), Vec3(1.0f, 1.5f, 1.0f), pal::BLUE, true);
  addBox(Vec3(10, 4.2f, 3), Vec3(1.8f, 1.2f, 1.8f), pal::WHITE, false);
  addBox(Vec3(-12, 0.8f, 12), Vec3(2.0f, 0.8f, 2.0f), pal::BROWN, true);
  addBox(Vec3(-12, 2.6f, 12), Vec3(2.4f, 1.0f, 2.4f), pal::GREEN, false);
  addBox(Vec3(12, 0.8f, 12), Vec3(2.0f, 0.8f, 2.0f), pal::BROWN, true);
  addBox(Vec3(12, 2.6f, 12), Vec3(2.4f, 1.0f, 2.4f), pal::GREEN, false);

  // ---- coins ----
  addCoin(Vec3(0, 1.4f, 7.f));
  addCoin(Vec3(-3.0f, 1.4f, 6.0f));
  addCoin(Vec3(3.0f, 1.4f, 6.0f));
  addCoin(Vec3(4.2f, 2.6f, 7.f));       // above the jump pad
  addCoin(Vec3(0, 1.9f, 1.8f));         // stairs
  addCoin(Vec3(0, 3.4f, -1.5f));        // stairs
  addCoin(Vec3(0, 6.1f, -9.5f));        // platform A
  addCoin(Vec3(0, 6.1f, -15.0f));       // bridge
  addCoin(Vec3(-3.6f, 6.6f, -20.5f));   // island B
  addCoin(Vec3(3.6f, 7.1f, -20.5f));    // island C
  addCoin(Vec3(0, 7.7f, -24.5f));
  addCoin(Vec3(3.2f, 8.4f, -27.0f));
  addCoin(Vec3(0, 9.1f, -29.5f));
  addCoin(Vec3(-3.2f, 9.8f, -32.0f));
  addCoin(Vec3(0, 10.6f, -36.0f));      // finish tower
  addCoin(Vec3(-2.5f, 10.6f, -33.0f));
  addCoin(Vec3(2.5f, 10.6f, -39.0f));
  addCoin(Vec3(-10, 3.6f, 3));          // on the red pillar
  addCoin(Vec3(10, 3.6f, 3));           // on the blue pillar
  addCoin(Vec3(0, 1.4f, 12.f));
}

// ---------------------------------------------------------------- run
void Game::reset() {
  for (auto& c : coins) c.taken = false;
  player.pos = spawn;
  player.vel = Vec3(0, 0, 0);
  player.yaw = PI;
  player.grounded = false;
  player.walkPhase = 0.f;
  camYaw = PI;            // camera behind the player, looking toward the course
  camPitch = 0.30f;
  moveX = moveY = 0.f;
  time = 0.f;
  collected = 0;
  won = false;
  respawns = 0;
  respawnFlash = 0.f;
}

void Game::jump() {
  if (player.grounded || player.airTime < 0.10f) {
    player.vel.y = JUMP_V;
    player.grounded = false;
    player.airTime = 0.11f;
  }
}

Vec3 Game::camFwd() const {
  const float cp = std::cos(camPitch);
  const float sp = std::sin(camPitch);
  return Vec3(std::sin(camYaw) * cp, -sp, std::cos(camYaw) * cp);
}

Vec3 Game::camRight() const {
  return Vec3(-std::cos(camYaw), 0.f, std::sin(camYaw));
}

Vec3 Game::camTarget() const {
  return player.pos + Vec3(0.f, 1.25f, 0.f);
}

Vec3 Game::camEye() const {
  return camTarget() - camFwd() * camDist;
}

void Game::update(float dt) {
  if (dt < 0.f) dt = 0.f;
  if (dt > 0.05f) dt = 0.05f;

  if (!won) time += dt;
  coinSpin += dt * 2.2f;
  bob += dt;
  if (respawnFlash > 0.f) respawnFlash = std::max(0.f, respawnFlash - dt * 2.5f);

  Player& p = player;

  // ---------- input to world-space wish direction ----------
  const Vec3 fwd(std::sin(camYaw), 0.f, std::cos(camYaw));
  const Vec3 right = camRight();
  Vec3 wish = fwd * moveY + right * moveX;
  float wl = wish.len();
  if (wl > 1.f) {
    wish = wish * (1.f / wl);
    wl = 1.f;
  }

  const float speed = (sprint ? RUN_SPEED : WALK_SPEED) * (wl > 0.02f ? 1.f : 0.f);
  const float accel = p.grounded ? 16.f : 5.f;
  const float k = 1.f - std::exp(-accel * dt);
  const Vec3 target = wish.norm() * speed;
  p.vel.x += (target.x - p.vel.x) * k;
  p.vel.z += (target.z - p.vel.z) * k;
  if (wl < 0.02f && p.grounded) {
    p.vel.x *= (1.f - 8.f * dt);
    p.vel.z *= (1.f - 8.f * dt);
  }

  // face the movement direction
  if (wl > 0.05f) {
    const float want = std::atan2(wish.x, wish.z);
    float diff = want - p.yaw;
    while (diff > PI) diff -= 2.f * PI;
    while (diff < -PI) diff += 2.f * PI;
    p.yaw += diff * std::min(1.f, 14.f * dt);
  }

  // walk animation phase
  const float planar = std::sqrt(p.vel.x * p.vel.x + p.vel.z * p.vel.z);
  if (p.grounded) {
    p.walkPhase += planar * dt * 1.9f;
  } else {
    p.airTime += dt;
  }

  // ---------- gravity ----------
  p.vel.y -= GRAVITY * dt;
  if (p.vel.y < -55.f) p.vel.y = -55.f;

  // ---------- integrate with axis-separated AABB collision ----------
  const float R = PLAYER_R;
  const float H = PLAYER_H;
  bool landed = false;

  auto overlaps = [&](const Box& b) {
    return p.pos.x + R > b.c.x - b.h.x && p.pos.x - R < b.c.x + b.h.x &&
           p.pos.z + R > b.c.z - b.h.z && p.pos.z - R < b.c.z + b.h.z &&
           p.pos.y + H > b.c.y - b.h.y && p.pos.y < b.c.y + b.h.y;
  };
  auto blockedAtY = [&](float y) {
    for (const auto& b : solids) {
      if (p.pos.x + R > b.c.x - b.h.x && p.pos.x - R < b.c.x + b.h.x &&
          p.pos.z + R > b.c.z - b.h.z && p.pos.z - R < b.c.z + b.h.z &&
          y + H > b.c.y - b.h.y && y < b.c.y + b.h.y)
        return true;
    }
    return false;
  };
  // roblox-style auto step: low ledges are climbed instead of blocking
  constexpr float STEP_UP = 0.62f;
  auto tryStepUp = [&](const Box& b) {
    const float top = b.c.y + b.h.y;
    const float rise = top - p.pos.y;
    if (!p.grounded || rise <= 0.001f || rise > STEP_UP) return false;
    const float ny = top + 0.002f;
    if (blockedAtY(ny)) return false;
    p.pos.y = ny;
    return true;
  };

  // X
  p.pos.x += p.vel.x * dt;
  for (const auto& b : solids) {
    if (!overlaps(b)) continue;
    if (tryStepUp(b)) continue;
    if (p.vel.x > 0.f) p.pos.x = b.c.x - b.h.x - R;
    else if (p.vel.x < 0.f) p.pos.x = b.c.x + b.h.x + R;
    p.vel.x = 0.f;
  }
  // Z
  p.pos.z += p.vel.z * dt;
  for (const auto& b : solids) {
    if (!overlaps(b)) continue;
    if (tryStepUp(b)) continue;
    if (p.vel.z > 0.f) p.pos.z = b.c.z - b.h.z - R;
    else if (p.vel.z < 0.f) p.pos.z = b.c.z + b.h.z + R;
    p.vel.z = 0.f;
  }
  // Y
  p.pos.y += p.vel.y * dt;
  for (const auto& b : solids) {
    if (!overlaps(b)) continue;
    if (p.vel.y <= 0.f) {
      p.pos.y = b.c.y + b.h.y;
      p.vel.y = 0.f;
      landed = true;
      if (b.pad) {
        p.vel.y = 17.5f;
        landed = false;
      }
    } else {
      p.pos.y = b.c.y - b.h.y - H;
      p.vel.y = 0.f;
    }
  }
  if (landed && !p.grounded) p.walkPhase = 0.f;
  p.grounded = landed;
  p.airTime = landed ? 0.f : p.airTime;

  // ---------- coins ----------
  for (auto& c : coins) {
    if (c.taken) continue;
    const float dx = c.pos.x - p.pos.x;
    const float dz = c.pos.z - p.pos.z;
    const float dy = c.pos.y - (p.pos.y + 0.9f);
    if (dx * dx + dz * dz < 1.1f * 1.1f && dy > -1.4f && dy < 1.4f) {
      c.taken = true;
      collected++;
    }
  }

  // ---------- fell off the world ----------
  if (p.pos.y < -16.f) {
    p.pos = spawn;
    p.vel = Vec3(0, 0, 0);
    respawns++;
    respawnFlash = 1.f;
  }

  if (!won && collected >= (int)coins.size() && !coins.empty()) won = true;
}

Game& instance() {
  static Game g;
  static bool built = false;
  if (!built) {
    g.build();
    g.reset();
    built = true;
  }
  return g;
}

}  // namespace blox
