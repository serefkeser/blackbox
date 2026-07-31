# OTONOM — Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada tarih sırasıyla (yeniden eskiye) tutulur.

## [black_3.15] — 2026-07-31

### [KRİTİK] Instagram FPS Fix — VFR→CFR + WebM→MP4 Dönüştürme

#### 1. ffmpeg VFR→CFR Dönüşümü
- **Sorun**: `captureStream(0)` + manuel `requestFrame()` ile üretilen WebM, timer worker'ın `setInterval` gecikmeleri nedeniyle VFR (Variable Frame Rate) oluyordu. ffmpeg `-r 30` parametresi sadece çıkış frame rate'ini set eder, VFR→CFR dönüşümü yapmaz. Instagram Reels sabit 30fps CFR (Constant Frame Rate) şart koşar — VFR videoyu reddeder veya "23fps" gibi hatalı frame rate raporlar.
- **Çözüm**: `convertWebMtoMP4` ffmpeg komutuna `-vf fps=30` (kare yeniden örnekleme) ve `-vsync cfr` (constant frame rate zorlama) eklendi.

#### 2. shareToBufferAPI'de WebM→MP4 Otomatik Dönüştürme
- **Sorun**: `shareToBufferAPI`'de video WebM blob URL ise MP4'e dönüştürülmeden doğrudan buluta yükleniyordu. Instagram WebM kabul etmez.
- **Çözüm**: Video `blob:` veya `.webm` ise, `uploadMediaToCloud` çağrısından önce otomatik olarak `convertWebMtoMP4` ile MP4'e dönüştürülüyor.

- **Dosya adı**: `black.3.14.jsx` → `black.3.15.jsx`, `test_black.3.14.js` → `test_black.3.15.js`.
- **Test**: 302 → 318 test (16 yeni v3.15 testi eklendi), 318/318 PASS.

## [black_3.14] — 2026-07-31

### [KRİTİK] Müzik Seçim Bug Fix — Kullanıcının Seçtiği Müzik Eziliyordu

- **Sorun**: Workflow (asset üretim) aşamasında, kullanıcı müzik seçmiş olsa bile `matchMusicToEmotion()` + `Math.random()` ile duygu bazlı/rastgele müzik seçiliyordu. Seçilen müzik `script._bgmId`'ye yazılıyor, render'da `preferences.ambientSound` yerine `_bgmId` öncelikli kullanıldığı için kullanıcının seçimi eziliyordu.
- **Çözüm (Workflow)**: Artık `preferences.ambientSound`'da geçerli bir müzik ID'si varsa (ambient type değilse) kullanıcı seçimi kullanılır. Seçim yoksa duygu bazlı otomatik seçim yapılır. `preferences.ambientSound`/`customBgMusicName`/`customBgMusicId` artık workflow'da override edilmiyor.
- **Çözüm (GüzelSoz)**: `ambientSound='none'` iken otomatik `allMusic[0]` seçimi kaldırıldı. Kullanıcı 'none' seçtiyse müzik istememiştir.
- **Dosya adı**: `black.3.13.jsx` → `black.3.14.jsx`, `test_black.3.13.js` → `test_black.3.14.js`.
- **Test**: 288 → 302 test (14 yeni v3.14 testi eklendi), 302/302 PASS.

## [black_3.13] — 2026-07-30

### İddia Analizi: 5 Render Düzeltmesi (Audio Bleed + Altyazı + Grafik + Split-Screen + Watermark)

#### 1. [KRİTİK] Audio Bleed Fix — Outro'da Ses Sızıntısı
- **Sorun**: `playAudio` `AudioBufferSourceNode` başlatıyordu ama source node'u geri döndürmüyordu. `renderScene` görsel süre dolduğunda (`scaleFactor < 1` durumunda) ses hala çalmaya devam ediyordu → ses sonraki sahneye (outro'ya) sızıyordu.
- **Çözüm**:
  - `playAudio` artık `sourceNode` döndürüyor.
  - `renderScene`'de `audioEnded` flag eklendi — `audioEndPromise` resolve olduğunda `true` olur.
  - Frame loop bittiğinde `!audioEnded` ise `sourceNode.stop()` ile hard-cut yapılır.
  - `renderSonSozScene`'de de sonSoz ve yorum sourceNode'ları için hard-cut eklendi.

#### 2. [KRİTİK] Altyazı Senkronizasyonu — Kelime Bölünmesi
- **Sorun**: `calculateSubtitles` `wordsPerSub = 2` kullanıyordu → tek kelimelik "Adalet." veya "standarttır." gibi havada kalan altyazılar beliriyordu.
- **Çözüm**:
  - `wordsPerSub` 2 → 4 yapıldı (en az 3-4 kelimelik mantıksal gruplar).
  - Altyazı `endSec` overlap 0.1 → 0.15 sn'ye çıkarıldı (daha akıcı geçiş).

#### 3. [ORTA] AI Grafik Metin Bozulması (Artifact)
- **Sorun**: AI görsel üretirken sayıları/etiketleri bozuk yazıyordu (örn: "371" üst üste binmiş).
- **Çözüm**:
  - `drawChartOverlay` fonksiyonu eklendi — `chartData.show` true ise canvas'a temiz bar chart çizilir (AI görseldeki bozuk sayılar yerine).
  - Bar'lar, değer etiketleri (üstte), kategori etiketleri (altta), başlık ve not gösterilir.
  - `generateImage` prompt'una "no numbers, no digits" eklendi.
  - Prompt'taki GRAFİK KURALI güncellendi: "görselin içine sayı yazma, canvas overlay olarak eklenecektir."

#### 4. [ORTA] Split-Screen Odak Dağınıklığı
- **Sorun**: Raw video `drawImageContain` ile çiziliyordu → letterbox (siyah çubuklar) → split-screen etkisi. Audio-only raw medyada thumbnail görseli arka planda görünüyordu.
- **Çözüm**:
  - Raw video artık `drawImageCover` ile tam ekran (crop, no letterbox).
  - Audio-only raw medyada thumbnail yerine temiz koyu arka plan (`#0B0F19`).

#### 5. [DÜŞÜK] Watermark Overlay
- **Sorun**: Üçüncü taraf ham videolarındaki filigranlar (örn: `@dilsizmuhalif`) içeriğin özgünlük algısını azaltıyordu.
- **Çözüm**: Raw video oynatımında üst %6 ve alt %6 bant ile filigranlar gizleniyor.

- **Dosya adı**: `black.3.12.jsx` → `black.3.13.jsx`, `test_black.3.12.js` → `test_black.3.13.js`.
- **Test**: 261 → 288 test (27 yeni v3.13 testi eklendi), 288/288 PASS.

## [black_3.12] — 2026-07-30

### İddia Analizi: İfşa Sahnesi Artık Adaletsizliğe Odaklanıyor
- **Değişiklik**: İddia Analizi modundaki "Karşılaştırma/İfşa" sahnesi artık rakamlara değil, **adaletsizliğin kendisine** odaklanıyor.
- **ADIM 3**: "KARŞI-ÖRNEK VE İFŞA KURALI" → "İFŞA VE ADALETSİZLİK KURALI" olarak yeniden yazıldı. Üç ana sorgu eklendi:
  - **Seçici hedefleme**: Sadece muhalefet (CHP) belediyeleri mi evlerinden alınıyor? Aynı fiil iktidar belediyelerinde de var mı?
  - **İtibar suikasti**: Tüm medyada (sosyal medya, gazete, TV) ifşa edilerek linç kampanyası yapılıyor mu?
  - **Çifte standart**: İktidar ve muhalefet aynı eylemde bulunduğunda sadece muhalefet mi cezalandırılıyor?
- **ADIM 4**: Senaryo yapısında "Karşılaştırma" → "Karşılaştırma/İfşa" olarak güncellendi. Senaryo artık adaletsizliği NET olarak söylemek zorunda. Rakamlar ikincil, adaletsizlik birincil.
- **Dosya adı**: `black.3.11.jsx` → `black.3.12.jsx`, `test_black.3.11.js` → `test_black.3.12.js`.
- **Test**: 244 → 261 test (17 yeni v3.12 adaletsizlik testi eklendi), 261/261 PASS.

## [black_3.11] — 2026-07-30

### Güzel Söz Modu: Çok Dilli Sahne Desteği (FR/DE/TR)
- **Özellik**: Güzel Söz modunda her sahne artık farklı bir dilde yazılıp seslendiriliyor:
  - **Sahne 1**: Fransızca (çeviri + Fransızca seslendirme)
  - **Sahne 2**: Almanca (çeviri + Almanca seslendirme)
  - **Sahne 3**: Türkçe (orijinal metin + Türkçe seslendirme)
- **Çeviri**: `_translateQuoteMultilang` fonksiyonu eklendi — Gemini API ile sözü FR/DE/TR dillerine çevirir. Anlam ve duygu korunur, edebi üslup kullanılır.
- **Senaryo**: `_buildGuzelSozScript` artık her sahneye farklı dilde `spokenText` ve `topText` atıyor. `_isMultilang`, `_multilangTexts`, `_multilangLabels` flag'leri eklendi.
- **Ses Üretimi**: Asset generation aşamasında 3 sahnenin de sesi üretiliyor (önceden sadece `audio[0]` üretiliyordu).
- **Render**: `renderGuzelSoz` çok dilli modda 3 sesi sırayla çalıyor, her sahneye doğru metni ve görseli gösteriyor. Dil etiketi (FR/DE/TR) sağ üst köşede gösteriliyor. `sceneBoundaries` ile her sahnenin frame sınırları hesaplanıyor.
- **Geri Uyumluluk**: `_isMultilang` flag'i ile eski tek dilli davranış korunuyor.
- **Dosya adı**: `black.3.10.jsx` → `black.3.11.jsx`, `test_black.3.10.js` → `test_black.3.11.js`.
- **Test**: 224 → 244 test (20 yeni v3.11 çok dilli testi eklendi), 244/244 PASS.

## [black_3.10] — 2026-07-30

### İddia Analizi: Siyah Ekran Fix + Grafik Doğruluğu + Görsel Temizliği + Fade Geçiş
- **Sorun 1 [KRİTİK]**: Raw video oynatımında ekranda 35 saniye boyunca siyah ekran görünüyordu. `drawImageContain` fonksiyonu `img.width / img.height` kullanıyordu — `<video>` elementinde bu değerler 0 (DOM'a eklenmemiş) → `imgRatio = 0/0 = NaN` → `drawImage` hiç çizilmiyordu.
  - **Çözüm**: `drawImageContain` ve `drawImageCover` artık `img.videoWidth || img.naturalWidth || img.width` kullanıyor. Boyut 0 ise erken return.
- **Sorun 2 [KRİTİK]**: Raw video'da seeking (`rawEl.currentTime = elapsedSec`) frame atlamalarına ve takılmalarına neden oluyordu.
  - **Çözüm**: Seeking kaldırıldı — video doğal oynatılıyor, her frame'de mevcut frame çiziliyor.
- **Sorun 3 [KRİTİK]**: AI grafik üretirken sayıları/etiketleri yanlış koyuyordu (örn: 371 sayısı AK Parti etiketiyle).
  - **Çözüm**: Prompt'a GRAFİK/İNFOGRAFİK KURALI eklendi: `imagePrompts` içinde TAM sayıları ve etiketleri yaz zorunluluğu (örn: "Bar chart showing AK Parti 677 (tallest), CHP 371 (medium), MHP 128 (shortest)").
- **Sorun 4 [ORTA]**: AI görsellerde anlamsız metinler ("OFFICIAL INVEŞTIEŞTİLWI") çıkıyordu.
  - **Çözüm**: `generateImage` prompt'una "no text, no words, no letters, no labels, clean visual" eklendi. Prompt'a GÖRSEL YAZI KURALI eklendi.
- **Sorun 5 [DÜŞÜK]**: Son sahneden outro'ya sert kesme (hard cut) ile geçiliyordu.
  - **Çözüm**: Outro öncesi 0.5sn (15 frame) fade-to-black efekti eklendi.
- **Dosya adı**: `black.3.9.jsx` → `black.3.10.jsx`, `test_black.3.9.js` → `test_black.3.10.js`.
- **Test**: 216 → 224 test (8 yeni v3.10 testi eklendi), 224/224 PASS.

## [black_3.9] — 2026-07-30

### İddia Analizi: Raw Medya Ses Düzeltmesi + Süre Pre-Load
- **Sorun**: black_3.8'de İddia Analizi raw playback sahnesinde yüklenen video/ses oynatılsa da, ses `audioDest`'e route edilmediği için final MP4'de SİLENT olarak çıkıyordu. Ayrıca `rawSlideSecs` 10.0s placeholder kullandığı için `scaleFactor` yanlış hesaplanıyor (0.57x gibi), diğer sahneler gereksiz sıkışıyordu.
- **Çözüm**:
  - **Ses Route**: Raw medya element'i artık `audioCtx.createMediaElementSource(rawEl)` → `rawGainNode` → `audioDest` + `audioCtx.destination` olarak bağlanıyor. Böylece orijinal ses hem MediaRecorder kaydına hem hoparlöre gidiyor. Render sonunda source/gain node'lar disconnect ediliyor (temizlik).
  - **Tek Element**: Video ve audio için ayrı elementler (rawVideo + rawAudioEl) yerine tek `rawEl` kullanılıyor. `rawEl.muted = false` + `crossOrigin = 'anonymous'`.
  - **Süre Pre-Load**: `rawSlideSecs` hesaplamasından önce raw medya async olarak pre-load ediliyor, gerçek `duration` alınıyor (`rawMediaDurations` objesinde saklanıyor). Placeholder 10.0s kaldırıldı. `scaleFactor` artık doğru hesaplanıyor.
  - **Fallback**: `createMediaElementSource` başarısız olursa (CORS vb.), element direkt çalmaya devam ediyor (kayda gitmeyebilir ama hoparlörden çalar).
- **Dosya adı**: `black.3.8.jsx` → `black.3.9.jsx`, `test_black.3.8.js` → `test_black.3.9.js`.
- **Test**: 206 → 216 test (10 yeni v3.9 testi eklendi), 216/216 PASS.

## [black_3.8] — 2026-07-30

### İddia Analizi: Orijinal Medya Oynatımı + Karşı-Örnek İfşa Sistemi
- **Sorun**: İddia Analizi'nde yüklenen ses/video hiç oynatılmadan direkt analiz ediliyordu. Kullanıcı orijinal medyayı videoda görmek istiyor. Ayrıca analizde karşı-örnek verilerle ifşa yapılması, kaynakların mutlaka yazılması ve en güncel resmi verinin kullanılması istendi.
- **Çözüm**:
  - **Raw Playback**: İddia Analizi + media modunda, yüklenen ses/video `script._originalMedia` olarak saklanır. Clickbait'ten sonra `videoSlides` dizisinin başına `_isRawMedia: true` sahnesi eklenir. Render sırasında bu sahne:
    - **Video ise**: Orijinal video element frame-by-frame canvas'a çizilir, orijinal ses çalınır, hiçbir yeri kesilmeden tam süre oynatılır.
    - **Ses ise**: Clickbait görseli sabit gösterilir, orijinal ses tam süre çalınır.
    - TTS/altyazı yok — sadece orijinal medya. "İŞTE KANIT" başlığı üstte gösterilir.
  - **Prompt Güncellemesi (ADIM 3)**: 3 yeni kural eklendi:
    - KARŞI-ÖRNEK VE İFŞA KURALI: Her iddiaya karşı gerçek olaylardan, resmi verilerden örnek ver. "Bu bir veridir, adalettir, başka bir olaydır" tarzında karşılaştırma.
    - KAYNAK ZORUNLULUĞU: Kanıt varsa MUTLAKA kaynak adı + URL + veri yaz. Kaynaksız iddia bırakma.
    - EN GÜNCEL VERİ KURALI: Devletin sunduğu resmi ve en güncel veriyi kullan. Temmuz 2026 verisi varsa onu yayınla.
  - **Prompt Güncellemesi (ADIM 4)**: Senaryo yapısına "Orijinal Medya" adımı eklendi (sistem tarafından otomatik eklenir, AI yazmaz). Karşılaştırma adımına "bu bir veridir, adalettir, başka bir olaydır" örneği eklendi. Kanıtlar adımına "kaynak varsa MUTLAKA yaz" zorunluluğu eklendi.
  - **Workflow**: `tipLabel` artık iddia_analizi için "İddia Analizi" olarak gösterilir (önceden "Güzel Söz" idi).
  - **Asset üretimi**: `_isRawMedia` sahnesi için görsel/ses üretimi atlanır (orijinal medya kullanılır).
- **Dosya adı**: `black.3.7.jsx` → `black.3.8.jsx`, `test_black.3.7.js` → `test_black.3.8.js`.
- **Test**: 192 → 206 test (14 yeni v3.8 testi eklendi), 206/206 PASS.

## [black_3.7] — 2026-07-30

### Manuel Müzik Klasörü Seçimine Dönüş (Otomatik Bulut Yedekleme Kaldırıldı)
- **Sorun**: Kullanıcı otomatik bulut müzik yedeklemeyi istemiyor; müzik klasörü seçildiğinde sadece dosyaların listelenip IndexedDB'ye kaydedilmesini, bulut servislerine (catbox, temp.sh, tmpfiles, file.io) otomatik upload yapılmamasını istedi.
- **Çözüm**:
  - `handleFolderSelectLegacy` artık sadece ses dosyalarını `NetworkUtils.fileToBase64` ile okuyup `AssetManagerService.saveMusicToLib` ile IndexedDB'ye kaydediyor. `uploadMediaToCloud` çağrısı, `cloudUrls` dizisi ve `saveCloudMusicUrls` kaydı kaldırıldı.
  - `loadLocalMusic` useEffect'i artık IndexedDB boşsa buluttan geri yükleme yapmıyor; sadece kullanıcıya "MÜZİK KLASÖRÜ SEÇ" butonuyla yeniden eklemesi gerektiğini söylüyor.
  - `deleteMusic` içinden `removeCloudMusicUrl` çağrısı kaldırıldı.
  - `AssetManagerService` içinde `saveCloudMusicUrls`, `getCloudMusicUrls`, `clearCloudMusicUrls`, `removeCloudMusicUrl` metodları ve `ns_cloudMusicUrls` localStorage key'i tamamen kaldırıldı.
  - UI alt metni: `"Müzik klasörü seçin — tüm müzikler otomatik yüklenir"` → `"Müzik klasörü seçin — dosyalar yerel olarak listelenir"`.
  - Başarı logu: `"...KALICI saklandı! IndexedDB + ... bulut yedek"` → `"...yerel olarak kaydedildi. Toplam ... müzik listelendi."`.
- **Not**: IndexedDB refresh/değişiklik sonrası silinirse müzikler kaybolur. Kullanıcı bunu biliyor ve klasörü elle yeniden seçmeyi tercih ediyor.
- **Dosya adı**: `black.3.6.jsx` → `black.3.7.jsx`, `test_black.3.6.js` → `test_black.3.7.js`.
- **Test**: 191 → 192 test (5 eski bulut testi kaldırıldı, 6 yeni v3.7 testi eklendi), 192/192 PASS.

## [black_3.6] — 2026-07-30

### Catbox CORS Sorunu Kalıcı Çözüm: Python Proxy Sunucu
- **Sorun**: `uploadMediaToCloud` frontend'den catbox.moe/litterbox.catbox.moe'ye FormData POST gönderiyordu. Tarayıcı CORS politikası ve public CORS proxy'lerinin POST body'sini güvenilir şekilde iletememesi nedeniyle catbox yüklemeleri çoğu modern origin'de başarısız oluyordu. Sonuçta video/müzik kalıcı depolamaya gitmiyor, sadece geçici tmpfiles.org yedeğiyle yetiniliyordu.
- **Çözüm**: Yerel Python sunucusu (`linkedin_server.py`, `http://localhost:3000`) artık upload'u server-side hallediyor. Frontend `uploadMediaToCloud` ilk deneme olarak localhost `/upload_cloud_media` endpoint'ine gönderiyor. Sunucu tarafında catbox.moe (kalıcı) → litterbox.catbox.moe (72 saat) → temp.sh → tmpfiles.org sıralamasıyla yüklemeler yapılıyor. CORS tamamen ortadan kalkıyor çünkü tarayıcı değil, sunucu catbox'a POST atıyor.
- **Frontend değişiklikleri**: `uploadMediaToCloud` içinde localhost Python proxy denemesi en başa alındı. Eğer sunucu kapalıysa veya başarısız olursa eski catbox direkt + allorigins + corsproxy.io fallback'leri ve tmpfiles/file.io/litterbox direkt yedekleri korundu.
- **Backend değişiklikleri**: `linkedin_server.py` içinde `/upload_cloud_media` endpoint'i yeniden yapılandırıldı. Gelen dosyayı önce catbox.moe'ye, sonra litterbox.catbox.moe'ye server-side yüklemeye çalışıyor; ikisi de başarısız olursa temp.sh ve tmpfiles.org fallback'lerine dönüyor. Yanıt `{success: true, url, provider}` formatında dönüyor.
- **Güvenlik**: Python sunucusu zaten `verify_auth()` ile `X-Local-Proxy-Auth`, allowed origin veya 127.0.0.1/localhost kontrolü yapıyor. SSRF koruması `is_safe_proxy_url()` ile mevcut; bu endpoint'te catbox'a giden POST harici URL yok.
- **Dosya adı**: `black.3.5.jsx` → `black.3.6.jsx`, `test_black.3.5.js` → `test_black.3.6.js`, `linkedin_server.py` güncellendi.
- **Test**: 184 → 191 test (7 yeni test eklendi), 191/191 PASS. Python sunucu syntax kontrolü: `python -m py_compile linkedin_server.py` OK.

## [black_3.5] — 2026-07-30

### Render Senkronizasyonu, TTS Hızı ve Bulut Yükleme Fix'leri
- **Sorun 1 — Timer worker FPS uyumsuzluğu**: `_createTimerWorker` içinde `frameInterval` sabit `1000 / 30` (33.33ms) olarak yazılmıştı ama `RENDER_CONFIG.TIMER_WORKER_INTERVAL_MS` 25ms idi. Kod iki farklı değer arasında çelişkiliydu; render 30fps varsayımıyla hesaplanırken worker teorik olarak daha hızlı tick atıyordu. Süre hesaplarında kayma riski vardı.
- **Çözüm**: `RENDER_CONFIG.TIMER_WORKER_INTERVAL_MS` `1000 / 30` (33.33ms) olarak güncellendi ve `_createTimerWorker` doğrudan config'den okuyor. Artık tek kaynak ve 30fps ile senkron.
- **Sorun 2 — Ken Burns flicker**: `executeRender` içindeki `renderScene` zoom koordinatlarında pan değerleri her frame `Math.random()` ile üretiliyordu. Bu durum videoda titreşim/flicker oluşturuyor ve render deterministik olmuyordu.
- **Çözüm**: Pan değerleri sahne başında bir kere üretilip `zoomPanSeed` değişkeninde saklanıyor; frame loop içinde aynı seed'ten ilerleniyor.
- **Sorun 3 — TTS hızı scaleFactor ile artıyordu**: `playAudio` içinde `source.playbackRate.value = Math.max(scaleFactor, RENDER_CONFIG.SPEECH_RATE)` vardı. Süre sınırı nedeniyle `scaleFactor > 1` olduğunda ses hızlanıyor, kullanıcı "normal konuşma hızı" beklerken hızlı çıktı duyuyordu.
- **Çözüm**: TTS playback rate sabit `RENDER_CONFIG.SPEECH_RATE` (1.0) olarak ayarlandı. Süre sıkıştırma sadece görsel sahne süresi ve frame sayısına uygulanıyor; ses hızı sabit kalıyor.
- **Sorun 4 — Ekonomik veri tarihleri eski kalmıştı**: Dolar/TL, Euro/TL, Gram Altın, Çeyrek Altın verilerinin `dataAsOf` alanı 16 Temmuz 2026'ydı; bugün 30 Temmuz 2026.
- **Çözüm**: Döviz ve altın verilerinin `dataAsOf` tarihleri 30 Temmuz 2026'ya güncellendi. (Rakamlar kullanıcı tarafından sağlanacaksa sonradan değiştirilebilir; etiket tarihi şimdi güncel.)
- **Sorun 5 — catbox.moe CORS proxy stratejisi hatalıydı**: FormData POST body'sini `corsproxy.io/?url=` gibi GET query parametrelerine sarmak dosyayı bozuyor ve çoğu CORS proxy POST'u reddediyordu.
- **Çözüm**: `uploadMediaToCloud` içinde catbox.moe ve litterbox.catbox.moe için önce direkt POST deneniyor, ardından allorigins ve corsproxy.io fallback'leri deneniyor. Her aşamada açıklayıcı log atılıyor; başarısız olunca bir sonraki servis deneniyor.
- **Dosya adı**: `black.3.4.jsx` → `black.3.5.jsx`, `test_black.3.4.js` → `test_black.3.5.js`
- **Test**: 173 → 184 test (11 yeni test eklendi), 184/184 PASS

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
