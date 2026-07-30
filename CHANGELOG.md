# OTONOM — Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada tarih sırasıyla (yeniden eskiye) tutulur.

## [black_3.4] — 2026-07-30

### Müzik Kalıcı Saklama Fix
- **Sorun 1 — SafeStorage.removeItem eksik**: `SafeStorage` objesinde `getItem` ve `setItem` var ama `removeItem` yoktu. 5+ yerde çağrılıyordu (müzik silme, prefs temizleme). TypeError veriyor, try/catch içinde sessizce fail ediyordu.
- **Çözüm**: `removeItem` metodu eklendi: `localStorage.removeItem` + memoryStore fallback.
- **Sorun 2 — Bulut yedek geçici servislerde**: `uploadMediaToCloud` sıralaması tmpfiles.org (geçici) → Python bridge → litterbox 1h → file.io idi. Hiçbiri kalıcı değildi. Refresh'te URL'ler ölü → geri yükleme fail → "Müzik kütüphanesi boş".
- **Çözüm**: catbox.moe kalıcı yükleme eklendi (CORS proxy üzerinden, sonsuz saklama, 200MB'a kadar). Yeni sıralama: catbox.moe kalıcı → tmpfiles.org → Python bridge → litterbox 72h → file.io.
- **Sorun 3 — Geri yükleme tek CORS proxy**: `loadLocalMusic` geri yükleme sadece `corsproxy.io` kullanıyordu. O fail olursa başka proxy yoktu.
- **Çözüm**: Çoklu CORS proxy fallback zinciri eklendi: corsproxy.io → allorigins.win → direct fetch.
- **Dosya adı**: `black.3.3.jsx` → `black.3.4.jsx`, `test_black.3.3.js` → `test_black.3.4.js`
- **Test**: 166 → 173 test (7 yeni test eklendi), 173/173 PASS

## [black_3.3] — 2026-07-30

### emotionForImage Scope Fix
- **Sorun**: v3.2'de müzik seçimi if/else dışına taşındı ama `emotionForImage` değişkeni hala `if (_isGuzelSoz)` bloğu içinde `const` olarak tanımlıydı. Gazete okuma ve normal modda `ReferenceError: emotionForImage is not defined` hatası veriyordu.
- **Çözüm**: `emotionForImage` tanımı if/else bloğunun öncesine taşındı. Artık tüm modlarda (güzel söz, gazete okuma, normal) erişilebilir.
- **Dosya adı**: `black.3.2.jsx` → `black.3.3.jsx`, `test_black.3.2.js` → `test_black.3.3.js`
- **Test**: 164 → 166 test (2 yeni test eklendi), 166/166 PASS

## [black_3.2] — 2026-07-30

### TTS Hızı + Müzik Seçimi + catbox CORS Fix
- **TTS hızı normal konuşma hızına getirildi**: `SPEECH_RATE: 1.25` → `1.0` — ne az ne çok, normal hız
- **Müzik seçimi gazete okuma modunda da çalışıyor**: `matchMusicToEmotion` + `_bgmId` ataması `if/else` bloğunun dışına taşındı. Önceki: sadece normal modda müzik seçiliyordu, gazete modunda "Render BGM: none" hatası veriyordu. Artık her iki modda da müzik otomatik seçiliyor.
- **catbox.moe CORS engeli fix**: Direkt `fetch('https://catbox.moe/user/api.php')` CORS engeline takılıyordu. Artık `uploadMediaToCloud` fonksiyonu kullanılıyor (tmpfiles.org → Python bridge → litterbox.catbox.moe → file.io failover zinciri)
- **Bulut yedek mesajı düzeltildi**: "Bulut yedek başarısız" → "Bulut yedek atlandı (IndexedDB'de mevcut, CORS engeli olabilir)" — daha doğru ve kullanıcıyı yanıltmayan mesaj
- **Dosya adı**: `black.3.1.jsx` → `black.3.2.jsx`, `test_black.3.1.js` → `test_black.3.2.js`
- **Test**: 159 → 164 test (5 yeni test eklendi), 164/164 PASS

## [black_3.1] — 2026-07-30

### İddia Analizi Prompt'u Genel Yapılandırıldı
- **Sorun**: İddia Analizi prompt'u sadece ekonomi odaklıydı. Belediye soruşturması, siyaset, hukuk gibi konularda AI neyi nasıl doğrulayacağını bilmiyordu. "KONU EKONOMİ DEĞİLSE: kullanma" diyordu ama ne yapacağını söylemiyordu.
- **Çözüm**: Prompt genel yapılandırıldı — TÜM konularda (siyaset, hukuk, belediye, sağlık, eğitim, güvenlik, dış politika, bilim) doğrulama yapacak şekilde yeniden yazıldı.
- **ADIM 2 yeniden yazıldı**: "KONU EKONOMİ İSE" → "KONUYA GÖRE VERİ KAYNAKLARI VE DOĞRULAMA". Konu türüne göre kaynak rehberi eklendi:
  - Siyaset/Belediye/Hukuk: İçişleri Bakanlığı, Adalet Bakanlığı, Yargıtay, Danıştay, Sayıştay, HSK, Anayasa Mahkemesi, resmigazete.gov.tr
  - Sağlık: Sağlık Bakanlığı, TÜİK, WHO, ECDC
  - Eğitim: MEB, YÖK, ÖSYM
  - Güvenlik/Terör: İçişleri Bakanlığı, Emniyet, Jandarma
  - Dış Politika: Dışişleri Bakanlığı
  - Bilim: TÜBİTAK
- **ADIM 3 güçlendirildi**: "İDDİA NE DİYOR vs GERÇEKTE NE VAR" karşılaştırma formatı. Google Search aktif kullanım vurgusu. Örnekler eklendi (belediye soruşturması, evden gözaltı).
- **ADIM 4 yeniden yapılandırıldı**: Senaryo yapısı değişti — Hook → İddia → Gerçek → Karşılaştırma → Kanıtlar → Sonuç → Kapanış. Amaç: "İnsanlar konuşmacının iddiasına körü körüne inanmamalı, gerçekte ne olduğunu kaynaklarla görmelidir."
- **Dürüstlük kurallarına eklendi**: TARAFSIZ OL (iktidar da muhalefet de aynı standart), KAYNAK ÇEŞİTLİLİĞİ (en az 2 kaynak)
- **Konu-dışı ekonomi yasağı korundu**: Ekonomi dışı konulara hala asgari ücret/açlık sınırı enjekte edilmiyor
- **Dosya adı**: `black.3.0.jsx` → `black.3.1.jsx`, `test_black.3.0.js` → `test_black.3.1.js`
- **Test**: 132 → 159 test (27 yeni test eklendi), 159/159 PASS

## [black_3.0] — 2026-07-30

### Müzik Kalıcı Saklama Çözümü
- **Sorun**: Gemini Canvas'ta IndexedDB refresh/değişiklik sonrası siliniyordu, müzik her seferinde yeniden yükleniyordu
- **Çözüm**: 3 katmanlı kalıcılık — IndexedDB (hızlı) + catbox.moe bulut yedek (kalıcı URL) + localStorage (URL listesi)
- **saveCloudMusicUrls/getCloudMusicUrls/removeCloudMusicUrl**: AssetManagerService'e cloud müzik URL metodları eklendi
- **handleFolderSelectLegacy**: Müzik dosyaları IndexedDB'ye kaydedilirken aynı anda catbox.moe'ye yükleme yapılıyor, URL'ler localStorage'a kaydediliyor
- **loadLocalMusic**: IndexedDB boşsa (refresh sonrası) catbox URL'leri corsproxy.io üzerinden fetch edilip IndexedDB'ye geri yükleniyor — kullanıcı müdahalesi gerekmez
- **deleteMusic**: Müzik silinirken catbox URL'i de localStorage'dan temizleniyor
- **Dosya adı**: `black.2.9.jsx` → `black.3.0.jsx`, `test_black.2.9.js` → `test_black.3.0.js`
- **Test**: 122 → 132 test (10 yeni test eklendi), 132/132 PASS

## [black_2.9] — 2026-07-30

### Dosya Yeniden Adlandırma
- `anti.2.9.jsx` → `black.2.9.jsx` (anti öneki kaldırıldı, black olarak devam)
- `test_anti.2.9.js` → `test_black.2.9.js`

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
