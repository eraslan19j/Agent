# My Vision — Profesyonel Fotoğraf Stüdyosu

My Vision; fotoğraf düzenleme, ilham keşfi, yerel proje arşivi ve Pro abonelik modelini birleştiren, mobil öncelikli bir fotoğraf uygulamasıdır. React + TypeScript arayüzü Capacitor ile native Android projesine paketlenir.

## Özellikler

- **12 imza görünümü:** Portre, sinema, seyahat ve siyah-beyaz koleksiyonları
- **Gerçek görüntü işleme:** Pozlama, parlaklık, kontrast, doygunluk, sıcaklık, parlak alanlar, gölgeler, solma, vinyet ve deterministik film greni
- **Kadraj araçları:** Merkezden oran kırpma, 90° döndürme ve yatay/dikey aynalama
- **Önce / sonra:** Sürüklenebilir karşılaştırma çizgisi
- **Düzenleme geçmişi:** Geri al, yinele ve sıfırla
- **Yerel projeler:** Küçük resimli proje kaydı, arama, filtreleme ve silme
- **Dışa aktarma:** JPG/PNG, kalite kontrolü, 1080/2048/4096 px; Android’de Documents/My Vision klasörüne kaydetme
- **Paylaşım:** Android native paylaşım sayfası ve Web Share API
- **Kamera ve galeri:** JPG, PNG ve WebP; büyük görselleri güvenli boyuta hazırlama
- **Freemium:** Free özellikler, Pro paywall, aylık/yıllık plan ve satın alım geri yükleme
- **Gizlilik:** Fotoğraf işleme cihazda; reklam takipçisi yok
- **Native deneyim:** Android 7.0+, Huawei/HarmonyOS dahil çentik ve sistem çubuğu güvenli alanları, kamera dönüşü yerleşim koruması, özel ikonlar ve koyu tema
- **1.1.0 araçları:** Netlik, yumuşak odak, canlı vinyet/gren ve basılı tutarak orijinal fotoğrafı görüntüleme

## Hızlı başlangıç

```bash
npm ci
npm run dev
```

Tarayıcıda gösterilen adrese gidin. Web önizlemesinde “Pro önizlemeyi etkinleştir” düğmesi ödeme almaz; yalnızca premium deneyimi test eder.

### Kontroller

```bash
npm run build   # TypeScript + production build
npm run test    # Görüntü motoru birim testleri
npm run lint    # ESLint
```

## Android

**Hazır test APK'sı:** [My Vision v1.1.0 debug APK](https://github.com/eraslan19j/Agent/releases/download/my-vision-v1.1.0-debug/My-Vision-1.1.0-debug.apk)

Yerel derleme gereksinimleri: JDK 21, Android Studio ve Android SDK 36.

```bash
npm run cap:sync
npm run android
```

veya komut satırından debug APK:

```bash
cd android
./gradlew assembleDebug
```

İmzalı Play Store AAB üretimi, RevenueCat ayarları ve release imzalama adımları için **[docs/PLAY_STORE.md](docs/PLAY_STORE.md)** dosyasını izleyin.

## Proje yapısı

```text
src/
  components/       Ana sayfa, keşfet, projeler, profil, paywall ve editör
  data/             Görünümler ve örnek galeri
  lib/              Canvas görüntü motoru, depolama, indirme ve RevenueCat
  types/            Ortak TypeScript tipleri
android/            Native Capacitor Android projesi
public/
  images/           Yerel örnek fotoğraflar
  privacy.html      Gizlilik politikası
  terms.html        Kullanım koşulları
resources/          İkon ve splash kaynakları
store/              Play Store ikonu, kapak görseli ve gerçek ekran görüntüleri
scripts/            Mağaza varlığı üretici
```

## Görüntü motoru

`src/lib/imageEngine.ts` CSS önizleme ile Canvas çıktısını aynı ayar modelinden üretir. Orijinal dosya değiştirilmez. Çıktı; kırpılmış ve döndürülmüş boyutları korur, cihaz belleğini korumak için seçilen maksimum kenara ölçeklenir. Gren rastgele çekirdekli olduğundan önizleme/çıktı yaklaşımı deterministiktir.

## Yayından önce zorunlu işler

- Gerçek destek e-posta adresini yapılandırın.
- `com.myvision.studio` paket sahipliğini doğrulayın.
- RevenueCat public Android key ve Play ürünlerini bağlayın.
- Gizlilik/koşul sayfalarını herkese açık HTTPS adresinde yayınlayın.
- Mağaza fiyatlarını Play Console ile eşleştirin.
- Gerçek Android cihazlarda satın alma, kamera ve dışa aktarma testlerini yapın.
- `versionCode` ve imzalama anahtarını güvenli biçimde yönetin.

Ayrıntılar: [Play Store rehberi](docs/PLAY_STORE.md) · [Mağaza metni](docs/store-listing-tr.md) · [Gelir modeli](docs/MONETIZATION.md)

## Not

Bu çalışma ortamında JDK/Android SDK bulunmadığından AAB/APK burada derlenmemiştir. Web production derlemesi, TypeScript, lint ve birim testleri doğrulanır; native proje Android Studio’da derlenmeye hazırdır.
