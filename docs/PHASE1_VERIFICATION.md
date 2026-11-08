# My Vision — Aşama 1 doğrulama ve cihaz testi

Tarih: 7 Kasım 2026

Bu rapor yalnız çalıştırılan otomasyonları ve incelenen ekran görüntülerini “doğrulandı” olarak adlandırır. Fiziksel telefon testleri **yapılmadı**; bu nedenle 12 MP slider akıcılığı, gerçek Android yaşam döngüsü ve cihaz belleği kalite kapıları hâlâ açıktır.

## Uygulanan düzeltmeler

- Çift merkezleme kaldırıldı; contain sahne hesabı ile DPR-backed canvas birbirinden ayrıldı.
- Orijinal fotoğraf ile EXIF yönlendirilmiş, sınırlı önizleme proxy’si ayrıldı. Export/share orijinali, önizleme/histogram/thumbnail proxy’yi kullanır.
- Orijinal ve önizleme Blob/ObjectURL sahipleri ile session, proje, unmount ve iptal temizliği tanımlandı.
- Preview Worker’ları AbortSignal ile iptal edilebilir; export Worker’ı paylaşılır. Slider güncellemeleri frame başına birleştirilir.
- Metin inputu controlled-input karakter kaybı yaşamaması için senkron güncellenir. Boyut/döndürme gibi slider’lar rAF’ta kalır; `commit()` bekleyen geçerli ayarları düşürmez.
- Çakışan iki etiket yerine fotoğraf dışında tek durum chip’i vardır. “Basılı tut: Orijinal” araç çubuğundadır.
- Mobil panel kapatılıp açılabilir; içerik bağımsız kayar, yoğunluk sticky kalır, 320 px düzen ve safe-area padding uygulanır.
- Üst barda kaydedilmedi/kaydedildi durumu, 44 px kontroller, erişilebilir adlar, title ve hover/uzun-basma tooltip bulunur.
- Ad + ayar snapshot’ı ile dirty takibi, `beforeunload`, Android geri ve çıkış onayı vardır. Açık export/free-crop/dirty diyalogları geri tuşunda editörden önce ele alınır.
- Asenkron kayıt sırasında yapılan daha yeni değişiklikler dirty kalır; “Kaydet ve çık” bu durumda editörü kapatmaz.
- Export diyaloğu CSS filtresi taklidi yerine güncel ayarlarla gerçek render edilmiş önizleme üretir; iptal/kapanışta Worker ve ObjectURL temizlenir.
- Yeni kontrollerin TR/EN metinleri ve `data-tooltip` çevirileri eklendi.
- Koyu tema seçili çıktı boyutu metni WCAG AA kontrastına çıkarıldı.

## Önce / sonra kanıtı

| Kontrol | Önce | Sonra |
|---|---|---|
| EXIF, dikey ve panorama merkezleme | 3 örnekte `centered:false` | 3 örnekte `centered:true`; landscape contain `fits:true` |
| 4000×1000 kaynak | Editöre 2800×700 kopya | Orijinal export kaynağı korunur; 1600 px preview proxy |
| Durum etiketleri | Aynı köşede iki mutlak etiket | Tek, fotoğraf dışı chip |
| Mobil yoğunluk | Preset listesinin altında | Liste kayarken görünür sticky kontrol |
| Export önizlemesi | Kaynak + CSS filter | Gerçek render edilmiş Blob önizlemesi |
| Kirli çıkış | Doğrudan kapanma | Dön / kaydetmeden çık / kaydet ve çık |
| Metin yazma | rAF yarışında bozuk karakter ve kayıp güncelleme | Kontrollü input ve ardından font/hizalama korunur |

Ekran kanıtları çalışma alanında:

- `.arena/phase1-editor-text-mobile.png`
- `.arena/phase1-look-intensity-mobile.png`
- `.arena/phase1-export-preview-mobile.png`
- `.arena/phase1-dirty-exit-mobile.png`
- `.arena/phase1-home-mobile.png`
- `.arena/phase1-home-desktop-light.png`
- Makine okunur sonuç: `.arena/phase1-regression-results.json`

## Otomasyon sonucu

- `npm run test -- --run`: **5 dosya, 44/44 PASS**.
- `.arena/phase1-regression.mjs`: **23/23 PASS**.
- Axe WCAG 2 A/AA ve 2.1 AA: mobil koyu ana sayfa, mobil metin editörü, export diyaloğu, dirty-exit diyaloğu, masaüstü açık ana sayfa ve masaüstü açık editör — **6 tarama, 0 ihlal**.
- 320×740 editör: üst bar kontrolleri viewport içinde, yatay sayfa taşması yok.
- Gerçek JPEG indirme: **1200×1600**, 40.660 byte.
- IndexedDB kayıt + reload + metin kalıcılığı ve legacy localStorage migrasyonu PASS.
- `.arena/editor-geometry.mjs`: EXIF-6, 1200×1600 ve panorama; portrait center + landscape contain **3/3 PASS**, page error yok.
- `npm run lint`: PASS.
- `npm run build`: strict TypeScript, Vite production build ve yerel FFmpeg asset doğrulaması PASS.
- `git diff --check`: PASS.
- Android CI [42479175419](https://github.com/eraslan19j/Agent/actions/runs/42479175419): **SUCCESS**; web doğrulaması, Capacitor sync, debug APK, target API 36 ve 16 KB zipalign PASS.
- Güncel kurulabilir APK: [My-Vision-1.4.0-debug.apk](https://github.com/eraslan19j/Agent/releases/download/my-vision-v1.4.0-debug/My-Vision-1.4.0-debug.apk), **13.723.722 byte**, debug imzalı, minimum Android 7.0. CI üzerinden yayınlanan SHA-256: **`2dbaa222c85e06bcde684073b0a952262590e7d3ce205ef84cee7515b7d12986`**. Yerel indirme/kurulum yapılmadı.

Ağ denetimi: Aşama 1 diff’inde yeni uzak URL, analytics/tracker, XMLHttpRequest veya sendBeacon yok. Eklenen `fetch(prepared.previewSource)` yalnız uygulamanın ürettiği yerel Blob/ObjectURL verisini thumbnail için okur; sunucuya fotoğraf göndermez.

## Fiziksel Android elle test listesi — henüz çalıştırılmadı

Bu maddeler yukarıdaki CI 42479175419 artifact’ı ile yapılmalıdır. Release aynı tag üzerinde güncellendiği için kurulumdan önce dosya boyutu ve SHA-256 eşleşmesi kontrol edilmelidir; daha eski 13.720.070 byte’lık APK bu son değişiklikleri içermez.

1. **Kurulum ve migrasyon:** v1.4.0 üstüne güncelle; eski projeleri, metinleri, EXIF yönünü ve orijinal kaynakları aç. Uçak modunda tekrarla.
2. **12 MP performans:** 12 MP EXIF’li fotoğraf aç; exposure, HSL, noise reduction ve sharpen slider’larını ayrı ayrı 60 saniye sürükle. Gecikme, takılma, eski preview’ın geri gelmesi, bellek ve ısınmayı kaydet. Ölçüm yapılmadan akıcı kabul etme.
3. **Geometri:** Dikey, yatay, panorama, 1:1, 4:5, 9:16, serbest kırpma, 90° döndürme ve perspektifi portrait/landscape cihaz yönünde karşılaştır.
4. **Panel ve safe-area:** Çentik ve gesture/navigation bar alanlarında bütün kontrollere eriş; paneli kapat/aç; uzun görünüm listesinde yoğunluğun görünür kaldığını doğrula.
5. **Orijinal ve tooltip:** Orijinal düğmesini basılı tut/bırak; parmağı dışarı kaydır; tooltip’i uzun basma ile aç/kapat. Etiket çakışması olmadığını kontrol et.
6. **Dirty çıkış:** Ad ve ayar değiştir; üst geri ve Android geri ile “Düzenlemeye dön”, “Kaydetmeden çık”, “Kaydet ve çık” seçeneklerini ayrı ayrı dene.
7. **Geri tuşu önceliği:** Export ve serbest kırpma açıkken Android geri yalnız diyaloğu kapatsın. Dirty onayı açıkken geri onayı kapatsın; editör açık kalsın.
8. **Kayıt yarışı:** Kaydet sırasında yeni ayar üretmeyi dene; kayıt sonrası durum hâlâ “Kaydedilmedi” ise “Kaydet ve çık” editörü kapatmamalı.
9. **Arka plan/resume:** Preview, kayıt ve export sırasında uygulamayı arka plana al/geri getir. Activity recreate ve düşük bellek sonrası kayıtlı projeyi aç; crash/blank canvas olmadığını doğrula.
10. **Büyük çıktı:** 8000 px+ kaynakta JPG ve PNG 4K export/share dene; çıktı boyutunu galeri ayrıntılarından ölç, bellek hatası/kilitlenme varsa kaydet. Otomatik 8000 px export kanıtı henüz yok.
11. **Paylaşım:** Android galeri ve paylaşım hedeflerine gerçek çıktıyı gönder; iptal sonrası editörün kullanılabilir kaldığını doğrula.
12. **Tema/dil/erişilebilirlik:** Koyu, saf siyah, açık ve sistem temalarında; TR/EN’de TalkBack ile üst bar, panel, slider ve diyalogları dolaş. Metin büyütmede kesilme/taşma kontrol et.
13. **Gizlilik:** Uçak modunda import → düzenleme → kaydet → reload → export/share akışını tamamla. Sistem ağ izlemede fotoğraf kaynaklı uzak istek bulunmadığını ayrıca gözle.

Aşama 3 sonrası ayrı kapı: orta seviye Android’de **1080p / 30 saniye video export süresi, iptal ve bellek** ölçülmeden video kalite kapısı geçilmiş sayılmayacak.

## Açık riskler

- Poco/HyperOS ve diğer fiziksel Android cihazlarda hiçbir doğrulama yapılmadı.
- 12 MP slider akıcılığı ve 8000 px gerçek export belleği ölçülmedi.
- Native Android geri, rotation, resume ve process-death senaryoları yalnız kod/benzer browser akışıyla sınandı.
- Axe otomasyonu erişilebilirliğin tamamını kanıtlamaz; TalkBack elle testi zorunludur.
- Aşama 2 efektleri ve Aşama 3+ video/şablon/müşteri akışı bu raporda çalışıyor olarak sunulmaz.
