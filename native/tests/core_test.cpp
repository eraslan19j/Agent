// ============================================================
// AETHERION BLOX — headless core tests (g++, no GL)
// ============================================================
#include <cmath>
#include <cstdio>
#include <string>

#include "game.h"

using namespace blox;

static int gPass = 0;
static int gFail = 0;

static void check(bool ok, const std::string& what, const std::string& extra = "") {
  if (ok) {
    gPass++;
    printf("  \033[32m✓\033[0m %s\n", what.c_str());
  } else {
    gFail++;
    printf("  \033[31m✗\033[0m %s %s\n", what.c_str(), extra.c_str());
  }
}

static void near(float a, float b, float eps, const std::string& what) {
  char buf[128];
  snprintf(buf, sizeof(buf), "(%.3f vs %.3f)", a, b);
  check(std::fabs(a - b) <= eps, what, buf);
}

// run the simulation for `seconds` at 60 Hz
static void sim(Game& g, float seconds) {
  const float dt = 1.f / 60.f;
  int steps = (int)(seconds / dt);
  for (int i = 0; i < steps; i++) g.update(dt);
}

int main() {
  printf("\n\033[1mAETHERION BLOX — çekirdek testleri\033[0m\n\n");

  Game& g = instance();

  // ---------------- world ----------------
  printf("\033[1mDünya\033[0m\n");
  check(g.world.size() > 1000 && g.world.size() % 6 == 0, "statik ağ üretildi",
        "(" + std::to_string(g.world.size()) + " köşe)");
  check(g.solids.size() > 20, "çarpışma kutuları var",
        "(" + std::to_string(g.solids.size()) + ")");
  check(g.coins.size() == 20, "20 para yerleştirildi",
        "(" + std::to_string(g.coins.size()) + ")");
  check(g.pads.size() == 1, "zıplama pedi var");

  // ---------------- spawn / gravity ----------------
  printf("\n\033[1mFizik\033[0m\n");
  g.reset();
  near(g.player.pos.y, 0.42f, 0.001f, "oyuncu spawn yüksekliğinde");
  sim(g, 1.5f);
  near(g.player.pos.y, 0.40f, 0.02f, "yerçekimi oyuncuyu platforma indiriyor");
  check(g.player.grounded, "oyuncu yere bastı");
  near(g.player.vel.y, 0.f, 0.001f, "dikey hız sıfırlandı");

  // ---------------- jump ----------------
  g.reset();
  sim(g, 0.5f);
  const float groundY = g.player.pos.y;
  g.jump();
  sim(g, 0.35f);
  check(g.player.pos.y > groundY + 0.5f, "zıplama yükseliyor",
        "(" + std::to_string(g.player.pos.y) + ")");
  sim(g, 1.2f);
  near(g.player.pos.y, groundY, 0.05f, "zıplama sonrası yere dönüyor");
  check(g.player.grounded, "iniş sonrası yerde");

  // ---------------- movement axes ----------------
  printf("\n\033[1mKontroller\033[0m\n");
  g.reset();
  sim(g, 0.3f);
  const float x0 = g.player.pos.x, z0 = g.player.pos.z;
  g.moveX = 1.f;
  g.moveY = 0.f;
  sim(g, 0.6f);
  check(g.player.pos.x > x0 + 0.5f, "joystick sağa → karakter sağa (+X)",
        "(" + std::to_string(g.player.pos.x - x0) + ")");
  near(g.player.pos.z, z0, 0.6f, "sağa giderken Z kayması yok");

  g.reset();
  sim(g, 0.3f);
  const float z1 = g.player.pos.z;
  g.moveX = 0.f;
  g.moveY = 1.f;
  sim(g, 0.6f);
  check(g.player.pos.z < z1 - 0.5f, "joystick ileri → karakter ileri (-Z)",
        "(" + std::to_string(g.player.pos.z - z1) + ")");

  g.reset();
  sim(g, 0.3f);
  const float x2 = g.player.pos.x;
  g.moveX = -1.f;
  g.moveY = 0.f;
  sim(g, 0.6f);
  check(g.player.pos.x < x2 - 0.5f, "joystick sola → karakter sola (-X)");

  g.moveX = g.moveY = 0.f;

  // ---------------- wall collision ----------------
  printf("\n\033[1mÇarpışma\033[0m\n");
  g.reset();
  g.player.pos = Vec3(-10.f, 0.02f, 9.f);   // south of the red pillar at (-10,?,3)
  g.camYaw = PI;
  sim(g, 0.2f);
  g.moveY = 1.f;
  sim(g, 1.6f);
  check(g.player.pos.z > 4.0f, "kırmızı sütun oyuncuyu durduruyor",
        "(z=" + std::to_string(g.player.pos.z) + ")");
  g.moveY = 0.f;

  // ---------------- stairs ----------------
  g.reset();
  sim(g, 0.3f);
  g.moveY = 1.f;
  sim(g, 2.6f);
  check(g.player.pos.y > 1.5f, "merdivenlerden yukarı çıkılıyor",
        "(y=" + std::to_string(g.player.pos.y) + ")");
  g.moveY = 0.f;

  // ---------------- coins ----------------
  printf("\n\033[1mOyun döngüsü\033[0m\n");
  g.reset();
  g.player.pos = Vec3(0.f, 0.42f, 7.f);
  sim(g, 0.2f);
  check(g.collected >= 1, "spawn üstündeki para toplandı",
        "(" + std::to_string(g.collected) + ")");
  const int before = g.collected;
  sim(g, 0.2f);
  check(g.collected == before, "aynı para ikinci kez sayılmıyor");

  // collect everything -> win
  g.reset();
  for (auto& c : g.coins) {
    g.player.pos = c.pos;
    g.update(1.f / 60.f);
  }
  check(g.collected == (int)g.coins.size(), "tüm paralar toplanabiliyor");
  check(g.won, "tüm paralar → kazanma durumu");
  const float frozen = g.time;
  sim(g, 0.5f);
  near(g.time, frozen, 0.001f, "kazandıktan sonra süre duruyor");

  // ---------------- respawn ----------------
  g.reset();
  g.player.pos = Vec3(0.f, -40.f, 0.f);
  g.update(1.f / 60.f);
  check(g.respawns == 1, "boşluğa düşünce yeniden doğuyor");
  near(g.player.pos.y, g.spawn.y, 0.01f, "yeniden doğma noktası doğru");

  // ---------------- camera ----------------
  printf("\n\033[1mKamera\033[0m\n");
  g.reset();
  sim(g, 0.2f);
  const Vec3 eye = g.camEye();
  const Vec3 tgt = g.camTarget();
  near((eye - tgt).len(), g.camDist, 0.05f, "kamera hedefe doğru mesafede");
  check(eye.y > tgt.y, "kamera karakterin üstünde");
  const Vec3 fwd = g.camFwd();
  check(fwd.z < -0.5f, "başlangıç kamerası parkura bakıyor");

  // ---------------- determinism / stability ----------------
  printf("\n\033[1mKararlılık\033[0m\n");
  g.reset();
  g.moveX = 0.7f;
  g.moveY = 1.f;
  float maxY = -1e9f, minY = 1e9f;
  for (int i = 0; i < 1800; i++) {
    g.update(1.f / 60.f);
    if (g.player.pos.y > maxY) maxY = g.player.pos.y;
    if (g.player.pos.y < minY) minY = g.player.pos.y;
    if (std::isnan(g.player.pos.x) || std::isnan(g.player.pos.y) ||
        std::isnan(g.player.pos.z)) {
      check(false, "NaN pozisyon");
      break;
    }
  }
  check(true, "30 s simülasyonda NaN yok");
  check(maxY < 30.f && minY > -20.f, "oyuncu dünyada kalıyor",
        "(min=" + std::to_string(minY) + " max=" + std::to_string(maxY) + ")");

  printf("\n\033[1mSonuç\033[0m\n");
  printf("  %d geçti · %d başarısız\n", gPass, gFail);
  if (gFail == 0) printf("\n  \033[32m✓ Çekirdek testleri geçti\033[0m\n\n");
  return gFail == 0 ? 0 : 1;
}
