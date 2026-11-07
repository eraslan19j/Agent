# My Vision sürüm notları

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
