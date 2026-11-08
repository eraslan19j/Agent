# FFmpeg.wasm çalışma zamanı

Bu dizin `@ffmpeg/core` 0.12.10 paketindeki değiştirilmemiş tek iş parçacıklı WebAssembly çekirdeğini içerir. WASM dosyası yalnızca Brotli ile sıkıştırılmıştır; işlevselliği değiştirilmemiştir.

- Çekirdek paketi: GPL-2.0-or-later (`LICENSE`)
- FFmpeg.wasm JavaScript sarmalayıcısı: MIT (`LICENSE-wrapper`)
- Kaynak ve derleme betikleri: https://github.com/ffmpegwasm/ffmpeg.wasm
- FFmpeg kaynak kopyası ve lisansları: https://github.com/FFmpeg/FFmpeg
- NPM paketi: https://www.npmjs.com/package/@ffmpeg/core/v/0.12.10

Uygulama bu çekirdeği Aşama 1 teknik doğrulaması için ayrı Worker içinde yükler.
