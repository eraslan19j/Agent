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

## Aşama 2 — Üretilen görselden marka sistemi

- Kodla çizilen eski SVG göz/diyafram kaldırıldı; seçilen AI üretimi raster ikon `resources/generated-vision-icon.png` tek kaynak oldu.
- Kaynak görselden antialias alfa maskesi çıkarıldı ve ana renkler `#FFC400` / `#0A0A0A` olarak normalize edildi.
- Android adaptive foreground/background, yuvarlak ikon, Android 13 monochrome, 192/512 PWA, maskable PWA, 32/64 favicon, Play Store 512 ve 1024×500 öne çıkan görsel üretildi.
- Uygulama içi logo bileşeni artık üretilen raster ikonu ve erişilebilir metin lockup’ını kullanıyor.
- Native splash varyantları ve mağaza kapağı yeni ikonla yenilendi; 48 px okunabilirlik ve mobil taşma kontrol edildi.
- Production build, 22 test ve ESLint başarılı.

## Aşama 3 — Merkezi tema, ayarlar ve tema uyumlu splash

- AMOLED (`#000`), Koyu, Açık ve Sistem temaları; Sarı/Mavi/Yeşil/Kırmızı/Mor ve Android 12+ dinamik vurgu eklendi.
- Liquid Glass/Sade, ayrı blur azaltma ve açılış animasyonu tercihleri eklendi; tercihler anında uygulanıp `myvision.preferences.v2` altında kalıcı oldu.
- Tema ve vurgu, ilk boyamadan önce `index.html` içinde uygulanıyor; sistem teması değişimi canlı izleniyor.
- Profil üzerinden erişilen yeni Ayarlar ekranı ve geri davranışı eklendi.
- Native `Theme` plugin’i tema/animasyon tercihlerini SharedPreferences’a yazıyor, dinamik sistem rengini ve sistem çubuğu görünümünü güncelliyor.
- Android 12+ `windowSplashScreen*`, Android 11 ve altı drawable varyantları; AMOLED/Açık launch temaları eklendi. Uygulama içi geçiş hazır olduktan sonra kapanıyor, dokunmayla geçilebiliyor ve yalnız transform/opacity kullanıyor.
- Kontrollü Chromium: AMOLED `#000`, Açık `#F3F3EF`, sistem dark/light canlı geçişi, mavi vurgu ve reload kalıcılığı, Sade/blur, splash kapalıyken mount olmama ve 390 px taşma kontrolü geçti.
- Production build, ESLint, Capacitor sync ve 26 test başarılı. Native derleme ve fiziksel soğuk/sıcak açılış ölçümü bu aşamada yapılmadı.

## Aşama 4 — Cihaz içi yaratıcı araçlar ve arşiv

- Rakip araştırması ve resmî kaynak bağlantıları `docs/RESEARCH.md` içine yazıldı; bulut/ücretli AI veya ağır çalışma zamanı eklenmedi.
- Serbest normalize kırpma; Story/Post/Kapak oranları; straighten için boş köşe bırakmayan cover ölçeği; yatay/dikey perspektif; Curves; 7 kanal HSL; radyal/lineer seçici maskeler eklendi.
- Yerel doku harmanlı healing/nesne, kırmızı göz, gürültü azaltma, keskinleştirme, kenar-renk tabanlı arka plan kaldırma eklendi. Arka plan ve nesne araçları klasik algoritmadır; AI olarak sunulmaz.
- Metin (3 font), taşınabilir çıkartma, gerçek fırça konturları, çerçeve, canlı 48 bölgeli histogram, grid, pinch/button zoom, önce–sonra ve 40 adımlı geri al/yinele birlikte çalışıyor.
- Portre/Manzara/Yemek/Gece/Vintage dahil 16 hazır görünüm; ayar kopyala/yapıştır ve en fazla 30 kalıcı özel tarif eklendi.
- Gerçek çoklu dosya Kolaj (Story/Post/Kapak, filtre, aralık, arka plan, başlık) ve Batch (12 dosya, ortak/kopyalanmış ayar, filigran, boyut, gerçek ilerleme ve hata listesi) stüdyoları eklendi.
- Albüm/favori/etiket proje modeline eklendi; arama bu alanları ve ismi kapsıyor. İlk açılış onboarding’i kalıcı ve geçilebilir.
- Gelişmiş önizleme düşük çözünürlüklü gerçek render kullanıyor; export aynı motorla kaynak çözünürlüğünde çalışıyor.
- Mobil tam-ekran araç dock’unun fotoğraf dokunuşlarını kapatması ve gelişmiş preview’ın `left/top:50%` ofseti QA sırasında bulunup düzeltildi.
- Kontrollü Chromium: Curves/HSL/radyal maske/healing/metin/fırça/free crop/özel tarif/save/export geçti; kayıtta 1 metin, 1 maske, 1 rötuş, 1 kontur, HSL 20 ve `free` doğrulandı; gerçek JPG indirildi.
- Kolaj çıktısı Sharp ile **1080×1920** doğrulandı; batch iki ayrı JPG üretti; favori/albüm/etiket araması geçti.
- Regresyon: Noir %85 ve proje kimliği, Discover 503/retry/iptal/Escape/scroll temizliği, EXIF 200×400, dikey ve panorama merkezleme yeniden geçti.
- Production build, ESLint ve 33 test başarılı. Fiziksel cihaz ölçümü yapılmadı.

## Aşama 5 — Worker, bellek ve ölçülen performans

- Base tone/grain, noise/sharpen, Curves/HSL, maskeler, kırmızı göz ve arka plan alfa işlemleri saf `pixelProcessing` fonksiyonuna ayrıştırıldı.
- Vite ayrı `pixelWorker` bundle’ı üretiyor; `ArrayBuffer` transfer kopyalama yerine sahiplik aktarıyor. Worker yoksa/oluşturulamazsa aynı saf pipeline ana thread fallback’iyle çalışıyor. Timeout’ta worker terminate ediliyor.
- Gelişmiş önizleme en fazla 1100 px; export kaynak çözünürlüğü ve 2800 px kaynak hazırlama sınırı korunuyor. Preview blob URL’leri revoke ediliyor.
- Layout animasyonu yerine photo-stage transform geçişi; onboarding indicator transform/opacity kullanımı eklendi.
- Piksel merkezi koordinat düzeltmesi unit testle yakalandı ve uygulandı. Neutral pixel, lokal maske, kırmızı göz ve border-background alfa testleri eklendi; toplam 37 test geçti.
- Worker açıkken gelişmiş editör ve batch yeniden geçti. Worker tamamen devre dışıyken Curves + JPG export geçti.
- Kontrollü PNG: köşe alfa 0, kontrast subject içinde alfa 255; straighten JPG’de boş/siyah köşe yok; canlı histogram ve sentetik iki-parmak %200 zoom geçti.
- Production Chromium ölçümü: açılış **724 ms**, 2800×700 ağır export **453 ms**, JS heap yaklaşık **12,7 MB**. Export sırasında bir **114 ms** ana-thread long task ölçüldü; canvas readback/writeback ana thread’de kaldığı için kesintisiz 120 Hz doğrulanmış sayılmaz.
- Fiziksel Poco X7 Pro, HyperOS, 120 Hz ekran ve native bellek ölçümü yapılmadı.
