# AETHERION BLOX

Roblox tarzı, mobil (yatay) blok oyunu. **C++17 çekirdek + Kotlin arayüz**, OpenGL ES 2.0.

> [!IMPORTANT]
> Bu depo **sıfırdan** yeniden yazıldı. Önceki deneme (açık dünya RPG motoru, WebView sürümü,
> gölge/HDR/bloom hattı) tamamen kaldırıldı; geçmişi yalnızca git tarihinde duruyor.

## APK

| Paket | Dosya | Not |
| --- | --- | --- |
| `apk-latest` | `Aetherion-Blox-1.0.0.apk` | Her yeşil CI derlemesinde güncellenir |

İndir → "bilinmeyen kaynaklara izin ver" → kur → yatay aç → **OYNA**.

## Oyun

- **Dünya:** çimen platform, 20 altın, merdiven, dar köprü, yüzen adalar, tepe kulesi
- **Karakter:** Roblox tarzı blok avatar (gövde/kol/bacak/kafa + gözler), yürüme ve zıplama animasyonu
- **Fizik:** yerçekimi, zıplama, otomatik basamak çıkma, AABB çarpışma, zıplama pedi
- **Döngü:** tüm altınları topla → süre durur → kazanma ekranı; boşluğa düşersen yeniden doğarsın
- **Kontroller:** sol joystick (itilen yön = gidilen yön), **ZIPLA** butonu, ekranı sürükle = kamera

## Mimari

```
native/
  app/src/main/cpp/
    game.h  game.cpp     # dünya üretimi + fizik (GL içermez → host'ta test edilebilir)
    render.h render.cpp  # OpenGL ES 2.0: tek shader, tek statik dünya tamponu, tek küp tamponu
    jni.cpp              # JNI köprüsü
  app/src/main/java/ai/aetherion/nativeapp/
    Engine.kt            # güvenli JNI sarmalayıcı (yüklenemezse çökmez)
    GameSurfaceView.kt   # GLSurfaceView (ES 2.0, varsayılan EGL yapılandırması)
    HudView.kt           # joystick + ZIPLA butonu (Canvas)
    MainActivity.kt      # menü, HUD, kazanma ekranı
  tests/core_test.cpp    # 29 çekirdek testi
```

**Neden bu kadar basit?** Önceki sürüm FBO, gölge haritası, HDR, bloom ve post-process
kullanıyordu; bu katmanların herhangi biri cihazda patladığında ekran tamamen siyah oluyordu.
Yeni hat doğrudan arka tampona çiziyor:

- 1 shader programı (`#version 100`), 2 attribute
- Statik dünya tek `glDrawArrays` çağrısı
- Karakter ve altınlar tek küp tamponundan matrisle çiziliyor
- Yüzey ışığı vertex rengine **pişirilmiş** (runtime ışık hesabı yok)

## Testler

```bash
cd native
g++ -std=c++17 -O2 -I app/src/main/cpp app/src/main/cpp/game.cpp tests/core_test.cpp -o /tmp/core_test
/tmp/core_test      # 29/29
```

Testler fizik, kontrol eksenleri (joystick sağa → karakter sağa), çarpışma, merdiven,
para toplama, yeniden doğma ve kamera matematiğini kapsar.

## Derleme

APK yalnızca GitHub Actions üzerinde derlenir (`.github/workflows/native-apk.yml`):
host testleri → NDK/CMake → `assembleRelease` → imza doğrulama → `apk-latest` sürümü.

İmza anahtarı: `signing/aetherion-dev.jks` (alias `aetherion`).
Uygulama kimliği `ai.aetherion.game`, versionCode 40, minSdk 24 / target 34 / compile 35.
