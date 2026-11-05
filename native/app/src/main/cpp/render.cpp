// ============================================================
// AETHERION BLOX — renderer (GLES 2.0, straight to the back buffer)
// ============================================================
#include "render.h"

#include <GLES2/gl2.h>
#include <android/log.h>
#include <cstdarg>
#include <cstdio>
#include <cstring>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "BloxGL", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "BloxGL", __VA_ARGS__)

namespace blox {
namespace {

// GLES 2.0 — maximum device compatibility, no extensions required
const char* VS = R"GLSL(
attribute vec3 aPos;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform vec3 uTint;
varying vec3 vCol;
void main() {
  vCol = aCol * uTint;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
)GLSL";

const char* FS = R"GLSL(
precision mediump float;
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 1.0);
}
)GLSL";

GLuint compile(GLenum type, const char* src, char* err, int errSize) {
  GLuint s = glCreateShader(type);
  glShaderSource(s, 1, &src, nullptr);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[512] = {0};
    glGetShaderInfoLog(s, sizeof(log) - 1, nullptr, log);
    snprintf(err, errSize, "shader %s: %s", type == GL_VERTEX_SHADER ? "VS" : "FS", log);
    glDeleteShader(s);
    return 0;
  }
  return s;
}

}  // namespace

void Renderer::note(const char* fmt, ...) {
  char buf[512];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  LOGE("%s", buf);
  snprintf(error_, sizeof(error_), "%s", buf);
}

bool Renderer::init() {
  const char* ver = (const char*)glGetString(GL_VERSION);
  const char* ren = (const char*)glGetString(GL_RENDERER);
  const char* vend = (const char*)glGetString(GL_VENDOR);
  snprintf(glInfo_, sizeof(glInfo_), "%s | %s | %s", ver ? ver : "?", ren ? ren : "?",
           vend ? vend : "?");
  LOGI("GL: %s", glInfo_);

  char err[512] = {0};
  GLuint vs = compile(GL_VERTEX_SHADER, VS, err, sizeof(err));
  if (!vs) {
    note("%s", err);
    return false;
  }
  GLuint fs = compile(GL_FRAGMENT_SHADER, FS, err, sizeof(err));
  if (!fs) {
    note("%s", err);
    glDeleteShader(vs);
    return false;
  }

  prog_ = glCreateProgram();
  glAttachShader(prog_, vs);
  glAttachShader(prog_, fs);
  glBindAttribLocation(prog_, 0, "aPos");
  glBindAttribLocation(prog_, 1, "aCol");
  glLinkProgram(prog_);
  GLint ok = 0;
  glGetProgramiv(prog_, GL_LINK_STATUS, &ok);
  if (!ok) {
    char log[512] = {0};
    glGetProgramInfoLog(prog_, sizeof(log) - 1, nullptr, log);
    note("link: %s", log);
    return false;
  }
  glDeleteShader(vs);
  glDeleteShader(fs);

  uMVP_ = glGetUniformLocation(prog_, "uMVP");
  uTint_ = glGetUniformLocation(prog_, "uTint");

  // unit cube (centered), per-face shade baked into the vertex colours
  static const float SH[6] = {1.00f, 0.52f, 0.86f, 0.74f, 0.92f, 0.68f};
  float cube[36 * 6];
  int w = 0;
  auto quad = [&](float ax, float ay, float az, float bx, float by, float bz, float cx,
                  float cy, float cz, float dx, float dy, float dz, float shade) {
    const float p[6][3] = {{ax, ay, az}, {bx, by, bz}, {cx, cy, cz},
                           {ax, ay, az}, {cx, cy, cz}, {dx, dy, dz}};
    for (int i = 0; i < 6; i++) {
      cube[w++] = p[i][0];
      cube[w++] = p[i][1];
      cube[w++] = p[i][2];
      cube[w++] = shade;
      cube[w++] = shade;
      cube[w++] = shade;
    }
  };
  quad(-.5f, .5f, -.5f, -.5f, .5f, .5f, .5f, .5f, .5f, .5f, .5f, -.5f, SH[0]);
  quad(-.5f, -.5f, -.5f, .5f, -.5f, -.5f, .5f, -.5f, .5f, -.5f, -.5f, .5f, SH[1]);
  quad(.5f, -.5f, -.5f, .5f, .5f, -.5f, .5f, .5f, .5f, .5f, -.5f, .5f, SH[2]);
  quad(-.5f, -.5f, -.5f, -.5f, -.5f, .5f, -.5f, .5f, .5f, -.5f, .5f, -.5f, SH[3]);
  quad(-.5f, -.5f, .5f, .5f, -.5f, .5f, .5f, .5f, .5f, -.5f, .5f, .5f, SH[4]);
  quad(-.5f, -.5f, -.5f, -.5f, .5f, -.5f, .5f, .5f, -.5f, .5f, -.5f, -.5f, SH[5]);

  glGenBuffers(1, &cubeVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, cubeVbo_);
  glBufferData(GL_ARRAY_BUFFER, sizeof(cube), cube, GL_STATIC_DRAW);

  // static world
  Game& g = instance();
  glGenBuffers(1, &worldVbo_);
  glBindBuffer(GL_ARRAY_BUFFER, worldVbo_);
  glBufferData(GL_ARRAY_BUFFER,
               (GLsizeiptr)(g.world.size() * sizeof(Vertex)), g.world.data(),
               GL_STATIC_DRAW);
  worldVerts_ = (int)g.world.size();
  glBindBuffer(GL_ARRAY_BUFFER, 0);

  glDisable(GL_CULL_FACE);
  glEnable(GL_DEPTH_TEST);
  glDepthFunc(GL_LEQUAL);
  glClearColor(0.56f, 0.79f, 0.97f, 1.f);

  ready_ = true;
  LOGI("renderer ready (world verts=%d)", worldVerts_);
  return true;
}

void Renderer::resize(int w, int h) {
  w_ = w > 0 ? w : 1;
  h_ = h > 0 ? h : 1;
  glViewport(0, 0, w_, h_);
}

void Renderer::drawCube(const Mat4& mvp, const Vec3& tint) {
  glUniformMatrix4fv(uMVP_, 1, GL_FALSE, mvp.m);
  glUniform3f(uTint_, tint.x, tint.y, tint.z);
  glBindBuffer(GL_ARRAY_BUFFER, cubeVbo_);
  glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
  glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float),
                        (void*)(3 * sizeof(float)));
  glEnableVertexAttribArray(0);
  glEnableVertexAttribArray(1);
  glDrawArrays(GL_TRIANGLES, 0, 36);
}

namespace {
// local part matrix: pivot at the joint, box hanging below it
Mat4 partMatrix(const Vec3& feet, float yaw, const Vec3& pivot, float angle,
                const Vec3& size) {
  Mat4 m = translate(feet);
  m = mul(m, rotateY(yaw));
  m = mul(m, translate(pivot));
  if (angle != 0.f) m = mul(m, rotateX(angle));
  m = mul(m, translate(Vec3(0.f, -size.y * 0.5f, 0.f)));
  m = mul(m, scaleV(size));
  return m;
}
}  // namespace

void Renderer::drawPlayer(const Game& g, const Mat4& viewProj) {
  const Player& p = g.player;
  const float s = 0.36f;                 // one stud
  const Vec3 feet = p.pos;
  const float walk = p.walkPhase;
  const bool moving = std::fabs(p.vel.x) + std::fabs(p.vel.z) > 0.4f;

  float swing = 0.f;
  float armSwing = 0.f;
  if (!p.grounded) {
    swing = 0.35f;
    armSwing = -0.6f;
  } else if (moving) {
    swing = std::sin(walk) * 0.7f;
    armSwing = -std::sin(walk) * 0.55f;
  } else {
    // idle breathing
    swing = std::sin(g.bob * 1.8f) * 0.03f;
    armSwing = -std::sin(g.bob * 1.8f) * 0.04f;
  }
  const float bobY = p.grounded ? std::fabs(std::sin(walk)) * 0.035f *
                                     (moving ? 1.f : 0.f)
                               : 0.f;

  const Vec3 legSize(s, 2.f * s, s);
  const Vec3 armSize(s, 2.f * s, s);
  const Vec3 torsoSize(2.f * s, 2.f * s, s);
  const Vec3 headSize(s, s, s);

  const Vec3 shirt = pal::SHIRT;
  const Vec3 pants = pal::PANTS;
  const Vec3 skin = pal::SKIN;

  const Mat4 body = mul(viewProj, translate(Vec3(0.f, bobY, 0.f)));

  // legs (pivot at hip height)
  drawCube(mul(body, partMatrix(feet, p.yaw, Vec3(-s * 0.5f, 2 * s, 0.f), swing, legSize)), pants);
  drawCube(mul(body, partMatrix(feet, p.yaw, Vec3(s * 0.5f, 2 * s, 0.f), -swing, legSize)), pants);
  // torso (hangs from the shoulders)
  drawCube(mul(body, partMatrix(feet, p.yaw, Vec3(0.f, 4 * s, 0.f), 0.f, torsoSize)), shirt);
  // arms
  drawCube(mul(body, partMatrix(feet, p.yaw, Vec3(-s * 1.5f, 4 * s, 0.f), armSwing, armSize)), skin);
  drawCube(mul(body, partMatrix(feet, p.yaw, Vec3(s * 1.5f, 4 * s, 0.f), -armSwing, armSize)), skin);
  // head (sits on the shoulders, pivot at 1.80 m)
  const Mat4 headM = mul(body, partMatrix(feet, p.yaw, Vec3(0.f, 5 * s, 0.f), 0.f, headSize));
  drawCube(headM, skin);

  // face: eyes + smile, expressed in head-local space (unit cube = ±0.5)
  drawCube(mul(headM, mul(translate(Vec3(-0.22f, -0.08f, 0.53f)), scaleV(Vec3(0.22f, 0.24f, 0.10f)))), pal::DARK);
  drawCube(mul(headM, mul(translate(Vec3(0.22f, -0.08f, 0.53f)), scaleV(Vec3(0.22f, 0.24f, 0.10f)))), pal::DARK);
  drawCube(mul(headM, mul(translate(Vec3(0.f, -0.30f, 0.53f)), scaleV(Vec3(0.42f, 0.10f, 0.10f)))), pal::DARK);
}

void Renderer::frame(Game& g, float dt) {
  (void)dt;
  if (!ready_) {
    glClearColor(0.10f, 0.06f, 0.12f, 1.f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    return;
  }
  glViewport(0, 0, w_, h_);
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

  const float aspect = (float)w_ / (float)(h_ > 0 ? h_ : 1);
  const Mat4 viewProj =
      mul(perspective(60.f * PI / 180.f, aspect, 0.10f, 320.f),
          lookAt(g.camEye(), g.camTarget(), Vec3(0, 1, 0)));

  glUseProgram(prog_);

  // ---- static world: single instanced-free draw call ----
  {
    const Mat4 mvp = viewProj;
    glUniformMatrix4fv(uMVP_, 1, GL_FALSE, mvp.m);
    glUniform3f(uTint_, 1.f, 1.f, 1.f);
    glBindBuffer(GL_ARRAY_BUFFER, worldVbo_);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float),
                          (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(0);
    glEnableVertexAttribArray(1);
    glDrawArrays(GL_TRIANGLES, 0, worldVerts_);
  }

  // ---- coins ----
  for (const auto& c : g.coins) {
    if (c.taken) continue;
    Mat4 m = mul(translate(c.pos), rotateY(g.coinSpin + c.pos.x * 0.7f + c.pos.z * 0.3f));
    m = mul(m, translate(Vec3(0.f, std::sin(g.bob * 2.2f + c.pos.z) * 0.08f, 0.f)));
    m = mul(m, scaleV(Vec3(0.55f, 0.55f, 0.12f)));
    drawCube(mul(viewProj, m), pal::GOLD);
  }

  // ---- player ----
  drawPlayer(g, viewProj);
}

void Renderer::shutdown() {
  if (cubeVbo_) glDeleteBuffers(1, &cubeVbo_);
  if (worldVbo_) glDeleteBuffers(1, &worldVbo_);
  if (prog_) glDeleteProgram(prog_);
  cubeVbo_ = worldVbo_ = 0;
  prog_ = 0;
  ready_ = false;
}

}  // namespace blox
