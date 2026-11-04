# Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada tutulur. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme: [SemVer](https://semver.org/lang/tr/).

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
