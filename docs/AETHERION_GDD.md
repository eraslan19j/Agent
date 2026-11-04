# AETHERION — Oyun Tasarım Dokümanı (GDD)

> **Sürüm:** 0.1.0 “İlk Işık” · **Platform:** Android (yatay, dokunmatik) · **Motor:** Aetherion Engine (WebGL2 / Three.js tabanlı özel motor)
> **Tür:** Açık dünya aksiyon-RPG · **Hedef oynanış süresi (v1.0):** 6–9 saat · **Cihaz hedefi:** 3 GB RAM, Adreno 610 / Mali-G52 ve üzeri

---

## 1. Vizyon

AETHERION, **Genshin Impact türü bir açık dünya aksiyon-RPG'nin mobilde “konsol hissi”** verecek şekilde sıfırdan tasarlanmış, tamamen özgün bir oyundur. Amaç bir kopya değil; türün **keşif → element ustalığı → karakter değiştirme → tepkime zincirleri** çekirdeğini alıp üzerine kendi dünyasını, kendi element felsefesini ve mobil için yeniden düşünülmüş bir kontrol şemasını kurmaktır.

**Tek cümlelik vaat:** “Cebindeki vadide, doğru elementi doğru anda kullanarak bir fırtınayı tek hamlede tersine çevir.”

### 1.1 Tasarım sütunları (her karar bunlara göre verilir)

| # | Sütun | Anlamı | Ölçülebilir karşılığı |
|---|-------|--------|------------------------|
| 1 | **Element ustalığı** | Hasar sadece sayı değil; element sırası ve zamanlama | Tepkime ile en az ×2 DPS; 10 farklı tepkime |
| 2 | **Akışkan hareket** | Tırman, süzül, yüz, koş — dünya engel değil oyun alanı | Hareket kilitlenmesi < 120 ms; stamina kararları |
| 3 | **Dokunmatik zarafet** | Butonlar görünmez hissettirecek kadar iyi yerleşmiş | Başparmak erişim alanı %92 içinde; tuş boyu ≥ 44 px |
| 4 | **Her 20 saniyede bir şey** | Boş yürüyüş yok: sandık, çiçek, düşman, mühür | POI yoğunluğu ≥ 1 / 25 m |
| 5 | **Sessiz lüks** | Arayüz ve ışık dili premium, gürültüsüz | 60 fps hedefi, bloom/gölge opsiyonel, altın+turkuaz palet |

### 1.2 Rakip konumlandırma

| Oyun | Bizden farkı | Biz ne yapıyoruz |
|------|--------------|------------------|
| Genshin Impact | 15+ GB, konsol/PC öncelikli | 8 MB APK, ilk 3 saniyede oynanabilir |
| Tower of Fantasy | Ağır MMO altyapısı | Tek kişilik, çevrimdışı, sıfır sunucu maliyeti |
| Diğer mobil RPG'ler | Statik harita + otomatik savaş | Prosedürel dünya + tam manuel aksiyon |
| Unreal mobil demoları | 2–4 GB, ısınma sorunları | Aynı görsel dil, 1/40 boyut, termal bütçe dostu |

---

## 2. Dünya

### 2.1 Aetheria — Yedigök Vadisi

Dünya, **960 × 960 m** kesintisiz bir alan. Bölge sınırları yapay duvarlarla değil, **doğal yükseltiler, sis ve derin su** ile çizilir. Harita 64 m'lik chunk'lara bölünür ve oyuncunun çevresinde akışkan biçimde yüklenir (bkz. Teknik Mimari §3).

| Bölge | Merkez (x, z) | Yarıçap | Karakter | İçerik |
|-------|---------------|---------|----------|--------|
| Yankı Çayırı | (8, 34) | 130 m | Yumuşak tepeler, yüksek ot, çiçek | Başlangıç, ilk mühür, 2 kamp |
| Gölgeli Orman | (−70, −40) | 120 m | Sık ağaç, loş ışık | 3 kamp, 5 sandık, tuzak noktaları |
| Sisli Kıyı | (−150, 120) | 120 m | Göl + kumsal, sis | Yüzme, kıyı mührü, Taş Muhafız |
| Yüksek Yamaçlar | (110, −90) | 130 m | Dik tırmanışlar | Tırmanma bulmacaları, kristal damarları |
| Zirve | (156, −176) | 90 m | Kar, rüzgâr, geniş görüş | Zirve Mührü, sürüklenme rotası |
| Bekçi Çukuru | (0, −205) | 90 m | Kül, kızıl ışık, çökük arena | Dünya boss'u “Yedigök Bekçisi” |

**Biyomlar:** kumsal · çayır · orman · yayla · kar · kül · su.
**Gün döngüsü:** 1 oyun günü = **15 gerçek dakika**. Güneş/ay yönü, gölge rengi, sis yoğunluğu ve müzik tonu buna bağlıdır.

### 2.2 Keşif ekonomisi

- **Mühür Taşları (3):** etkinleştirince → tam iyileşme + dayanıklılık + hızlı seyahat noktası + doğma noktası.
- **Sandıklar (22):** 4 kademe (Sıradan / Zarif / Değerli / Görkemli). İçerik: Mora, Yankı Kristali, Yankı Çiçeği, Vadi Anahtarı, Yankı Parçası, Yıldız Taşı.
- **Toplanabilirler (46):** Yankı Çiçeği (can), Yankı Kristali (yükseltme). Yaklaşınca otomatik toplanır.
- **Kamp ateşleri (5):** dinlen → tam iyileşme; boss öncesi hazırlık noktası.
- **Düşman kampları (7 + arena):** 75–180 s yeniden doğma; oyuncu 45 m'den uzaktayken doldurulur.

### 2.3 Anlatı çerçevesi

Oyuncu bir **Gözcü**: vadilerin element yankısını duyabilen, mühürleri uyandırabilen son taşıyıcı. Yedigök, yedi elementin aynı anda çatladığı bir yarık; **Gölge**, bu çatlağın boşluğundan sızan bir yankısızlık. Bölüm I, üç mühürden ikisini uyandırma ve Bekçi'yi görme hikâyesidir. Anlatım **çevre + kısa kart metinleri** ile yapılır (tam seslendirme v1.2 hedefi).

---

## 3. Oynanabilir karakterler

Dört karakter, dört farklı **ritim**: hızlı kılıç, ağır kılıç, menzilli büyü, mızrak. Element çeşitliliği, tepkime zinciri kurmayı zorunlu kılar.

| | **KAEL** | **SERA** | **RIN** | **BORA** |
|---|---|---|---|---|
| Element | Anemo (Rüzgâr) | Pyro (Ateş) | Electro (Elektrik) | Cryo (Buz) |
| Silah | Tek el kılıç | Katalizör | Mızrak | Çift el kılıç |
| Rol | Hareketli DPS / toplayıcı | Alan hasarı | Zincir hasarı | Tank / kontrol |
| HP / ATK | 1200 / 62 | 980 / 74 | 1050 / 68 | 1500 / 78 |
| Hız / Menzil | 4.6 / 2.4 m | 4.2 / 8.5 m | 4.8 / 2.9 m | 3.9 / 3.1 m |
| Yetenek (E) | **Yankı Girdabı** — 4.4 m girdap, düşmanı içine çeker, 6.5 s CD | **Yakıcı Lotus** — 5 m yanan alan, 4 s, 7.5 s CD | **Zincir Kıvılcım** — 3 hedefe zincir, 5.5 s CD | **Donmuş Zırh** — 3.8 m donma + %32 can kalkanı, 9 s CD |
| Patlama (Q) | **Fırtına Yemini** — 6.5 m, 6 s kasırga (60 enerji) | **Güneş Alevi** — 7.5 m meteor (70) | **Fırtına Çağrısı** — 6 m elektrik fırtınası (55) | **Kış Uykusu** — 6.8 m kar fırtınası (60) |
| Oynanış hissi | “Vur-kaç, düşmanı topla” | “Alanı hazırla, patlat” | “Zincirle, tepkime kur” | “Öne çık, kilitle, kır” |

**Parti mantığı:** 4 slot, anında geçiş (0.45 s bekleme). Her karakterin kendi canı ve enerjisi var; ölen karakter 3.2 s içinde toparlanır. Geçiş, ekranın solundaki portrelerden veya 1–4 tuşlarından yapılır.

---

## 4. Savaş sistemi

### 4.1 Çekirdek döngü

```
Konumlan → (E) ile elementi uygula → (J) komboyla tetikle → TEPKİME → (Q) ile alanı kilitle → ganimet
```

- **Kombo:** 3 vuruş (×1.00 → ×1.05 → ×1.45). 1.15 s içinde devam etmezsen sıfırlanır. Son vuruşta geri tepme artar.
- **Kritik:** taban %8, seviye başına +%0.4; kritik hasarı %55.
- **Savunma eğrisi:** `1 − DEF / (DEF + 420)`, alt sınır %35 → “duvar” hissi yok.
- **Hit-stop:** 30–140 ms; vuruşun ağırlığını hissettiren en ucuz numara.
- **Kamera sarsıntısı:** hasarla ölçekli, 0.06–0.55; boss vuruşlarında 0.5.
- **Kilitlenme:** görüş konisi ±75°, 14 m; yumuşak yönlendirme (oyuncudan kontrol almaz).

### 4.2 Element tepkime matrisi (tam liste)

| Tepkime | Element çifti | Etki | Hasar |
|---------|---------------|------|-------|
| Buharlaşma | Su + Ateş | Anında patlama | **×2** (su auraya ateş) / ×1.5 (tersi) |
| Erime | Buz + Ateş | Anında patlama | **×2** / ×1.5 |
| Aşırı Yük | Ateş + Elektrik | 4.2 m patlama, savurma | ×1 + 0.9 alan |
| Elektrik Çarpması | Su + Elektrik | 4 s zincir DOT | ×1 + DOT |
| Süper İletken | Buz + Elektrik | 8 s %40 savunma kırma | ×0.9 + 0.4 alan |
| Donma | Su + Buz | 2 s tam kilit | ×0.6 |
| Girdap | Rüzgâr + (Ateş/Su/Elektrik/Buz) | 4.5 m yayılım + çekim | ×0.7 + yayılım |
| Kristalleşme | Toprak + (Ateş/Su/Elektrik/Buz) | Hasarın %40'ı kadar kalkan | ×1 |
| Çiçeklenme | Doğa + Su | Gecikmeli doğa patlaması | ×1 + ×1.4 alan |
| Yanma | Doğa + Ateş | 5 s yanan zemin | DOT |
| Hızlanma | Doğa + Elektrik | 6 s hız bonusu | ×1.25 |

> Uygulanan sürümde 10 tepkime oynanabilir durumda (`src/data/elements.ts` + `EnemyManager.applyHit`).
> **Aura kuralı:** tepkime aurayı tüketir; tepkimesiz vuruş yeni aura bırakır (8 s).

### 4.3 Düşman tasarımı

| Düşman | Model | HP | ATK | Davranış | Not |
|--------|-------|----|-----|----------|-----|
| Gölge Sürüngeni | insansı | 420 | 44 | Melee, 2.0 s atak | Temel gövde |
| Yankı Ateşi | ruh | 280 | 36 | Menzilli mermi (16 m/s) | Pyro aura taşır |
| Buzlu / Kıvılcım Yankısı | balçık | 240 | 30 | Hücum (zıplayarak) | Elementli |
| Taş Muhafız (elit) | golem | 2800 | 86 | Ağır melee + zırh | Geo; kristal düşürür |
| **Yedigök Bekçisi (boss)** | dev | 14000 | 140 | Slam AoE (7.5 m) + mermi | Elektro; 400 s respawn |

**Yapay zekâ:** 7 durumlu makine (`idle → patrol → chase → windup → attack → recover → stagger`), 190 m'de uykuya alınan simülasyon, sürü ayrışması (separation), 0.42–0.8 s “telegraph” (saldırı öncesi parlayan silah + parçacık) → okunabilir savaş.

---

## 5. Hareket ve hayatta kalma

| Eylem | Girdi | Maliyet | Not |
|-------|-------|---------|-----|
| Koşma (sprint) | » / Shift (basılı) | 9.5 stamina/s | ×1.7 hız |
| Zıplama | ⇧ / Space | — | 8.4 m/s dikey |
| **Tırmanma** | Dik yamaca doğru ilerleme | 7.5 stamina/s | 2.3 m/s tırmanış, çıkıntıda otomatik atlama |
| **Sürüklenme** | Havadayken ⇧ | 5.5 stamina/s | −1.9 m/s iniş, 7.4 m/s yatay |
| Yüzme | Suya girme | 4.2 stamina/s | Stamina biterse kıyıya dönüş + %25 can |
| Toparlanma | — | +19 stamina/s (0.6 s sonra) | Hareketsizken |

**Tasarım niyeti:** stamina bir “ceza” değil, **rota kararı** aracıdır. Zirveye tırmanmak için kamp ateşinde dinlenmek gerekir.

---

## 6. İlerleme ve ekonomi

- **Seviye:** 1–60 (v1.0). XP eğrisi `100 × level^1.42`. Seviye başına +105 HP, +6 ATK, +3.2 DEF.
- **Para birimleri:** Mora (yükseltme), Yıldız Taşı (nadir), Yankı Kristali (malzeme), Yankı Parçası (yadigâr).
- **Yükseltme (v0.2):** silah + yetenek seviyesi; kristal harcaması; her seviye +%8 yetenek hasarı.
- **Yadigârlar (v0.3):** 3 slot, rastgele ana statü (ATK% / HP% / Kritik) — Genshin'in “artifact farm” kısır döngüsü **bilinçli olarak yok**; düşen yadigâr doğrudan kalıcı bonus.
- **Denge hedefi:** Bölüm I sonunda oyuncu Sv.8–12 aralığında olmalı; boss 3–5 dakikada, 2–3 ölümle geçilmeli.

---

## 7. Arayüz ve mobil deneyim

### 7.1 Ekran düzeni (yatay, güvenli alan destekli)

```
┌────────────────────────────────────────────────────────────┐
│ [minimap]                                   [saat] [⏸]     │
│  ◈ görev özeti (sağ üst)                                    │
│                                                             │
│                                                             │
│  [1]                          ⟳ etkileşim                   │
│  [2]                                                    ✦ Q │
│  [3]                                                 ◈ E    │
│  [4]                                             ⚔         │
│  KAEL Lv.3 ▮▮▮▮▮        (stamina)      ⇧      »           │
└────────────────────────────────────────────────────────────┘
```

- **Sol alt:** sanal joystick (148 px, ölü bölge %12, kilitlenme yok — parmak nereye basarsa oraya).
- **Sağ yarı:** kamera sürükleme; **sağ alt:** eylem kümesi (saldırı 35 %, yetenek 27 %, patlama 22 %, zıpla 20 %, koş 18 %).
- **Erişilebilirlik:** tüm butonlar ≥ 44 px; sol elli mod (v0.2); hasar sayıları kapatılabilir; FPS sayacı; kamera hassasiyeti 0.4–2.0.
- **Güvenli alan:** `env(safe-area-inset-*)` + çentik kaçınması; 420 px'den kısa ekranlarda görev paneli gizlenir.

### 7.2 Geri bildirim dili

| Olay | Görsel | Ses |
|------|--------|-----|
| Vuruş | Yay izi + kıvılcım + hasar sayısı (kritikte altın) | Filtrelenmiş gürültü + darbe |
| Tepkime | Renkli patlama + “BUHARLAŞMA!” etiketi | Element tonu (yükselen/düşen) |
| Yetenek | Zemin halkası + alan silindiri | Bas notası + gürültü |
| Patlama | Ekran sarsıntısı + FOV kick + hit-stop | 110 Hz düşen sinüs |
| Ganimet | Parçacık + altın toast | İki notalı çan |
| Seviye | Dikey halka + altın patlama | 4 notalı arpej |

> Tüm sesler **runtime'da sentezlenir** (WebAudio): APK'da tek bir ses dosyası yok → lisans riski sıfır, boyut ~0 KB.

---

## 8. Sanat yönü

- **Palet:** gece laciverti `#070B14`, altın `#E8C983`, turkuaz `#6FE8C4`, element renkleri (ateş `#FF6B3D`, su `#4FB8FF`, elektrik `#B98CFF`, buz `#9FE8FF`, toprak `#FFC857`).
- **Biçim dili:** kalın siluet, az poligon, cel-shading (4 kademeli gradient map), yumuşak rim ışığı, yüksek kontrast gölge.
- **Karakterler:** prosedürel rig (kemiksiz, eklem grupları) — 1.75 m boy, ~40 mesh, tek gradient atlası.
- **Tipografi:** Cinzel (başlık, OFL) + Inter (gövde, OFL) — ikisi de APK'ya gömülü, çevrimdışı.
- **VFX dili:** additive parçacık, halka, yay, şimşek; ekranı kirletmeyen düşük opaklık.

---

## 9. Ses

| Katman | Uygulama |
|--------|----------|
| Ortam | Filtrelenmiş pembe gürültü (rüzgâr), hıza göre yoğunluk |
| Müzik | Üretken (generative) pentatonik pad + yankı; çatışmada kök nota düşer, tempo artar |
| SFX | Sentez: kılıç, ağır darbe, element tonları, ganimet, seviye, UI |
| Miks | Compressor → master (0.85), SFX 0.9, müzik 0.4 (varsayılan) |

---

## 10. Görev akışı — Bölüm I: Uyanış

| # | Görev | Hedef(ler) | Ödül |
|---|-------|-----------|------|
| 1 | Uyanış Taşı | Taşa yaklaş → etkinleştir | 300 Mora, 120 XP, 5 Yıldız Taşı |
| 2 | Vadi Temizliği | 5 düşman yen | 420 Mora, 180 XP, 3 Kristal |
| 3 | Kayıp Sandıklar | 3 sandık aç | 500 Mora, 200 XP, 8 Yıldız Taşı |
| 4 | Yankı Çiçeği | 4 çiçek topla | 380 Mora, 160 XP, 3 Çiçek |
| 5 | Taş Muhafız | Elit düşmanı yen | 900 Mora, 380 XP, 12 Yıldız Taşı, 1 Yadigâr |
| 6 | Yedigök'ün Yankısı | Zirveye tırman → mührü uyandır | 1600 Mora, 700 XP, 30 Yıldız Taşı, 1 Öz |

Görev günlüğü (Journal) tüm zinciri, ipuçlarını ve tamamlanma durumunu gösterir. HUD izleyicisi mesafe + minimap işareti verir.

---

## 11. Teknik hedefler (tasarımdan türeyen gereksinimler)

| Gereksinim | Hedef | v0.1 durumu |
|------------|-------|-------------|
| Kare süresi | ≤ 16.6 ms (orta kalite) | ✅ adaptif çözünürlük 0.6–1.0 |
| Soğuk açılış | ≤ 6 s | ✅ ~2–4 s (dünya yüklemesi kademeli) |
| APK boyutu | ≤ 20 MB | ✅ ~10 MB (imzalı) |
| Bellek | ≤ 450 MB | ✅ ~150–250 MB tahmini |
| Pil/termal | 30 dk oyunda < 12 % | ⏳ v0.2'de ölçüm + frame cap |
| Çevrimdışı | %100 | ✅ hiç ağ çağrısı yok |
| İzinler | 0 | ✅ manifest boş |

---

## 12. Kapsam: v0.1'de ne var, ne yok

**Var:** prosedürel dünya + akışkan arazi yükleme, gündüz-gece, 4 karakter, 10 tepkime, 5 düşman tipi + boss, yetenek/patlama, tırmanma/sürüklenme/yüzme, stamina, görev zinciri, sandıklar, mühür taşları, hızlı seyahat, envanter, seviye, kayıt (otomatik), mobil HUD, ayarlar (kalite/bloom/gölge/ses/hassasiyet), kodeks.

**Yok (planlı):** yükseltme sistemi (v0.2), yadigâr slotları (v0.3), ikinci bölge (v0.4), hava olayları (v0.5), NPC diyalogları (v0.6), seslendirme (v1.2), çoklu dil (v0.7), bulut kayıt (v1.0).

Tam sürüm planı: [`YOL_HARITASI.md`](./YOL_HARITASI.md)

---

## 13. Başarı ölçütleri

- **İlk 90 saniye:** oyuncu en az 1 kez tepkime tetikler, 1 sandık açar (onboarding akışı bunu zorunlu kılar).
- **Oturum:** ortalama 11–18 dk; günlük 2+ oturum.
- **Elde tutma:** D1 %35, D7 %12 (demo hedefi).
- **Teknik:** çökme oranı < %0.5, ANR < %0.1, 30 fps altına düşen kare oranı < %3.
- **Hisset:** “butonlar kayboluyor” geri bildirimi — oyuncuların %70'i kontrolleri “doğal” olarak tanımlamalı.
