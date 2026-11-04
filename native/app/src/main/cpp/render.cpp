// ============================================================
// AETHERION NATIVE — OpenGL ES 3.0 renderer implementation
// ============================================================
#include "render.h"
#include <android/log.h>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <algorithm>
#include "shaders.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "AetherionGL", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "AetherionGL", __VA_ARGS__)

namespace ae {

using namespace m3;

namespace {

const int CHUNK_SEGMENTS = 20;
const float CHUNK_SIZE = 96.f;
const int VIEW_RADIUS = 2;
const int SHADOW_SIZE = 1024;
const float CHAR_STRIDE = 40.f;      // 9 floats + 4 bytes
const float TERRAIN_STRIDE = 36.f;   // 9 floats
const float PART_STRIDE = 32.f;      // pos3 + rgba4 + size1

GLuint compile(GLenum type, const char* src) {
  GLuint s = glCreateShader(type);
  glShaderSource(s, 1, &src, nullptr);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[2048];
    GLsizei n = 0;
    glGetShaderInfoLog(s, sizeof(log), &n, log);
    LOGE("shader compile failed: %s", log);
    glDeleteShader(s);
    return 0;
  }
  return s;
}

std::string merge(const char* common, const char* body) {
  return std::string(common) + "\n" + body;
}

}  // namespace

GLint GlProgram::u(const char* name) {
  auto it = cache.find(name);
  if (it != cache.end()) return it->second;
  GLint loc = glGetUniformLocation(id, name);
  cache[name] = loc;
  return loc;
}

// ---------------------------------------------------------------- shader build
namespace {
bool buildProgram(GlProgram& p, const std::string& vs, const std::string& fs, const char* label) {
  GLuint v = compile(GL_VERTEX_SHADER, vs.c_str());
  GLuint f = compile(GL_FRAGMENT_SHADER, fs.c_str());
  if (!v || !f) {
    LOGE("program %s failed", label);
    return false;
  }
  GLuint prog = glCreateProgram();
  glAttachShader(prog, v);
  glAttachShader(prog, f);
  glLinkProgram(prog);
  GLint ok = 0;
  glGetProgramiv(prog, GL_LINK_STATUS, &ok);
  if (!ok) {
    char log[2048];
    GLsizei n = 0;
    glGetProgramInfoLog(prog, sizeof(log), &n, log);
    LOGE("link failed (%s): %s", label, log);
    return false;
  }
  glDeleteShader(v);
  glDeleteShader(f);
  p.id = prog;
  return true;
}
}  // namespace

GLuint Renderer::makeTexture(int w, int h, GLenum internal, GLenum format, GLenum type, bool depth) {
  GLuint tex = 0;
  glGenTextures(1, &tex);
  glBindTexture(GL_TEXTURE_2D, tex);
  glTexImage2D(GL_TEXTURE_2D, 0, (GLint)internal, w, h, 0, format, type, nullptr);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  if (depth) {
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_COMPARE_MODE, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_COMPARE_FUNC, GL_LEQUAL);
  }
  glBindTexture(GL_TEXTURE_2D, 0);
  return tex;
}

bool Renderer::init() {
  const char* ver = (const char*)glGetString(GL_VERSION);
  const char* ren = (const char*)glGetString(GL_RENDERER);
  const char* vend = (const char*)glGetString(GL_VENDOR);
  snprintf(glInfo_, sizeof(glInfo_), "%s | %s | %s", ver ? ver : "?", ren ? ren : "?", vend ? vend : "?");
  LOGI("GL: %s", glInfo_);

  std::string common = shaders::COMMON;

  if (!buildProgram(sky_, std::string("#version 300 es\n") + shaders::SKY_VS,
                    std::string("#version 300 es\n") + common + shaders::SKY_BODY, "sky"))
    return false;

  std::string litVs = std::string("#version 300 es\n") + shaders::LIT_VS;
  std::string litFs = std::string("#version 300 es\n") + common + shaders::LIT_FS_BODY;
  if (!buildProgram(lit_, litVs, litFs, "lit")) return false;

  std::string skinVs = std::string("#version 300 es\n") + shaders::SKIN_VS;
  std::string skinFs = std::string("#version 300 es\n") + common + shaders::SKIN_FS_BODY;
  if (!buildProgram(skin_, skinVs, skinFs, "skin")) return false;

  std::string waterVs = std::string("#version 300 es\n") + shaders::WATER_VS;
  std::string waterFs = std::string("#version 300 es\n") + common + shaders::WATER_FS_BODY;
  if (!buildProgram(water_, waterVs, waterFs, "water")) return false;

  if (!buildProgram(part_, std::string("#version 300 es\n") + shaders::PART_VS,
                    std::string("#version 300 es\n") + shaders::PART_FS, "particles"))
    return false;
  if (!buildProgram(trail_, std::string("#version 300 es\n") + shaders::TRAIL_VS,
                    std::string("#version 300 es\n") + shaders::TRAIL_FS, "trail"))
    return false;
  if (!buildProgram(bright_, std::string("#version 300 es\n") + shaders::QUAD_VS,
                    std::string("#version 300 es\n") + shaders::BRIGHT_FS, "bright"))
    return false;
  if (!buildProgram(blur_, std::string("#version 300 es\n") + shaders::QUAD_VS,
                    std::string("#version 300 es\n") + shaders::BLUR_FS, "blur"))
    return false;
  if (!buildProgram(composite_, std::string("#version 300 es\n") + shaders::QUAD_VS,
                    std::string("#version 300 es\n") + shaders::COMPOSITE_FS, "composite"))
    return false;

  // fullscreen quad
  const float quad[] = {-1, -1, 3, -1, -1, 3};
  glGenVertexArrays(1, &quadVao_);
  glBindVertexArray(quadVao_);
  glGenBuffers(1, &quadVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, quadVbo_);
  glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 8, nullptr);
  glBindVertexArray(0);

  // character mesh
  buildCharacterModel(model_);
  glGenVertexArrays(1, &charVao_);
  glBindVertexArray(charVao_);
  glGenBuffers(1, &charVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, charVbo_);
  glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)(model_.mesh.verts.size() * sizeof(SkinnedVertex)),
               model_.mesh.verts.data(), GL_STATIC_DRAW);
  glGenBuffers(1, &charIbo_);
  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, charIbo_);
  glBufferData(GL_ELEMENT_ARRAY_BUFFER, (GLsizeiptr)(model_.mesh.idx.size() * sizeof(uint16_t)),
               model_.mesh.idx.data(), GL_STATIC_DRAW);
  charCount_ = (GLsizei)model_.mesh.idx.size();
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, (int)CHAR_STRIDE, (void*)0);
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, (int)CHAR_STRIDE, (void*)12);
  glEnableVertexAttribArray(2);
  glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, (int)CHAR_STRIDE, (void*)24);
  glEnableVertexAttribArray(3);
  glVertexAttribPointer(3, 2, GL_UNSIGNED_BYTE, GL_FALSE, (int)CHAR_STRIDE, (void*)36);
  glEnableVertexAttribArray(4);
  glVertexAttribPointer(4, 1, GL_UNSIGNED_BYTE, GL_TRUE, (int)CHAR_STRIDE, (void*)38);
  glBindVertexArray(0);
  LOGI("character mesh: %zu verts, %zu tris", model_.mesh.verts.size(), model_.mesh.idx.size() / 3);

  // water grid
  {
    const int N = 48;
    const float S = 1500.f;
    std::vector<float> v;
    std::vector<uint16_t> i;
    for (int z = 0; z <= N; z++)
      for (int x = 0; x <= N; x++)
        v.insert(v.end(), {(float)x / N * S - S * 0.5f, 0.f, (float)z / N * S - S * 0.5f});
    for (int z = 0; z < N; z++)
      for (int x = 0; x < N; x++) {
        uint16_t a = (uint16_t)(z * (N + 1) + x);
        uint16_t b = (uint16_t)(a + 1);
        uint16_t c = (uint16_t)(a + N + 1);
        uint16_t d = (uint16_t)(c + 1);
        i.insert(i.end(), {a, c, b, b, c, d});
      }
    glGenVertexArrays(1, &waterVao_);
    glBindVertexArray(waterVao_);
    glGenBuffers(1, &waterVbo_);
    glBindBuffer(GL_ARRAY_BUFFER, waterVbo_);
    glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)(v.size() * sizeof(float)), v.data(), GL_STATIC_DRAW);
    glGenBuffers(1, &waterIbo_);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, waterIbo_);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, (GLsizeiptr)(i.size() * sizeof(uint16_t)), i.data(), GL_STATIC_DRAW);
    waterCount_ = (GLsizei)i.size();
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 12, nullptr);
    glBindVertexArray(0);
  }

  // particles (dynamic)
  glGenVertexArrays(1, &partVao_);
  glBindVertexArray(partVao_);
  glGenBuffers(1, &partVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, partVbo_);
  glBufferData(GL_ARRAY_BUFFER, 1024 * 8 * sizeof(float), nullptr, GL_DYNAMIC_DRAW);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, (int)PART_STRIDE, (void*)0);
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 4, GL_FLOAT, GL_FALSE, (int)PART_STRIDE, (void*)12);
  glEnableVertexAttribArray(2);
  glVertexAttribPointer(2, 1, GL_FLOAT, GL_FALSE, (int)PART_STRIDE, (void*)28);
  glBindVertexArray(0);

  // trail (dynamic)
  glGenVertexArrays(1, &trailVao_);
  glBindVertexArray(trailVao_);
  glGenBuffers(1, &trailVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, trailVbo_);
  glBufferData(GL_ARRAY_BUFFER, 24 * 6 * 4 * sizeof(float), nullptr, GL_DYNAMIC_DRAW);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 16, (void*)0);
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 1, GL_FLOAT, GL_FALSE, 16, (void*)12);
  glBindVertexArray(0);

  // shadow map
  glGenFramebuffers(1, &shadowFbo_);
  shadowTex_ = makeTexture(SHADOW_SIZE, SHADOW_SIZE, GL_DEPTH_COMPONENT24, GL_DEPTH_COMPONENT, GL_UNSIGNED_INT, true);
  GLuint shadowColor = 0;
  glGenRenderbuffers(1, &shadowColor);
  glBindRenderbuffer(GL_RENDERBUFFER, shadowColor);
  glRenderbufferStorage(GL_RENDERBUFFER, GL_RGBA8, SHADOW_SIZE, SHADOW_SIZE);
  glBindFramebuffer(GL_FRAMEBUFFER, shadowFbo_);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, shadowTex_, 0);
  glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, shadowColor);
  GLenum st = glCheckFramebufferStatus(GL_FRAMEBUFFER);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  if (st != GL_FRAMEBUFFER_COMPLETE) {
    LOGE("shadow FBO incomplete: 0x%x", st);
    return false;
  }

  resize(1, 1);
  glEnable(GL_DEPTH_TEST);
  glDepthFunc(GL_LESS);
  glEnable(GL_CULL_FACE);
  glCullFace(GL_BACK);
  LOGI("renderer initialised");
  return true;
}

void Renderer::resize(int w, int h) {
  if (w < 2 || h < 2) return;
  w_ = w;
  h_ = h;
  if (sceneFbo_) {
    glDeleteFramebuffers(1, &sceneFbo_);
    glDeleteTextures(1, &sceneColor_);
    glDeleteRenderbuffers(1, &sceneDepth_);
    glDeleteFramebuffers(1, &bloomFboA_);
    glDeleteFramebuffers(1, &bloomFboB_);
    bloomFboA_ = bloomFboB_ = 0;
    glDeleteTextures(1, &bloomA_);
    glDeleteTextures(1, &bloomB_);
  }
  glGenFramebuffers(1, &sceneFbo_);
  glBindFramebuffer(GL_FRAMEBUFFER, sceneFbo_);
  // try HDR first, fall back to LDR if the driver rejects RGBA16F
  sceneColor_ = makeTexture(w, h, GL_RGBA16F, GL_RGBA, GL_HALF_FLOAT, false);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, sceneColor_, 0);
  glGenRenderbuffers(1, &sceneDepth_);
  glBindRenderbuffer(GL_RENDERBUFFER, sceneDepth_);
  glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, w, h);
  glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, sceneDepth_);
  GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
  if (status != GL_FRAMEBUFFER_COMPLETE) {
    LOGI("HDR framebuffer unsupported (0x%x), falling back to RGBA8", status);
    glDeleteTextures(1, &sceneColor_);
    sceneColor_ = makeTexture(w, h, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, false);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, sceneColor_, 0);
    hdr_ = false;
    status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    if (status != GL_FRAMEBUFFER_COMPLETE) LOGE("scene FBO incomplete: 0x%x", status);
  } else {
    hdr_ = true;
  }

  bloomW_ = std::max(2, w / 4);
  bloomH_ = std::max(2, h / 4);
  bloomA_ = makeTexture(bloomW_, bloomH_, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, false);
  bloomB_ = makeTexture(bloomW_, bloomH_, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, false);
  glGenFramebuffers(1, &bloomFboA_);
  glBindFramebuffer(GL_FRAMEBUFFER, bloomFboA_);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, bloomA_, 0);
  glGenFramebuffers(1, &bloomFboB_);
  glBindFramebuffer(GL_FRAMEBUFFER, bloomFboB_);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, bloomB_, 0);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

// ---------------------------------------------------------------- chunks
void Renderer::ensureChunks(const Vec3& center) {
  const int pcx = (int)std::floor(center.x / CHUNK_SIZE);
  const int pcz = (int)std::floor(center.z / CHUNK_SIZE);
  // release far chunks
  for (size_t i = 0; i < chunks_.size();) {
    GpuChunk* c = chunks_[i];
    if (std::abs(c->cx - pcx) > VIEW_RADIUS + 1 || std::abs(c->cz - pcz) > VIEW_RADIUS + 1) {
      glDeleteVertexArrays(1, &c->vao);
      glDeleteBuffers(1, &c->vbo);
      glDeleteBuffers(1, &c->ibo);
      if (c->pvao) {
        glDeleteVertexArrays(1, &c->pvao);
        glDeleteBuffers(1, &c->pvbo);
        glDeleteBuffers(1, &c->pibo);
      }
      delete c;
      chunks_.erase(chunks_.begin() + i);
    } else {
      i++;
    }
  }
  // build at most 2 new chunks per frame (keeps the frame time flat)
  int built = 0;
  for (int dz = -VIEW_RADIUS; dz <= VIEW_RADIUS && built < 2; dz++)
    for (int dx = -VIEW_RADIUS; dx <= VIEW_RADIUS && built < 2; dx++) {
      int cx = pcx + dx, cz = pcz + dz;
      bool exists = false;
      for (auto* c : chunks_)
        if (c->cx == cx && c->cz == cz) {
          exists = true;
          break;
        }
      if (exists) continue;

      auto* gpu = new GpuChunk();
      gpu->cx = cx;
      gpu->cz = cz;
      Chunk cpu;
      buildChunk(cpu, cx, cz, CHUNK_SEGMENTS, CHUNK_SIZE);

      glGenVertexArrays(1, &gpu->vao);
      glBindVertexArray(gpu->vao);
      glGenBuffers(1, &gpu->vbo);
      glBindBuffer(GL_ARRAY_BUFFER, gpu->vbo);
      glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)(cpu.verts.size() * sizeof(TerrainVertex)), cpu.verts.data(), GL_STATIC_DRAW);
      glGenBuffers(1, &gpu->ibo);
      glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, gpu->ibo);
      glBufferData(GL_ELEMENT_ARRAY_BUFFER, (GLsizeiptr)(cpu.idx.size() * sizeof(uint16_t)), cpu.idx.data(), GL_STATIC_DRAW);
      gpu->count = (GLsizei)cpu.idx.size();
      glEnableVertexAttribArray(0);
      glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)0);
      glEnableVertexAttribArray(1);
      glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)12);
      glEnableVertexAttribArray(2);
      glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)24);

      std::vector<PropVertex> pv;
      std::vector<uint16_t> pi;
      buildPropGeometry(cpu.trees, cpu.rocks, pv, pi);
      if (!pv.empty()) {
        glGenVertexArrays(1, &gpu->pvao);
        glBindVertexArray(gpu->pvao);
        glGenBuffers(1, &gpu->pvbo);
        glBindBuffer(GL_ARRAY_BUFFER, gpu->pvbo);
        glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)(pv.size() * sizeof(PropVertex)), pv.data(), GL_STATIC_DRAW);
        glGenBuffers(1, &gpu->pibo);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, gpu->pibo);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, (GLsizeiptr)(pi.size() * sizeof(uint16_t)), pi.data(), GL_STATIC_DRAW);
        gpu->pcount = (GLsizei)pi.size();
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)0);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)12);
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, (int)TERRAIN_STRIDE, (void*)24);
      }
      glBindVertexArray(0);
      gpu->ready = true;
      chunks_.push_back(gpu);
      built++;
    }
}

void Renderer::releaseChunks() {
  for (auto* c : chunks_) {
    glDeleteVertexArrays(1, &c->vao);
    glDeleteBuffers(1, &c->vbo);
    glDeleteBuffers(1, &c->ibo);
    if (c->pvao) {
      glDeleteVertexArrays(1, &c->pvao);
      glDeleteBuffers(1, &c->pvbo);
      glDeleteBuffers(1, &c->pibo);
    }
    delete c;
  }
  chunks_.clear();
}

// ---------------------------------------------------------------- uniforms
namespace {
struct FrameUniforms {
  Mat4 vp;
  Mat4 view;
  Mat4 proj;
};
}

void Renderer::frame(Game& g, float dt) {
  drawCalls_ = 0;
  ensureChunks(g.player.pos);

  // ---- camera matrices ----
  Mat4 proj = Mat4::perspective(62.f * (float)PI / 180.f, (float)w_ / (float)h_, 0.12f, 1400.f);
  Vec3 camPos = g.camPos;
  Mat4 view = Mat4::lookAt(camPos, g.camTarget, Vec3(0, 1, 0));
  Mat4 vp = proj * view;

  // ---- shadow camera ----
  lightCenter_ = g.player.pos;
  Vec3 lightPos = lightCenter_ + g.sunDir * 190.f;
  Mat4 lightView = Mat4::lookAt(lightPos, lightCenter_, Vec3(0, 1, 0));
  Mat4 lightProj = Mat4::ortho(-62.f, 62.f, -62.f, 62.f, 1.f, 420.f);
  lightVP_ = lightProj * lightView;

  // ---- bone palettes ----
  Mat4 playerBones[BONE_COUNT];
  Pose playerPose;
  g.player.anim.sample(playerPose);
  poseToMatrices(model_, playerPose, g.player.pos, g.player.yaw, 1.f, playerBones);

  std::vector<std::vector<Mat4>> enemyPalettes;
  enemyPalettes.resize(g.enemies.size());
  for (size_t i = 0; i < g.enemies.size(); i++) {
    Enemy& e = g.enemies[i];
    Pose p;
    e.anim.sample(p);
    enemyPalettes[i].resize(BONE_COUNT);
    poseToMatrices(model_, p, e.pos, e.yaw, e.scale, enemyPalettes[i].data());
  }

  // ---- shadow pass ----
  glBindFramebuffer(GL_FRAMEBUFFER, shadowFbo_);
  glViewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  glClearColor(1, 1, 1, 1);
  glClear(GL_DEPTH_BUFFER_BIT | GL_COLOR_BUFFER_BIT);
  glEnable(GL_DEPTH_TEST);
  glDepthMask(GL_TRUE);
  glDisable(GL_BLEND);
  {
    glUseProgram(lit_.id);
    glUniformMatrix4fv(lit_.u("uVP"), 1, GL_FALSE, lightVP_.m);
    glUniformMatrix4fv(lit_.u("uLightVP"), 1, GL_FALSE, lightVP_.m);
    glUniform1f(lit_.u("uFogDensity"), 0.f);
    glUniform1f(lit_.u("uExposure"), 1.f);
    glUniform3f(lit_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    for (auto* c : chunks_) {
      glBindVertexArray(c->vao);
      glDrawElements(GL_TRIANGLES, c->count, GL_UNSIGNED_SHORT, nullptr);
      drawCalls_++;
      if (c->pcount) {
        glBindVertexArray(c->pvao);
        glDrawElements(GL_TRIANGLES, c->pcount, GL_UNSIGNED_SHORT, nullptr);
        drawCalls_++;
      }
    }
    // characters cast shadows too
    glUseProgram(skin_.id);
    glUniformMatrix4fv(skin_.u("uVP"), 1, GL_FALSE, lightVP_.m);
    glUniformMatrix4fv(skin_.u("uLightVP"), 1, GL_FALSE, lightVP_.m);
    glUniformMatrix4fv(skin_.u("uBones"), BONE_COUNT, GL_FALSE, playerBones[0].m);
    glUniform1f(skin_.u("uShadowTexel"), 0.f);
    glUniform3f(skin_.u("uCloth"), 0, 0, 0);
    glUniform3f(skin_.u("uAccent"), 0, 0, 0);
    glUniform3f(skin_.u("uSkinTone"), 0, 0, 0);
    glUniform3f(skin_.u("uHair"), 0, 0, 0);
    glUniform1f(skin_.u("uHitFlash"), 0.f);
    glUniform1f(skin_.u("uGlow"), 0.f);
    glUniform3f(skin_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    glBindVertexArray(charVao_);
    for (size_t i = 0; i < g.enemies.size(); i++) {
      if (!g.enemies[i].alive && g.enemies[i].anim.time > 1.1f) continue;
      glUniformMatrix4fv(skin_.u("uBones"), BONE_COUNT, GL_FALSE, enemyPalettes[i][0].m);
      glDrawElements(GL_TRIANGLES, charCount_, GL_UNSIGNED_SHORT, nullptr);
      drawCalls_++;
    }
    glUniformMatrix4fv(skin_.u("uBones"), BONE_COUNT, GL_FALSE, playerBones[0].m);
    glDrawElements(GL_TRIANGLES, charCount_, GL_UNSIGNED_SHORT, nullptr);
    drawCalls_++;
  }
  glBindVertexArray(0);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);

  // ---- scene pass ----
  glBindFramebuffer(GL_FRAMEBUFFER, sceneFbo_);
  glViewport(0, 0, w_, h_);
  glClearColor(g.fogColor.x, g.fogColor.y, g.fogColor.z, 1.f);
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

  // sky
  {
    Vec3 fwd = (g.camTarget - camPos).norm();
    Vec3 right = fwd.cross(Vec3(0, 1, 0)).norm();
    Vec3 up = right.cross(fwd).norm();
    float tanHalf = std::tan(31.f * (float)PI / 180.f);
    glDisable(GL_DEPTH_TEST);
    glDepthMask(GL_FALSE);
    glUseProgram(sky_.id);
    glUniform3f(sky_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    glUniform3f(sky_.u("uCamRight"), right.x, right.y, right.z);
    glUniform3f(sky_.u("uCamUp"), up.x, up.y, up.z);
    glUniform3f(sky_.u("uCamFwd"), fwd.x, fwd.y, fwd.z);
    glUniform1f(sky_.u("uTanHalf"), tanHalf);
    glUniform1f(sky_.u("uAspect"), (float)w_ / (float)h_);
    glUniform3f(sky_.u("uSkyTop"), g.skyTop.x, g.skyTop.y, g.skyTop.z);
    glUniform3f(sky_.u("uSkyHorizon"), g.skyHorizon.x, g.skyHorizon.y, g.skyHorizon.z);
    glUniform3f(sky_.u("uSunColor"), g.sunColor.x, g.sunColor.y, g.sunColor.z);
    glUniform3f(sky_.u("uSunDir"), g.sunDir.x, g.sunDir.y, g.sunDir.z);
    glUniform1f(sky_.u("uSunIntensity"), g.sunIntensity);
    glUniform1f(sky_.u("uTime"), g.timeSeconds);
    glBindVertexArray(quadVao_);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    drawCalls_++;
    glEnable(GL_DEPTH_TEST);
    glDepthMask(GL_TRUE);
  }

  // terrain + props
  {
    glUseProgram(lit_.id);
    glUniformMatrix4fv(lit_.u("uVP"), 1, GL_FALSE, vp.m);
    glUniformMatrix4fv(lit_.u("uLightVP"), 1, GL_FALSE, lightVP_.m);
    glUniform3f(lit_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    glUniform3f(lit_.u("uSunDir"), g.sunDir.x, g.sunDir.y, g.sunDir.z);
    glUniform3f(lit_.u("uSunColor"), g.sunColor.x, g.sunColor.y, g.sunColor.z);
    glUniform1f(lit_.u("uSunIntensity"), g.sunIntensity);
    glUniform3f(lit_.u("uSkyColor"), g.skyTop.x * 0.75f, g.skyTop.y * 0.85f, g.skyTop.z);
    glUniform3f(lit_.u("uGroundColor"), 0.24f, 0.24f, 0.20f);
    glUniform3f(lit_.u("uFogColor"), g.fogColor.x, g.fogColor.y, g.fogColor.z);
    glUniform1f(lit_.u("uFogDensity"), g.fogDensity);
    glUniform1f(lit_.u("uTime"), g.timeSeconds);
    glUniform1f(lit_.u("uExposure"), g.exposure * g.brightness);
    glUniform1f(lit_.u("uShadowTexel"), 1.f / SHADOW_SIZE);
    glUniform1f(lit_.u("uWaterLevel"), Terrain::WATER_LEVEL);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, shadowTex_);
    glUniform1i(lit_.u("uShadow"), 0);
    for (auto* c : chunks_) {
      glBindVertexArray(c->vao);
      glDrawElements(GL_TRIANGLES, c->count, GL_UNSIGNED_SHORT, nullptr);
      drawCalls_++;
      if (c->pcount) {
        glBindVertexArray(c->pvao);
        glDrawElements(GL_TRIANGLES, c->pcount, GL_UNSIGNED_SHORT, nullptr);
        drawCalls_++;
      }
    }
  }

  // water
  {
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glUseProgram(water_.id);
    glUniformMatrix4fv(water_.u("uVP"), 1, GL_FALSE, vp.m);
    glUniform3f(water_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    glUniform3f(water_.u("uSunDir"), g.sunDir.x, g.sunDir.y, g.sunDir.z);
    glUniform3f(water_.u("uSunColor"), g.sunColor.x, g.sunColor.y, g.sunColor.z);
    glUniform1f(water_.u("uSunIntensity"), g.sunIntensity);
    glUniform3f(water_.u("uSkyColor"), g.skyHorizon.x, g.skyHorizon.y, g.skyHorizon.z);
    glUniform3f(water_.u("uSkyTop"), g.skyTop.x, g.skyTop.y, g.skyTop.z);
    glUniform3f(water_.u("uGroundColor"), 0.1f, 0.18f, 0.2f);
    glUniform3f(water_.u("uFogColor"), g.fogColor.x, g.fogColor.y, g.fogColor.z);
    glUniform1f(water_.u("uFogDensity"), g.fogDensity);
    glUniform1f(water_.u("uTime"), g.timeSeconds);
    glUniform1f(water_.u("uExposure"), g.exposure * g.brightness);
    glUniform1f(water_.u("uWaterLevel"), Terrain::WATER_LEVEL);
    glBindVertexArray(waterVao_);
    glDrawElements(GL_TRIANGLES, waterCount_, GL_UNSIGNED_SHORT, nullptr);
    drawCalls_++;
    glDisable(GL_BLEND);
  }

  // characters
  {
    glUseProgram(skin_.id);
    glUniformMatrix4fv(skin_.u("uVP"), 1, GL_FALSE, vp.m);
    glUniformMatrix4fv(skin_.u("uLightVP"), 1, GL_FALSE, lightVP_.m);
    glUniform3f(skin_.u("uCamPos"), camPos.x, camPos.y, camPos.z);
    glUniform3f(skin_.u("uSunDir"), g.sunDir.x, g.sunDir.y, g.sunDir.z);
    glUniform3f(skin_.u("uSunColor"), g.sunColor.x, g.sunColor.y, g.sunColor.z);
    glUniform1f(skin_.u("uSunIntensity"), g.sunIntensity);
    glUniform3f(skin_.u("uSkyColor"), g.skyTop.x * 0.75f, g.skyTop.y * 0.85f, g.skyTop.z);
    glUniform3f(skin_.u("uGroundColor"), 0.24f, 0.24f, 0.20f);
    glUniform3f(skin_.u("uFogColor"), g.fogColor.x, g.fogColor.y, g.fogColor.z);
    glUniform1f(skin_.u("uFogDensity"), g.fogDensity);
    glUniform1f(skin_.u("uTime"), g.timeSeconds);
    glUniform1f(skin_.u("uExposure"), g.exposure * g.brightness);
    glUniform1f(skin_.u("uShadowTexel"), 1.f / SHADOW_SIZE);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, shadowTex_);
    glUniform1i(skin_.u("uShadow"), 0);
    glUniform3f(skin_.u("uSkinTone"), 0.94f, 0.78f, 0.66f);
    // enemies
    glBindVertexArray(charVao_);
    for (size_t i = 0; i < g.enemies.size(); i++) {
      Enemy& e = g.enemies[i];
      if (!e.alive && e.anim.time > 1.1f) continue;
      if ((e.pos - camPos).len() > 150.f) continue;
      glUniformMatrix4fv(skin_.u("uBones"), BONE_COUNT, GL_FALSE, enemyPalettes[i][0].m);
      glUniform3f(skin_.u("uCloth"), e.baseColor.x, e.baseColor.y, e.baseColor.z);
      glUniform3f(skin_.u("uAccent"), e.accentColor.x, e.accentColor.y, e.accentColor.z);
      glUniform3f(skin_.u("uHair"), e.baseColor.x * 0.4f, e.baseColor.y * 0.4f, e.baseColor.z * 0.4f);
      glUniform1f(skin_.u("uHitFlash"), e.hurtFlash);
      glUniform1f(skin_.u("uGlow"), e.telegraph > 0.f ? 1.f : 0.f);
      glDrawElements(GL_TRIANGLES, charCount_, GL_UNSIGNED_SHORT, nullptr);
      drawCalls_++;
    }
    // player
    const CharacterDef& d = g.def();
    glUniformMatrix4fv(skin_.u("uBones"), BONE_COUNT, GL_FALSE, playerBones[0].m);
    glUniform3f(skin_.u("uCloth"), d.clothColor.x, d.clothColor.y, d.clothColor.z);
    glUniform3f(skin_.u("uAccent"), d.accent.x, d.accent.y, d.accent.z);
    glUniform3f(skin_.u("uHair"), d.accent.x * 0.45f, d.accent.y * 0.45f, d.accent.z * 0.45f);
    glUniform1f(skin_.u("uHitFlash"), 0.f);
    glUniform1f(skin_.u("uGlow"), 0.f);
    glDrawElements(GL_TRIANGLES, charCount_, GL_UNSIGNED_SHORT, nullptr);
    drawCalls_++;
  }

  // particles
  {
    partScratch_.clear();
    int n = 0;
    for (const auto& p : g.particles) {
      if (!p.alive || n >= 1000) continue;
      float t = p.life / p.maxLife;
      float alpha = std::min(1.f, t * 1.6f);
      partScratch_.insert(partScratch_.end(),
                          {p.pos.x, p.pos.y, p.pos.z,
                           p.color.x, p.color.y, p.color.z, alpha,
                           p.size * (0.55f + t * 0.75f)});
      n++;
    }
    if (n > 0) {
      glEnable(GL_BLEND);
      glBlendFunc(GL_SRC_ALPHA, GL_ONE);
      glDepthMask(GL_FALSE);
      glUseProgram(part_.id);
      glUniformMatrix4fv(part_.u("uVP"), 1, GL_FALSE, vp.m);
      glBindVertexArray(partVao_);
      glBindBuffer(GL_ARRAY_BUFFER, partVbo_);
      glBufferSubData(GL_ARRAY_BUFFER, 0, (GLsizeiptr)(partScratch_.size() * sizeof(float)), partScratch_.data());
      glDrawArrays(GL_POINTS, 0, n);
      drawCalls_++;
      glDepthMask(GL_TRUE);
      glDisable(GL_BLEND);
    }
  }

  // sword trail
  {
    trailScratch_.clear();
    int pairs = 0;
    Vec3 prevA, prevB;
    bool hasPrev = false;
    for (int i = 0; i < 24; i++) {
      int idx = (g.trailHead + i) % 24;
      const TrailPoint& tp = g.trail[idx];
      if (!tp.valid) {
        hasPrev = false;
        continue;
      }
      if (hasPrev) {
        float a = tp.t * 0.8f;
        // two triangles per segment
        auto push = [&](const Vec3& p, float al) {
          trailScratch_.insert(trailScratch_.end(), {p.x, p.y, p.z, al});
        };
        push(prevA, a); push(prevB, a); push(tp.a, a * 0.15f);
        push(prevB, a); push(tp.b, a * 0.15f); push(tp.a, a * 0.15f);
        pairs++;
      }
      prevA = tp.a;
      prevB = tp.b;
      hasPrev = true;
    }
    if (pairs > 0) {
      glEnable(GL_BLEND);
      glBlendFunc(GL_SRC_ALPHA, GL_ONE);
      glDepthMask(GL_FALSE);
      glUseProgram(trail_.id);
      glUniformMatrix4fv(trail_.u("uVP"), 1, GL_FALSE, vp.m);
      Vec3 c = g.elementColor();
      glUniform3f(trail_.u("uColor"), c.x, c.y, c.z);
      glBindVertexArray(trailVao_);
      glBindBuffer(GL_ARRAY_BUFFER, trailVbo_);
      glBufferSubData(GL_ARRAY_BUFFER, 0, (GLsizeiptr)(trailScratch_.size() * sizeof(float)), trailScratch_.data());
      glDrawArrays(GL_TRIANGLES, 0, pairs * 6);
      drawCalls_++;
      glDepthMask(GL_TRUE);
      glDisable(GL_BLEND);
    }
  }

  glBindVertexArray(0);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  renderPost(g);
  frames_++;
}

void Renderer::renderPost(const Game& g) {
  // bright pass
  glBindFramebuffer(GL_FRAMEBUFFER, bloomFboA_);
  glViewport(0, 0, bloomW_, bloomH_);
  glDisable(GL_DEPTH_TEST);
  glUseProgram(bright_.id);
  glActiveTexture(GL_TEXTURE0);
  glBindTexture(GL_TEXTURE_2D, sceneColor_);
  glUniform1i(bright_.u("uTex"), 0);
  glUniform1f(bright_.u("uThreshold"), 1.05f);
  glBindVertexArray(quadVao_);
  glDrawArrays(GL_TRIANGLES, 0, 3);

  // blur horizontal
  glBindFramebuffer(GL_FRAMEBUFFER, bloomFboB_);
  glUseProgram(blur_.id);
  glBindTexture(GL_TEXTURE_2D, bloomA_);
  glUniform1i(blur_.u("uTex"), 0);
  glUniform2f(blur_.u("uDir"), 1.f / bloomW_, 0.f);
  glDrawArrays(GL_TRIANGLES, 0, 3);

  // blur vertical (wider)
  glBindFramebuffer(GL_FRAMEBUFFER, bloomFboA_);
  glBindTexture(GL_TEXTURE_2D, bloomB_);
  glUniform2f(blur_.u("uDir"), 0.f, 2.2f / bloomH_);
  glDrawArrays(GL_TRIANGLES, 0, 3);

  // composite to the screen
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  glViewport(0, 0, w_, h_);
  glUseProgram(composite_.id);
  glActiveTexture(GL_TEXTURE0);
  glBindTexture(GL_TEXTURE_2D, sceneColor_);
  glUniform1i(composite_.u("uScene"), 0);
  glActiveTexture(GL_TEXTURE1);
  glBindTexture(GL_TEXTURE_2D, bloomA_);
  glUniform1i(composite_.u("uBloom"), 1);
  glUniform1f(composite_.u("uBloomStrength"), hdr_ ? 0.85f : 0.35f);
  glUniform1f(composite_.u("uBrightness"), 1.0f);
  glUniform1f(composite_.u("uVignette"), 0.55f);
  glUniform1f(composite_.u("uDamage"), g.damageFlash);
  glUniform1f(composite_.u("uTime"), g.timeSeconds);
  glDrawArrays(GL_TRIANGLES, 0, 3);
  glEnable(GL_DEPTH_TEST);
  glActiveTexture(GL_TEXTURE0);
}

void Renderer::shutdown() {
  releaseChunks();
  if (sceneFbo_) glDeleteFramebuffers(1, &sceneFbo_);
  if (shadowFbo_) glDeleteFramebuffers(1, &shadowFbo_);
  if (bloomFboA_) glDeleteFramebuffers(1, &bloomFboA_);
  if (bloomFboB_) glDeleteFramebuffers(1, &bloomFboB_);
}

}  // namespace ae
