# OTONOM — Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada tarih sırasıyla (yeniden eskiye) tutulur.

## [black_2.9] — 2026-07-30

### İddia Analizi Video Hataları Düzeltildi
- **TTS hızı %25 artırıldı**: `RENDER_CONFIG.SPEECH_RATE: 1.25` — ağır/yapay konuşma fix
- **Konu-dışı ekonomi verisi yasaklandı**: ADIM 2'ye "KONU EKONOMİ DEĞİLSE: EKONOMİK VERİLERİ ASLA KULLANMA, ENJETE ETME" kuralı eklendi. ADIM 4'e "KONU-DIŞI VERİ YASAĞI" eklendi — belediye soruşturması gibi konulara asgari ücret/açlık sınırı enjekte edilmesi önlendi
- **Ses-görsel senkron düzeltildi**: `rawSlideSecs` buffer `+0.0` → `+0.3` (cümle kesilmesi önlendi), `rawCushion` `0.01` → `0.5` (video sonu ses kırıntısı önlendi), `playAudio` buffer `+0.05` → `+0.3`
- **TTS text cleaning güçlendirildi**: "İYİ" kelimesinin "için" olarak yanlış okunması fix (context koruma), `"` temizleme kaldırıldı (Türkçe metni bozuyordu)
- **Dosya adı**: `anti.2.8.jsx` → `anti.2.9.jsx`, `test_anti.2.8.js` → `test_anti.2.9.js`
- **Test**: 110 → 122 test (12 yeni test eklendi), 122/122 PASS

## [black_2.8] — 2026-07-30

### Dosya Yeniden Adlandırma
- `anti.1.0.jsx` → `anti.2.8.jsx` (dosya adı versiyonla eşleşti)
- `test_anti.1.0.js` → `test_anti.2.8.js` (test dosyası da güncellendi)
- Test dosyasındaki tüm `anti.1.0` referansları `anti.2.8` olarak güncellendi

### İddia Analizi Modülü Geliştirildi
- **ECONOMIC_DATA**: Her veri alanına `baseline2002` property'si eklendi (aclikSiniri, yoksullukSiniri, asgariUcret, emekli maası, TÜFE, faiz, dolar, euro, altın, işsizlik)
- **buildEconomicDataBlock()**: `[2002: X]` formatında baz yılı karşılaştırma gösterimi eklendi
- **sysPrompt tamamen yeniden yazıldı**: 4 adımlı yapı (girdiyi analiz et → konu ekonomi ise verileri kullan → doğrula → video senaryosu)
- **2002 baz yılı karşılaştırması**: "2002'de X idi, bugün Y oldu, Z kata çıktı" formatı
- **Dürüstlük kuralı**: "BİLMEDİĞİN şey için ASLA uydurma", "Doğrulanamıyor" de, blog/haber sitesi KAYNAK DEĞİLDİR
- **Tekrar kaldırıldı**: `XXXXX TL` placeholder'ları ve duplicate KURALLAR bölümleri yok edildi
- **Türkçe karakterler**: Prompt düzgün Türkçe karakterlerle yazıldı
- **Kaynaklar sahnesi güçlendirildi**: Kaynak adı + veri + URL birlikte, `kaynakSet` ile dedup, "KAYNAKLAR VE REFERANSLAR" başlığı
- **Ölü kod**: `getEconomyDataPrompt()` fonksiyonu kaldırıldı
- **Test**: 87 → 110 test (23 yeni test eklendi), 110/110 PASS

## [black_2.7] — 2026-07-29

### Buffer & CORS İyileştirmeleri
- Buffer token kontrolü: token YOK ise erken return + net hata mesajı
- isHttpsRemoteOrigin: hostname boş ise remote say (Gemini Canvas fix)
- CORS proxy URL encode + cors.eu.org eklendi
- UI: Ayarlar bölümüne Buffer API Token input eklendi
- Paylaşım log paneli: KOPYALA butonu + işlem bitse bile ekranda kalır
- Tüm paylaşım aşamalarında [DEBUG] detaylı log

## [black_2.5] — 2026-07-28

### Bug Fix'ler
- isVideoAsset bug fix
- getLinkedInServerUrl remote PNA engeli fix
- Buffer CORS proxy güncelleme (corsproxy.io + allorigins.win)

## [black_2.4] — 2026-07-27

### Sosyal Medya & Gazete Özellikleri
- LinkedIn API entegrasyonu
- Buffer API entegrasyonu
- Gazete crop sistemi
- Sosyal medya paylaşımı
- Bulut yükleme (catbox.moe, file.io)
- Güvenlik fix'leri: PROXY_AUTH_TOKEN constant'a taşındı, static_gzt hardcoded URL'ler dinamik slug'a çevrildi

## [black_2.3] — 2026-07-26

### Mimari Refactoring
- APP_VERSION objesi ile tek kaynak versiyon yönetimi
- Dead code (M1b Drive Helpers) kaldırıldı
- Magic number'lar RENDER_CONFIG / AI_CONFIG altında toplandı
- ErrorHandler.silent() ile boş catch blokları standardize edildi
- ObjectURLManager ile URL sızıntısı fix edildi
- var → let/const modernize edildi

## [black_2.2] — 2026-07-25

### Temizlik & Stabilite
- API key'ler temizlendi (NVIDIA, GROQ — boş string)
- bgmInitialized deklarasyonu düzeltildi (use-before-declare fix)
- FeatureFlags ölü kodu kaldırıldı
- 999 magic number → RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES

## [black_2.1] — 2026-07-24

### Hata Yönetimi
- fetchWithRetry'e exponential backoff + jitter eklendi
- React Error Boundary eklendi (beyaz ekran önlenir)
- sanitizeText() ile AI çıktısı XSS koruması

## [black_2.0] — 2026-07-23

### Yeni Mimari
- Modüler yapı (M1-M10 section header'lar)
- Versiyon notlarından duplikasyonlar temizlendi
- errorPatterns tek constant'a çıkarıldı
- OCR fallback mantığı tek fonksiyona indirildi
- UI badge dinamik (APP_VERSION.toString())

## [black_1.0 → 1.11] — 2026-07-15/22

### Temel Özellikler
- Gazete takip, ses mixleme, MP4 dönüşümü
- Firefox uyum, RAM fix (File System Access API)
- Instagram FPS fix, ffmpeg.wasm corePath
- Drive müzik kütüphanesi kaldırıldı
- OCR fonksiyonları birleştirildi
- NVIDIA/GROQ API key'ler eklendi
