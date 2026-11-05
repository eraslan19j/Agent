// ============================================================
// AETHERION BLOX — JNI bridge
// ============================================================
#include <jni.h>

#include <cmath>

#include "game.h"
#include "render.h"

namespace {
blox::Game* gGame = nullptr;
blox::Renderer* gRenderer = nullptr;
bool gReady = false;
float gSensitivity = 1.0f;
}  // namespace

extern "C" {

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nCreate(JNIEnv*, jclass) {
  if (!gGame) {
    gGame = &blox::instance();
    gGame->reset();
  }
  if (!gRenderer) {
    gRenderer = new blox::Renderer();
    gReady = gRenderer->init() && gRenderer->ready();
  }
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nResize(JNIEnv*, jclass, jint w, jint h) {
  if (gRenderer) gRenderer->resize((int)w, (int)h);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nFrame(JNIEnv*, jclass, jfloat dt) {
  if (!gGame || !gRenderer || !gReady) return;
  gGame->update(dt);
  gRenderer->frame(*gGame, dt);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetMove(JNIEnv*, jclass, jfloat x, jfloat y) {
  if (!gGame) return;
  // x = strafe (right positive), y = forward (up on the stick positive)
  gGame->moveX = x > 1.f ? 1.f : (x < -1.f ? -1.f : x);
  gGame->moveY = y > 1.f ? 1.f : (y < -1.f ? -1.f : y);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nLook(JNIEnv*, jclass, jfloat dx, jfloat dy) {
  if (!gGame) return;
  gGame->camYaw -= dx * 0.006f * gSensitivity;
  gGame->camPitch += dy * 0.004f * gSensitivity;
  const float lo = -0.25f, hi = 1.15f;
  if (gGame->camPitch < lo) gGame->camPitch = lo;
  if (gGame->camPitch > hi) gGame->camPitch = hi;
  while (gGame->camYaw > blox::PI) gGame->camYaw -= 2.f * blox::PI;
  while (gGame->camYaw < -blox::PI) gGame->camYaw += 2.f * blox::PI;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nJump(JNIEnv*, jclass) {
  if (gGame) gGame->jump();
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetSprint(JNIEnv*, jclass, jboolean on) {
  if (gGame) gGame->sprint = on == JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetSensitivity(JNIEnv*, jclass, jfloat s) {
  gSensitivity = s < 0.2f ? 0.2f : (s > 2.5f ? 2.5f : s);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nReset(JNIEnv*, jclass) {
  if (gGame) gGame->reset();
}

JNIEXPORT jfloatArray JNICALL
Java_ai_aetherion_nativeapp_Engine_nState(JNIEnv* env, jclass) {
  jfloatArray arr = env->NewFloatArray(10);
  if (!arr) return nullptr;
  float v[10] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  if (gGame) {
    v[0] = (float)gGame->collected;
    v[1] = (float)gGame->coins.size();
    v[2] = gGame->time;
    v[3] = gGame->player.pos.x;
    v[4] = gGame->player.pos.y;
    v[5] = gGame->player.pos.z;
    v[6] = gGame->won ? 1.f : 0.f;
    v[7] = (float)gGame->respawns;
    v[8] = gGame->respawnFlash;
    v[9] = gGame->player.grounded ? 1.f : 0.f;
  }
  env->SetFloatArrayRegion(arr, 0, 10, v);
  return arr;
}

JNIEXPORT jstring JNICALL
Java_ai_aetherion_nativeapp_Engine_nGlInfo(JNIEnv* env, jclass) {
  const char* info = gRenderer ? gRenderer->glInfo() : "motor hazır değil";
  return env->NewStringUTF(info);
}

JNIEXPORT jstring JNICALL
Java_ai_aetherion_nativeapp_Engine_nLastError(JNIEnv* env, jclass) {
  const char* msg = gRenderer ? gRenderer->lastError() : "renderer oluşturulmadı";
  return env->NewStringUTF(msg && msg[0] ? msg : "");
}

JNIEXPORT jboolean JNICALL
Java_ai_aetherion_nativeapp_Engine_nReady(JNIEnv*, jclass) {
  return (jboolean)(gReady ? 1 : 0);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nDestroy(JNIEnv*, jclass) {
  if (gRenderer) {
    gRenderer->shutdown();
    delete gRenderer;
    gRenderer = nullptr;
  }
  gReady = false;
}

}  // extern "C"
