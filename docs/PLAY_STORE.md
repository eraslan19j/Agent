# Google Play yayın rehberi

## 1. Yayın öncesi yapılandırma

1. Node.js 20+, JDK 21 ve Android Studio'nun güncel sürümünü kurun.
2. Bağımlılıkları kurun: `npm ci`
3. `.env.example` dosyasını `.env.production` olarak kopyalayın.
4. RevenueCat Dashboard'da Google Play uygulaması oluşturun ve **public Android SDK key** değerini `VITE_REVENUECAT_ANDROID_API_KEY` alanına yazın. Secret API key'i uygulamaya koymayın.
5. RevenueCat entitlement adını varsayılan `My Vision Pro` olarak oluşturun veya `.env.production` içinde değiştirin.
6. Play Console'da şu ürünleri oluşturun:
   - Aylık abonelik, base plan aylık
   - Yıllık abonelik, base plan yıllık
   - Yıllık plana uygun hesaplar için 7 günlük ücretsiz deneme
7. Ürünleri RevenueCat'e bağlayın; `default` offering içinde `MONTHLY` ve `ANNUAL` paketlerini tanımlayın. Paket kimliklerini `.env.production` içindeki `VITE_REVENUECAT_MONTHLY_PACKAGE_ID` ve `VITE_REVENUECAT_YEARLY_PACKAGE_ID` alanlarına girin. Uygulama fiyatı, para birimini ve deneme süresini kodda sabitlenmiş değerden değil gerçek store product/default option verisinden gösterir.
8. `support@myvision.app` yerine aktif destek adresinizi `src/` ve `public/` altında değiştirin.
9. `public/privacy.html` ve `public/terms.html` sayfalarını HTTPS alan adınızda yayınlayın. Play Console'a bu herkese açık URL'leri girin.

## 2. Release bundle üretme

```bash
npm ci
npm run test
npm run lint
npm run cap:sync
cd android
./gradlew bundleRelease
```

İmzalama için `android/keystore.properties` oluşturun (bu dosya Git'e eklenmez):

```properties
storeFile=my-vision-release.jks
storePassword=GUVENLI_PAROLA
keyAlias=my-vision
keyPassword=GUVENLI_PAROLA
```

Anahtarı Android Studio veya `keytool` ile oluşturun ve anahtar deposunu güvenli, çevrimdışı bir yedekte saklayın. Play App Signing kullanılması önerilir. Çıktı:

`android/app/build/outputs/bundle/release/app-release.aab`

### GitHub Actions ile imzalı AAB (önerilen)

`.github/workflows/android-release.yml` yalnızca manuel çalışır ve imza malzemesini repository’ye yazmaz. Repository → Settings → Secrets and variables → Actions altına şu secret’ları ekleyin:

- `MYVISION_KEYSTORE_BASE64`: JKS dosyasının base64 çıktısı
- `MYVISION_STORE_PASSWORD`
- `MYVISION_KEY_ALIAS`
- `MYVISION_KEY_PASSWORD`

**Build signed Play Store AAB** workflow’unu çalıştırın. Secret eksikse iş açık hata verir; imzasız AAB yayınlanmaz. Başarılı işte `My-Vision-1.3.0-signed-play-aab` artifact’ı 14 gün saklanır. JKS ve parolalar Git’e eklenmemelidir.

## 2.1 Target API ve 16 KB uyumluluğu

- Resmî [Google Play target API gereksinimi](https://developer.android.com/google/play/requirements/target-sdk): **31 Ağustos 2026’dan itibaren yeni uygulamalar ve güncellemeler Android 16 / API 36 hedeflemelidir.** Proje `targetSdkVersion = 36` ve `compileSdkVersion = 36` kullanır.
- Resmî [16 KB sayfa boyutu rehberi](https://developer.android.com/guide/practices/page-sizes): Android 15+ hedefleyen 64-bit uygulamalar 16 KB cihazları desteklemelidir; desteklemeyen güncellemeler **1 Şubat 2027’den itibaren** yayınlanamaz. AGP 8.13.0 kullanılır.
- Uygulama Java/Kotlin + WebView kodudur; custom NDK/native `.so` eklenmemiştir. Debug CI `zipalign -c -P 16 -v 4` çalıştırır ve APK’daki `.so` sayısını bildirir. Native kütüphane çıkarsa ELF LOAD hizalaması ve gerçek 16 KB emulator/cihaz testi zorunludur.

## 3. Test ve dağıtım

- Önce **Internal testing** kanalına yükleyin.
- Gerçek cihazlarda galeri, kamera, proje kaydetme, JPG/PNG çıktı, paylaşım ve geri yükleme akışlarını test edin.
- Test lisanslı Google hesabıyla aylık/yıllık satın alma, deneme, iptal ve geri yükleme senaryolarını doğrulayın.
- Play Console Data safety bölümünde fotoğrafların sunucuya gönderilmediğini; satın alma bilgilerinin RevenueCat/Google Play tarafından işlendiğini doğru biçimde beyan edin.
- İçerik derecelendirmesi, hedef kitle, reklam içermeme beyanı ve uygulama erişimi formlarını doldurun.
- En az 2 telefon ve mümkünse tablet ekran görüntüsü yükleyin.
- Kapalı testten sonra üretime kademeli sunum yapın (%10 → %25 → %50 → %100).

## 4. Sürüm yükseltme

Her yeni sürümde `android/app/build.gradle` içindeki `versionCode` değerini artırın ve `versionName` değerini güncelleyin. `package.json` sürümünü de aynı tutun.

## Not

Bu çalışma alanında JDK/Android SDK bulunmadığı için web üretim derlemesi doğrulanmıştır; imzalı AAB dosyasını Android SDK bulunan bir ortamda yukarıdaki adımlarla üretmelisiniz.
