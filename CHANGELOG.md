# Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada tutulur. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme: [SemVer](https://semver.org/lang/tr/).

---

## [0.2.0] — “Ustalık” — 2026-11-04

Hareket ve dünya hissini derinleştiren sürüm: kaçınma, iniş saldırısı, fizikli nesneler ve dinamik hava.

### Eklendi — Savaş
- **Kaçınma (dash):** 0.24 s'lik hız patlaması (tepe ~19 m/s), 0.32 s dokunulmazlık, 1.0 s bekleme, 7 dayanıklılık bedeli. HUD'a ayrı ⇢ butonu, klavyede `C`
- **Havadan iniş saldırısı:** havadayken saldırı → dalış (26 m/s), inişte 4.4 m yarıçapında 2.15× alan hasarı, prop savurma, ekran sarsıntısı ve hit-stop
- Saldırılar, beceriler ve patlamalar artık çevredeki fizikli nesnelere de hasar veriyor

### Eklendi — Fizik
- `world/props.ts`: ~70 adet varil, sandık, çömlek ve taş blok
  - Analitik arazi alanına karşı küre çarpışması, sekme (restitution 0.26), yüzey sürtünmesi
  - Eğim normali boyunca yerçekimi bileşeni → **yuvarlanma** (varil/çömlek daha fazla, taş blok daha az)
  - Oyuncu çarpması itme kuvveti, patlama dalgası itmesi, suda yüzme ve sönümleme
  - Kırılma: parçacık patlaması, halka, Mora/kristal ganimeti
  - Deterministik yerleşim (kamp ve mühür taşları çevresi)

### Eklendi — Atmosfer
- `world/weather.ts`: açık → yağmur → fırtına döngüsü
- 2200 noktalı GPU yağmur (özel shader, kamerayı izleyen kutu), rüzgâr sapması
- Sis yoğunluğu/rengi ve ton eşleme pozlaması hava durumuna göre değişiyor
- Fırtınada şimşek: gökyüzü çakması, dallanan yıldırım VFX'i, gök gürültüsü sesi, kamera sarsıntısı

### Düzeltildi
- **Yerinde zıplama çalışmıyordu:** arazi çözümlemesi tek karelik yükselmeyi (0.14 m) yere geri yapıştırıyordu. Yükselen oyuncu artık asla aşağı sabitlenmiyor
- Beceri bekleme süreleri karakterler arasında paylaşılıyordu → karakter başına ayrıldı
- Kırılan proplarda renk yerine element kimliği geçilmesi (Three.js uyarısı)

### Test
- Simülasyona 17 yeni kontrol: prop itme/oturma/kırılma/ganimet/yuvarlanma, hava durumu geçişleri, dash hızı ve dokunulmazlığı, iniş saldırısı hasarı → **57 kontrol**

---

## [0.1.0] — “İlk Işık” — 2026-11-04

İlk oynanabilir sürüm. Android APK olarak imzalı biçimde dağıtıldı.

### Eklendi — Motor
- Özel WebGL2 motor katmanı: ACES Filmic ton eşleme, gölgeler (PCFSoft), FogExp2, adaptif iç çözünürlük (0.6–1.0), opsiyonel HDR bloom (`EffectComposer` + `UnrealBloomPass` + `OutputPass`)
- Hit-stop (30–140 ms) ve kamera sarsıntısı ile vuruş hissi
- Kalite kademeleri (düşük/orta/yüksek) ve çalışma zamanında değiştirme

### Eklendi — Dünya
- Analitik yükseklik alanı (`heightAt`): mesh üretimi ve çarpışma tek kaynaktan
- 960 × 960 m dünya, 64 m'lik chunk'lar, 3 yarıçapında akışkan yükleme
- 6 biyom + vertex renkleri, eğim/türev tabanlı gölgeleme
- Gökyüzü shader'ı (zenit/ufuk gradyanı, güneş diski, yıldızlar), güneş/ay, bulutlar, 15 dakikalık gündüz-gece döngüsü
- Su yüzeyi shader'ı (dalga, fresnel, güneş parıltısı)
- Instanced bitki örtüsü: ağaçlar, kayalar, çiçekler, oyuncuyu izleyen çim halısı
- Mühür taşları (3), sandıklar (22, 4 kademe), toplanabilirler (46), kamp ateşleri (5)

### Eklendi — Oynanış
- 4 oynanabilir karakter: KAEL (Anemo/kılıç), SERA (Pyro/katalizör), RIN (Electro/mızrak), BORA (Cryo/çift el kılıç)
- Prosedürel karakter rig'i + 12 durumlu animasyon (koşu, saldırı, tırmanma, süzülme, yüzme, ölüm…)
- Kombo sistemi (×1.00 / ×1.05 / ×1.45), kritik, savunma eğrisi
- 10 element tepkimesi + aura zinciri (tepkime tüketimi, 8 s aura ömrü)
- Yetenek (E) ve patlama (Q) sistemleri: girdap, alan hasarı, zincir şimşeği, kalkan, fırtına
- Hareket: koşma, zıplama, tırmanma, sürüklenme, yüzme + dayanıklılık
- Düşmanlar: 5 tip + elit + boss, 7 durumlu YZ, telegraph, mermiler, sürü ayrışması, kamp yeniden doğması
- Görev zinciri (6 görev), seviye/XP, envanter, otomatik kayıt

### Eklendi — Arayüz
- Mobil HUD: sanal joystick, eylem kümesi, sağlık/enerji/dayanıklılık, parti portreleri, görev izleyici, minimap, hasar sayıları, boss barı
- Ekranlar: ana menü, duraklatma, ayarlar, envanter, harita (hızlı seyahat), karakterler, kodeks, görev günlüğü, ölüm ekranı
- Yatay mod kilidi + güvenli alan desteği, sol/sağ el için ölçeklenebilir butonlar

### Eklendi — Ses
- WebAudio sentez motoru: kılıç, darbe, element tonları, ganimet, seviye, UI
- Üretken ambient müzik + rüzgâr katmanı (çatışmada gerilim artışı)

### Eklendi — Platform
- Android WebView kabuğu: `WebViewAssetLoader` (https origin), immersive tam ekran, ekran açık tutma, geri tuşu → duraklat, dikey/yatay değişiminde yeniden yükleme yok
- İzinsiz manifest (ağ/konum/depolama izni yok)
- GitHub Actions: tip kontrolü → testler → `vite build` → `gradle assembleRelease` → `apksigner verify` → artifact + `apk-latest` release
- Sabit demo imza anahtarı (üzerine kurulabilir sürümler)

### Test
- 45 mantık testi (tepkimeler, hasar, arazi determinizmi, ganimet, XP, performans eşikleri)
- 40 kontrollük headless oynanış simülasyonu (DOM taklidi ile gerçek sistemler)

### Düzeltildi
- `Enemy.applyElement` içinde doğuştan gelen element tepkimesi `null` döndüğünde çökme
- Beceri bekleme süreleri karakterler arasında paylaşılıyordu → karakter başına ayrıldı
- Ana menü butonlarının HUD girdi dinleyicileriyle çakışması
- Düşman vurulduğunda paylaşılan materyalin değiştirilmesi (tüm aynı tip düşmanlar parlıyordu) → materyal takası
- Ölüm durumunda simülasyonun donması (yeniden doğma çalışmıyordu)

### Bilinen sınırlar
- Dinamik nesne fiziği yok (v0.2: Rapier)
- Tek bölge (Bölüm I), 4 karakter (v1.0: 3 bölge, 8 karakter)
- Çoklu dil yok (Türkçe)
- Görsel regresyon testi yok (v0.3: Playwright)
