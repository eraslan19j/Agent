# Editör hata raporu — Aşama 0

Tarih: 7 Kasım 2026. Bu rapor uygulama kodu değiştirilmeden önce hazırlandı. Bulgular kod incelemesine ve mevcut browser geometri testinin çıktısına dayanır.

## Başlangıç kanıtı

- `npm run test -- --reporter=dot`: 5 dosya, **40/40 PASS**.
- `.arena/editor-geometry.mjs`: EXIF’li dikey, 1200×1600 dikey ve panorama örneklerinin üçünde **`centered:false`**.
- Aynı panorama dosyası 4000×1000 kaynaktan **2800×700** olarak editöre alındı; boyut kaybı browser’da ölçüldü.

## P0 — Kritik

### 1. Önizleme iki kez merkezleniyor

- **Dosya:** `src/components/PhotoEditor.tsx`, `previewImageStyle` ve `transform`; `src/styles.css`, `.photo-stage__image`.
- **Kanıt:** Parent flex ile görüntüyü ortalıyor. Transform ayrıca `translate(-50%, -50%)` uyguluyor. Browser testinde bütün örneklerde görüntü merkezi sahne merkezinden farklı.
- **Kök neden:** Flex merkezleme ile transform merkezlemenin birlikte kullanılması; döndürme/kırpma offset’i aynı transform zincirine eklenince hata büyüyor.
- **Plan:** Tek merkezleme yöntemi kullan; kırpma/döndürme/aynala offset’lerini kaynak koordinatından sahne koordinatına açık bir hesapla bağla. 1:1, 4:3, 16:9, 9:16, 1:4, 8000px+, EXIF ve döndürme regresyonları ekle.

### 2. İçe aktarmada orijinal çözünürlük kalıcı olarak kayboluyor

- **Dosya:** `src/lib/imageEngine.ts`, `preparePhoto()`; `src/components/PhotoEditor.tsx`, export çağrıları.
- **Kanıt:** Bütün büyük kaynaklar `maxDimension=2800` ile data URL’e çiziliyor. `renderPhoto()` aynı azaltılmış `session.source` değerini kullanıyor.
- **Kök neden:** Önizleme proxy’si ile export kaynağı ayrılmamış.
- **Plan:** Orijinal Blob/object URL ile düşük boyutlu önizleme proxy’sini ayır. Orijinali IndexedDB’de sakla; önizleme/thumbnail/histogram için proxy kullan, export için orijinali kullan. URL sahipliğini ve revoke yaşam döngüsünü tanımla.

## P1 — Yüksek

### 3. Yoğunluk etiketi ile orijinal ipucu aynı konuma yazılmış

- **Dosya:** `src/styles.css`, `.original-hold` ve `.preset-indicator`; `src/components/PhotoEditor.tsx`.
- **Kanıt:** İki mutlak etiket de `bottom:12px` kullanıyor.
- **Plan:** Önizleme dışında tek durum chip’i kullan; orijinal kontrolünü araç çubuğuna taşı. İpucunu kullanım sayısıyla sınırla ve safe-area uygula.

### 4. Mobil panel ve yoğunluk kontrolü erişilebilir başlangıç konumunda değil

- **Dosya:** `src/styles.css`, mobil `.editor-panel`; `src/components/PhotoEditor.tsx`, looks paneli.
- **Kanıt:** Panel `%43` yükseklik ve en az `280px`; yoğunluk kontrolü yatay preset listesinin ve tarif araçlarının öncesinde değil, preset listesinin altında. Paneli kapatma kontrolü yok.
- **Plan:** Sabit sekmeler + bağımsız kayan içerik + sınırlı `dvh` yüksekliği kullan. Yoğunluğu küçük resimlerin üstünde sticky şeride al. Panel aç/kapat düğmesi ve safe-area padding ekle.

### 5. Kaydedilmemiş değişiklik kaybı engellenmiyor

- **Dosya:** `src/components/PhotoEditor.tsx`, `src/App.tsx` Android `backButton` dinleyicisi.
- **Kanıt:** Dirty state yok; çıkış `onClose` ve Android geri `setSession(null)` yapıyor.
- **Plan:** Ad + ayar snapshot’ı ile dirty takibi, kaydet sonrası temiz snapshot, çıkış onay dialog’u, `beforeunload`; Android geri işlemini aynı editör kapanış akışına bağla.

### 6. Eski preview işleri iptal edilmiyor

- **Dosya:** `src/components/PhotoEditor.tsx`, advanced preview effect; `src/lib/pixelScheduler.ts`.
- **Kanıt:** `active=false` yalnız eski sonucun state’e yazılmasını engelliyor. Worker’a gönderilen eski işler iptal edilmiyor ve worker tek kuyrukla çalışıyor.
- **Plan:** Slider state’ini rAF ile sınırla, her preview için AbortController üret, iptalde dedicated worker’ı terminate et. Yalnız en güncel sonucu URL’ye çevir. Ağır piksel işini worker’da tut.

### 7. Export dialog önizlemesi gerçek çıktıyı temsil etmiyor

- **Dosya:** `src/components/PhotoEditor.tsx`, `.export-preview`.
- **Kanıt:** Dialog yalnız `session.source + CSS filter` gösteriyor; kırpma, döndürme, gelişmiş piksel işlemleri, metin ve çerçeve bu görüntüde uygulanmıyor.
- **Plan:** Güncel render edilmiş önizlemeyi kullan; gerekirse dialog açılırken mevcut ayarlarla proxy üret.

## P2 — Kalite ve yaşam döngüsü

### 8. Object URL sahipliği eksik

- **Dosya:** `src/lib/storage.ts`, `src/App.tsx`, advanced preview effect.
- **Kanıt:** Advanced preview URL’leri revoke ediliyor. Storage proje URL’leri yalnız proje silinirken revoke ediliyor; uygulama unmount temizliği yok. Yeni import için kaynak sahipliği modeli yok.
- **Plan:** Sahiplik bayrakları, yeni kaynakta taze object URL, session/unmount cleanup ve iptal edilen import cleanup’ı ekle. Bitmap kapatmayı koru.

### 9. İkon tooltip’leri ve bazı erişilebilir adlar eksik

- **Dosya:** `src/components/PhotoEditor.tsx`.
- **Kanıt:** Üst/alt ikon düğmelerinin bir bölümünde `aria-label` var; uzun basma tooltip sistemi yok. Panel ve özgün bazı kontrollerde metin alternatifi bulunmuyor.
- **Plan:** Erişilebilir ad + `title` + uzun basma tooltip, 44px hedef ve axe regresyonu.

### 10. Slider reset çift history üretebilir

- **Dosya:** `src/components/EditorSlider.tsx`.
- **Kanıt:** Aynı `onReset` hem `onClick` hem `onDoubleClick`’e bağlı.
- **Plan:** Tek click kullan; gesture başlangıcı/bitişi ve undo/redo testleri ekle.

### 11. Yeni çeviriler için merkezi kapsama zayıf

- **Dosya:** `src/lib/localization.ts` ve editör bileşenleri.
- **Kanıt:** Çeviri sistemi metin eşleştirmeli; kaldırılmış özelliklere ait eski eşleşmeler hâlâ bulunuyor. Yeni kontroller eklenirse eksik çeviri riski doğrudan var.
- **Plan:** Yeni metinlerin TR/EN karşılıklarını ekle, kullanılmayan eski eşleşmeleri temizle ve browser’da İngilizce görünüm/taşma kontrolü yap.

## Aşama 1 kabul kapıları

1. Bütün aspect ratio ve EXIF örneklerinde görüntü merkezli, contain ve kırpılmadan görünmeli.
2. 8000px+ kaynak proxy ile önizlenmeli; export boyut hesabı orijinal ölçülerden yapılmalı.
3. Etiketler çakışmamalı; panel ve yoğunluk küçük ekranda kullanılabilmeli.
4. Kirli çıkış hem düğme hem Android geri için onay istemeli.
5. Eski worker sonucu yeni ayarların üzerine çıkmamalı; iptalde worker sonlanmalı.
6. Mevcut 40 birim + 10 browser kontrolü, yeni testler, lint, strict TypeScript, production build ve Android CI geçmeli.
7. Fiziksel cihaz performansı ve native yaşam döngüsü ayrıca elle raporlanmalı; browser kanıtı bunların yerine sunulmamalı.

## Uygulama sonrası doğrulama

Düzeltmelerin kapsamı, 44 birim + 23 Chromium kontrolü, önce/sonra ekran kanıtları ve hâlâ açık fiziksel cihaz kapıları için bkz. [`PHASE1_VERIFICATION.md`](./PHASE1_VERIFICATION.md).
