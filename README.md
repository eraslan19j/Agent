# My Vision — Yerel Fotoğraf Stüdyosu

My Vision; görünümler, hassas fotoğraf ayarları, kadraj, düzenlenebilir metin, kolaj ve toplu işlem araçlarını birleştiren ücretsiz, mobil öncelikli bir fotoğraf uygulamasıdır. React + TypeScript arayüzü Capacitor ile Android uygulamasına paketlenir. Fotoğraflar ve projeler cihazda işlenir; hesap, ödeme veya bulut servisi gerekmez.

## Özellikler

- **Görünümler ve görüntü işleme:** Pozlama, parlaklık, kontrast, doygunluk, sıcaklık, ton eğrileri, HSL, seçici maskeler, netlik ve film greni
- **Kadraj:** Oranlı/serbest kırpma, döndürme, perspektif ve aynalama
- **Düzenlenebilir metin:** İçerik, konum, boyut, renk, yazı tipi, hizalama ve döndürme; uzun metinlerde güvenli satır kaydırma
- **Çalışma geçmişi:** Geri al, yinele, önce/sonra ve sıfırlama
- **Yerel projeler:** IndexedDB içinde ayrı medya Blob’ları ve proje metadata’sı; arama, filtreleme, favori, albüm ve etiketler
- **Güvenli eski veri aktarımı:** localStorage kaydı IndexedDB’ye yazılıp tekrar okunarak doğrulanmadan eski kayıt silinmez
- **Stüdyo:** Gerçek çok fotoğraflı kolaj ve ortak ayarlarla toplu dışa aktarma
- **Dışa aktarma:** JPG/PNG, kalite ve 1080/2048/4096 px seçenekleri; Android’de Documents/My Vision
- **Sade sistem tasarımı:** Sistem fontu, nötr zeminler, mavi vurgu, açık/koyu/sistem teması, en az 44 px dokunma hedefleri
- **Gizlilik:** Cihaz içi işleme, reklam takipçisi yok, zorunlu ağ servisi yok

## Hızlı başlangıç

Node.js 22 önerilir.

```bash
npm ci
npm run dev
```

### Kontroller

```bash
npm run test         # Birim ve migrasyon testleri
npm run lint         # ESLint
npm run build        # FFmpeg varlıkları + TypeScript + production build + boyut/hash kontrolü
npm run test:ffmpeg  # Gerçek Chromium Worker, WebM→MP4 ve playback testi
```

FFmpeg yalnızca gelecekteki video işlem hattının teknik doğrulamasıdır; bu sürümde video editörü arayüzü yoktur. Tek iş parçacıklı çekirdek Brotli ile yaklaşık 6,94 MiB’a indirilir. Statik sunucu `.wasm.br` dosyasını `Content-Encoding: br` ve `Content-Type: application/wasm` başlıklarıyla sunmalıdır; örnek kurallar `public/_headers` içindedir.

## Android

**Kurulabilir test paketi:** [My Vision v1.4.0 debug APK](https://github.com/eraslan19j/Agent/releases/download/my-vision-v1.4.0-debug/My-Vision-1.4.0-debug.apk)

Yerel derleme gereksinimleri: JDK 21, Android Studio ve Android SDK 36.

```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```

Debug paketi cihaz sınaması içindir. Play Store için imzalı AAB gerekir; ayrıntılar **[docs/PLAY_STORE.md](docs/PLAY_STORE.md)** içindedir.

## Proje yapısı

```text
src/
  components/       Ana sayfa, projeler, profil, fotoğraf editörü ve stüdyo
  data/             Görünüm tanımları
  lib/              Görüntü motoru, IndexedDB, indirme ve teknik video doğrulaması
  types/            Ortak TypeScript tipleri
android/            Native Capacitor Android projesi
public/
  ffmpeg/           Sıkıştırılmış çekirdek, manifest ve lisanslar
  privacy*.html     Gizlilik politikaları
  terms*.html       Kullanım koşulları
qa/                 Ayrı FFmpeg browser smoke sayfası
scripts/            Varlık üretimi ve teknik doğrulama
resources/          İkon ve splash kaynakları
store/              Mağaza görselleri ve ekran görüntüleri
```

## Veri ve görüntü motoru

`src/lib/storage.ts` medya Blob’unu ve proje metadata’sını IndexedDB’de ayrı saklar. Eski localStorage projeleri desteklenen düzenlemeler korunarak aktarılır; kaldırılan özelliklere ait eski alanlar atılır. Aktarımın tamamı doğrulanamazsa eski kayıt korunur.

`src/lib/imageEngine.ts` ve `advancedImageEngine.ts` önizleme ile Canvas çıktısını aynı ayar modelinden üretir. Orijinal dosya değiştirilmez. Çıktı; kırpılmış/döndürülmüş boyutları korur ve seçilen maksimum kenara ölçeklenir.

## Yayından önce

- `com.myvision.studio` paket sahipliğini doğrulayın.
- Gizlilik ve koşul sayfalarını herkese açık HTTPS adresinde yayınlayın.
- Gerçek Android cihazlarda kamera, galeri, kayıt, JPG/PNG çıktı ve paylaşımı test edin.
- Mağaza metinlerini ve ekran görüntülerini güncel sürümle eşleştirin.
- `versionCode` değerini artırın ve imzalama anahtarını güvenli biçimde yönetin.

Ayrıntılar: [Play Store rehberi](docs/PLAY_STORE.md) · [Türkçe mağaza metni](docs/store-listing-tr.md) · [Doğrulama raporu](docs/AUDIT.md)
