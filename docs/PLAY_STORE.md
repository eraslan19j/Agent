# Google Play yayın rehberi

## 1. Yayın öncesi yapılandırma

1. Node.js 20+, JDK 17 ve Android Studio'nun güncel sürümünü kurun.
2. Bağımlılıkları kurun: `npm ci`
3. `.env.example` dosyasını `.env.production` olarak kopyalayın.
4. RevenueCat Dashboard'da Google Play uygulaması oluşturun ve **public Android SDK key** değerini `VITE_REVENUECAT_ANDROID_API_KEY` alanına yazın. Secret API key'i uygulamaya koymayın.
5. RevenueCat entitlement adını varsayılan `My Vision Pro` olarak oluşturun veya `.env.production` içinde değiştirin.
6. Play Console'da şu ürünleri oluşturun:
   - Aylık abonelik, base plan aylık
   - Yıllık abonelik, base plan yıllık
   - Yıllık plana uygun hesaplar için 7 günlük ücretsiz deneme
7. Ürünleri RevenueCat'e bağlayın; `default` offering içinde `MONTHLY` ve `ANNUAL` paketlerini tanımlayın.
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
