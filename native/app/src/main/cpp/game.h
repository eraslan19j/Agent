// ============================================================
// AETHERION NATIVE — simulation core (terrain, characters, combat)
// Pure CPU: no GL calls here, so it can be unit-tested on a host.
// ============================================================
#pragma once
#include <cstdint>
#include <vector>
#include <string>
#include "m3d.h"

namespace ae {

using m3::Vec3;
using m3::Mat4;

// ---------------------------------------------------------------- bones
enum BoneId {
  B_ROOT = 0, B_HIPS, B_SPINE, B_CHEST, B_NECK, B_HEAD,
  B_SHOULDER_L, B_ARM_L, B_FOREARM_L, B_HAND_L,
  B_SHOULDER_R, B_ARM_R, B_FOREARM_R, B_HAND_R,
  B_THIGH_L, B_SHIN_L, B_FOOT_L,
  B_THIGH_R, B_SHIN_R, B_FOOT_R,
  B_WEAPON,
  BONE_COUNT
};

struct Pose {
  float rot[BONE_COUNT][3];   // euler XYZ per bone (radians, relative to rest)
  Vec3 rootOffset;            // hip translation (bob / lean)
  float scaleHint = 0.f;      // reserved
  Pose();
  static void blend(const Pose& a, const Pose& b, float t, Pose& out);
};

struct SkinnedVertex {
  float px, py, pz;
  float nx, ny, nz;
  float cr, cg, cb;
  uint8_t j0, j1;
  uint8_t w0, pad;
};

struct MeshData {
  std::vector<SkinnedVertex> verts;
  std::vector<uint16_t> idx;
};

struct CharModel {
  MeshData mesh;
  Mat4 bindInv[BONE_COUNT];
  Mat4 restLocal[BONE_COUNT];
  int parent[BONE_COUNT];
  bool built = false;
};

/** Builds the shared humanoid mesh + skeleton (identical for every character). */
void buildCharacterModel(CharModel& out);
/** Computes bone matrices for a pose; returns the bone palette for skinning. */
void poseToMatrices(const CharModel& model, const Pose& pose, const Vec3& worldPos, float yaw, float scale, Mat4 out[BONE_COUNT]);

// ---------------------------------------------------------------- animation
enum AnimState {
  A_IDLE = 0, A_RUN, A_SPRINT, A_JUMP, A_FALL, A_GLIDE,
  A_ATTACK1, A_ATTACK2, A_ATTACK3, A_SKILL, A_DASH, A_HIT, A_DEAD, A_STATE_COUNT
};

struct AnimPlayer {
  AnimState state = A_IDLE;
  float time = 0;
  float blend = 1.f;          // 0..1 blend-in weight
  AnimState prevState = A_IDLE;
  float prevTime = 0;
  float speed = 1.f;
  void play(AnimState s, float startTime = 0.f);
  void update(float dt);
  /** Samples the pose for the current state, cross-fading with the previous one. */
  void sample(Pose& out) const;
};

/** Straight-ahead run/idle/etc. curve functions (also used by tests). */
void samplePose(AnimState state, float t, float speedScale, Pose& out);
float animDuration(AnimState s);

// ---------------------------------------------------------------- terrain
struct Terrain {
  static float heightAt(float x, float z);
  static Vec3 normalAt(float x, float z);
  static Vec3 colorAt(float x, float z, float height, const Vec3& n);
  static bool isWater(float x, float z);
  static constexpr float WATER_LEVEL = 0.f;
  static constexpr float HALF = 720.f;
};

// ---------------------------------------------------------------- world props
struct TreeInstance { Vec3 pos; float height; float radius; float hue; };
struct RockInstance { Vec3 pos; float size; float yaw; };

struct TerrainVertex {
  float px, py, pz;
  float nx, ny, nz;
  float cr, cg, cb;
};

struct Chunk {
  int cx = 0, cz = 0;
  bool ready = false;
  std::vector<TerrainVertex> verts;
  std::vector<uint16_t> idx;
  std::vector<TreeInstance> trees;
  std::vector<RockInstance> rocks;
};

// ---------------------------------------------------------------- particles
struct Particle {
  Vec3 pos, vel;
  float life = 0, maxLife = 1;
  float size = 0.2f;
  Vec3 color;
  float gravity = -6.f;
  float drag = 1.5f;
  bool additive = true;
  bool alive = false;
};

struct TrailPoint { Vec3 a, b; float t; bool valid; };

// ---------------------------------------------------------------- entities
struct Entity {
  Vec3 pos;
  Vec3 vel;
  float yaw = 0;
  float hp = 100, maxHp = 100;
  float radius = 0.45f;
  bool alive = true;
  float hurtFlash = 0;
  float scale = 1.f;
  Vec3 baseColor{0.9f, 0.75f, 0.55f};   // skin/cloth tint
  Vec3 accentColor{0.35f, 0.55f, 0.9f};
  AnimPlayer anim;
};

struct Enemy : Entity {
  float attackCd = 0;
  float telegraph = 0;
  float aggro = 0;
  int kind = 0;          // 0 melee, 1 ranged
  Vec3 spawn;
};

struct CombatEvent {
  Vec3 pos;
  float amount;
  bool crit;
  int element;           // 0 none, 1 anemo, 2 pyro, 3 electro, 4 cryo
};

// ---------------------------------------------------------------- game
enum ElementId { EL_NONE = 0, EL_ANEMO, EL_PYRO, EL_ELECTRO, EL_CRYO };

struct CharacterDef {
  const char* name;
  int element;
  Vec3 clothColor;
  Vec3 accent;
  float atk;
  float speed;
  const char* weapon;    // "sword" | "catalyst" | "polearm" | "claymore"
};

extern const CharacterDef CHARACTERS[4];
extern const Vec3 ELEMENT_COLORS[5];

struct Game {
  // player
  Entity player;
  int character = 0;
  float stamina = 100, staminaMax = 100;
  float energy = 0, energyMax = 100;
  bool grounded = true, gliding = false, sprinting = false;
  float attackTimer = 0, attackDur = 0.42f, attackHitAt = 0.34f, comboTimer = 0;
  int comboIndex = 0;
  bool attackHitDone = false, attackQueued = false;
  float dashTimer = 0, dashCd = 0, invuln = 0, skillCd = 0;
  bool plunging = false;
  Vec3 dashDir;
  float footstepTimer = 0;

  // camera
  Vec3 camPos, camTarget;
  float camYaw = 0, camPitch = 0.22f, camDist = 5.4f;

  // input
  float moveX = 0, moveY = 0;
  float lookDX = 0, lookDY = 0;
  bool wantJump = false, wantAttack = false, wantSkill = false, wantDash = false;

  // world
  std::vector<Enemy> enemies;
  std::vector<Particle> particles;
  TrailPoint trail[24];
  int trailHead = 0;
  float timeSeconds = 0;
  float dayTime = 0.34f;       // 0..1 (0.25 = sunrise, 0.5 = noon)
  Vec3 sunDir{0.4f, 0.85f, 0.3f};
  Vec3 sunColor{1.f, 0.95f, 0.86f};
  float sunIntensity = 3.1f;
  Vec3 skyTop{0.22f, 0.42f, 0.74f}, skyHorizon{0.72f, 0.83f, 0.92f};
  Vec3 fogColor{0.68f, 0.79f, 0.88f};
  float fogDensity = 0.0042f;
  float exposure = 1.0f;
  float brightness = 1.0f;     // user setting
  float shake = 0.f;
  float hitStop = 0.f;
  float damageFlash = 0.f;
  Vec3 hitDir{0, 0, 1};
  int hitCount = 0;

  void reset();
  void spawnEnemies();
  void setCharacter(int id);
  void update(float dt);
  void updateCamera(float dt);
  void updatePlayer(float dt);
  void updateEnemies(float dt);
  void updateParticles(float dt);
  void updateSky(float dt);

  void startAttack();
  void performHit();
  void doDash();
  void useSkill();
  void plungeImpact();
  void emit(Vec3 pos, Vec3 vel, float life, float size, Vec3 color, float gravity, bool additive);
  void burst(Vec3 pos, int count, Vec3 color, float speed, float life, float gravity, bool additive);
  void addTrailPoint(Vec3 a, Vec3 b);

  const CharacterDef& def() const { return CHARACTERS[character]; }
  float atk() const { return def().atk; }
  Vec3 elementColor() const { return ELEMENT_COLORS[def().element]; }
};

Game& gameInstance();

// deterministic RNG for reproducible worlds
struct Rng {
  uint32_t s = 12345;
  explicit Rng(uint32_t seed = 12345) : s(seed ? seed : 1) {}
  float next() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s & 0xFFFFFF) / 16777216.f;
  }
  float range(float a, float b) { return a + next() * (b - a); }
};

// chunk generation (used by the renderer and tests)
void buildChunk(Chunk& chunk, int cx, int cz, int segments, float size);

struct PropVertex {
  float px, py, pz;
  float nx, ny, nz;
  float cr, cg, cb;
};

/** Generates tree/rock geometry merged into a vertex/index pair. */
void buildPropGeometry(const std::vector<TreeInstance>& trees, const std::vector<RockInstance>& rocks,
                       std::vector<PropVertex>& outVerts, std::vector<uint16_t>& outIdx);

}  // namespace ae
