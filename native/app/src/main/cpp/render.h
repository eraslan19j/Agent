// ============================================================
// AETHERION NATIVE — OpenGL ES 3.0 renderer
// ============================================================
#pragma once
#include <GLES3/gl3.h>
#include <map>
#include <string>
#include <vector>
#include "game.h"

namespace ae {

struct GlProgram {
  GLuint id = 0;
  std::map<std::string, GLint> cache;
  GLint u(const char* name);
};

struct GpuChunk {
  int cx = 0, cz = 0;
  bool ready = false;
  GLuint vao = 0, vbo = 0, ibo = 0;
  GLsizei count = 0;
  GLuint pvao = 0, pvbo = 0, pibo = 0;
  GLsizei pcount = 0;
};

class Renderer {
 public:
  bool init();
  void resize(int w, int h);
  void frame(Game& g, float dt);
  void shutdown();
  int framesRendered() const { return frames_; }
  const char* glInfo() const { return glInfo_; }
  int drawCalls() const { return drawCalls_; }

 private:
  void ensureChunks(const Vec3& center);
  void releaseChunks();
  GLuint makeTexture(int w, int h, GLenum internal, GLenum format, GLenum type, bool depth);
  void drawQuad();
  void beginShadow(const Game& g);
  void endShadow();
  void renderPost(const Game& g);

  int w_ = 1, h_ = 1;
  int frames_ = 0, drawCalls_ = 0;
  char glInfo_[192] = {0};

  GlProgram sky_, lit_, skin_, water_, part_, trail_, bright_, blur_, composite_;
  GLuint quadVao_ = 0, quadVbo_ = 0;

  // framebuffers
  GLuint sceneFbo_ = 0, sceneColor_ = 0, sceneDepth_ = 0;
  GLuint shadowFbo_ = 0, shadowTex_ = 0;
  GLuint bloomA_ = 0, bloomB_ = 0, bloomFboA_ = 0, bloomFboB_ = 0;
  int bloomW_ = 1, bloomH_ = 1;
  bool hdr_ = true;

  // geometry
  GLuint charVao_ = 0, charVbo_ = 0, charIbo_ = 0;
  GLsizei charCount_ = 0;
  CharModel model_;
  GLuint waterVao_ = 0, waterVbo_ = 0, waterIbo_ = 0;
  GLsizei waterCount_ = 0;
  GLuint partVao_ = 0, partVbo_ = 0;
  GLuint trailVao_ = 0, trailVbo_ = 0;
  std::vector<GpuChunk*> chunks_;
  std::vector<float> partScratch_;
  std::vector<float> trailScratch_;

  Mat4 lightVP_;
  Vec3 lightCenter_;
};

}  // namespace ae
