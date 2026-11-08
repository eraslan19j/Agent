# My Vision — Fotoğraf ve Video Stüdyosu

My Vision; görünümler, hassas fotoğraf ayarları, kadraj, düzenlenebilir metin, çok klipli video, kolaj ve toplu işlem araçlarını birleştiren ücretsiz, mobil öncelikli bir uygulamadır. React + TypeScript arayüzü Capacitor ile Android uygulamasına paketlenir. Özel projeler cihazda kalır; yalnız kullanıcının açıkça “Paylaşım alanına yükle” dediği fotoğraflar Node sunucusuna gönderilir.

## Özellikler

- **Görünümler ve görüntü işleme:** Pozlama, parlaklık, kontrast, doygunluk, sıcaklık, ton eğrileri, HSL, seçici maskeler, netlik ve film greni
- **Kadraj:** Oranlı/serbest kırpma, döndürme, perspektif ve aynalama
- **Düzenlenebilir metin:** İçerik, konum, boyut, renk, yazı tipi, hizalama ve döndürme; uzun metinlerde güvenli satır kaydırma
- **Çalışma geçmişi:** Geri al, yinele, önce/sonra ve sıfırlama
- **Yerel projeler:** IndexedDB içinde ayrı medya Blob’ları ve proje metadata’sı; arama, filtreleme, favori, albüm ve etiketler
- **Güvenli eski veri aktarımı:** localStorage kaydı IndexedDB’ye yazılıp tekrar okunarak doğrulanmadan eski kayıt silinmez
- **Video editörü:** 8 klip/120 saniye, trim, hız, bölme, sıralama, fade, metin/sticker, kullanıcı müziği ve 720p/1080p MP4
- **Stüdyo:** Gerçek çok fotoğraflı kolaj ve ortak ayarlarla toplu dışa aktarma
- **Paylaşım alanı:** Galeri/kamera upload’ı, müşteri fotoğrafını seçip efektle düzenleme, düzenlenmiş kopyayı yayınlama ve `/share/:id` bağlantıları
- **Dışa aktarma:** JPG/PNG, kalite ve 1080/2048/4096 px seçenekleri; Android’de Documents/My Vision
- **Sade sistem tasarımı:** Sistem fontu, nötr zeminler, mavi vurgu, açık/koyu/sistem teması, en az 44 px dokunma hedefleri
- **Gizlilik:** Özel projeler cihaz içi işlenir; reklam takipçisi yok. Paylaşım alanına yüklenen fotoğraflar sunucuda herkese açık galeri olarak saklanır.

## Hızlı başlangıç

Node.js 22 önerilir.

```bash
npm ci
npm run dev:server  # Terminal 1 — API ve paylaşım sunucusu, :8787
npm run dev         # Terminal 2 — Vite, /api isteklerini :8787'e proxy'ler
```

Production’da tek Node süreci hem derlenmiş uygulamayı hem API’yi sunar:

```bash
npm run build
npm start           # PORT=8787; 0.0.0.0 üzerinde dinler
```

Upload’lar `.data/shared-photos/` altında, metadata `.data/shared-photos.json` içinde atomik olarak saklanır. `.data` Git’e eklenmez. Kalıcı üretim diski için `MY_VISION_DATA_DIR`, native istemci için `VITE_API_URL` / `VITE_PUBLIC_URL` ve `CLIENT_ORIGIN` kullanılabilir; örnek `.env.example` içindedir.

### Kontroller

```bash
npm run test         # Birim ve migrasyon testleri
npm run lint         # ESLint
npm run build        # FFmpeg varlıkları + TypeScript + production build + boyut/hash kontrolü
npm run test:ffmpeg  # Gerçek Chromium Worker, WebM→MP4 ve playback testi
npm run test:server  # Gerçek HTTP upload, imza doğrulama, byte eşitliği ve restart kalıcılığı
npm audit --omit=dev # Production bağımlılık güvenlik taraması
```

FFmpeg, video editörünün gerçek H.264/AAC MP4 üretimini Worker içinde cihazda yapar; videolar sunucuya gönderilmez. Tek iş parçacıklı çekirdek Brotli ile yaklaşık 6,94 MiB’a indirilir. Statik sunucu `.wasm.br` dosyasını `Content-Encoding: br` ve `Content-Type: application/wasm` başlıklarıyla sunmalıdır; örnek kurallar `public/_headers` içindedir.

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
server/             Express API, güvenli upload ve HTTP entegrasyon doğrulaması
.data/              Çalışma zamanı paylaşım dosyaları ve metadata (Git dışı)
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
