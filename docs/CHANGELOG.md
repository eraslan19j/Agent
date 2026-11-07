# My Vision sürüm notları

## 1.2.0 — Android sürüm 3

### Liquid Glass ve marka
- Mobil öncelikli koyu Liquid Glass tasarımı; tam ekran fotoğraf, blur’lu yüzen navigasyon ve editör araç dock’u eklendi.
- `#FFC400` sarı, `#0A0A0A` siyah ve açık metin renkleri merkezi CSS değişkenlerine bağlandı.
- Kodla çizilmiş geometrik göz + kamera diyaframı logosu tek SVG kaynağına taşındı.
- Yazılı/yazısız logo, animasyonlu uygulama açılışı, yükleme ve paylaşım durumları, favicon, PWA, native launcher/splash ve Play Store varlıkları aynı kaynaktan üretiliyor.
- Paywall’deki stok görsel kaldırılarak marka odaklı özgün kompozisyon uygulandı.

### Gerçek keşif ve projeler
- Tekrarlanan yerel stok galeri, sahte örnek projeler ve statik seçkiler kaldırıldı.
- Keşfet artık Lorem Picsum API’sinden rastgele sayfalar yükler; ardışık yenilemelerde aynı sayfa seçilmez.
- Her fotoğrafta fotoğrafçı, orijinal boyut ve kaynak bağlantısı gösterilir; seçilen fotoğraf gerçek dosya olarak stüdyoya aktarılır.
- İstek zaman aşımı ve ağ hatası durumlarında sahte içerik yerine açık hata ve yeniden deneme sunulur.
- Ana sayfa ve proje arşivi yalnızca kullanıcının gerçek çalışmalarını gösterir; eski örnek kayıtlar filtrelenir.

### Kırpma ve Huawei/HarmonyOS
- Önizleme boyutu; kaynak kırpması, döndürme ve kullanılabilir alanı hesaplayan `previewDimensions()` motoruna taşındı.
- `1:1 → Orijinal` geçişinde sıfır genişlik/siyah fotoğraf sorunu giderildi; 90° döndürmede keyfi küçültme kaldırıldı.
- Native tema, WebView, durum/gezinme çubukları ve tüm splash varyantları `#0A0A0A` ile bütünleştirildi.
- Mevcut native displayCutout/systemBars inset ve kamera dönüşü resume koruması korundu.

### Doğrulama
- 17 birim testi, TypeScript production build ve ESLint başarılı.
- Mobil ölçümler: Orijinal `370×208`, kare `370×370`, Orijinal’e dönüş `370×208`, 90° `370×657`; geri yüklenen görüntü piksel içeriği doğrulandı.
- Sürüm `1.2.0`, Android `versionCode 3`.

## 1.1.0 — Android sürüm 2

### Cihaz uyumluluğu
- Çentik, durum çubuğu ve alt navigasyon alanı için native Android WindowInsets koruması eklendi.
- Huawei / HarmonyOS WebView varyantlarında güvenli alanlar native kenar boşluklarıyla uygulanıyor.
- Kamera veya galeriden dönüldüğünde sistem alanları ve WebView yerleşimi yeniden hesaplanıyor.
- Editör sabit tam ekran oldu; önceki sayfanın kaydırma konumunun editörü yukarı taşıması engellendi.
- Eski WebView sürümleri için dinamik viewport birimi bağımlılığı kaldırıldı.

### Görünüm ve efekt düzeltmeleri
- Görünüm seçimi %85 etkiyle uygulanıyor ve uygulanan görünüm bildirimle doğrulanıyor.
- Görünüm küçük resimleri artık stok fotoğraflar yerine düzenlenen fotoğrafı kullanıyor.
- Sinematik, Ege Mavisi, Doğal Portre ve Doğada görünümlerinin etkileri güçlendirildi.
- Vinyet ve film greni canlı önizlemeye eklendi.
- Parlak alan ve gölge kontrollerinin canlı önizleme yaklaşımı iyileştirildi.

### Yeni araçlar
- **Netlik:** Dokuların ve kontrastın gücünü ayarlar.
- **Yumuşak odak:** Pro kullanıcılar için kontrollü bulanıklık sağlar.
- **Basılı tut: Orijinal:** Fotoğrafın düzenlemesiz hâlini anında gösterir.
- Önce/sonra sürüklenebilir karşılaştırması korunarak orijinal gösterimi güçlendirildi.

### Teknik
- Sürüm `1.1.0`, Android `versionCode 2`.
- Android derleme hedefi Java 21 ve SDK 36.
- Yeni görüntü motoru birim testleri eklendi.
