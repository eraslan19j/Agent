# My Vision paylaşım sunucusu ve UI doğrulaması

## Mimari

- **Özel çalışmalar:** Fotoğraf/video projeleri cihazdaki IndexedDB’de kalır. Video ve fotoğraf render işlemleri cihazda yapılır.
- **Paylaşım alanı:** Kullanıcının galeri/kamera ile yüklediği veya editör export’unda açıkça “Paylaşım alanına yükle” dediği fotoğraflar Node sunucusuna gider.
- **Galeri:** Hesap veya özel sosyal akış yoktur. Sunucudaki paylaşım galerisi ve `/share/:id` bağlantıları herkese açıktır. Hassas içerik yüklenmemelidir.
- **Production:** Tek Express süreci `dist`, API, paylaşım bağlantıları ve Brotli FFmpeg varlıklarını sunar.

## Çalıştırma

Geliştirme:

```bash
npm ci
npm run dev:server  # :8787 API
npm run dev         # Vite; /api → :8787
```

Production:

```bash
npm run build
npm start           # 0.0.0.0:8787
```

Dosyalar `.data/shared-photos/`, metadata `.data/shared-photos.json` altındadır. Metadata geçici dosya + rename ile atomik yazılır. `.data` Git dışıdır. Production’da kalıcı disk için `MY_VISION_DATA_DIR` kullanın ve bu dizini yedekleyin.

Native istemci ayrı origin kullanıyorsa `.env.example` içindeki `VITE_API_URL`, `VITE_PUBLIC_URL` ve `CLIENT_ORIGIN` değerlerini gerçek HTTPS adresleriyle ayarlayın. Browser/native kodunda `localhost` sunucu adresi kullanılmamalıdır.

## API

| Yöntem | Yol | İşlev |
|---|---|---|
| GET | `/api/health` | Sunucu ve fotoğraf sayısı |
| GET | `/api/photos?limit=60` | En yeni paylaşılan fotoğraflar |
| GET | `/api/photos/:id` | Fotoğraf metadata’sı |
| GET | `/api/photos/:id/content` | Orijinal paylaşılan görsel |
| POST | `/api/photos` | Multipart `photo`, `name`, `caption` upload |
| GET | `/share/:id` | SPA paylaşım bağlantısı |

Upload kuralları:

- Yalnız JPEG, PNG ve WebP; MIME’a ek olarak dosya imzası doğrulanır.
- En fazla 12 MB, tek dosya, en fazla iki metin alanı.
- IP başına 15 dakikada 30 upload.
- Rastgele UUID dosya adı; kullanıcı dosya adı path olarak kullanılmaz.
- Başarısız yazımda metadata ve yetim dosya temizlenir.
- `nosniff`, referrer politikası ve yapılandırılabilir tek-origin CORS.
- `/ffmpeg/*.wasm.br` için `Content-Encoding: br` ve `application/wasm`.

Bu sürümde hesap, kimlik doğrulama ve kullanıcı tarafından sunucu içeriği silme yoktur. Herkese açık kullanıma çıkarmadan önce kalıcı disk, HTTPS, yedekleme, içerik moderasyonu ve silme süreci işletilmelidir.

## Düzeltilen editing UI hataları

- Mobil video “Taslak kaydedildi” göstergesinin viewport altına taşması; artık header içinde.
- Mobilde önizlemenin kontrollere az alan bırakması; 390×844 ölçümünde inspector içerik alanı **320px**, 320×568’de kaydırılabilir kontrol paneli.
- Video/kolaj/batch açıkken ana sayfanın DOM ve erişilebilirlik ağacında kalması; artık unmount.
- 320px video header kontrollerinde taşma ve 44px hedef sorunları.
- Paylaşım export’unun yalnız cihaz paylaşımıyla sınırlı olması; gerçek render edilmiş kopya artık API’ye yüklenebiliyor.
- Production Node sunucusunda Brotli FFmpeg header’ının eksikliği.

## Doğrulama

- **10/10 UI/server browser kontrolü:** Gerçek galeri, müşteri fotoğrafı seçme, glow, export, düzenlenmiş kopyayı yayınlama, yeni sekmede deep link, mobil video, 320px, kolaj/batch ve İngilizce.
- Paylaşım galerisi axe: **0 violation**.
- **23/23** Aşama 1 regresyonu.
- **7/7** Aşama 2 browser kontrolü ve **32/32** backend piksel kontrolü.
- **15/15** Aşama 3 video kontrolü.
- `npm run test:server`: geçersiz dosya reddi, gerçek upload, byte-identical download, liste, Brotli header ve restart kalıcılığı **PASS**.
- Production `npm audit --omit=dev`: **0 vulnerability**.

Kanıtlar `.arena/ui-server-regression.mjs`, `.arena/ui-server-results.json` ve `.arena/ui-*.png` altındadır; `.arena` Git’e eklenmez.

## Güncel derleme

- Kod: `08061f8`
- Android CI: https://github.com/eraslan19j/Agent/actions/runs/42493582392 — **SUCCESS**
- APK: https://github.com/eraslan19j/Agent/releases/download/my-vision-v1.4.0-debug/My-Vision-1.4.0-debug.apk
- Boyut: **13.756.519 byte**
- SHA-256: **`09cc650e99e914d80189d40272c03635f5af1e161fe5b6bd30feaaf6fc0b00e7`**
