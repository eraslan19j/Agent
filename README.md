# AETHERION — Yedi Elementin Yankısı

> **Mobil için sıfırdan yazılmış açık dünya aksiyon-RPG.** Yatay ekran, dokunmatik, çevrimdışı, ~1.5 MB APK.
> Prosedürel Aetheria vadisi · 4 oynanabilir karakter · 10 element tepkimesi · kaçınma, iniş saldırısı, tırmanma, süzülme, yüzme · fizikli nesneler · dinamik hava · görev zinciri · imzalı APK.

<p align="center">
  <img src="game/src/assets/keyart.jpg" width="820" alt="AETHERION key art" />
</p>

---

## 🎮 Hemen oyna

| Yol | Nasıl |
|-----|-------|
| **Android APK (asıl hedef)** | [`apk-latest` release](https://github.com/eraslan19j/Agent/releases/tag/apk-latest) → `Aetherion-0.2.0.apk` indir → “bilinmeyen kaynaklara izin ver” → kur → yatay modda aç |
| **Tarayıcı (anında test)** | `cd game && npm i && npm run dev` → `http://localhost:5173` |
| **Yerel APK derleme** | `cd game && npm run build && cd ../android && gradle assembleRelease` |

> Telefonda en iyi deneyim: Chrome/Safari yerine **APK** (tam ekran, kalıcı kayıt, yüksek performans).

---

## ⌨️ Kontroller

**Dokunmatik (mobil)**
- **Sol alt joystick:** hareket · **Sağ yarı sürükle:** kamera
- **⚔:** saldırı (3'lü kombo) · **◈ (E):** element yeteneği · **✦ (Q):** patlama
- **⇢:** kaçınma (dash, kısa dokunulmazlık) · **havadayken ⚔:** iniş saldırısı
- **⇧:** zıpla (havada tekrar bas = sürüklenme) · **»:** koş (basılı tut)
- **Sol portreler:** karakter değiştir · **✦ Etkileşim:** sandık / mühür / çiçek
- **⏸:** duraklat (ayarlar, envanter, harita, görevler, kodeks)

**Klavye/fare (masaüstü test)**
`WASD` hareket · fare sürükle kamera · `J` saldırı · `E` yetenek · `Q` patlama · `Space` zıpla/süzül · `Shift` koş · `C` kaçınma · `F` etkileşim · `1–4` karakter · `Esc` duraklat · `M` harita

---

## ✨ v0.2 “Ustalık” içeriği

- **Dünya:** 960 × 960 m kesintisiz vadi, 6 biyom, 64 m'lik akışkan chunk'lar, 15 dakikalık gündüz-gece döngüsü, sis, bulutlar, göl + kıyı, prosedürel orman/çim/çiçek
- **Karakterler:** KAEL (Anemo/kılıç), SERA (Pyro/katalizör), RIN (Electro/mızrak), BORA (Cryo/çift el kılıç) — her biri kendi yeteneği ve patlamasıyla
- **Savaş:** 3'lü kombo, kritik, hit-stop, kamera sarsıntısı, hasar sayıları, **10 element tepkimesi** (Buharlaşma, Erime, Aşırı Yük, Elektrik Çarpması, Süper İletken, Donma, Girdap, Kristalleşme, Çiçeklenme, Yanma)
- **Hareket:** koşma, zıplama, **dash/kaçınma**, **tırmanma**, **süzülme**, **yüzme**, dayanıklılık yönetimi
- **Fizik:** ~70 varil/sandık/çömlek/taş blok — itilir, eğimden yuvarlanır, kırılır, ganimet düşürür
- **Hava durumu:** açık → yağmur → fırtına; şimşek, gök gürültüsü, ıslak sis, yağmur shader'ı
- **Düşmanlar:** Gölge Sürüngeni, Yankı Ateşi, elementli balçıklar, **Taş Muhafız** (elit) ve **Yedigök Bekçisi** (boss) — 8 kamp, yeniden doğma
- **Keşif:** 3 mühür taşı (hızlı seyahat), 22 sandık (4 kademe), 46 toplanabilir, 5 kamp ateşi
- **İlerleme:** seviye/XP, envanter, otomatik kayıt, 6 görevlik Bölüm I zinciri
- **Arayüz:** mobil HUD, minimap, görev izleyici, hasar sayıları, ayarlar (kalite/bloom/gölge/ses/hassasiyet/FPS), kodeks, dünya haritası
- **Ses:** tamamı runtime'da sentezlenen SFX + üretken müzik (tek dosya yok)

---

## 🏗 Mimari (kısa)

```
game/ (TypeScript + Three.js + Vite)
├── core/     motor, kamera, girdi, ses, kayıt, olaylar
├── data/     karakterler, elementler, düşmanlar, eşyalar, görevler, dünya
├── world/    arazi (analitik yükseklik), gökyüzü, su, bitki örtüsü, etkileşimli nesneler
├── entities/ oyuncu kontrolcüsü, düşman YZ, prosedürel rig
├── combat/   hasar matematiği (saf fonksiyonlar), tepkimeler
├── fx/       parçacık/VFX motoru
├── systems/  görev yönetmeni, envanter
└── ui/       HUD, minimap, menüler

android/      WebView kabuğu (WebViewAssetLoader) + Gradle + imzalı release
.github/      Android APK workflow (build → test → imzala → release)
docs/         GDD, teknik mimari, asset kaynakları, yol haritası
```

**Motor hakkında:** Unreal Engine bu ortamda derlenemediği için, Unreal'ın verdiği *hissi* hedefleyen özel bir WebGL2 motoru yazıldı: ACES ton eşleme, HDR bloom, adaptif çözünürlük, gölgeler, instancing, analitik arazi çarpışması, hit-stop ve kamera sarsıntısı. Ayrıntı: [`docs/TEKNIK_MIMARI.md`](docs/TEKNIK_MIMARI.md)

**Fizik:** arazi analitik yükseklik fonksiyonudur (mesh ve çarpışma **aynı** fonksiyondan beslenir → zemine düşme hatası imkânsız). Karakter kontrolcüsü ve küçük nesne fiziği (varil/sandık/çömlek) özel yazıldı — harici fizik motoru yok, bu yüzden 1.5 MB'lık APK'da 60 fps hedefleniyor. Büyük ölçekli yıkılabilir yapılar için v0.4'te Rapier (WASM) değerlendirilecek.

---

## 🧪 Test

```bash
cd game
npm run typecheck   # tsc --noEmit
npm test            # 45 mantık testi + 57 kontrollük headless oynanış simülasyonu
```

Headless simülasyon (`tests/sim.ts`) DOM'u taklit eder ve **gerçek sistemleri** çalıştırır: arazi akışı, koşu, zıplama, süzülme, dash, iniş saldırısı, 4 karakterin savaşı, tepkime boru hattı, prop fiziği (itme/yuvarlanma/kırılma), hava durumu geçişleri, sandık/mühür etkileşimi, görev ilerlemesi, düşman ölümü, HUD ve tüm menüler. WebGL çizimi dışında her şey doğrulanır — bu simülasyon v0.2'de "yerinde zıplama çalışmıyor" hatasını yakaladı.

---

## 🚀 Derleme

**Web**
```bash
cd game
npm install
npm run dev        # geliştirme
npm run build      # dist/ üretir
```

**APK (CI — önerilen)**
`.github/workflows/android.yml` her push'ta: tip kontrolü → testler → `vite build` → `gradle assembleRelease` → `apksigner verify` → artifact + `apk-latest` release.

**APK (yerel, Android SDK + JDK 17 gerekir)**
```bash
cd game && npm run build
cd ../android && gradle assembleRelease
# çıktı: android/app/build/outputs/apk/release/app-release.apk
```

**İmza:** `android/keystore/aetherion-dev.jks` (demo anahtarı, parola `aetherion2026`). Her derleme aynı sertifikayla imzalanır → APK'lar üzerine kurulabilir. Yayın öncesi kendi anahtarınızla değiştirin.

---

## 📚 Dokümanlar

| Doküman | İçerik |
|---------|--------|
| [`docs/AETHERION_GDD.md`](docs/AETHERION_GDD.md) | Oyun tasarım dokümanı: vizyon, dünya, karakterler, savaş, ekonomi, UI, KPI |
| [`docs/TEKNIK_MIMARI.md`](docs/TEKNIK_MIMARI.md) | Render hattı, arazi algoritması, fizik, kayıt şeması, Android paketleme, performans bütçesi |
| [`docs/ASSET_VE_REPO_KAYNAKLARI.md`](docs/ASSET_VE_REPO_KAYNAKLARI.md) | Doğrulanmış CC0 asset ve repo kaynakları, entegrasyon planı, lisans politikası |
| [`docs/YOL_HARITASI.md`](docs/YOL_HARITASI.md) | v0.3 → v1.0 sürüm planı |
| [`CHANGELOG.md`](CHANGELOG.md) | Sürüm notları |

---

## ⚖️ Lisans ve telif

- **Kod:** bu depo. **Görsel/ses:** %100 prosedürel (kodla üretilir) — hiçbir üçüncü taraf oyun varlığı kullanılmaz.
- **Kütüphaneler:** three.js (MIT), Vite (MIT), TypeScript (Apache-2.0), androidx.webkit (Apache-2.0), Cinzel & Inter (OFL 1.1).
- **Anahtar görsel & ikon:** bu proje için üretildi.
- Genshin Impact veya başka bir yapıma ait hiçbir varlık, ses, metin ya da kod içermez; yalnızca tür benzerliği vardır.

---

## 🗺 Sonraki adımlar

v0.3 “Yankı”: yükseltme sistemi, yadigâr slotları, ikinci bölge, yeni düşman tipleri, 30 fps enerji modu, sol elli HUD → [`docs/YOL_HARITASI.md`](docs/YOL_HARITASI.md)
