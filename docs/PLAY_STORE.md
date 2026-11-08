# Google Play yayın rehberi

## 1. Yayın öncesi yapılandırma

1. Node.js 22, JDK 21 ve Android Studio'nun güncel sürümünü kurun.
2. Bağımlılıkları kurun: `npm ci`.
3. Uygulama kimliği `com.myvision.studio` için paket sahipliğini doğrulayın.
4. `public/privacy.html`, `public/privacy-en.html`, `public/terms.html` ve `public/terms-en.html` sayfalarını HTTPS alan adınızda yayınlayın. Play Console'a herkese açık URL'leri girin.
5. Mağaza metinlerini ve gerçek cihaz ekran görüntülerini güncel sürümle eşleştirin.
6. Bu sürümde hesap, ödeme ve bulut yapılandırması yoktur; herhangi bir servis anahtarı eklemeyin.

## 2. Kontroller ve release bundle

```bash
npm ci
npm run test
npm run lint
npm run test:ffmpeg
npm run build
npm run cap:sync
cd android
./gradlew bundleRelease
```

İmzalama için `android/keystore.properties` oluşturun; bu dosya Git'e eklenmez:

```properties
storeFile=my-vision-release.jks
storePassword=GUVENLI_PAROLA
keyAlias=my-vision
keyPassword=GUVENLI_PAROLA
```

Anahtar deposunu güvenli, çevrimdışı bir yedekte saklayın. Play App Signing kullanılması önerilir. Çıktı:

`android/app/build/outputs/bundle/release/app-release.aab`

### GitHub Actions ile imzalı AAB

`.github/workflows/android-release.yml` yalnızca manuel çalışır ve imza malzemesini repository’ye yazmaz. Repository → Settings → Secrets and variables → Actions altına şu secret’ları ekleyin:

- `MYVISION_KEYSTORE_BASE64`: JKS dosyasının base64 çıktısı
- `MYVISION_STORE_PASSWORD`
- `MYVISION_KEY_ALIAS`
- `MYVISION_KEY_PASSWORD`

**Build signed Play Store AAB** workflow’unu çalıştırın. Secret eksikse iş açık hata verir; imzasız AAB yayınlanmaz. Başarılı işte `My-Vision-1.4.0-signed-play-aab` artifact’ı 14 gün saklanır.

## 2.1 Target API ve 16 KB uyumluluğu

- Resmî [Google Play target API gereksinimi](https://developer.android.com/google/play/requirements/target-sdk): Proje `targetSdkVersion = 36` ve `compileSdkVersion = 36` kullanır. Gönderimden önce güncel resmî gereksinimi tekrar kontrol edin.
- Resmî [16 KB sayfa boyutu rehberi](https://developer.android.com/guide/practices/page-sizes): AGP 8.13.0 kullanılır.
- Uygulama Java/Kotlin + WebView kodudur; custom NDK/native `.so` eklenmemiştir. Debug CI `zipalign -c -P 16 -v 4` çalıştırır ve APK’daki `.so` sayısını bildirir. Native kütüphane çıkarsa ELF LOAD hizalaması ve gerçek 16 KB emulator/cihaz testi zorunludur.

## 3. Test ve dağıtım

- Önce **Internal testing** kanalına yükleyin.
- Gerçek cihazlarda galeri, kamera, proje kaydetme/yeniden açma, metin düzenleme, JPG/PNG çıktı ve paylaşım akışlarını test edin.
- Play Console Data safety bölümünde fotoğrafların ve projelerin cihazda işlendiğini, bu sürümün ödeme veya hesap verisi toplamadığını gerçek davranışa göre beyan edin.
- İçerik derecelendirmesi, hedef kitle, reklam içermeme beyanı ve uygulama erişimi formlarını doldurun.
- En az 2 telefon ve mümkünse tablet ekran görüntüsü yükleyin.
- Kapalı testten sonra üretime kademeli sunum yapın.

## 4. Sürüm yükseltme

Her yeni sürümde `android/app/build.gradle` içindeki `versionCode` değerini artırın ve `versionName` değerini güncelleyin. `package.json` sürümünü de aynı tutun. Workflow artifact ve release adlarındaki sürümü eşleştirin.
