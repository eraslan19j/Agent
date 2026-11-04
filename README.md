# AETHERION — Yedi Elementin Yankısı

> **Native Android açık dünya aksiyon-RPG.** C++17 + OpenGL ES 3.0 motor, Kotlin + Material 3 arayüz.
> WebView yok, tarayıcı yok: doğrudan APK.

<p align="center">
  <img src="game/src/assets/keyart.jpg" width="780" alt="AETHERION key art" />
</p>

---

## 📦 APK

| Sürüm | Etiket | Dosya | Ne olduğu |
|---|---|---|---|
| **v0.3.0 NATIVE (asıl ürün)** | [`apk-latest`](https://github.com/eraslan19j/Agent/releases/tag/apk-latest) | `Aetherion-Native-0.3.0.apk` | C++/OpenGL motor, Kotlin arayüz |
| v0.2.0 Web (arşiv) | [`apk-web`](https://github.com/eraslan19j/Agent/releases/tag/apk-web) | `Aetherion-0.2.0.apk` | WebView + three.js (eski yol) |

**Kurulum:** APK'yı indir → “bilinmeyen kaynaklara izin ver” → kur → yatay tut. İzin istemez, internet gerekmez.

---

## 🧱 Mimari (v0.3 — native)

```
native/
├── app/src/main/cpp/          # C++17 · NDK · OpenGL ES 3.0
│   ├── m3d.h                  # vektör/matrise, 4x4, gürültü
│   ├── game.h / game.cpp      # simülasyon: arazi, iskelet, animasyon, savaş, düşmanlar, parçacıklar
│   ├── shaders.h              # GLSL ES 3.0 kaynakları
│   ├── render.h / render.cpp  # HDR FBO, gölge haritası, bloom, ton eşleme, çizim
│   └── jni.cpp                # Kotlin ⇄ C++ köprüsü
├── app/src/main/java/.../     # Kotlin · Material 3
│   ├── MainActivity.kt        # menü, karakter seçimi, ayarlar
│   ├── GameSurfaceView.kt     # GLSurfaceView + kamera sürükleme
│   ├── HudView.kt             # dokunmatik HUD (Canvas)
│   └── Engine.kt              # JNI bildirimleri
└── tests/core_test.cpp        # 30 host testi (GL olmadan CPU çekirdeği)
```

**Render hattı:** gölge geçişi (1024², 3×3 PCF) → HDR sahne (RGBA16F; desteklenmezse RGBA8) → bright pass → yatay/dikey blur → composite (bloom + ACES + vinyet + hasar kırmızısı + dither).

**Animasyon:** 21 kemikli iskelet, GPU skinning, 13 durum, durumlar arası ağırlıklı geçiş. Koşu döngüsü kalça salınımı + gövde karşı dönüşü + baş stabilizasyonu ile kurgulandı; saldırılar antisipasyon → vuruş → toparlanma eğrileriyle.

**Neden WebView değil:** senin isteğin doğrultusunda. Native katman, dokunmatik gecikmesini ve kare süresini belirgin biçimde düşürür; grafik hattı üzerinde tam kontrol verir.

---

## 🎮 Kontroller

- **Sol/Sağ joystick** (ayarlardan seçilir): hareket — *ekranın yukarısı her zaman ileri*
- **Boş alanı sürükle:** kamera
- **⚔ saldırı** (3'lü kombo) · **◈ yetenek** · **⇢ kaçınma** (kısa dokunulmazlık) · **⇧ zıpla** (havada tekrar = süzülme)
- **Havadayken ⚔:** iniş saldırısı (4.4 m alan hasarı)
- **Üst sağdaki portreler:** karakter değiştir · **⏸:** duraklat + ayarlar

---

## 🧪 Test

```bash
# C++ çekirdek testleri (GL gerekmez, CI'da koşuyor)
g++ -std=c++17 -O2 -I native/app/src/main/cpp \
    native/app/src/main/cpp/game.cpp native/tests/core_test.cpp -o /tmp/core_test && /tmp/core_test
```

Kapsam: arazi sürekliliği ve sınırları, chunk indeks geçerliliği, iskelet matrislerinin sonluluğu, koşu/saldırı hareketi, zıplama, dash, koşu mesafesi, saldırı isabeti, parçacık üretimi, 30 saniyelik yoğun soak (NaN/zeminden kopma yok).

---

## 🚀 Derleme

**APK (CI):** `.github/workflows/native-apk.yml` — NDK/CMake tespiti → host testleri → `gradle assembleRelease` → `apksigner verify` → APK + `apk-latest` release.

**Yerel derleme** (JDK 17 + Android SDK + NDK 27 gerekir):
```bash
cd native && gradle assembleRelease
# çıktı: native/app/build/outputs/apk/release/app-release.apk
```

**İmza:** `android/keystore/aetherion-dev.jks` (demo anahtarı, parola `aetherion2026`) — sürümler üzerine kurulabilir.

---

## 📚 Dokümanlar

| Doküman | İçerik |
|---|---|
| [`docs/AETHERION_GDD.md`](docs/AETHERION_GDD.md) | Oyun tasarım dokümanı |
| [`docs/TEKNIK_MIMARI.md`](docs/TEKNIK_MIMARI.md) | Web sürümünün mimarisi + native geçiş notları |
| [`docs/ASSET_VE_REPO_KAYNAKLARI.md`](docs/ASSET_VE_REPO_KAYNAKLARI.md) | CC0 asset/repo kaynakları, lisans politikası |
| [`docs/YOL_HARITASI.md`](docs/YOL_HARITASI.md) | Sürüm planı |
| [`CHANGELOG.md`](CHANGELOG.md) | Sürüm notları |

---

## ⚖️ Lisans

Kod bu depoya aittir. Görsel ve ses içeriği tamamen prosedürel (kodla üretilir) — üçüncü taraf oyun varlığı yok. Kütüphaneler: AndroidX, Material Components (Apache-2.0). Genshin Impact veya başka bir yapıma ait hiçbir varlık, ses ya da kod içermez.

---

## 🗺 Sırada (v0.4)

Gerçek glTF karakter modelleri ve iskelet animasyonları · düşman çeşitliliği + boss · envanter/görev arayüzleri · kayıt sistemi (native) · ses motoru (AAudio/Oboe) · kalite kademeleri
