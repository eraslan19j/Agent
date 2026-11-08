# Değişiklik günlüğü

## 1.4.0 — 7 Kasım 2026

### Temizlik ve ücretsiz model
- Hesap, ödeme, uzaktan içerik ve kullanılmayan yaratıcı araç yolları kaldırıldı.
- Arayüz, yerel proje akışı ve ücretsiz fotoğraf düzenleme etrafında sadeleştirildi.
- Yasal sayfalar ve mağaza metinleri gerçek cihaz içi veri modeliyle eşleştirildi.

### Yerel veri
- Projeler localStorage yerine IndexedDB’ye taşındı; medya Blob’ları ve metadata ayrıldı.
- Eski kayıt ancak tüm projeler yazılıp tekrar okunarak doğrulandıktan sonra siliniyor.
- Hata veya bozuk kayıt durumunda eski localStorage verisi korunuyor.

### Editör
- Metin katmanları sonradan seçilip içerik, konum, boyut, renk, yazı tipi, hizalama ve açı bakımından düzenlenebiliyor.
- Uzun metinler için Canvas export ve önizlemede ortak hizalama/satır kaydırma eklendi.
- Küçük mobil ekranlarda geri al/yinele erişimi korundu.

### Tasarım
- Nötr açık/koyu zeminler, tek mavi vurgu, sistem fontu ve sade bileşenler uygulandı.
- Dokunma hedefleri en az 44 px yapıldı; kontrast ve reduced-motion davranışı iyileştirildi.
- Uygulama ikonları, splash ve mağaza varlıkları yeni görsel sistemle üretildi.

### Teknik doğrulama
- FFmpeg çekirdeği 30,74 MiB ham WASM yerine 6,94 MiB Brotli varlığıyla paketlendi.
- Gerçek Chromium Worker yüklemesi, WebM→MP4/H.264+AAC export ve browser playback smoke testi eklendi.
- Bu sürüm video editörü arayüzü içermez.
