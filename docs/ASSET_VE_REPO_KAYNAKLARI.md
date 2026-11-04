# AETHERION — Repo ve Asset Kaynakları

> v0.1 **hiçbir dış asset kullanmaz**: tüm modeller, dokular, arayüz ve sesler kodla üretilir (CC0 / telifsiz, sıfır lisans riski).
> Bu dosya, sonraki sürümlerde kaliteyi yükseltmek için **doğrulanmış** kaynakları ve entegrasyon planını listeler.

Lisans sütunu kaynağın kendi beyanına dayanır; her paket entegre edilmeden önce tekrar kontrol edilmelidir.

---

## 1. Çekirdek kütüphaneler (kullanımda)

| Kütüphane | Sürüm | Lisans | Kullanım | Link |
|-----------|-------|--------|----------|------|
| three.js | 0.169 | MIT | Tüm render hattı | https://github.com/mrdoob/three.js |
| Vite | 5.4 | MIT | Paketleme / dev sunucu | https://github.com/vitejs/vite |
| TypeScript | 5.6 | Apache-2.0 | Dil | https://github.com/microsoft/TypeScript |
| Cinzel | – | OFL 1.1 | Başlık tipografisi | https://fonts.google.com/specimen/Cinzel |
| Inter | – | OFL 1.1 | Gövde tipografisi | https://github.com/rsms/inter |
| androidx.webkit | 1.11.0 | Apache-2.0 | WebViewAssetLoader | https://github.com/androidx/androidx |

---

## 2. Fizik / simülasyon adayları (v0.2)

| Proje | Lisans | Boyut | Neden |
|-------|--------|-------|-------|
| **Rapier** (`@dimforge/rapier3d-compat`) | Apache-2.0 | ~600 KB wasm | Rust tabanlı, mobilde hızlı, deterministik; kırılabilir nesneler, düşen kayalar, sandık fiziği | https://github.com/dimforge/rapier |
| cannon-es | MIT | ~150 KB | Daha hafif alternatif, JS | https://github.com/pmndrs/cannon-es |
| JoltPhysics.js | MIT | ~1 MB | Yüksek doğruluk, büyük sahneler | https://github.com/jrouwe/JoltPhysics.js |
| ammo.js | zlib | ~1.5 MB | Eski ama olgun | https://github.com/kripken/ammo.js |
| recast-navigation-js | MIT | ~500 KB | NavMesh + kalabalık YZ | https://github.com/isaac-mason/recast-navigation-js |

**Karar:** v0.2'de **Rapier** (yalnızca dinamik proplar için; karakter analitik kalır).

---

## 3. Karakter / yaratık modelleri (CC0)

| Kaynak | İçerik | Lisans | Link |
|--------|--------|--------|------|
| KayKit Character Packs (GitHub) | İskeletli, 90+ animasyonlu, atlas dokulu low-poly karakterler | CC0 | https://github.com/KayKit-Game-Assets |
| KayKit – Skeletons 1.0 | 4+2 iskelet karakter, mobil optimize | CC0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 |
| Quaternius | RPG Characters, Knight, Ultimate Modular Characters (glTF) | CC0 | https://quaternius.com |
| Kenney | Modular characters, props, UI kit, ses paketleri | CC0 | https://kenney.nl/assets |
| Poly Pizza | Topluluk low-poly model arama motoru | CC0/CC-BY karışık (kontrol et) | https://poly.pizza |
| glTF Sample Assets (Khronos) | Test/format referansı (Fox, CesiumMan, DamagedHelmet) | CC0/CC-BY | https://github.com/KhronosGroup/glTF-Sample-Assets |
| Mixamo | İnsan iskelet + animasyon kütüphanesi | Ücretsiz kullanım (Adobe şartları) | https://www.mixamo.com |

**Entegrasyon planı (v0.4):**
1. `GLTFLoader` + `SkeletonUtils.clone()` ile iskeletli karakter.
2. `AnimationMixer` ile 8 temel klip: `idle, run, sprint, jump, fall, glide, attack1-3, skill, burst`.
3. Mevcut `HumanoidRig` arayüzü korunur → `Rig` arayüzü (`update(pose)`) aynı kalır, oyun kodu değişmez.
4. Atlas dokusu 1024² → 512²'ye düşürülür (mobil bellek).

---

## 4. Çevre ve doku (CC0)

| Kaynak | İçerik | Lisans | Link |
|--------|--------|--------|------|
| Poly Haven | HDRI, PBR doku, modeller | CC0 | https://polyhaven.com |
| ambientCG | PBR malzeme (taş, toprak, metal) | CC0 | https://ambientcg.com |
| cgbookcase | Photoscanned PBR | CC0 | https://www.cgbookcase.com |
| TextureCan | PBR + SBSAR | CC0 | https://www.texturecan.com |
| OpenGameArt | 2D/3D/ses topluluğu (lisanları kontrol et) | Karışık | https://opengameart.org |
| Free Game Dev Assets (katalog) | Lisansları kaydedilmiş küratörlü liste | Katalog CC0 | https://github.com/Gatyh/Free-Game-Dev-Assets |

**v0.3 hedefi:** araziye 2 katman triplanar PBR (çim + kaya) → görsel sıçrama; şu an vertex-color ile idare ediliyor.

---

## 5. Ses

| Kaynak | İçerik | Lisans | Link |
|--------|--------|--------|------|
| Freesound | Kayıt kütüphanesi | CC0 / CC-BY (dosya bazında) | https://freesound.org |
| Sonniss GDC Bundle | Yıllık ücretsiz profesyonel SFX paketi (GB'larca) | Sonniss lisansı (ticari OK) | https://sonniss.com/gameaudiogdc |
| Kenney Audio | UI/sfx paketleri | CC0 | https://kenney.nl/assets?q=audio |
| OpenGameArt – Music | Müzik döngüleri | CC-BY/CC0 karışık | https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12 |

**Mevcut durum:** tüm sesler WebAudio ile sentezleniyor (`core/audio.ts`) — dosya yok, lisans yok. v0.6'da Freesound'dan 30–40 CC0 örnek ile katmanlanacak (boyut hedefi +4 MB).

---

## 6. Referans / ilham projeleri (kod okuması için)

| Proje | Ne öğretir | Link |
|-------|-----------|------|
| three.js open world (JiguDev) | Prosedürel arazi + 3. şahıs kontrolcü temel desenleri | https://github.com/JiguDev/threejs-open-world |
| shellbound (jgunaratne) | Three.js + React/Vite açık dünya prototipi, kamera/arazi ayrımı | https://github.com/jgunaratne/shellbound |
| jungle-trail (StarKnightt) | Sıfır-asset prosedürel dünya, prosedürel karakter, GPU doku üretimi | https://github.com/StarKnightt/jungle-trail |
| three.js örnekleri | Post-processing, instancing, materyal referansları | https://threejs.org/examples |
| Babylon.js | Alternatif motor; PBR/mobil optimizasyon yaklaşımları | https://github.com/BabylonJS/BabylonJS |
| Godot (MIT) | Açık kaynak oyun motoru; mobil export boru hattı karşılaştırması | https://github.com/godotengine/godot |
| Filament (Google) | Mobil PBR render referansı (CLUSTER forward, tone mapping) | https://github.com/google/filament |

> Not: Genshin Impact'in varlıkları, sesleri veya kodu **hiçbir koşulda** kullanılmaz; tür benzerliği dışında bağ yoktur.

---

## 7. Araçlar

| Araç | Amaç | Link |
|------|------|------|
| Blender | Model/animasyon düzenleme, glTF export | https://www.blender.org |
| gltf-transform | glTF optimizasyonu (Draco, KTX2, sadeleştirme) | https://github.com/donmccurdy/glTF-Transform |
| TexturePacker / free-tex-packer | Atlas üretimi | https://github.com/odrick/free-tex-packer |
| Spector.js | WebGL frame debug | https://github.com/BabylonJS/Spector.js |
| Android Studio | APK imzalama/profiling | https://developer.android.com/studio |
| Firebase Crashlytics (WebView köprüsü) | Saha çökme takibi (v0.5) | https://firebase.google.com/products/crashlytics |

---

## 8. Lisans uyum politikası (proje kuralı)

1. **Yalnızca CC0, MIT, Apache-2.0, OFL** veya yazılı ticari izin veren kaynaklar.
2. Her yeni asset için `docs/CREDITS.md`'ye **kaynak + lisans + URL + indirme tarihi** satırı zorunlu.
3. CC-BY kullanılırsa oyun içi “Krediler” ekranında isim zorunlu.
4. “Genshin/Riot/Blizzard asset” içeren hiçbir paket repoya girmez.
5. CI kontrolü (v0.3): `tools/check-licenses.mjs` → CREDITS.md'de karşılığı olmayan dosya varsa build kırılır.
