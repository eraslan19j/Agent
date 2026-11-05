// ============================================================
// AETHERION BLOX — minimal OpenGL ES 2.0 renderer
// one shader, one static world buffer, one cube buffer, no FBOs
// ============================================================
#pragma once
#include "game.h"

namespace blox {

class Renderer {
 public:
  bool init();
  void resize(int w, int h);
  void frame(Game& g, float dt);
  void shutdown();

  bool ready() const { return ready_; }
  const char* lastError() const { return error_; }
  const char* glInfo() const { return glInfo_; }

 private:
  void note(const char* fmt, ...);
  void drawCube(const Mat4& mvp, const Vec3& tint);
  void drawPlayer(const Game& g, const Mat4& viewProj);

  bool ready_ = false;
  int w_ = 0, h_ = 0;
  char error_[1024] = {0};
  char glInfo_[192] = {0};

  unsigned prog_ = 0;
  int uMVP_ = -1;
  int uTint_ = -1;
  unsigned worldVbo_ = 0;
  int worldVerts_ = 0;
  unsigned cubeVbo_ = 0;
};

}  // namespace blox
