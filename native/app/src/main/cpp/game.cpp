// ============================================================
// AETHERION NATIVE — simulation core implementation
// ============================================================
#include "game.h"
#include <algorithm>
#include <cmath>

namespace ae {

using namespace m3;

const Vec3 ELEMENT_COLORS[5] = {
    {0.85f, 0.85f, 0.9f},   // none
    {0.45f, 0.93f, 0.78f},  // anemo
    {1.00f, 0.52f, 0.24f},  // pyro
    {0.72f, 0.44f, 1.00f},  // electro
    {0.55f, 0.85f, 1.00f},  // cryo
};

const CharacterDef CHARACTERS[4] = {
    {"KAEL", EL_ANEMO, {0.16f, 0.20f, 0.30f}, {0.45f, 0.93f, 0.78f}, 62.f, 5.2f, "sword"},
    {"SERA", EL_PYRO, {0.42f, 0.14f, 0.12f}, {1.00f, 0.52f, 0.24f}, 74.f, 4.9f, "catalyst"},
    {"RIN", EL_ELECTRO, {0.22f, 0.16f, 0.38f}, {0.72f, 0.44f, 1.00f}, 68.f, 5.4f, "polearm"},
    {"BORA", EL_CRYO, {0.14f, 0.30f, 0.38f}, {0.55f, 0.85f, 1.00f}, 80.f, 4.6f, "claymore"},
};

// ============================================================ skeleton rest
namespace {
struct JointDef { int parent; Vec3 offset; };
// canonical humanoid joints in model space (metres), feet at y=0
const Vec3 J_HIPS{0.f, 0.94f, 0.f};
const Vec3 J_SPINE{0.f, 1.09f, 0.f};
const Vec3 J_CHEST{0.f, 1.27f, 0.f};
const Vec3 J_NECK{0.f, 1.45f, 0.f};
const Vec3 J_HEAD{0.f, 1.53f, 0.f};
const Vec3 J_SHL{0.175f, 1.39f, 0.f};
const Vec3 J_ELB{0.30f, 1.12f, 0.01f};
const Vec3 J_WRI{0.335f, 0.89f, 0.04f};
const Vec3 J_HAND{0.35f, 0.80f, 0.06f};
const Vec3 J_SHR{-0.175f, 1.39f, 0.f};
const Vec3 J_ELBR{-0.30f, 1.12f, 0.01f};
const Vec3 J_WRIR{-0.335f, 0.89f, 0.04f};
const Vec3 J_HANDR{-0.35f, 0.80f, 0.06f};
const Vec3 J_THL{0.105f, 0.90f, 0.f};
const Vec3 J_KNEL{0.11f, 0.49f, 0.01f};
const Vec3 J_ANKL{0.11f, 0.085f, 0.f};
const Vec3 J_TOEL{0.11f, 0.05f, 0.17f};
const Vec3 J_THR{-0.105f, 0.90f, 0.f};
const Vec3 J_KNER{-0.11f, 0.49f, 0.01f};
const Vec3 J_ANKR{-0.11f, 0.085f, 0.f};
const Vec3 J_TOER{-0.11f, 0.05f, 0.17f};
const Vec3 J_WEAP{-0.35f, 0.86f, 0.10f};

const JointDef JOINTS[BONE_COUNT] = {
    {-1, {0, 0, 0}},              // B_ROOT
    {B_ROOT, J_HIPS},             // B_HIPS
    {B_HIPS, J_SPINE - J_HIPS},   // B_SPINE
    {B_SPINE, J_CHEST - J_SPINE}, // B_CHEST
    {B_CHEST, J_NECK - J_CHEST},  // B_NECK
    {B_NECK, J_HEAD - J_NECK},    // B_HEAD
    {B_CHEST, J_SHL - J_CHEST},   // B_SHOULDER_L
    {B_SHOULDER_L, J_ELB - J_SHL},
    {B_ARM_L, J_WRI - J_ELB},
    {B_FOREARM_L, J_HAND - J_WRI},
    {B_CHEST, J_SHR - J_CHEST},   // B_SHOULDER_R
    {B_SHOULDER_R, J_ELBR - J_SHR},
    {B_ARM_R, J_WRIR - J_ELBR},
    {B_FOREARM_R, J_HANDR - J_WRIR},
    {B_HIPS, J_THL - J_HIPS},     // B_THIGH_L
    {B_THIGH_L, J_KNEL - J_THL},
    {B_SHIN_L, J_ANKL - J_KNEL},
    {B_HIPS, J_THR - J_HIPS},     // B_THIGH_R
    {B_THIGH_R, J_KNER - J_THR},
    {B_SHIN_R, J_ANKR - J_KNER},
    {B_HAND_R, J_WEAP - J_HANDR}, // B_WEAPON
};

const Vec3 JOINT_POS[BONE_COUNT] = {
    {0, 0, 0}, J_HIPS, J_SPINE, J_CHEST, J_NECK, J_HEAD,
    J_SHL, J_ELB, J_WRI, J_HAND,
    J_SHR, J_ELBR, J_WRIR, J_HANDR,
    J_THL, J_KNEL, J_ANKL,
    J_THR, J_KNER, J_ANKR,
    J_WEAP,
};

// palette
const Vec3 C_SKIN{0.96f, 0.80f, 0.68f};
const Vec3 C_HAIR{0.16f, 0.14f, 0.20f};
const Vec3 C_GOLD{0.85f, 0.70f, 0.36f};
const Vec3 C_BOOT{0.20f, 0.17f, 0.22f};
const Vec3 C_STEEL{0.72f, 0.74f, 0.80f};
}  // namespace

// ============================================================ Pose
Pose::Pose() {
  std::memset(rot, 0, sizeof(rot));
  // relaxed arms
  rot[B_ARM_L][2] = 0.10f;
  rot[B_ARM_R][2] = -0.10f;
  rot[B_FOREARM_L][0] = -0.18f;
  rot[B_FOREARM_R][0] = -0.18f;
}

void Pose::blend(const Pose& a, const Pose& b, float t, Pose& out) {
  float u = t * t * (3.f - 2.f * t);
  for (int i = 0; i < BONE_COUNT; i++)
    for (int k = 0; k < 3; k++) out.rot[i][k] = lerpf(a.rot[i][k], b.rot[i][k], u);
  out.rootOffset = Vec3::lerp(a.rootOffset, b.rootOffset, u);
}

// ============================================================ character mesh
namespace {
struct Seg {
  int bone;
  int parent;        // bone used for weight blending at the joint
  Vec3 a, b;
  float ra, rb;
  Vec3 color;
};

void pushRing(MeshData& m, const Vec3& center, const Mat4& rot, float radius, int sides, int bone, int parent,
              uint8_t w0, const Vec3& color) {
  for (int i = 0; i < sides; i++) {
    float ang = (float)i / sides * TAU;
    Vec3 dir(std::cos(ang), 0.f, std::sin(ang));
    Vec3 p = center + rot.transformDir(dir * radius);
    Vec3 n = rot.transformDir(dir);
    SkinnedVertex v{};
    v.px = p.x; v.py = p.y; v.pz = p.z;
    v.nx = n.x; v.ny = n.y; v.nz = n.z;
    v.cr = color.x; v.cg = color.y; v.cb = color.z;
    v.j0 = (uint8_t)bone; v.j1 = (uint8_t)(parent >= 0 ? parent : bone); v.w0 = w0;
    m.verts.push_back(v);
  }
}

void addTube(MeshData& m, const Seg& s, int sides = 8, int rings = 3) {
  Vec3 axis = s.b - s.a;
  float len = axis.len();
  if (len < 1e-4f) return;
  Vec3 z = axis.norm();
  Vec3 x = Vec3(0, 1, 0).cross(z);
  if (x.len() < 1e-3f) x = Vec3(1, 0, 0);
  x = x.norm();
  Vec3 y = z.cross(x).norm();
  Mat4 rot = Mat4::zero();
  rot.m[0] = x.x; rot.m[1] = x.y; rot.m[2] = x.z;
  rot.m[4] = y.x; rot.m[5] = y.y; rot.m[6] = y.z;
  rot.m[8] = z.x; rot.m[9] = z.y; rot.m[10] = z.z;
  rot.m[15] = 1.f;

  const uint16_t base = (uint16_t)m.verts.size();
  for (int r = 0; r <= rings; r++) {
    float t = (float)r / rings;
    float rad = lerpf(s.ra, s.rb, t);
    // blend toward the parent bone near the joint for smooth bending
    float w = clampf(0.25f + t * 1.6f, 0.f, 1.f);
    pushRing(m, Vec3::lerp(s.a, s.b, t), rot, rad, sides, s.bone, s.parent, (uint8_t)(w * 255.f), s.color);
  }
  for (int r = 0; r < rings; r++)
    for (int i = 0; i < sides; i++) {
      uint16_t a0 = (uint16_t)(base + r * sides + i);
      uint16_t a1 = (uint16_t)(base + r * sides + (i + 1) % sides);
      uint16_t b0 = (uint16_t)(a0 + sides), b1 = (uint16_t)(a1 + sides);
      m.idx.push_back(a0); m.idx.push_back(b0); m.idx.push_back(a1);
      m.idx.push_back(a1); m.idx.push_back(b0); m.idx.push_back(b1);
    }
  // end cap so limbs read as solid volumes
  uint16_t capBase = (uint16_t)(base + rings * sides);
  uint16_t cIdx = (uint16_t)m.verts.size();
  SkinnedVertex v{};
  v.px = s.b.x; v.py = s.b.y; v.pz = s.b.z;
  v.nx = z.x; v.ny = z.y; v.nz = z.z;
  v.cr = s.color.x; v.cg = s.color.y; v.cb = s.color.z;
  v.j0 = (uint8_t)s.bone; v.j1 = (uint8_t)(s.parent >= 0 ? s.parent : s.bone); v.w0 = 255;
  m.verts.push_back(v);
  for (int i = 0; i < sides; i++)
    m.idx.push_back((uint16_t)(capBase + i)), m.idx.push_back((uint16_t)(capBase + (i + 1) % sides)), m.idx.push_back(cIdx);
}

void addSphere(MeshData& m, const Vec3& center, float radius, const Vec3& squash, const Vec3& color, int bone,
               int parent, int sides = 10, int rows = 7) {
  uint16_t base = (uint16_t)m.verts.size();
  for (int j = 0; j <= rows; j++) {
    float v = (float)j / rows;
    float ang = v * PI;
    float ry = std::cos(ang), rr = std::sin(ang);
    for (int i = 0; i < sides; i++) {
      float u = (float)i / sides * TAU;
      Vec3 dir(std::cos(u) * rr, ry, std::sin(u) * rr);
      SkinnedVertex sv{};
      sv.px = center.x + dir.x * radius * squash.x;
      sv.py = center.y + dir.y * radius * squash.y;
      sv.pz = center.z + dir.z * radius * squash.z;
      sv.nx = dir.x; sv.ny = dir.y; sv.nz = dir.z;
      sv.cr = color.x; sv.cg = color.y; sv.cb = color.z;
      sv.j0 = (uint8_t)bone; sv.j1 = (uint8_t)(parent >= 0 ? parent : bone); sv.w0 = 255;
      m.verts.push_back(sv);
    }
  }
  for (int j = 0; j < rows; j++)
    for (int i = 0; i < sides; i++) {
      uint16_t a0 = (uint16_t)(base + j * sides + i);
      uint16_t a1 = (uint16_t)(base + j * sides + (i + 1) % sides);
      uint16_t b0 = (uint16_t)(a0 + sides), b1 = (uint16_t)(a1 + sides);
      m.idx.push_back(a0); m.idx.push_back(b0); m.idx.push_back(a1);
      m.idx.push_back(a1); m.idx.push_back(b0); m.idx.push_back(b1);
    }
}
}  // namespace

void buildCharacterModel(CharModel& out) {
  if (out.built) return;
  for (int i = 0; i < BONE_COUNT; i++) {
    out.parent[i] = JOINTS[i].parent;
    out.restLocal[i] = Mat4::translate(JOINTS[i].offset);
    out.bindInv[i] = Mat4::translate(-JOINT_POS[i]);
  }
  MeshData& m = out.mesh;
  m.verts.reserve(6000);
  m.idx.reserve(12000);

  // vertex colour encodes a palette slot: R=cloth, G=skin, B=metal/accent, (0.5,0.5,0)=hair
  const Vec3 cloth(1.f, 0.f, 0.f);
  const Vec3 skin(0.f, 1.f, 0.f);
  const Vec3 accent(0.f, 0.f, 1.f);
  const Vec3 mark(0.5f, 0.5f, 0.f);

  // torso
  addTube(m, Seg{B_HIPS, B_ROOT, J_HIPS + Vec3(0, -0.02f, 0), J_SPINE, 0.150f, 0.158f, cloth}, 10, 2);
  addTube(m, Seg{B_SPINE, B_HIPS, J_SPINE, J_CHEST, 0.158f, 0.180f, cloth}, 12, 3);
  addTube(m, Seg{B_CHEST, B_SPINE, J_CHEST, J_NECK, 0.180f, 0.088f, cloth}, 12, 3);
  // collar accent
  addTube(m, Seg{B_CHEST, B_SPINE, J_NECK + Vec3(0, -0.02f, 0), J_NECK + Vec3(0, 0.03f, 0), 0.115f, 0.098f, accent}, 10, 1);
  // neck + head
  addTube(m, Seg{B_NECK, B_CHEST, J_NECK, J_HEAD, 0.062f, 0.070f, skin}, 8, 2);
  addSphere(m, J_HEAD + Vec3(0, 0.10f, 0.005f), 0.125f, Vec3(0.92f, 1.06f, 0.98f), skin, B_HEAD, B_NECK, 16, 11);
  // hair cap + fringe
  addSphere(m, J_HEAD + Vec3(0, 0.125f, -0.012f), 0.132f, Vec3(1.02f, 0.92f, 1.04f), mark, B_HEAD, B_NECK, 16, 10);
  addSphere(m, J_HEAD + Vec3(0, 0.02f, -0.10f), 0.10f, Vec3(1.0f, 0.85f, 0.7f), mark, B_HEAD, B_NECK, 10, 8);

  // arms
  for (int side = 0; side < 2; side++) {
    bool left = side == 0;
    int sh = left ? B_SHOULDER_L : B_SHOULDER_R;
    int arm = left ? B_ARM_L : B_ARM_R;
    int fore = left ? B_FOREARM_L : B_FOREARM_R;
    int hand = left ? B_HAND_L : B_HAND_R;
    int chestB = B_CHEST;
    Vec3 s0 = left ? J_SHL : J_SHR;
    Vec3 e0 = left ? J_ELB : J_ELBR;
    Vec3 w0 = left ? J_WRI : J_WRIR;
    Vec3 h0 = left ? J_HAND : J_HANDR;
    addSphere(m, s0, 0.085f, Vec3(1.f, 0.95f, 1.f), cloth, sh, chestB, 8, 6);   // pauldron
    addTube(m, Seg{arm, sh, s0, e0, 0.072f, 0.056f, cloth}, 10, 3);
    addTube(m, Seg{fore, arm, e0, w0, 0.056f, 0.042f, skin}, 10, 3);
    addTube(m, Seg{hand, fore, w0, h0, 0.046f, 0.034f, accent}, 6, 1);
  }

  // legs
  for (int side = 0; side < 2; side++) {
    bool left = side == 0;
    int th = left ? B_THIGH_L : B_THIGH_R;
    int sh = left ? B_SHIN_L : B_SHIN_R;
    int ft = left ? B_FOOT_L : B_FOOT_R;
    int hipB = B_HIPS;
    Vec3 a0 = left ? J_THL : J_THR;
    Vec3 k0 = left ? J_KNEL : J_KNER;
    Vec3 an = left ? J_ANKL : J_ANKR;
    Vec3 to = left ? J_TOEL : J_TOER;
    addTube(m, Seg{th, hipB, a0, k0, 0.098f, 0.072f, cloth}, 10, 3);
    addTube(m, Seg{sh, th, k0, an, 0.072f, 0.052f, cloth}, 10, 3);
    addTube(m, Seg{ft, sh, an + Vec3(0, 0.01f, -0.02f), to, 0.062f, 0.050f, accent}, 8, 1);
  }

  // weapon (sword) bound to the right hand
  addTube(m, Seg{B_WEAPON, B_HAND_R, J_WEAP, J_WEAP + Vec3(0, 0.12f, 0.5f), 0.028f, 0.024f, accent}, 6, 2);
  addTube(m, Seg{B_WEAPON, B_HAND_R, J_WEAP + Vec3(0, 0.12f, 0.5f), J_WEAP + Vec3(0, 0.13f, 1.08f), 0.045f, 0.006f, accent}, 4, 2);

  out.built = true;
}

void poseToMatrices(const CharModel& model, const Pose& pose, const Vec3& worldPos, float yaw, float scale,
                    Mat4 out[BONE_COUNT]) {
  Mat4 world[BONE_COUNT];
  for (int i = 0; i < BONE_COUNT; i++) {
    Mat4 local = model.restLocal[i] * Mat4::euler(pose.rot[i][0], pose.rot[i][1], pose.rot[i][2]);
    int p = model.parent[i];
    world[i] = p >= 0 ? world[p] * local : local;
  }
  Mat4 root = Mat4::translate(worldPos + Vec3(0, pose.rootOffset.y, 0)) * Mat4::rotY(yaw) * Mat4::scale(Vec3(scale));
  for (int i = 0; i < BONE_COUNT; i++) out[i] = root * world[i] * model.bindInv[i];
}

// ============================================================ animation
float animDuration(AnimState s) {
  switch (s) {
    case A_RUN: return 0.62f;
    case A_SPRINT: return 0.50f;
    case A_ATTACK1: return 0.44f;
    case A_ATTACK2: return 0.44f;
    case A_ATTACK3: return 0.62f;
    case A_SKILL: return 0.80f;
    case A_DASH: return 0.34f;
    case A_HIT: return 0.30f;
    case A_DEAD: return 1.10f;
    default: return 1.6f;
  }
}

namespace {
inline float kf(float t, const float* times, const float* vals, int n) {
  if (t <= times[0]) return vals[0];
  for (int i = 1; i < n; i++) {
    if (t <= times[i]) {
      float u = (t - times[i - 1]) / (times[i] - times[i - 1] + 1e-6f);
      u = u * u * (3.f - 2.f * u);
      return lerpf(vals[i - 1], vals[i], u);
    }
  }
  return vals[n - 1];
}
inline void setRot(Pose& p, int bone, float x, float y, float z) {
  p.rot[bone][0] = x; p.rot[bone][1] = y; p.rot[bone][2] = z;
}
}  // namespace

void samplePose(AnimState state, float t, float speedScale, Pose& p) {
  p = Pose();
  const float phase = t * TAU;
  switch (state) {
    case A_IDLE: {
      float br = std::sin(t * TAU * 0.62f);
      setRot(p, B_CHEST, br * 0.022f, std::sin(t * TAU * 0.31f) * 0.03f, 0);
      setRot(p, B_SPINE, br * 0.014f, 0, 0);
      setRot(p, B_HEAD, -br * 0.02f, std::sin(t * TAU * 0.21f) * 0.10f, 0);
      setRot(p, B_ARM_L, -0.05f + br * 0.03f, 0, 0.14f + br * 0.02f);
      setRot(p, B_ARM_R, -0.05f - br * 0.03f, 0, -0.14f - br * 0.02f);
      setRot(p, B_FOREARM_L, -0.28f, 0, 0);
      setRot(p, B_FOREARM_R, -0.28f, 0, 0);
      setRot(p, B_THIGH_L, 0.02f, 0, 0.03f);
      setRot(p, B_THIGH_R, 0.02f, 0, -0.03f);
      setRot(p, B_SHIN_L, 0.05f, 0, 0);
      setRot(p, B_SHIN_R, 0.05f, 0, 0);
      p.rootOffset.y = br * 0.012f;
      break;
    }
    case A_RUN:
    case A_SPRINT: {
      const bool sprint = state == A_SPRINT;
      const float amp = (sprint ? 1.22f : 0.95f) * clampf(speedScale, 0.55f, 1.35f);
      const float lean = sprint ? 0.26f : 0.15f;
      // legs: negative rotX swings the thigh forward
      float tl = -std::sin(phase) * 0.78f * amp;
      float tr = -std::sin(phase + PI) * 0.78f * amp;
      setRot(p, B_THIGH_L, tl, 0, 0.02f);
      setRot(p, B_THIGH_R, tr, 0, -0.02f);
      // knees bend when the leg travels backwards / lifts
      float kl = 0.25f + std::max(0.f, std::sin(phase + 2.2f)) * (sprint ? 1.55f : 1.25f);
      float kr = 0.25f + std::max(0.f, std::sin(phase + 2.2f + PI)) * (sprint ? 1.55f : 1.25f);
      setRot(p, B_SHIN_L, kl, 0, 0);
      setRot(p, B_SHIN_R, kr, 0, 0);
      setRot(p, B_FOOT_L, -kl * 0.35f + 0.12f, 0, 0);
      setRot(p, B_FOOT_R, -kr * 0.35f + 0.12f, 0, 0);
      // arms counter-swing
      float al = std::sin(phase) * (sprint ? 0.85f : 0.62f);
      float ar = -al;
      setRot(p, B_ARM_L, al, 0, 0.16f);
      setRot(p, B_ARM_R, ar, 0, -0.16f);
      setRot(p, B_FOREARM_L, -0.55f - std::max(0.f, al) * 0.55f, 0, 0);
      setRot(p, B_FOREARM_R, -0.55f - std::max(0.f, ar) * 0.55f, 0, 0);
      // torso: lean + counter rotation
      setRot(p, B_SPINE, -lean * 0.35f, std::sin(phase) * 0.10f, 0);
      setRot(p, B_CHEST, -lean * 0.65f, -std::sin(phase) * 0.14f, 0);
      setRot(p, B_HEAD, lean * 0.55f, std::sin(phase) * 0.06f, 0);
      setRot(p, B_HIPS, -lean * 0.25f, std::sin(phase) * 0.06f, 0);
      p.rootOffset.y = -0.03f + std::cos(phase * 2.f) * (sprint ? 0.055f : 0.04f);
      break;
    }
    case A_JUMP: {
      setRot(p, B_THIGH_L, -0.55f, 0, 0.05f);
      setRot(p, B_THIGH_R, -0.20f, 0, -0.05f);
      setRot(p, B_SHIN_L, 0.95f, 0, 0);
      setRot(p, B_SHIN_R, 0.35f, 0, 0);
      setRot(p, B_ARM_L, -0.45f, 0, 0.55f);
      setRot(p, B_ARM_R, -0.35f, 0, -0.65f);
      setRot(p, B_CHEST, -0.12f, 0, 0);
      p.rootOffset.y = 0.05f;
      break;
    }
    case A_FALL: {
      float w = std::sin(t * TAU * 0.9f) * 0.08f;
      setRot(p, B_THIGH_L, -0.18f, 0, 0.12f);
      setRot(p, B_THIGH_R, 0.12f, 0, -0.12f);
      setRot(p, B_SHIN_L, 0.35f + w, 0, 0);
      setRot(p, B_SHIN_R, 0.25f - w, 0, 0);
      setRot(p, B_ARM_L, -0.30f, 0, 0.85f);
      setRot(p, B_ARM_R, -0.30f, 0, -0.85f);
      setRot(p, B_CHEST, 0.08f, 0, 0);
      break;
    }
    case A_GLIDE: {
      float w = std::sin(t * TAU * 0.7f) * 0.05f;
      setRot(p, B_ARM_L, -0.10f, 0, 1.35f + w);
      setRot(p, B_ARM_R, -0.10f, 0, -1.35f - w);
      setRot(p, B_FOREARM_L, -0.15f, 0, 0);
      setRot(p, B_FOREARM_R, -0.15f, 0, 0);
      setRot(p, B_THIGH_L, -0.12f, 0, 0.06f);
      setRot(p, B_THIGH_R, -0.22f, 0, -0.06f);
      setRot(p, B_SHIN_L, 0.30f, 0, 0);
      setRot(p, B_SHIN_R, 0.45f, 0, 0);
      setRot(p, B_CHEST, -0.10f, 0, 0);
      break;
    }
    case A_ATTACK1: {
      const float ts[] = {0.f, 0.22f, 0.38f, 0.60f, 1.f};
      const float armX[] = {-0.2f, -1.15f, 0.75f, 0.30f, 0.0f};
      const float armZ[] = {-0.2f, -1.05f, 0.95f, 0.35f, -0.14f};
      const float fore[] = {-0.6f, -1.45f, -0.15f, -0.35f, -0.28f};
      const float chestY[] = {0.05f, 0.62f, -0.55f, -0.15f, 0.f};
      const float hipsY[] = {0.f, 0.22f, -0.24f, -0.06f, 0.f};
      const float knee[] = {0.10f, 0.45f, 0.65f, 0.30f, 0.05f};
      setRot(p, B_ARM_R, kf(t, ts, armX, 5), 0, kf(t, ts, armZ, 5));
      setRot(p, B_FOREARM_R, kf(t, ts, fore, 5), 0, 0);
      setRot(p, B_CHEST, 0, kf(t, ts, chestY, 5), 0);
      setRot(p, B_HIPS, 0, kf(t, ts, hipsY, 5), 0);
      setRot(p, B_ARM_L, 0.25f, 0, 0.55f);
      setRot(p, B_FOREARM_L, -0.9f, 0, 0);
      setRot(p, B_THIGH_L, -0.25f, 0, 0.05f);
      setRot(p, B_THIGH_R, 0.15f, 0, -0.05f);
      setRot(p, B_SHIN_L, kf(t, ts, knee, 5), 0, 0);
      setRot(p, B_SHIN_R, kf(t, ts, knee, 5) * 0.6f, 0, 0);
      static const float bob[] = {0.f, -0.02f, -0.05f, -0.02f, 0.f};
      p.rootOffset.y = kf(t, ts, bob, 5);
      break;
    }
    case A_ATTACK2: {
      const float ts[] = {0.f, 0.20f, 0.36f, 0.58f, 1.f};
      const float armX[] = {-0.1f, -1.30f, 0.55f, 0.20f, 0.0f};
      const float armZ[] = {0.2f, 1.10f, -1.05f, -0.3f, -0.14f};
      const float chestY[] = {-0.05f, -0.65f, 0.65f, 0.15f, 0.f};
      setRot(p, B_ARM_R, kf(t, ts, armX, 5), 0, kf(t, ts, armZ, 5));
      setRot(p, B_FOREARM_R, -0.45f, 0, 0);
      setRot(p, B_CHEST, 0, kf(t, ts, chestY, 5), 0);
      setRot(p, B_HIPS, 0, kf(t, ts, chestY, 5) * 0.4f, 0);
      setRot(p, B_ARM_L, 0.35f, 0, 0.85f);
      setRot(p, B_THIGH_L, -0.15f, 0, 0.05f);
      setRot(p, B_THIGH_R, -0.30f, 0, -0.05f);
      setRot(p, B_SHIN_L, 0.35f, 0, 0);
      setRot(p, B_SHIN_R, 0.55f, 0, 0);
      break;
    }
    case A_ATTACK3: {
      const float ts[] = {0.f, 0.30f, 0.46f, 0.70f, 1.f};
      const float armX[] = {-0.1f, -2.55f, 0.35f, 0.15f, 0.f};
      const float fore[] = {-0.4f, -0.85f, -0.05f, -0.3f, -0.28f};
      const float chestX[] = {0.f, 0.30f, -0.42f, -0.15f, 0.f};
      const float hipsY[] = {0.f, -0.18f, 0.30f, 0.10f, 0.f};
      setRot(p, B_ARM_R, kf(t, ts, armX, 5), 0, -0.20f);
      setRot(p, B_ARM_L, kf(t, ts, armX, 5) * 0.85f, 0, 0.22f);
      setRot(p, B_FOREARM_R, kf(t, ts, fore, 5), 0, 0);
      setRot(p, B_FOREARM_L, kf(t, ts, fore, 5), 0, 0);
      setRot(p, B_CHEST, kf(t, ts, chestX, 5), kf(t, ts, hipsY, 5), 0);
      setRot(p, B_THIGH_L, -0.35f, 0, 0.06f);
      setRot(p, B_THIGH_R, 0.25f, 0, -0.06f);
      setRot(p, B_SHIN_L, 0.85f, 0, 0);
      setRot(p, B_SHIN_R, 0.25f, 0, 0);
      setRot(p, B_HEAD, 0.12f, 0, 0);
      break;
    }
    case A_SKILL: {
      const float ts[] = {0.f, 0.28f, 0.55f, 1.f};
      const float armX[] = {-0.1f, -0.55f, -0.85f, -0.2f};
      const float armZ[] = {0.2f, -0.35f, -0.55f, -0.14f};
      const float chestX[] = {0.f, 0.16f, -0.12f, 0.f};
      setRot(p, B_ARM_R, kf(t, ts, armX, 4), 0, kf(t, ts, armZ, 4));
      setRot(p, B_ARM_L, kf(t, ts, armX, 4), 0, -kf(t, ts, armZ, 4));
      setRot(p, B_FOREARM_R, -0.75f, 0, 0);
      setRot(p, B_FOREARM_L, -0.75f, 0, 0);
      setRot(p, B_CHEST, kf(t, ts, chestX, 4), 0, 0);
      setRot(p, B_HEAD, -0.15f, 0, 0);
      setRot(p, B_THIGH_L, -0.20f, 0, 0.09f);
      setRot(p, B_THIGH_R, 0.18f, 0, -0.09f);
      setRot(p, B_SHIN_L, 0.45f, 0, 0);
      setRot(p, B_SHIN_R, 0.30f, 0, 0);
      p.rootOffset.y = -0.02f;
      break;
    }
    case A_DASH: {
      setRot(p, B_SPINE, -0.35f, 0, 0);
      setRot(p, B_CHEST, -0.28f, 0, 0);
      setRot(p, B_HEAD, 0.35f, 0, 0);
      setRot(p, B_ARM_L, 0.85f, 0, 0.35f);
      setRot(p, B_ARM_R, 0.95f, 0, -0.30f);
      setRot(p, B_FOREARM_L, -1.15f, 0, 0);
      setRot(p, B_FOREARM_R, -0.95f, 0, 0);
      setRot(p, B_THIGH_L, -0.65f, 0, 0.05f);
      setRot(p, B_THIGH_R, 0.35f, 0, -0.05f);
      setRot(p, B_SHIN_L, 0.95f, 0, 0);
      setRot(p, B_SHIN_R, 0.55f, 0, 0);
      p.rootOffset.y = -0.09f;
      break;
    }
    case A_HIT: {
      float k = 1.f - clampf(t * 1.6f, 0.f, 1.f);
      setRot(p, B_CHEST, 0.28f * k, 0.20f * k, 0);
      setRot(p, B_HEAD, 0.35f * k, 0, 0);
      setRot(p, B_ARM_L, 0.35f * k, 0, 0.35f);
      setRot(p, B_ARM_R, 0.45f * k, 0, -0.30f);
      p.rootOffset.y = -0.04f * k;
      break;
    }
    case A_DEAD: {
      float k = easeOutCubic(clampf(t * 1.25f, 0.f, 1.f));
      setRot(p, B_HIPS, -1.45f * k, 0, 0);
      setRot(p, B_SPINE, 0.35f * k, 0, 0);
      setRot(p, B_CHEST, 0.25f * k, 0, 0.15f * k);
      setRot(p, B_HEAD, 0.45f * k, 0.3f * k, 0);
      setRot(p, B_ARM_L, 0.9f * k, 0, 0.9f * k);
      setRot(p, B_ARM_R, 0.7f * k, 0, -0.7f * k);
      setRot(p, B_THIGH_L, -0.5f * k, 0, 0.2f * k);
      setRot(p, B_THIGH_R, -0.25f * k, 0, -0.2f * k);
      setRot(p, B_SHIN_L, 1.1f * k, 0, 0);
      setRot(p, B_SHIN_R, 0.8f * k, 0, 0);
      p.rootOffset.y = -0.55f * k;
      break;
    }
    default:
      break;
  }
}

void AnimPlayer::play(AnimState s, float startTime) {
  if (s == state) return;
  prevState = state;
  prevTime = time;
  state = s;
  time = startTime;
  blend = 0.f;
}

void AnimPlayer::update(float dt) {
  time += dt * speed;
  float dur = animDuration(state);
  bool looping = state == A_IDLE || state == A_RUN || state == A_SPRINT || state == A_FALL || state == A_GLIDE;
  if (looping) {
    while (time > dur) time -= dur;
  } else if (time > dur) {
    time = dur;
  }
  prevTime += dt * speed;
  if (prevTime > animDuration(prevState)) prevTime = animDuration(prevState);
  blend = clampf(blend + dt * 9.f, 0.f, 1.f);
}

void AnimPlayer::sample(Pose& out) const {
  Pose a, b;
  samplePose(state, animDuration(state) > 0 ? time / animDuration(state) : 0.f, 1.f, a);
  if (blend < 0.999f) {
    samplePose(prevState, animDuration(prevState) > 0 ? prevTime / animDuration(prevState) : 0.f, 1.f, b);
    Pose::blend(b, a, blend, out);
  } else {
    out = a;
  }
}

// ============================================================ terrain
float Terrain::heightAt(float x, float z) {
  float base = fbm(x * 0.0042f + 11.3f, z * 0.0042f - 7.1f, 5);
  float ridgeN = fbm(x * 0.0018f - 3.3f, z * 0.0018f + 5.7f, 4) * 2.f - 1.f;
  float ridge = 1.f - std::fabs(ridgeN);
  float h = base * 13.f + std::pow(clampf(ridge, 0.f, 1.f), 3.2f) * 52.f - 3.f;
  // gentle plateau around spawn
  float sd = std::sqrt((x - 8.f) * (x - 8.f) + (z - 34.f) * (z - 34.f));
  h = lerpf(h, h * 0.45f + 1.f, smoothstep(90.f, 12.f, sd) * 0.55f);
  // lake basin to the south-west
  float ld = std::sqrt((x + 150.f) * (x + 150.f) + (z - 120.f) * (z - 120.f));
  h -= smoothstep(120.f, 20.f, ld) * 24.f;
  // river valley cutting north
  float rv = std::fabs(x - 60.f - std::sin(z * 0.01f) * 30.f);
  h -= smoothstep(26.f, 4.f, rv) * 7.f;
  return h;
}

Vec3 Terrain::normalAt(float x, float z) {
  const float e = 0.6f;
  float hl = heightAt(x - e, z), hr = heightAt(x + e, z);
  float hd = heightAt(x, z - e), hu = heightAt(x, z + e);
  return Vec3(hl - hr, 2.f * e, hd - hu).norm();
}

Vec3 Terrain::colorAt(float x, float z, float h, const Vec3& n) {
  float slope = 1.f - n.y;
  float n1 = fbm(x * 0.06f, z * 0.06f, 3);
  Vec3 grass(0.24f + n1 * 0.10f, 0.44f + n1 * 0.14f, 0.20f + n1 * 0.08f);
  Vec3 grass2(0.32f, 0.50f, 0.22f);
  Vec3 rock(0.40f + n1 * 0.08f, 0.39f + n1 * 0.07f, 0.38f + n1 * 0.06f);
  Vec3 sand(0.78f, 0.72f, 0.52f);
  Vec3 snow(0.92f, 0.95f, 0.99f);
  Vec3 dirt(0.45f, 0.36f, 0.24f);

  Vec3 c = Vec3::lerp(grass, grass2, n1);
  c = Vec3::lerp(c, dirt, smoothstep(0.10f, 0.22f, slope) * 0.55f);
  c = Vec3::lerp(c, rock, smoothstep(0.22f, 0.42f, slope));
  c = Vec3::lerp(c, snow, smoothstep(34.f, 46.f, h) * (1.f - smoothstep(0.35f, 0.6f, slope)));
  c = Vec3::lerp(c, sand, smoothstep(2.2f, 0.2f, h));
  // subtle AO in valleys
  c = c * (0.86f + 0.14f * smoothstep(-6.f, 10.f, h));
  return c;
}

bool Terrain::isWater(float x, float z) { return heightAt(x, z) < WATER_LEVEL; }

// ============================================================ chunks
void buildChunk(Chunk& chunk, int cx, int cz, int segments, float size) {
  chunk.cx = cx;
  chunk.cz = cz;
  chunk.verts.clear();
  chunk.idx.clear();
  chunk.trees.clear();
  chunk.rocks.clear();
  const int N = segments + 1;
  chunk.verts.reserve(N * N);
  chunk.idx.reserve(segments * segments * 6);
  const float ox = cx * size, oz = cz * size;
  for (int j = 0; j < N; j++)
    for (int i = 0; i < N; i++) {
      float x = ox + (float)i / segments * size;
      float z = oz + (float)j / segments * size;
      float y = Terrain::heightAt(x, z);
      Vec3 n = Terrain::normalAt(x, z);
      Vec3 c = Terrain::colorAt(x, z, y, n);
      TerrainVertex v{x, y, z, n.x, n.y, n.z, c.x, c.y, c.z};
      chunk.verts.push_back(v);
    }
  for (int j = 0; j < segments; j++)
    for (int i = 0; i < segments; i++) {
      uint16_t a = (uint16_t)(j * N + i);
      uint16_t b = (uint16_t)(a + 1);
      uint16_t c = (uint16_t)(a + N);
      uint16_t d = (uint16_t)(c + 1);
      chunk.idx.push_back(a); chunk.idx.push_back(c); chunk.idx.push_back(b);
      chunk.idx.push_back(b); chunk.idx.push_back(c); chunk.idx.push_back(d);
    }
  // scatter trees / rocks deterministically
  Rng rng((uint32_t)(cx * 73856093 ^ cz * 19349663 ^ 0x9e3779b9u));
  int treeCount = (int)(rng.next() * 14.f);
  for (int t = 0; t < treeCount; t++) {
    float x = ox + rng.range(2.f, size - 2.f);
    float z = oz + rng.range(2.f, size - 2.f);
    float y = Terrain::heightAt(x, z);
    Vec3 n = Terrain::normalAt(x, z);
    if (y < 1.2f || n.y < 0.80f || y > 32.f) continue;
    TreeInstance tr;
    tr.pos = Vec3(x, y, z);
    tr.height = rng.range(4.2f, 8.6f);
    tr.radius = rng.range(1.1f, 2.0f);
    tr.hue = rng.next();
    chunk.trees.push_back(tr);
  }
  int rockCount = (int)(rng.next() * 6.f);
  for (int r = 0; r < rockCount; r++) {
    float x = ox + rng.range(2.f, size - 2.f);
    float z = oz + rng.range(2.f, size - 2.f);
    RockInstance rk;
    rk.pos = Vec3(x, Terrain::heightAt(x, z), z);
    rk.size = rng.range(0.5f, 1.9f);
    rk.yaw = rng.range(0.f, TAU);
    chunk.rocks.push_back(rk);
  }
  chunk.ready = true;
}

void buildPropGeometry(const std::vector<TreeInstance>& trees, const std::vector<RockInstance>& rocks,
                       std::vector<PropVertex>& outV, std::vector<uint16_t>& outI) {
  auto push = [&](Vec3 p, Vec3 n, Vec3 c) {
    outV.push_back({p.x, p.y, p.z, n.x, n.y, n.z, c.x, c.y, c.z});
  };
  for (const auto& t : trees) {
    Vec3 trunkC(0.33f, 0.24f, 0.17f);
    float trunkH = t.height * 0.42f;
    const int sides = 6;
    uint16_t base = (uint16_t)outV.size();
    for (int i = 0; i < sides; i++) {
      float a = (float)i / sides * TAU;
      Vec3 dir(std::cos(a), 0, std::sin(a));
      Vec3 n = dir;
      push(t.pos + dir * 0.20f, n, trunkC);
    }
    for (int i = 0; i < sides; i++) {
      float a = (float)i / sides * TAU;
      Vec3 dir(std::cos(a), 0, std::sin(a));
      push(t.pos + Vec3(0, trunkH, 0) + dir * 0.15f, dir, trunkC);
    }
    for (int i = 0; i < sides; i++) {
      uint16_t a0 = base + i, a1 = base + (i + 1) % sides;
      uint16_t b0 = a0 + sides, b1 = a1 + sides;
      outI.push_back(a0); outI.push_back(b0); outI.push_back(a1);
      outI.push_back(a1); outI.push_back(b0); outI.push_back(b1);
    }
    // canopy: three stacked cones
    Vec3 leaf(0.15f + t.hue * 0.10f, 0.34f + t.hue * 0.18f, 0.14f + t.hue * 0.06f);
    for (int c = 0; c < 3; c++) {
      float cy = t.pos.y + trunkH + c * t.height * 0.20f;
      float rad = t.radius * (1.f - c * 0.26f);
      float hgt = t.height * 0.34f;
      uint16_t cb = (uint16_t)outV.size();
      for (int i = 0; i < sides + 2; i++) {
        float a = (float)i / (sides + 2) * TAU;
        Vec3 dir(std::cos(a), 0, std::sin(a));
        Vec3 n = (dir + Vec3(0, 0.75f, 0)).norm();
        push(Vec3(t.pos.x + dir.x * rad, cy, t.pos.z + dir.z * rad), n, leaf * 0.86f);
      }
      Vec3 apex = Vec3(t.pos.x, cy + hgt, t.pos.z);
      uint16_t apt = (uint16_t)outV.size();
      push(apex, Vec3(0, 1, 0), leaf);
      for (int i = 0; i < sides + 2; i++) {
        uint16_t a0 = cb + i, a1 = cb + (i + 1) % (sides + 2);
        outI.push_back(a0); outI.push_back(a1); outI.push_back(apt);
      }
    }
  }
  for (const auto& r : rocks) {
    Vec3 c(0.42f, 0.41f, 0.40f);
    const int sides = 7, rows = 4;
    uint16_t base = (uint16_t)outV.size();
    for (int j = 0; j <= rows; j++) {
      float v = (float)j / rows;
      float ry = (v - 0.5f) * r.size * 1.1f;
      float rad = std::sqrt(std::max(0.f, 1.f - (v * 2.f - 1.f) * (v * 2.f - 1.f))) * r.size;
      for (int i = 0; i < sides; i++) {
        float a = (float)i / sides * TAU + r.yaw;
        Vec3 dir(std::cos(a), 0, std::sin(a));
        float wobble = 0.82f + 0.36f * hash2(r.pos.x + i, r.pos.z + j);
        Vec3 p = r.pos + Vec3(dir.x * rad * wobble, ry, dir.z * rad * wobble);
        Vec3 n = (dir + Vec3(0, (v - 0.5f) * 1.4f, 0)).norm();
        push(p, n, c * (0.8f + 0.35f * v));
      }
    }
    for (int j = 0; j < rows; j++)
      for (int i = 0; i < sides; i++) {
        uint16_t a0 = base + j * sides + i;
        uint16_t a1 = base + j * sides + (i + 1) % sides;
        uint16_t b0 = a0 + sides, b1 = a1 + sides;
        outI.push_back(a0); outI.push_back(b0); outI.push_back(a1);
        outI.push_back(a1); outI.push_back(b0); outI.push_back(b1);
      }
  }
}

}  // namespace ae

// ============================================================ Game
namespace ae {
namespace {

inline float comboMult(int idx) {
  static const float m[3] = {1.0f, 1.05f, 1.45f};
  return m[idx % 3];
}

}  // namespace

Game& gameInstance() {
  static Game g;
  return g;
}

void Game::reset() {
  character = 0;
  player = Entity();
  player.pos = Vec3(8.f, Terrain::heightAt(8.f, 34.f), 34.f);
  player.hp = player.maxHp = 1200.f;
  player.baseColor = CHARACTERS[character].clothColor;
  player.accentColor = CHARACTERS[character].accent;
  player.anim.play(A_IDLE);
  stamina = staminaMax;
  energy = 20.f;
  grounded = true;
  gliding = false;
  camYaw = 0.f;
  camPitch = 0.20f;
  camDist = 5.4f;
  camPos = player.pos + Vec3(0, 2.2f, 6.f);
  timeSeconds = 0.f;
  dayTime = 0.32f;
  exposure = 1.0f;
  if (particles.empty()) particles.resize(1024);
  for (auto& p : particles) p.alive = false;
  for (auto& t : trail) t.valid = false;
  enemies.clear();
  spawnEnemies();
}

void Game::spawnEnemies() {
  Rng rng(9001);
  for (int i = 0; i < 14; i++) {
    Enemy e;
    float ang = rng.range(0.f, TAU);
    float dist = rng.range(16.f, 70.f);
    float x = player.pos.x + std::cos(ang) * dist;
    float z = player.pos.z + std::sin(ang) * dist;
    e.pos = Vec3(x, Terrain::heightAt(x, z), z);
    e.spawn = e.pos;
    e.maxHp = e.hp = 180.f + rng.range(0.f, 90.f);
    e.kind = i % 4 == 0 ? 1 : 0;
    e.baseColor = Vec3(0.20f, 0.16f, 0.26f);
    e.accentColor = Vec3(0.72f, 0.44f, 1.0f);
    e.scale = e.kind == 1 ? 0.92f : 1.0f;
    e.anim.play(A_IDLE);
    enemies.push_back(e);
  }
}

void Game::setCharacter(int id) {
  character = ((id % 4) + 4) % 4;
  player.baseColor = CHARACTERS[character].clothColor;
  player.accentColor = CHARACTERS[character].accent;
  attackTimer = 0.f;
  comboIndex = 0;
  player.anim.play(A_IDLE);
  // elemental burst of colour when switching
  burst(player.pos + Vec3(0, 1.0f, 0), 26, ELEMENT_COLORS[def().element], 4.2f, 0.55f, -2.f, true);
}

void Game::emit(Vec3 pos, Vec3 vel, float life, float size, Vec3 color, float gravity, bool additive) {
  for (auto& p : particles) {
    if (p.alive) continue;
    p.pos = pos;
    p.vel = vel;
    p.life = p.maxLife = life;
    p.size = size;
    p.color = color;
    p.gravity = gravity;
    p.additive = additive;
    p.alive = true;
    return;
  }
}

void Game::burst(Vec3 pos, int count, Vec3 color, float speed, float life, float gravity, bool additive) {
  for (int i = 0; i < count; i++) {
    float a = (float)i / count * TAU + m3::hash2((float)i, timeSeconds) * 0.8f;
    float up = 0.25f + hash2((float)i * 3.1f, timeSeconds * 0.7f) * 1.1f;
    Vec3 dir(std::cos(a), up, std::sin(a));
    emit(pos, dir * speed * (0.4f + hash2((float)i, (float)count) * 0.9f), life * (0.7f + 0.6f * hash2((float)i, 7.7f)),
         0.10f + hash2((float)i, 3.3f) * 0.16f, color, gravity, additive);
  }
}

void Game::addTrailPoint(Vec3 a, Vec3 b) {
  trail[trailHead].a = a;
  trail[trailHead].b = b;
  trail[trailHead].t = 1.f;
  trail[trailHead].valid = true;
  trailHead = (trailHead + 1) % 24;
}

// ---------------------------------------------------------------- frame
void Game::update(float dt) {
  if (dt > 0.05f) dt = 0.05f;
  float simDt = dt;
  if (hitStop > 0.f) {
    hitStop -= dt;
    simDt = dt * 0.12f;
  }
  timeSeconds += simDt;
  updateSky(simDt);
  updatePlayer(simDt);
  updateEnemies(simDt);
  updateParticles(simDt);
  updateCamera(dt);

  shake = std::max(0.f, shake - dt * 2.6f);
  damageFlash = std::max(0.f, damageFlash - dt * 2.0f);
  for (auto& t : trail) {
    if (!t.valid) continue;
    t.t -= dt * 3.4f;
    if (t.t <= 0.f) t.valid = false;
  }
}

void Game::updateSky(float dt) {
  dayTime += dt / 480.f;           // 8 minute full cycle
  if (dayTime > 1.f) dayTime -= 1.f;
  float ang = (dayTime - 0.25f) * TAU;
  sunDir = Vec3(std::cos(ang) * 0.55f, std::sin(ang), std::cos(ang) * 0.35f + 0.18f).norm();
  float day = clampf(sunDir.y * 2.2f + 0.25f, 0.f, 1.f);
  float dusk = std::exp(-std::pow((sunDir.y - 0.02f) * 6.0f, 2.f));

  Vec3 nightTop(0.03f, 0.05f, 0.12f), nightHorizon(0.09f, 0.12f, 0.22f);
  Vec3 dayTop(0.24f, 0.48f, 0.86f), dayHorizon(0.74f, 0.87f, 0.96f);
  Vec3 duskHorizon(0.98f, 0.62f, 0.38f), duskTop(0.28f, 0.28f, 0.46f);

  skyTop = Vec3::lerp(nightTop, dayTop, day);
  skyHorizon = Vec3::lerp(nightHorizon, dayHorizon, day);
  skyTop = Vec3::lerp(skyTop, duskTop, dusk * 0.65f);
  skyHorizon = Vec3::lerp(skyHorizon, duskHorizon, dusk * 0.8f);
  fogColor = Vec3::lerp(skyHorizon, skyTop, 0.25f);
  fogDensity = lerpf(0.0060f, 0.0032f, day);
  sunColor = Vec3::lerp(Vec3(1.f, 0.62f, 0.35f), Vec3(1.f, 0.97f, 0.90f), day);
  sunIntensity = lerpf(0.35f, 3.4f, day);
  exposure = lerpf(0.82f, 1.02f, day);
}

void Game::updatePlayer(float dt) {
  Entity& p = player;
  const CharacterDef& d = def();

  // ---- timers ----
  if (invuln > 0) invuln -= dt;
  if (dashCd > 0) dashCd = std::max(0.f, dashCd - dt);
  if (skillCd > 0) skillCd = std::max(0.f, skillCd - dt);
  if (comboTimer > 0) comboTimer -= dt;

  // ---- camera-relative desired direction ----
  Vec3 forward(-std::sin(camYaw), 0.f, -std::cos(camYaw));
  Vec3 right = forward.cross(Vec3(0, 1, 0)).norm();
  Vec3 wish = (forward * moveY + right * moveX);
  float wishLen = std::min(1.f, wish.len());
  if (wishLen > 0.001f) wish = wish.norm();

  const bool busy = attackTimer > 0.f || dashTimer > 0.f;
  const bool canSprint = sprinting && stamina > 1.f && wishLen > 0.2f && !busy;
  float speed = d.speed * (canSprint ? 1.75f : 1.f) * (busy ? 0.45f : 1.f);

  // ---- dash ----
  if (dashTimer > 0.f) {
    dashTimer -= dt;
    float k = clampf(dashTimer / 0.24f, 0.f, 1.f);
    float dashSpeed = 7.f + 13.f * k * k;
    p.vel.x = dashDir.x * dashSpeed;
    p.vel.z = dashDir.z * dashSpeed;
    if (dashTimer <= 0.f) {
      dashTimer = 0.f;
      p.vel.x *= 0.45f;
      p.vel.z *= 0.45f;
    }
  } else {
    float accel = grounded ? 15.f : 5.f;
    p.vel.x = damp(p.vel.x, wish.x * speed, accel, dt);
    p.vel.z = damp(p.vel.z, wish.z * speed, accel, dt);
  }

  if (canSprint) stamina = std::max(0.f, stamina - 9.5f * dt);

  // ---- vertical ----
  float groundY = Terrain::heightAt(p.pos.x, p.pos.z);
  bool inWater = groundY < Terrain::WATER_LEVEL - 0.4f && p.pos.y < Terrain::WATER_LEVEL + 0.8f;

  if (wantJump) {
    wantJump = false;
    if (grounded) {
      p.vel.y = 8.6f;
      grounded = false;
      burst(p.pos + Vec3(0, 0.1f, 0), 12, Vec3(0.85f, 0.82f, 0.74f), 2.4f, 0.42f, -6.f, false);
    } else if (!gliding && stamina > 10.f && p.vel.y < 1.5f) {
      gliding = true;
      burst(p.pos + Vec3(0, 0.9f, 0), 18, ELEMENT_COLORS[EL_ANEMO], 3.2f, 0.5f, -2.f, true);
    }
  }

  if (gliding) {
    stamina = std::max(0.f, stamina - 5.5f * dt);
    p.vel.y = damp(p.vel.y, -1.9f, 5.f, dt);
    p.vel.x = damp(p.vel.x, wish.x * 7.6f, 3.2f, dt);
    p.vel.z = damp(p.vel.z, wish.z * 7.6f, 3.2f, dt);
    if (stamina <= 0.f) gliding = false;
  } else {
    p.vel.y -= 26.f * dt;
    if (p.vel.y < -55.f) p.vel.y = -55.f;
  }
  if (inWater) {
    p.vel.y = damp(p.vel.y, 0.f, 6.f, dt);
    p.pos.y = damp(p.pos.y, Terrain::WATER_LEVEL + 0.15f, 8.f, dt);
    stamina = std::max(0.f, stamina - 4.f * dt);
  }

  // ---- integrate ----
  p.pos += p.vel * dt;
  p.pos.x = clampf(p.pos.x, -Terrain::HALF + 8.f, Terrain::HALF - 8.f);
  p.pos.z = clampf(p.pos.z, -Terrain::HALF + 8.f, Terrain::HALF - 8.f);

  float g = Terrain::heightAt(p.pos.x, p.pos.z);
  if (p.pos.y <= g) {
    if (!grounded && p.vel.y < -7.f) {
      burst(Vec3(p.pos.x, g + 0.08f, p.pos.z), 14, Vec3(0.82f, 0.78f, 0.68f), 2.6f, 0.4f, -8.f, false);
      if (plunging) plungeImpact();
    }
    p.pos.y = g;
    p.vel.y = 0.f;
    grounded = true;
    gliding = false;
    plunging = false;
  } else if (p.vel.y > 0.01f) {
    grounded = false;
  } else if (p.pos.y > g + 0.36f) {
    grounded = false;
  } else {
    grounded = true;
    p.vel.y = std::min(0.f, p.vel.y);
    p.pos.y = g;
  }

  if (!canSprint && !gliding && !inWater) stamina = std::min(staminaMax, stamina + 19.f * dt);

  // ---- facing ----
  if (wishLen > 0.12f && attackTimer <= 0.f && dashTimer <= 0.f)
    p.yaw = dampAngle(p.yaw, std::atan2(wish.x, wish.z), 13.f, dt);

  // ---- animation state ----
  AnimState next;
  float speedNow = p.vel.lenXZ();
  if (attackTimer > 0.f) {
    float prog = 1.f - attackTimer / attackDur;
    next = prog < 0.5f ? A_ATTACK1 : A_ATTACK2;
    if (comboIndex >= 2) next = A_ATTACK3;
  } else if (dashTimer > 0.f) {
    next = A_DASH;
  } else if (plunging) {
    next = A_FALL;
  } else if (gliding) {
    next = A_GLIDE;
  } else if (!grounded) {
    next = p.vel.y > 0.6f ? A_JUMP : A_FALL;
  } else if (speedNow > 6.6f) {
    next = A_SPRINT;
  } else if (speedNow > 0.9f) {
    next = A_RUN;
  } else {
    next = A_IDLE;
  }
  p.anim.play(next);
  p.anim.speed = next == A_RUN ? clampf(speedNow / 5.0f, 0.7f, 1.5f)
                 : next == A_SPRINT ? clampf(speedNow / 8.0f, 0.8f, 1.4f) : 1.f;
  p.anim.update(dt);

  // ---- combat timeline ----
  if (attackTimer > 0.f) {
    attackTimer -= dt;
    float prog = 1.f - attackTimer / attackDur;
    if (!attackHitDone && prog >= attackHitAt) {
      attackHitDone = true;
      performHit();
    }
    if (attackTimer <= 0.f) {
      attackTimer = 0.f;
      if (attackQueued) {
        attackQueued = false;
        startAttack();
      }
    }
    // sword trail sampling
    Vec3 hand = p.pos + Vec3(0, 1.1f, 0) + Vec3(std::sin(p.yaw), 0, std::cos(p.yaw)) * 0.35f
                + Vec3(std::cos(p.yaw), 0, -std::sin(p.yaw)) * (-0.45f + prog * 0.9f);
    addTrailPoint(hand, hand + Vec3(0, -0.15f, 0));
    if (!grounded) { /* keep trail from floating */ }
  }

  if (wantAttack) {
    wantAttack = false;
    if (attackTimer > 0.f) attackQueued = true;
    else startAttack();
  }
  if (wantSkill) {
    wantSkill = false;
    if (skillCd <= 0.f) useSkill();
  }
  if (wantDash && dashCd <= 0.f && dashTimer <= 0.f && stamina > 8.f && !busy) {
    wantDash = false;
    doDash();
  }
  wantDash = false;

  // ---- footsteps ----
  if (grounded && speedNow > 1.4f) {
    footstepTimer -= dt * speedNow;
    if (footstepTimer <= 0.f) {
      footstepTimer = 2.6f;
      Vec3 at = Vec3(p.pos.x, Terrain::heightAt(p.pos.x, p.pos.z) + 0.06f, p.pos.z);
      burst(at, canSprint ? 5 : 3, Vec3(0.80f, 0.76f, 0.66f), 1.4f, 0.35f, -3.f, false);
    }
  }
}

void Game::updateEnemies(float dt) {
  Entity& p = player;
  for (auto& e : enemies) {
    if (!e.alive) {
      e.hurtFlash = std::max(0.f, e.hurtFlash - dt * 3.f);
      continue;
    }
    Vec3 to = p.pos - e.pos;
    float dist = to.lenXZ();
    e.hurtFlash = std::max(0.f, e.hurtFlash - dt * 3.5f);
    e.attackCd = std::max(0.f, e.attackCd - dt);

    if (dist < 22.f) e.aggro = std::min(1.f, e.aggro + dt);
    else e.aggro = std::max(0.f, e.aggro - dt * 0.5f);

    if (e.aggro > 0.2f && dist < 20.f) {
      Vec3 dir = to.norm();
      float want = e.kind == 1 ? 7.5f : 1.4f;
      if (dist > want) {
        e.vel.x = damp(e.vel.x, dir.x * (e.kind == 1 ? 2.4f : 3.6f), 8.f, dt);
        e.vel.z = damp(e.vel.z, dir.z * (e.kind == 1 ? 2.4f : 3.6f), 8.f, dt);
      } else {
        e.vel.x = damp(e.vel.x, 0.f, 10.f, dt);
        e.vel.z = damp(e.vel.z, 0.f, 10.f, dt);
        if (e.attackCd <= 0.f) {
          e.attackCd = 1.9f;
          e.telegraph = 0.45f;
        }
      }
      e.yaw = dampAngle(e.yaw, std::atan2(dir.x, dir.z), 8.f, dt);
    } else {
      e.vel.x = damp(e.vel.x, 0.f, 4.f, dt);
      e.vel.z = damp(e.vel.z, 0.f, 4.f, dt);
    }

    if (e.telegraph > 0.f) {
      e.telegraph -= dt;
      if (e.telegraph <= 0.f && dist < 3.2f && p.hp > 0.f && invuln <= 0.f) {
        float dmg = 38.f;
        p.hp = std::max(0.f, p.hp - dmg);
        damageFlash = 1.f;
        shake = std::max(shake, 0.5f);
        hitStop = 0.06f;
        hitDir = (p.pos - e.pos).norm();
        burst(p.pos + Vec3(0, 1.0f, 0), 14, Vec3(0.95f, 0.35f, 0.3f), 3.f, 0.45f, -4.f, true);
        invuln = 0.55f;
      }
    }

    e.pos += e.vel * dt;
    e.pos.y = Terrain::heightAt(e.pos.x, e.pos.z);

    float sp = e.vel.lenXZ();
    if (sp > 3.f) e.anim.play(A_RUN);
    else if (e.telegraph > 0.f) e.anim.play(A_ATTACK1);
    else e.anim.play(A_IDLE);
    e.anim.update(dt);
  }
}

void Game::updateParticles(float dt) {
  for (auto& p : particles) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0.f) {
      p.alive = false;
      continue;
    }
    p.vel.y += p.gravity * dt;
    p.vel = p.vel * (1.f - std::min(0.9f, dt * p.drag));
    p.pos += p.vel * dt;
    float g = Terrain::heightAt(p.pos.x, p.pos.z);
    if (p.pos.y < g + 0.02f) {
      p.pos.y = g + 0.02f;
      p.vel.y = std::fabs(p.vel.y) * 0.28f;
      p.vel.x *= 0.7f;
      p.vel.z *= 0.7f;
    }
  }
}

void Game::updateCamera(float dt) {
  camYaw -= lookDX * 0.0042f;
  camPitch = clampf(camPitch + lookDY * 0.0032f, -0.35f, 1.05f);
  lookDX = 0.f;
  lookDY = 0.f;

  float targetDist = camDist;
  Vec3 focus = player.pos + Vec3(0, 1.55f, 0);
  Vec3 dir(std::sin(camYaw) * std::cos(camPitch), std::sin(camPitch), std::cos(camYaw) * std::cos(camPitch));
  Vec3 desired = focus + dir * targetDist;
  float groundAtCam = Terrain::heightAt(desired.x, desired.z) + 0.7f;
  if (desired.y < groundAtCam) desired.y = groundAtCam;
  camPos = Vec3::lerp(camPos, desired, 1.f - std::exp(-12.f * dt));
  camTarget = Vec3::lerp(camTarget, focus, 1.f - std::exp(-16.f * dt));

  // shake
  if (shake > 0.001f) {
    float s = shake * shake * 0.42f;
    camPos += Vec3(std::sin(timeSeconds * 61.f) * s, std::cos(timeSeconds * 71.f) * s, std::sin(timeSeconds * 53.f) * s);
  }
}

// ---------------------------------------------------------------- combat
void Game::startAttack() {
  if (!grounded && !gliding && !plunging) {
    plunging = true;
    attackTimer = 0.f;
    attackHitDone = true;
    player.vel.y = -26.f;
    burst(player.pos + Vec3(0, 1.f, 0), 12, elementColor(), 3.f, 0.35f, -2.f, true);
    return;
  }
  static const float durs[3] = {0.40f, 0.42f, 0.60f};
  comboIndex = comboTimer > 0.f ? (comboIndex + 1) % 3 : 0;
  comboTimer = 1.05f;
  attackDur = durs[comboIndex];
  attackHitAt = comboIndex == 2 ? 0.42f : 0.33f;
  attackTimer = attackDur;
  attackHitDone = false;
}

void Game::performHit() {
  const CharacterDef& d = def();
  Vec3 origin = player.pos + Vec3(0, 1.0f, 0);
  Vec3 fwd(std::sin(player.yaw), 0.f, std::cos(player.yaw));
  float reach = 2.6f;
  float mult = comboMult(comboIndex);
  float baseDmg = atk() * mult * (comboIndex == 2 ? 1.5f : 1.f);
  bool hitAny = false;

  for (auto& e : enemies) {
    if (!e.alive) continue;
    Vec3 to = e.pos - origin;
    float dist = to.lenXZ();
    if (dist > reach + e.radius) continue;
    Vec3 dir = to.norm();
    if (dir.dot(fwd) < 0.28f) continue;   // ~±73° cone
    float dmg = baseDmg * (0.85f + m3::hash2(e.pos.x, timeSeconds) * 0.35f);
    bool crit = m3::hash2(timeSeconds * 3.1f, e.pos.z) > 0.72f;
    if (crit) dmg *= 1.9f;
    e.hp -= dmg;
    e.hurtFlash = 1.f;
    hitAny = true;
    hitCount++;
    // knockback
    e.vel += dir * (comboIndex == 2 ? 7.5f : 3.2f);
    e.pos.y = Terrain::heightAt(e.pos.x, e.pos.z);

    Vec3 impact = e.pos + Vec3(0, 1.05f, 0);
    burst(impact, crit ? 22 : 14, Vec3(1.f, 0.94f, 0.80f), crit ? 5.2f : 3.6f, 0.34f, -5.f, true);
    burst(impact, 8, elementColor(), 2.4f, 0.30f, -3.f, true);
    // elemental ring on the ground
    if (comboIndex == 2) burst(e.pos + Vec3(0, 0.2f, 0), 20, elementColor(), 4.6f, 0.45f, -1.5f, true);

    if (e.hp <= 0.f) {
      e.alive = false;
      e.anim.play(A_DEAD);
      burst(e.pos + Vec3(0, 1.f, 0), 30, elementColor(), 4.f, 0.7f, -3.f, true);
      burst(e.pos + Vec3(0, 0.6f, 0), 18, e.baseColor, 3.f, 0.8f, -6.f, false);
    }
  }

  if (hitAny) {
    hitStop = comboIndex == 2 ? 0.10f : 0.055f;
    shake = std::max(shake, comboIndex == 2 ? 0.75f : 0.42f);
  } else {
    // whiff puff at the tip
    Vec3 tip = origin + fwd * reach;
    burst(tip, 4, Vec3(0.85f, 0.85f, 0.9f), 1.4f, 0.22f, -1.f, true);
  }
  energy = std::min(energyMax, energy + (hitAny ? 7.f : 1.5f));
}

void Game::doDash() {
  Vec3 forward(-std::sin(camYaw), 0.f, -std::cos(camYaw));
  Vec3 right = forward.cross(Vec3(0, 1, 0)).norm();
  Vec3 dir = forward * moveY + right * moveX;
  if (dir.len() < 0.1f) dir = Vec3(std::sin(player.yaw), 0.f, std::cos(player.yaw));
  dir = dir.norm();
  dashDir = dir;
  dashTimer = 0.24f;
  dashCd = 1.0f;
  invuln = 0.32f;
  attackTimer = 0.f;
  stamina = std::max(0.f, stamina - 7.f);
  player.yaw = std::atan2(dir.x, dir.z);
  burst(player.pos + Vec3(0, 0.25f, 0), 14, Vec3(0.85f, 0.93f, 1.f), 2.8f, 0.35f, -2.f, true);
}

void Game::useSkill() {
  skillCd = 7.5f;
  int el = def().element;
  Vec3 color = ELEMENT_COLORS[el];
  Vec3 at = player.pos + Vec3(std::sin(player.yaw), 0.f, std::cos(player.yaw)) * 2.4f;
  at.y = Terrain::heightAt(at.x, at.z);

  float radius = 4.6f;
  for (auto& e : enemies) {
    if (!e.alive) continue;
    float dist = (e.pos - at).lenXZ();
    if (dist > radius) continue;
    float dmg = atk() * 2.1f;
    e.hp -= dmg;
    e.hurtFlash = 1.f;
    e.vel += (e.pos - at).norm() * 4.f;
    if (e.hp <= 0.f) {
      e.alive = false;
      e.anim.play(A_DEAD);
      burst(e.pos + Vec3(0, 1.f, 0), 26, color, 4.f, 0.7f, -3.f, true);
    }
  }
  burst(at + Vec3(0, 0.4f, 0), 60, color, 7.5f, 0.75f, -2.f, true);
  burst(at + Vec3(0, 0.15f, 0), 30, Vec3(1.f, 1.f, 1.f), 5.f, 0.5f, 0.f, true);
  shake = std::max(shake, 0.85f);
  hitStop = 0.09f;
  energy = std::min(energyMax, energy + 12.f);
  player.anim.play(A_SKILL);
}

void Game::plungeImpact() {
  Vec3 at = player.pos;
  float radius = 4.4f;
  for (auto& e : enemies) {
    if (!e.alive) continue;
    float dist = (e.pos - at).lenXZ();
    if (dist > radius) continue;
    e.hp -= atk() * 2.15f;
    e.hurtFlash = 1.f;
    e.vel += (e.pos - at).norm() * 8.f;
    if (e.hp <= 0.f) {
      e.alive = false;
      e.anim.play(A_DEAD);
    }
  }
  burst(at + Vec3(0, 0.3f, 0), 46, Vec3(0.86f, 0.82f, 0.72f), 8.f, 0.7f, -6.f, false);
  burst(at + Vec3(0, 0.4f, 0), 30, elementColor(), 5.5f, 0.55f, -2.f, true);
  shake = std::max(shake, 1.0f);
  hitStop = 0.10f;
  energy = std::min(energyMax, energy + 8.f);
}

}  // namespace ae
