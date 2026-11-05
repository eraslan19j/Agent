// ============================================================
// AETHERION NATIVE — JNI bridge (Kotlin ⇄ C++)
// ============================================================
#include <jni.h>
#include <GLES3/gl3.h>
#include <android/log.h>
#include <cmath>
#include "game.h"
#include "render.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "AetherionJNI", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "AetherionJNI", __VA_ARGS__)

namespace {
ae::Renderer* gRenderer = nullptr;
ae::Game* gGame = nullptr;
bool gReady = false;
float gBrightness = 1.0f;
}  // namespace

extern "C" {

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nCreate(JNIEnv*, jclass) {
  if (!gGame) {
    gGame = &ae::gameInstance();
    gGame->reset();
  }
  if (!gRenderer) {
    gRenderer = new ae::Renderer();
    gReady = gRenderer->init() && gRenderer->ready();
    if (!gReady) {
      LOGE("renderer init failed: %s", gRenderer->lastError());
      gRenderer->note("init failed");
    }
    LOGI("engine created (%s)", gReady ? "ok" : "FAILED");
  }
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nResize(JNIEnv*, jclass, jint w, jint h) {
  if (gRenderer) gRenderer->resize((int)w, (int)h);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nFrame(JNIEnv*, jclass, jfloat dt) {
  if (!gGame || !gRenderer || !gReady) {
    // visible "engine not ready" colour instead of an unexplained black screen
    glClearColor(0.10f, 0.06f, 0.12f, 1.f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    return;
  }
  gGame->brightness = gBrightness;
  gGame->update(dt);
  gRenderer->frame(*gGame, dt);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetMove(JNIEnv*, jclass, jfloat x, jfloat y) {
  if (!gGame) return;
  gGame->moveX = x;
  gGame->moveY = y;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nLook(JNIEnv*, jclass, jfloat dx, jfloat dy) {
  if (!gGame) return;
  gGame->lookDX += dx;
  gGame->lookDY += dy;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetSprint(JNIEnv*, jclass, jboolean on) {
  if (gGame) gGame->sprinting = on;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nAction(JNIEnv*, jclass, jint code) {
  if (!gGame) return;
  switch (code) {
    case 0: gGame->wantAttack = true; break;   // attack
    case 1: gGame->wantSkill = true; break;    // element skill
    case 2: gGame->wantDash = true; break;     // dash
    case 3: gGame->wantJump = true; break;     // jump / glide
    default: break;
  }
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetCharacter(JNIEnv*, jclass, jint id) {
  if (gGame) gGame->setCharacter((int)id);
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetBrightness(JNIEnv*, jclass, jfloat b) {
  gBrightness = b;
}

JNIEXPORT void JNICALL
Java_ai_aetherion_nativeapp_Engine_nSetQuality(JNIEnv*, jclass, jint level) {
  (void)level;   // reserved: chunk radius / shadow res scaling
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
    int alive = 0;
    for (const auto& e : gGame->enemies)
      if (e.alive) alive++;
    v[0] = gGame->player.hp;
    v[1] = gGame->player.maxHp;
    v[2] = gGame->stamina;
    v[3] = gGame->energy;
    v[4] = (float)gGame->character;
    v[5] = gGame->player.pos.x;
    v[6] = gGame->player.pos.z;
    v[7] = (float)alive;
    v[8] = gGame->skillCd;
    v[9] = gGame->dashCd;
  }
  env->SetFloatArrayRegion(arr, 0, 10, v);
  return arr;
}

JNIEXPORT jstring JNICALL
Java_ai_aetherion_nativeapp_Engine_nGlInfo(JNIEnv* env, jclass) {
  const char* info = gRenderer ? gRenderer->glInfo() : "renderer not ready";
  return env->NewStringUTF(info);
}

JNIEXPORT jstring JNICALL
Java_ai_aetherion_nativeapp_Engine_nLastError(JNIEnv* env, jclass) {
  const char* msg = gRenderer ? gRenderer->lastError() : "renderer not created";
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
