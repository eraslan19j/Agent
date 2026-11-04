# AETHERION — Sürüm Yol Haritası

Her sürüm **APK olarak çalışır** durumda teslim edilir; hiçbir sürüm “yarım” bırakılmaz.
Sürüm numarası `android/app/build.gradle` içindeki `versionCode`/`versionName` ile eşleşir ve aynı imza anahtarıyla imzalandığı için **üzerine kurulabilir**.

---

## v0.1 — “İlk Işık” ✅ (teslim edildi)

**Hedef:** Oynanabilir çekirdek döngü + APK.

- [x] Özel WebGL2 motor: ACES ton eşleme, adaptif çözünürlük, opsiyonel HDR bloom
- [x] Analitik arazi + 64 m chunk akışı, 6 biyom, gündüz-gece (15 dk), sis, bulut, su shader'ı
- [x] 4 karakter (Anemo / Pyro / Electro / Cryo), silah çeşitleri, prosedürel rig + animasyon
- [x] Kombo savaş, 10 element tepkimesi, yetenek/patlama, hit-stop, kamera sarsıntısı, hasar sayıları
- [x] 5 düşman tipi + elit + boss, 8 kamp, yeniden doğma
- [x] Koşma/zıplama/tırmanma/sürüklenme/yüzme + stamina yönetimi
- [x] Mühür taşları, 22 sandık, 46 toplanabilir, 5 kamp ateşi, hızlı seyahat
- [x] 6 görevlik Bölüm I zinciri + görev günlüğü
- [x] Envanter, seviye/XP, otomatik kayıt
- [x] Mobil HUD (joystick + eylem kümesi), ayarlar, kodeks, harita ekranı
- [x] Android kabuğu + GitHub Actions ile imzalı APK
- [x] 45 mantık testi + tip kontrolü

---

## v0.2 — “Ustalık” (hedef: 2–3 hafta)

**Tema:** Derinlik — oyuncunun güçlendiğini *hissetmesi*.

- [ ] **Yükseltme sistemi:** silah + yetenek seviyesi (Yankı Kristali, Mora), arayüz ekranı
- [ ] **Yadigâr slotları (2):** ATK% / HP% / Kritik ana statüleri, düşünce otomatik kuşanma
- [ ] **Yetenek varyantları:** basılı tutunca güçlendirilmiş versiyon (Kael: daha büyük girdap)
- [ ] **Rapier fizik:** kırılabilir kayalar, düşen sandıklar, savrulma
- [ ] **30 fps enerji modu** + termal ölçüm ekranı
- [ ] **Sol elli HUD** ve buton yerleşimi özelleştirme
- [ ] Performans: chunk üretimini Web Worker'a taşı (kare düşmesi < 1)

**Kabul kriteri:** 30 dakika kesintisiz oyunda ≥ 50 fps (orta kalite, 3 GB cihaz), çökme yok.

---

## v0.3 — “Zengin Vadi” (3–4 hafta)

- [ ] **Gölgeli Orman bölgesi** genişletmesi + 4 yeni düşman (uçan, kalkanlı, intihar, şaman)
- [ ] **Hava olayları:** yağmur (ıslak aura, Hydro tepkimeleri kolaylaşır), sis, fırtına
- [ ] **Triplanar PBR zemini** (çim/kaya/toprak katmanları) — görsel sıçrama
- [ ] **Müzik derinleşmesi:** 3 bölge teması, çatışma katmanı geçişleri
- [ ] **Erişilebilirlik:** renk körü modu, ekran okuyucu etiketleri, tek elle mod
- [ ] CI: Playwright + WebGL ekran görüntüsü regresyon testi

---

## v0.4 — “Yankılar” (1 ay)

- [ ] **İskeletli glTF karakterler** (KayKit/Quaternius, CC0) — rig arayüzü korunur
- [ ] **NPC + diyalog sistemi** (basit düğüm grafiği, Türkçe metin)
- [ ] **İkinci boss:** “Sis Anası” (Hydro, dalga mekaniği)
- [ ] **Tırmanma 2.0:** çıkıntı yakalama, duvarda zıplama
- [ ] **Fotoğraf modu** (kamera serbest, filtre, paylaş)

---

## v0.5 — “Fırtına” (1 ay)

- [ ] **Bölüm II:** yeni alt bölge (Sisli Kıyı derinlikleri), su altı nefes mekaniği
- [ ] **Element ustalığı ağacı:** her karakter için 3 pasif seçim
- [ ] **Crashlytics benzeri saha telemetrisi** (opsiyonel, KVKK uyumlu, varsayılan kapalı)
- [ ] **Bulut kayıt (opsiyonel)** — cihazdan bağımsız ilerleme

---

## v0.6 — “Ses ve Hikâye” (1 ay)

- [ ] Profesyonel SFX kütüphanesi (CC0) + yeniden miks
- [ ] Türkçe/İngilizce tam metin yerelleştirme (`i18n` sözlüğü, dil seçimi)
- [ ] Ara sahneler (kamera yönetmenliği + diyalog)
- [ ] Başarımlar (achievements) ve istatistik ekranı

---

## v1.0 — “Yedigök” (yayın)

- [ ] 3 bölge, 2 boss, 20+ düşman, 40+ görev
- [ ] 8 karakter (4 yeni element kombinasyonu: Hydro, Geo, Dendro, anemo varyantları)
- [ ] Yayın imzası rotasyonu (Play Console anahtarı), sürüm notları, gizlilik politikası
- [ ] Mağaza görselleri, tanıtım videosu, basın kiti
- [ ] Performans garantisi: 3 GB cihazda 60 fps “orta”, 2 GB cihazda 30 fps “düşük”

---

## Sürüm disiplini

| Kural | Açıklama |
|-------|----------|
| **Her sürüm APK** | CI her push'ta imzalı APK üretir; `apk-latest` release her zaman güncel |
| **Aynı imza** | `android/keystore/aetherion-dev.jks` — üzerine kurulum garantisi |
| **Kayıt uyumu** | `mergeDefaults()` sayesinde eski kayıtlar yeni sürümde çalışır |
| **Test kapısı** | Kırmızı test = sürüm yok |
| **Doküman eşliği** | Her sürümde `docs/` güncellenir ve `CHANGELOG.md`'ye satır eklenir |

---

## Öncelik sırası (ne zaman neye odaklanılır)

1. **Hisset** (kontrol, kamera, vuruş geri bildirimi) — her sürümde iyileştir
2. **Kararlılık** (çökme, bellek, kayıt) — yeni içerikten önce
3. **İçerik** (bölge, düşman, görev)
4. **Görsel parlaklık** (doku, VFX, ışık)
5. **Meta sistemler** (yükseltme, yadigâr, sezon)
