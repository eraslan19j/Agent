// ============================================================
// AETHERION NATIVE — host-side unit tests for the simulation core
// Build:  g++ -std=c++17 -O2 -I app/src/main/cpp app/src/main/cpp/game.cpp tests/core_test.cpp -o /tmp/core_test
// ============================================================
#include <cmath>
#include <cstdio>
#include <string>
#include "game.h"

using namespace ae;

static int gPass = 0, gFail = 0;
static void check(bool cond, const std::string& what, const std::string& detail = "") {
  if (cond) {
    gPass++;
    printf("  \033[32m✓\033[0m %s %s\n", what.c_str(), detail.c_str());
  } else {
    gFail++;
    printf("  \033[31m✗ %s %s\033[0m\n", what.c_str(), detail.c_str());
  }
}
static bool finite(float v) { return std::isfinite(v); }
static std::string f2s(float v) { char b[32]; snprintf(b, sizeof(b), "%.2f", v); return b; }

int main() {
  printf("\n▸ Arazi\n");
  {
    float h1 = Terrain::heightAt(10, 10);
    float h2 = Terrain::heightAt(10.0001f, 10);
    check(std::fabs(h1 - h2) < 0.01f, "Yükseklik sürekli", f2s(h1));
    bool inRange = true;
    float lo = 1e9f, hi = -1e9f;
    for (int i = -100; i <= 100; i++)
      for (int j = -100; j <= 100; j++) {
        float h = Terrain::heightAt(i * 3.1f, j * 3.1f);
        if (!finite(h) || h < -60.f || h > 120.f) inRange = false;
        lo = std::fmin(lo, h);
        hi = std::fmax(hi, h);
      }
    check(inRange, "Yükseklik alanı sınırlar içinde", "min " + f2s(lo) + " / max " + f2s(hi));
    Vec3 n = Terrain::normalAt(40, -20);
    check(std::fabs(n.len() - 1.f) < 0.01f, "Normal birim uzunlukta", f2s(n.len()));
    check(Terrain::heightAt(8, 34) > Terrain::WATER_LEVEL, "Başlangıç noktası karada");
  }

  printf("\n▸ Chunk üretimi\n");
  {
    Chunk c;
    buildChunk(c, 0, 0, 20, 96.f);
    check(c.verts.size() == 21 * 21, "Tepe noktası sayısı", std::to_string(c.verts.size()));
    check(c.idx.size() == 20 * 20 * 6, "İndeks sayısı", std::to_string(c.idx.size()));
    bool okIdx = true;
    for (auto i : c.idx)
      if (i >= c.verts.size()) okIdx = false;
    check(okIdx, "İndeksler aralık içinde");
    bool okNormals = true;
    for (const auto& v : c.verts)
      if (std::fabs(std::sqrt(v.nx * v.nx + v.ny * v.ny + v.nz * v.nz) - 1.f) > 0.02f) okNormals = false;
    check(okNormals, "Tüm normaller normalize");

    std::vector<PropVertex> pv;
    std::vector<uint16_t> pi;
    buildPropGeometry(c.trees, c.rocks, pv, pi);
    check(pv.size() > 0 && pi.size() % 3 == 0, "Prop geometrisi üretildi",
          std::to_string(pv.size()) + " tepe / " + std::to_string(pi.size() / 3) + " üçgen");
  }

  printf("\n▸ İskelet ve animasyon\n");
  {
    CharModel model;
    buildCharacterModel(model);
    check(model.mesh.verts.size() > 1000, "Karakter mesh'i üretildi",
          std::to_string(model.mesh.verts.size()) + " tepe");
    bool jointsOk = true;
    for (const auto& v : model.mesh.verts)
      if (v.j0 >= BONE_COUNT || v.j1 >= BONE_COUNT) jointsOk = false;
    check(jointsOk, "Kemik indeksleri geçerli");

    bool allFinite = true;
    float minY = 1e9f, maxY = -1e9f;
    for (int s = 0; s < A_STATE_COUNT; s++) {
      for (int step = 0; step <= 8; step++) {
        Pose p;
        samplePose((AnimState)s, step / 8.f, 1.f, p);
        Mat4 bones[BONE_COUNT];
        poseToMatrices(model, p, Vec3(0, 0, 0), 0.f, 1.f, bones);
        for (int b = 0; b < BONE_COUNT; b++) {
          for (int k = 0; k < 16; k++)
            if (!finite(bones[b].m[k])) allFinite = false;
          Vec3 j = bones[b].transformPoint(Vec3(0, 0, 0));
          minY = std::fmin(minY, j.y);
          maxY = std::fmax(maxY, j.y);
        }
      }
    }
    check(allFinite, "Tüm pozlarda matrisler sonlu");
    check(minY > -1.2f && maxY < 2.2f, "İskelet makul yükseklikte", f2s(minY) + " .. " + f2s(maxY));

    // run cycle must actually move the legs
    Pose a, b;
    samplePose(A_RUN, 0.25f, 1.f, a);
    samplePose(A_RUN, 0.75f, 1.f, b);
    check(std::fabs(a.rot[B_THIGH_L][0] - b.rot[B_THIGH_L][0]) > 0.4f, "Koşu döngüsü bacakları savuruyor");
    Pose c;
    samplePose(A_ATTACK1, 0.15f, 1.f, a);
    samplePose(A_ATTACK1, 0.38f, 1.f, c);
    check(std::fabs(a.rot[B_ARM_R][2] - c.rot[B_ARM_R][2]) > 0.8f, "Saldırı kolu savuruyor");
  }

  printf("\n▸ Oyun döngüsü\n");
  {
    Game& g = gameInstance();
    g.reset();
    check(g.enemies.size() > 8, "Düşmanlar oluşturuldu", std::to_string(g.enemies.size()));
    check(std::fabs(g.player.pos.y - Terrain::heightAt(g.player.pos.x, g.player.pos.z)) < 0.2f,
          "Oyuncu zeminde başlıyor", f2s(g.player.pos.y));

    // idle stability
    for (int i = 0; i < 120; i++) g.update(1.f / 60.f);
    check(std::fabs(g.player.pos.y - Terrain::heightAt(g.player.pos.x, g.player.pos.z)) < 0.35f,
          "Boşta zeminden ayrılmıyor", f2s(g.player.pos.y));

    // jump leaves the ground
    g.wantJump = true;
    float y0 = g.player.pos.y;
    float peak = y0;
    for (int i = 0; i < 40; i++) {
      g.update(1.f / 60.f);
      peak = std::fmax(peak, g.player.pos.y);
    }
    check(peak - y0 > 0.8f, "Zıplama yükseliyor", f2s(peak - y0) + " m");
    for (int i = 0; i < 120; i++) g.update(1.f / 60.f);
    check(g.grounded || std::fabs(g.player.pos.y - Terrain::heightAt(g.player.pos.x, g.player.pos.z)) < 0.4f,
          "Zıplama sonrası yere dönüyor");

    // running moves forward relative to the camera
    g.moveX = 0.f;
    g.moveY = 1.f;
    Vec3 start = g.player.pos;
    for (int i = 0; i < 120; i++) g.update(1.f / 60.f);
    float travelled = (g.player.pos - start).lenXZ();
    check(travelled > 5.f, "Koşu ilerliyor", f2s(travelled) + " m");
    g.moveY = 0.f;

    // dash bursts forward and grants i-frames
    g.dashCd = 0.f;
    g.stamina = 100.f;
    Vec3 d0 = g.player.pos;
    g.wantDash = true;
    g.moveY = 1.f;
    float topSpeed = 0.f;
    for (int i = 0; i < 20; i++) {
      g.update(1.f / 60.f);
      topSpeed = std::fmax(topSpeed, g.player.vel.lenXZ());
    }
    check(topSpeed > 9.f, "Dash hız kazandırdı", f2s(topSpeed) + " m/s");
    check((g.player.pos - d0).lenXZ() > 1.6f, "Dash mesafe kat etti", f2s((g.player.pos - d0).lenXZ()) + " m");
    g.moveY = 0.f;

    // attack kills a nearby enemy and triggers hit feedback
    Enemy& e = g.enemies[0];
    e.alive = true;
    e.hp = 60.f;
    e.pos = g.player.pos + Vec3(std::sin(g.player.yaw), 0, std::cos(g.player.yaw)) * 1.6f;
    e.pos.y = Terrain::heightAt(e.pos.x, e.pos.z);
    int hitsBefore = g.hitCount;
    g.attackTimer = 0.f;
    g.comboTimer = 0.f;
    g.wantAttack = true;
    for (int i = 0; i < 40; i++) g.update(1.f / 60.f);
    check(g.hitCount > hitsBefore, "Saldırı düşmana isabet etti");
    check(!e.alive || e.hp < 60.f, "Hasar uygulandı", f2s(e.hp));

    // skill damages in an area and spawns particles
    int aliveParticles = 0;
    for (const auto& p : g.particles)
      if (p.alive) aliveParticles++;
    g.wantSkill = true;
    g.attackTimer = 0.f;
    for (int i = 0; i < 20; i++) g.update(1.f / 60.f);
    int afterParticles = 0;
    for (const auto& p : g.particles)
      if (p.alive) afterParticles++;
    check(afterParticles > aliveParticles, "Yetenek parçacık üretti",
          std::to_string(aliveParticles) + " → " + std::to_string(afterParticles));

    // character switching keeps the model valid and tints change
    g.setCharacter(2);
    check(g.character == 2 && g.def().element == EL_ELECTRO, "Karakter değişti", g.def().name);

    // long soak: no NaN and the player stays on the terrain
    bool sane = true;
    for (int i = 0; i < 1800; i++) {
      g.moveX = std::sin(i * 0.02f) * 0.8f;
      g.moveY = 0.9f;
      if (i % 90 == 0) g.wantJump = true;
      if (i % 120 == 0) g.wantAttack = true;
      if (i % 300 == 0) g.wantDash = true;
      if (i % 400 == 0) g.wantSkill = true;
      g.update(1.f / 60.f);
      if (!finite(g.player.pos.x) || !finite(g.player.pos.y) || !finite(g.player.pos.z)) sane = false;
      if (std::fabs(g.player.pos.y - Terrain::heightAt(g.player.pos.x, g.player.pos.z)) > 3.f) sane = false;
      if (!finite(g.camPos.x) || !finite(g.camPos.y)) sane = false;
    }
    check(sane, "30 saniyelik yoğun simülasyonda NaN/zeminden kopma yok",
          "konum " + f2s(g.player.pos.x) + ", " + f2s(g.player.pos.z));
    check(g.timeSeconds > 30.f, "Zaman ilerledi", f2s(g.timeSeconds));
    check(g.dayTime >= 0.f && g.dayTime <= 1.f, "Gündüz döngüsü sınırlarda", f2s(g.dayTime));
  }

  printf("\n──────────────────────────────────────\n");
  printf("  %d geçti · %d başarısız\n", gPass, gFail);
  if (gFail == 0) printf("  \033[32m✓ Çekirdek testleri geçti\033[0m\n\n");
  else printf("  \033[31m✗ Hatalar var\033[0m\n\n");
  return gFail == 0 ? 0 : 1;
}
