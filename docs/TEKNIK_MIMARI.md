# AETHERION — Teknik Mimari Dokümanı

> Aetherion Engine v0.1.0 · WebGL2 (Three.js r169) · TypeScript 5.6 · Vite 5 · Android WebView kabuğu
> Bu doküman **uygulanmış** mimariyi anlatır; hedefler ayrı bölümde işaretlenmiştir.

---

## 1. Neden Unreal değil, “Unreal hissi”?

Projenin hedefi Unreal Engine kalitesinde bir **oyun hissi**; ancak Unreal'ın mobil çıktısı tipik olarak 1.5–4 GB APK, 90 °C cihaz sıcaklığı ve 8–12 saniye açılış demek. Bu projede bilinçli olarak şu takas yapıldı:

| Unreal'ın verdiği | Bizim çözümümüz | Sonuç |
|-------------------|------------------|-------|
| Nanite/Lumen | Statik vertex-color arazi + basitleştirilmiş PBR/cel + seçmeli bloom | 8 MB APK |
| Blueprint görsel script | TypeScript veri odaklı sistemler (`data/*.ts`) | Dizayn değişikliği = tek dosya |
| NavMesh + AIPerception | Prosedürel durum makinesi + koni/yarıçap sorguları | 0 ek bağımlılık |
| Chaos fizik | Analitik yükseklik alanı + özel karakter kontrolcüsü | Deterministik, ucuz |
| Sequencer | Prosedürel animasyon (kemiksiz rig) | 0 animasyon dosyası |
| Paketleme | Vite → WebViewAssetLoader | Tek komut derleme |

Anahtar fikir: **arazi analitik bir fonksiyondur**. `heightAt(x, z)` hem mesh üretiminde hem çarpışmada kullanılır — bu yüzden “zeminin içine düşme” hatası yapısal olarak imkânsızdır.

---

## 2. Katman haritası

```
game/src
├── main.ts                  # giriş, hata yakalama, yönlendirme kilidi, tam ekran
├── game.ts                  # orkestrasyon: boot, mod, döngü, olay bağlama
├── style.css                # HUD/menü tasarım sistemi (tam ekran, safe-area)
├── core/
│   ├── engine.ts            # renderer, kalite kademeleri, adaptif çözünürlük, hit-stop, bloom
│   ├── camera.ts            # 3. şahıs yörünge kamera, arazi kaçınma, kilitlenme
│   ├── input.ts             # klavye + dokunma soyutlaması, eylem tamponu (280 ms)
│   ├── audio.ts             # WebAudio sentez motoru (SFX + üretken müzik)
│   ├── save.ts              # localStorage kayıt, şema birleştirme, migrasyon
│   ├── events.ts            # tipli olay veriyolu
│   └── utils.ts             # matematik, gürültü, PRNG, havuz
├── data/                    # saf veri (oyun tasarımının tek kaynağı)
│   ├── characters.ts  elements.ts  enemies.ts  items.ts  quests.ts  world.ts
├── world/
│   ├── terrain.ts           # analitik yükseklik + chunk akışı + biyom/renk
│   ├── scatter.ts           # instanced bitki/taş/çiçek/çim
│   ├── sky.ts               # gökyüzü shader'ı, güneş/ay, yıldız, bulut, gündüz-gece
│   ├── water.ts             # dalga shader'ı, fresnel, güneş parıltısı
│   └── worldobjects.ts      # sandık, mühür, toplanabilir, kamp ateşi
├── entities/
│   ├── player.ts            # hareket, tırmanma, süzülme, savaş, parti, seviye
│   ├── enemy.ts             # düşman + YZ + hasar boru hattı + mermiler
│   └── rig.ts               # prosedürel karakter/yaratık rig'i + animasyon
├── combat/combat.ts         # hasar formülleri (saf fonksiyonlar)
├── fx/effects.ts            # parçacık/halka/yay/şimşek VFX
├── systems/
│   ├── quests.ts            # görev yönetmeni + HUD izleyici verisi
│   └── inventory.ts         # envanter/ödül
└── ui/
    ├── hud.ts               # joystick, butonlar, barlar, hasar sayıları
    ├── minimap.ts           # 2D harita üretimi (yükseklik → piksel)
    └── screens.ts           # menü, ayarlar, envanter, harita, parti, kodeks, günlük
```

**Kural:** `data/` ve `combat/` DOM/THREE'ye bağlı değildir → Node'da test edilebilir (`tests/run.ts`, 45 test).

---

## 3. Render hattı

### 3.1 Boru hattı

```
Sahne (PBR/cel)
   ↓ gölge (PCFSoft, 46 m ortografik, güneş oyuncuyu takip eder)
   ↓ fog (FogExp2, gece yoğunlaşır)
   ↓ [opsiyonel] HDR render target (HalfFloat)
   ↓ UnrealBloom (0.62 / 0.6 / 0.82)
   ↓ OutputPass (ACES Filmic → sRGB)
Ekran (dpr × renderScale)
```

- **Ton eşleme:** ACES Filmic, pozlama 1.06.
- **Renk yönetimi:** `SRGBColorSpace` çıkış, `ColorManagement` açık.
- **Kalite kademeleri:**

| | Düşük | Orta | Yüksek |
|---|-------|------|--------|
| Piksel oranı | 1.0 | 1.35 | 2.0 (cihaz) |
| Gölge haritası | kapalı | 1024² | 2048² |
| Bloom | kapalı | 0.4 güç | 0.62 |
| Çim yoğunluğu | %35 | %70 | %100 |
| Chunk görüş | 3 | 3 | 3 |

- **Adaptif çözünürlük:** 1.2 s'lik pencerede ortalama kare süresi > 26 ms ise iç çözünürlük 0.12 adım düşer (min 0.6); < 15 ms ise toparlanır. Bu, 60 fps'i “kırpmak yerine kaliteden ödün vererek” korur.
- **Hit-stop:** `Engine.tick()` zaman ölçeğini 0.06'ya indirir; fizik ve animasyon aynı saatten beslenir.

### 3.2 Arazi (Terrain)

**Yükseklik fonksiyonu** (deterministik, seed 20261104):

```
h = 4.5 + fbm4(x/330, z/330) * 25
  + sin(x*0.0041 + fbm2*3.4) * 3.0            // geniş dalgalar
  + ridge4(x*0.0052, z*0.0052) * 66 * mask²   // zirve sırtı (152, −182)
  + ridge3(x*0.011) * 9 * mask
  − (1 − lakeDist²) * 34                      // göl havzası (−140, 130)
  − (1 − craterDist²) * 9                     // boss çukuru (0, −205)
  + fbm2(fine) * 1.35
mask = exp(−(normalizedDistance)² * 1.5)
```

- **Düzleştirme:** mühür taşları, başlangıç, arena gibi oyun alanları `smoothstep` ile plato hâline getirilir (yükseklik önce hesaplanır, sonra harmanlanır).
- **Chunk:** 64 m, 26×26 segment (≈ 1.35 m vertex aralığı), 3 yarıçapında akış (49 chunk görünür).
- **Üretim maliyeti:** tek geçişte yükseklik önbelleği → 1 noise/vertex; ölçülen ~4.8 ms/chunk (Node, masaüstü CPU). Kare başına **1 chunk** bütçesi ile 60 fps korunur; ilk yükleme boot ekranında 40 turda tamamlanır.
- **Renk:** biyom + eğim karışımı + düşük frekans parlaklık; tepe ışığı (`computeVertexNormals`) ile yumuşak gölgeleme. Doku dosyası yok → bellek dostu.

### 3.3 Gökyüzü ve su

- **Gökyüzü:** BackSide küre + özel shader (zenit/ufuk gradyanı, güneş diski + iki halka parıltısı, ufuk pusu, prosedürel yıldızlar). Güneş yönü `sin((t−0.25)·2π)` ile 15 dakikalık gün döngüsüne bağlı.
- **Işık:** DirectionalLight (güneş) + HemisphereLight + AmbientLight; renkler gün fazına göre lerp; gölge kamerası oyuncuyu takip eder (46 m kutu).
- **Bulutlar:** 11 sprite, canvas ile üretilen yumuşak bulut dokusu, rüzgârla sürüklenir, oyuncu etrafında sarılır.
- **Su:** 1400 m düzlem, vertex'te 3 sinüs dalgası + fragment'te fresnel, güneş specular'ı, gece koyulaşması. Şeffaf, kamera merkezli 100 m'lik adımlarla kaydırılır.

### 3.4 Bitki örtüsü (Scatter)

Tamamı `InstancedMesh` → **6 çizim çağrısı**:

| Tür | Kapasite | Not |
|-----|----------|-----|
| Gövde | 360 | silindir, chunk başına 10 örnek |
| Yaprak konisi ×2 | 720 + 720 | HSL ile renk çeşitliliği |
| Kaya | 260 | dodecahedron |
| Çiçek | 320 | emissive oktayder |
| Çim | 2100 | oyuncu etrafında 30 m yarıçap, 22 m'de bir yeniden kurulur |

Yerleşim chunk başına deterministik PRNG (`chunkRng(cx, cz)`) → aynı dünyada her zaman aynı orman.

---

## 4. Fizik ve hareket

- **Çarpışma modeli:** analitik yükseklik alanı + eğim gradyanı. Ek rigid body yok (v0.1); nesne çarpışması gerektirmeyen bir dünya tasarlandı.
- **Karakter:** yarıçap 0.35 / boy 1.7 varsayımıyla nokta-benzeri kontrol; yer çözünürlüğü `y = max(y, heightAt(x,z))`.
- **Eğim:** `slopeAt` 0..1; > 0.63 ve ileri girdi → tırmanma modu. Çıkıntı tespiti `heightAt(ileri)` karşılaştırması ile “vault”.
- **Yerçekimi:** −26 m/s², terminal −55; zıplama 8.4 (≈ 1.35 m).
- **Süzülme:** −1.9 m/s sabit iniş, 7.4 m/s yatay; stamina biterse düşer.
- **Su:** yükseklik su seviyesinin altında ve oyuncu su yüzeyine yakın → yüzme; stamina 0 → kıyıya teleport + %25 can.
- **Düşmanlar:** yükseklik alanına yapışır, sürü ayrışması (separation) uygular, 190 m'de simülasyondan çıkar.

> **v0.2 hedefi:** `@dimforge/rapier3d-compat` (Rust/WASM, 600 KB) ile sandık/kaya parçalanması ve düşen cisimler; karakter kontrolcüsü analitik kalır (deterministik ağ için).

---

## 5. Savaş boru hattı

```
Player.performHit()
   └→ EnemyManager.inCone/inRadius  (konum sorgusu)
        └→ EnemyManager.applyHit()
             ├→ Enemy.applyElement()      → resolveReaction(aura, element)
             ├→ computeDamage()           → ATK × güç × kritik × tepkime × DEF eğrisi
             ├→ Enemy.takeDamage()        → kalkan, stagger, geri tepme, ölüm
             ├→ damageNumber() + hitStop + shake + VFX + audio
             ├→ tepkime yan etkileri: AoE, DOT, stun, DEF kırma, kalkan, yayılım
             └→ ölüm → events.emit('enemy:killed') → XP/Mora/görev
```

**Tasarım kuralı:** hasar matematiği `combat.ts` içinde **saf fonksiyon**; hiçbir yan etkisi yok. Bu sayede denge 45 birim testle doğrulanabilir.

### 5.1 Durum makineleri

- **Oyuncu:** `idle/run/sprint/jump/fall/glide/climb/swim/attack/skill/burst/hurt/dead` → `Player.resolveAnimState()`.
- **Düşman:** `idle→patrol→chase→windup→attack→recover`, `stagger`, `dead`. Her saldırı öncesi **telegraph** (0.42–0.8 s parlayan silah + parçacık) → mobilde okunabilirlik.

### 5.2 Animasyon

Kemik yok; **eklem grupları** (hips, torso, head, armL/R, legL/R, hairPivot, cape) matematiksel olarak sürülür:

- koşu: `sin(t·f)·amp` bacak/kol karşı fazı, gövde eğimi
- saldırı: 3 fazlı zaman çizelgesi (windup → strike 0.28–0.55 → recover)
- süzülme/tırmanma/yüzme: hedef pozlar, `damp()` ile yumuşatma
- pelerin ve saç: ikincil hareket (inertia)

Bu yaklaşım APK'ya **hiç animasyon dosyası koymaz** ve tüm karakterlerde tutarlı stil sağlar. (v0.4: iskeletli glTF + AnimationMixer hibrit destek.)

---

## 6. Veri ve kayıt

**Kayıt şeması** (`AETH_VERSION = 1`, `localStorage["aetherion.save.v1"]`):

```
player  { level, xp, xpNext, mora, primogems, hp, atk, def, critRate, critDmg, position, respawn }
party[] { id, level, xp, hp, talentLv }
activeChar, waypoints[], chests[], collectibles{}, collectiblesTaken[], quests{}, stats{}, settings{}, world{time}
```

- **Migrasyon:** `mergeDefaults(newSave(), parsed)` → eksik alanlar varsayılanla doldurulur; ileri sürümlerde alan eklemek güvenlidir.
- **Yazma:** 4 saniyede bir “dirty” temizliği + `pagehide`/`onPause` anında zorunlu `flush()` (Android tarafında `evaluateJavascript` ile).
- **Hata toleransı:** localStorage yoksa (`available=false`) oyun çalışır, kayıt sessizce devre dışı kalır.

---

## 7. Platform: Android

### 7.1 Neden WebView?

- Tek kod tabanı, **iOS/PC/masaüstü tarayıcı** dahil her yerde aynı oyun.
- APK içinde native oyun motoru yok → Play Store 150 MB limiti sorunu yok.
- WebGL2 + WASM erişimi var; `WebViewAssetLoader` sayesinde gerçek `https://` origin'i (ES modülleri, `localStorage`, ileride Service Worker).

### 7.2 APK kabuğu (`android/`)

| Dosya | Görev |
|-------|-------|
| `MainActivity.java` | WebView kurulumu, immersive tam ekran, AssetLoader, geri tuşu → oyun içi duraklat, `FLAG_KEEP_SCREEN_ON` |
| `AndroidManifest.xml` | `sensorLandscape`, `configChanges` (döndürmede yeniden yükleme yok), GLES 3.0 zorunlu, **izin yok** |
| `res/values/themes.xml` | Açılışta beyaz flaş yok (koyu `windowBackground`), çentik desteği (v27) |
| `mipmap-*` | 6 yoğunlukta ikon + adaptive icon (API 26+) |
| `app/build.gradle` | `copyWebAssets` görevi `game/dist` → `assets/www`; imzalı release |

**Güvenlik:** `allowFileAccess=false`, `mixedContent=NEVER`, harici navigasyon engelli, hata ayıklama WebView kapalı (release).
**İzin listesi:** yok. Ağ yok, konum yok, depolama yok.

### 7.3 Derleme hattı (GitHub Actions)

`.github/workflows/android.yml`

```
push (arena/**, main) veya manuel
 ├─ setup-node 20 + npm ci
 ├─ tsc --noEmit            (tip güvenliği)
 ├─ npm test                (45 mantık testi)
 ├─ vite build              → game/dist (~1.1 MB)
 ├─ setup-java 17 + gradle 8.9
 ├─ SDK hazırlığı (platform 35, build-tools 35)
 ├─ gradle assembleRelease  → imzalı APK
 ├─ apksigner verify        (imza doğrulama)
 └─ artifact + "apk-latest" release
```

**İmza:** `android/keystore/aetherion-dev.jks` (demo anahtarı, bilinçli olarak depoda). Böylece her derleme **aynı sertifika** ile imzalanır ve kullanıcı APK'yı üzerine kurabilir. Gerçek yayın öncesi bu anahtar Play Console anahtarıyla değiştirilmelidir (bkz. Yol Haritası §Güvenlik).

---

## 8. Performans bütçesi (v0.1 hedefi / ölçüm)

| Ölçüt | Hedef | Nasıl |
|-------|-------|-------|
| Çizim çağrısı | < 90 | 6 (scatter) + 49 (chunk) + ~40 (aktör) + VFX |
| Üçgen | < 220 K | chunk 26² ×2 × 49 ≈ 66 K + bitki/aktör |
| Kare CPU | < 8 ms | güncelleme döngüsü (ölçüldü: ~3–5 ms masaüstü) |
| Bellek | < 450 MB | doku yok, geometri yeniden kullanımı |
| Açılış | < 6 s | chunk bütçesi + hızlı boot |
| APK | < 20 MB | ölçüldü: ~10 MB |

**Bilinen darboğazlar ve çözümleri**
1. *Chunk üretimi* → 1 chunk/kare + önbellekli yükseklik; ileride Web Worker'a taşınacak.
2. *Çim yeniden kurulumu* → 22 m eşik + yarıçap 30 m (görsel süreklilik/performans dengesi).
3. *DOM güncellemeleri* → değişmezse yazma yok, ağır `innerHTML` 200 ms'de bir.
4. *Bloom* → mobilde varsayılan kapalı, kullanıcı açar.

---

## 9. Test stratejisi

| Katman | Araç | Kapsam |
|--------|------|--------|
| Mantık | `tests/run.ts` (Node) | tepkimeler, aura, hasar, DEF eğrisi, arazi determinizmi, ganimet, XP eğrisi, performans eşikleri (45 test) |
| Tip | `tsc --noEmit` | tüm kod tabanı |
| Paket | `vite build` + boyut kontrolü | yol göreli (`base: './'`) |
| Cihaz | Manuel QA matrisi | 3 cihaz sınıfı × 2 Android sürümü |
| CI | GitHub Actions | her push'ta yukarıdakiler + APK imza doğrulaması |

**v0.2 eklenecek:** Playwright + WebGL screenshot diff (görsel regresyon), Android emulator smoke test (`adb install` + logcat “FATAL” taraması).

---

## 10. Riskler ve azaltma

| Risk | Etki | Azaltma |
|------|------|---------|
| WebGL2 desteklemeyen cihaz | Oyun açılmaz | Manifest `glEsVersion 3.0` + açılışta hata ekranı (Türkçe mesaj) |
| Düşük RAM'li cihazda WebView çökmesi | Oturum kaybı | `largeHeap`, otomatik kayıt, 4 s'de bir flush |
| Termal throttling | fps düşüşü | adaptif çözünürlük + kalite kademeleri + 30 fps hedef modu (v0.2) |
| Shader derleme hatası | siyah ekran | 2 shader (sky/water), basit GLSL; hata yakalayıcı DOM overlay |
| Ses otomatik oynatma engeli | sessiz oyun | AudioContext ilk dokunuşta başlatılır |
| Dev imza anahtarının sızması | sahte güncelleme | Yayın öncesi anahtar rotasyonu (v1.0 kapısı) |

---

## 11. Genişleme noktaları

1. **Yeni karakter:** `data/characters.ts`'e bir kayıt + `PARTY_ORDER` güncellemesi. Rig otomatik üretilir.
2. **Yeni düşman:** `data/enemies.ts` + model tipi (`humanoid/blob/golem/spirit/boss`) — YZ davranışı hazır.
3. **Yeni element:** `elements.ts` + tepkime matrisi satırı; görsel/ses renkleri otomatik.
4. **Yeni bölge:** `data/world.ts`'e landmark + `terrain.rawHeight`'a biyom katkısı.
5. **Gerçek 3D model:** `entities/rig.ts` içindeki `buildCharacterRig()` yerine glTF yükleyici (bkz. `ASSET_VE_REPO_KAYNAKLARI.md`).
6. **Çok oyunculu:** `game.ts` döngüsü 30 Hz sabit adıma alınmalı; `enemy.ts` durumları serileştirilebilir (v1.x araştırma).

---

## 13. Fizikli Nesneler (v0.2)

Harici fizik motoru kullanılmıyor; `world/props.ts` içinde **küre–yükseklik alanı** çarpışmasına dayanan hafif bir gövde simülasyonu var.

| Kavram | Uygulama |
|--------|----------|
| Gövde | Yarıçap + kütle + hp; konum/hız `Vector3`, görsel `Group` |
| Çarpışma | `terrain.heightAt` ile destek yüksekliği, `terrain.normalAt` ile yüzey normali |
| Sekme | Normal bileşeni `-vn * (1 + 0.26)` ile yansıtılır, teğetsel hız %82 sürtünme |
| Yuvarlanma | Eğim varsa yerçekiminin teğet bileşeni eklenir (varil/çömlek 1.0, taş 0.55, sandık 0.3) |
| Görsel dönüş | Hız vektörüne dik eksende `rotateOnWorldAxis(hız/yarıçap · dt)` |
| Uyku | Hız < 0.32 m/s → gövde dinlenmeye alınır, simülasyon maliyeti sıfırlanır |
| Oyuncu itmesi | Oyuncu yarıçapı içine girerse gövde dışarı itilir + hız aktarılır |
| Patlama | `push(pos, radius, güç)` düşüş (falloff) ile radyal itme |
| Kırılma | hp ≤ 0 → mesh kaldırılır, parçacık + halka, Mora/kristal ganimeti |

Maliyet: ~70 gövde, çoğu uykuda; kare başına < 0.2 ms.

## 14. Hava Durumu

`world/weather.ts` üç durumlu bir makine: `clear → rain → storm`. Yoğunluk üstel yumuşatma ile geçer (yaklaşık 8 s).

- **Yağmur:** 2200 noktalı `Points`, özel shader ile dikey çizgi; kamerayı izleyen 46 m'lik kutu içinde sarılır, rüzgâr sapması fırtınada 6.5 m/s.
- **Sis:** `FogExp2` yoğunluğu 1 + 1.35 × yoğunluk, rengi `CLEAR (#b6d3ea) → RAIN (#8d9aa8) → STORM (#5f6a78)` arasında karışır.
- **Pozlama:** fırtınada −0.10, şimşek çakmasında +0.55 (ACES ton eşleme).
- **Şimşek:** 2.4–7.4 s aralıklı; dallanan yıldırım VFX'i, gök gürültüsü (filtreli gürültü + 58 Hz sinüs), 0.18 kamera sarsıntısı.
