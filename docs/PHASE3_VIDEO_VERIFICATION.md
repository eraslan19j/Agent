# Aşama 3 — Çok klipli video editörü doğrulaması

Tarih: 2026-11-08 (UTC)  
Kapsam: Web/Chromium ve Android WebView'a aktarılan kullanıcı arayüzü; fiziksel cihaz performansı bu raporun dışındadır.

## Uygulanan kullanıcı akışı

- Ana sayfadan açılan ayrı video stüdyosu; en fazla 8 klip ve toplam 120 saniye.
- MP4, WebM ve WebView codec desteğine bağlı MOV içe aktarma; 500 MB dosya sınırı.
- MediaRecorder WebM dosyalarındaki `duration=Infinity` metadata durumunu terminal seek ile çözme.
- Trim, 0,25×–4× hız, bölme, kopyalama, silme, yeniden sıralama, 90° döndürme, ses seviyesi ve susturma.
- 9:16, 1:1, 4:5 ve 16:9; 720p veya 1080p çıktı. 4K video vaadi yok.
- Klip çıkışında 0,35 sn fade; ses ve video birlikte geçiş yapar.
- Fotoğraf editörüyle aynı 16 efekt modeli, parçacık ve tarih damgası.
- Zamanlı metin/sticker ve yalnız kullanıcı tarafından sağlanan müzik; müzik seviyesi ve fade in/out.
- Canlı Canvas önizleme, ayrı `myvision-video` IndexedDB taslağı, 1,8 sn autosave, manuel kayıt, reload sonrası Blob geri yükleme.
- Worker içinde FFmpeg ile H.264/AAC MP4; ilerleme, iptal, kalıcı hata, indirme ve paylaşma.
- Mobil/masaüstü responsive düzen, Android geri/dirty-close akışı ve Türkçe/İngilizce kontroller.

## Otomatik sonuçlar

| Kontrol | Sonuç |
|---|---:|
| Vitest | **65/65 PASS** (9 dosya) |
| ESLint | **PASS** |
| TypeScript + production build | **PASS** |
| Production asset ve Brotli FFmpeg doğrulaması | **PASS** |
| Aşama 1 fotoğraf regresyonu | **23/23 PASS** |
| Aşama 2 üst seviye browser kontrolleri | **7/7 PASS** |
| Canvas2D/WebGL efekt piksel taraması | **32/32 PASS** |
| Aşama 3 gerçek video browser kontrolleri | **15/15 PASS** |
| Aşama 3 axe taramaları | **0 violation** |

Aşama 3 kontrolleri ana sayfa erişimi, iki klipli import, sessiz klip, Canvas oynatma, rotation/trim/resolution, kayıt, 44px dokunma hedefleri, gerçek MP4, ObjectURL yaşam döngüsü, ffprobe, masaüstü taşması, tam reload ile taslak geri yükleme, export iptali, İngilizce yerelleştirme ve uncaught browser error yokluğunu kapsar.

## Gerçek MP4 kanıtı

Tarayıcıda MediaRecorder ile üretilen iki yaklaşık iki saniyelik WebM kullanıldı: ilk klipte Opus tonu, ikinci klip sessiz. İlk klibin çıkışına fade; taslağa glow, parçacık, tarih, metin ve kullanıcı Opus müziği uygulandı.

Oluşan `.arena/phase3-output.mp4`:

- Boyut: **453.780 byte**
- Süre: **3,734 saniye**
- Video: **H.264, 720×1280**
- Ses: **AAC, 2 kanal**
- Tarayıcı metadata süresi: **3,733333 saniye**
- MP4 imzası: **ftyp**
- Beklenen fade süresi: iki klip − 0,35 sn; ölçüm bu süreyle uyumlu.

Harness ve sonuçlar: `.arena/phase3-video.mjs`, `.arena/phase3-video-results.json`. Ekran görüntüleri `.arena/phase3-video-editor-mobile.png` ve `.arena/phase3-video-output-desktop.png` altındadır; `.arena` Git'e eklenmez.

## Testlerin yakaladığı ve düzeltilen hatalar

- Export sonucu değişince aktif klip ObjectURL'lerinin revoke edilmesi.
- Metadata temizliği sırasında video süresinin okunamaz hale gelmesi.
- MediaRecorder WebM süresinin `Infinity` olması.
- Mobilde erişilebilir adı olmayan MP4 düğmesi ve labelsız dosya inputları.
- Vite geliştirme sunucusunun public ESM FFmpeg çekirdeğini `?import` ile reddetmesi; aynı-origin Blob core URL ile çözüldü.
- ffmpeg.wasm `ffprobe` başarılı JSON yazarken `-1` döndürebildiği için özgün sesin yanlışlıkla sessiz sayılması.
- Fade'in UI'daki “sonraki klibe geçiş” anlamıyla ters uygulanması.
- Klip rotation/trim değişimlerinde Canvas önizlemenin bayat kalması.
- Paylaşım dosya adının video için `.jpg` kalması.

## Açık fiziksel riskler

- Poco/HyperOS üzerinde native geri, rotation, background/resume, process death ve güncelleme migrasyonu bu turda çalıştırılmadı.
- **1080p / 30 saniye** gerçek cihaz export süresi, bellek ve termal davranış doğrulanmadı.
- Android codec sağlayıcısına bağlı MOV/HEVC içe aktarma ve büyük dosya performansı fiziksel cihazda doğrulanmalı.
- TalkBack, sistem paylaşım sayfası, Documents/Cache izinleri ve büyük MP4 base64 dönüşümü cihazda sınanmalı.
- Video preview efektleri hafif Canvas2D yolunu kullanır; fotoğraf editöründeki WebGL hızlandırma video export Worker'ına taşınmaz.
