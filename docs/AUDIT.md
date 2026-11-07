# My Vision denetim kaydı

## Aşama 1 — Kritik hatalar ve editör geometrisi

### Bulunan hatalar ve çözümler

1. **Keşfet modalı ile import overlay’inin yaşam döngüsü ayrıydı.** Native geri işlemi açık fotoğraf önizlemesini bilmiyor, fetch/prepare işlemi iptal edilemiyor ve gecikmeli async sonuçlar başka ekranda oturum açabiliyordu.
   - Önizleme `createPortal` ile `document.body` üzerine taşındı; stacking context ve bulanık backdrop zinciri kırıldı.
   - Bütün galeri/keşif import işlemleri generation + `AbortController` ile yönetiliyor.
   - Geri, `Escape`, backdrop, kapat ve İptal yolları aynı temizleme mantığına bağlandı.
   - Eski async sonuçların editör açması engellendi; scroll kilidi merkezileştirildi.

2. **Servis hatası kullanıcıya işlem bazında gösterilmiyordu.**
   - HTTP, zaman aşımı, geçersiz görsel ve iptal ayrıştırıldı.
   - Hata açık önizlemenin içinde gösteriliyor; “Tekrar dene” aynı fotoğrafı yeniden alıyor.
   - Yükleme overlay’i başarı, hata, iptal ve geri durumlarında kapanıyor.

3. **Önizleme erişilebilirliği ve odak davranışı eksikti.**
   - Dialog başlığı, odaklanabilir dialog, Escape ve açıklayıcı kart etiketleri eklendi.
   - Önizleme yüklenme durumu ayrı gösteriliyor; boş/bulanık pencere yerine gerçek yüklenme göstergesi var.

4. **EXIF yönü iki kez uygulanabiliyordu.** Chromium tabanlı decoder, `imageOrientation: 'none'` verilse bile bazı JPEG’leri döndürülmüş döndürüyor.
   - EXIF orientation ve JPEG SOF ham ölçüleri okunuyor.
   - Bitmap ölçüleri SOF ölçüleriyle karşılaştırılarak decoder’ın EXIF’i uyguladığı tespit ediliyor.
   - Sekiz EXIF yönü için transform, doğru canvas ölçüleri ve `ImageBitmap.close()` bellek temizliği eklendi.

5. **Editör yalnızca window resize’a bağımlıydı.**
   - `ResizeObserver`, `orientationchange`, `visualViewport.resize` ve `visualViewport.scroll` birlikte kullanılıyor.
   - Görüntü merkezde tutuluyor; panorama/dikey/yatay ölçüleri korunuyor.
   - Eski fotoğraf yükleme sonuçlarının yeni oturumu değiştirmesi engellendi.

### Doğrulama

- 22 birim testi, production TypeScript/Vite build ve ESLint başarılı.
- Keşif `503`: yükleme overlay’i kapandı, açık hata ve Tekrar dene gösterildi.
- İptal ve Escape: backdrop, importing overlay ve scroll kilidi temizlendi; gecikmeli yanıt editör açmadı.
- Keşif başarı akışı: uzak fotoğraf cihaz içi kaynağa dönüştü ve editör açıldı.
- EXIF orientation=6, 400×200 JPEG: çıktı doğru şekilde 200×400.
- Dikey 1200×1600 ve panorama 4000×1000: oran korundu, merkezleme ve viewport değişimi doğrulandı.
- Proje kaydet/yeniden aç: Noir %85 ve proje kimliği korunarak geri yüklendi.
