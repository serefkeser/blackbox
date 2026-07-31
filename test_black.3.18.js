const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const FILE = path.join(__dirname, 'black.3.18.jsx');
const PY_FILE = path.join(__dirname, 'linkedin_server.py');
const src = fs.readFileSync(FILE, 'utf-8');
const pySrc = fs.readFileSync(PY_FILE, 'utf-8');
const lines = src.split('\n');
let pass = 0, fail = 0;
const out = [];

function t(name, cond, detail) {
  if (cond) pass++; else fail++;
  out.push(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
}

function isComment(l) {
  const t = l.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

// 1. Babel syntax
try {
  parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
  t('Babel Syntax Parse', true);
} catch (e) {
  t('Babel Syntax Parse', false, e.message);
}

// 2. API keys
const nv = src.match(/NVIDIA_API_KEY\s*=\s*["']([^"']*)["']/);
const gq = src.match(/GROQ_API_KEY\s*=\s*["']([^"']*)["']/);
t('NVIDIA_API_KEY empty', nv && nv[1] === '', nv ? `"${nv[1].slice(0,15)}"` : 'not found');
t('GROQ_API_KEY empty', gq && gq[1] === '', gq ? `"${gq[1].slice(0,15)}"` : 'not found');
t('No nvapi- key', !/nvapi-[A-Za-z0-9_-]{20,}/.test(src));
t('No gsk_ key', !/gsk_[A-Za-z0-9]{20,}/.test(src));

// 3. APP_VERSION (updated to 3.13)
t('APP_VERSION major=3', /APP_VERSION\s*=\s*\{[\s\S]*?major:\s*3[,\s]/.test(src));
t('APP_VERSION minor=18', /APP_VERSION\s*=\s*\{[\s\S]*?minor:\s*18[,\s]/.test(src));
t('APP_VERSION hotfix=H3.18', /hotfix:\s*['"]H3.18['"]/.test(src));

// 4. exportWorkflowLog uses APP_VERSION.toString()
const exLog = src.match(/exportWorkflowLog[\s\S]{0,2000}/);
t('exportWorkflowLog uses APP_VERSION.toString()', exLog && exLog[0].includes('APP_VERSION.toString()'));

// 5. FeatureFlags removed
const ff = src.match(/^[^/]*FeatureFlags\s*=/gm);
t('FeatureFlags removed', !ff || ff.length === 0, ff ? `${ff.length} matches` : '');

// 6. MAX_CUSTOM_SCENE_IMAGES
t('MAX_CUSTOM_SCENE_IMAGES:5', /MAX_CUSTOM_SCENE_IMAGES:\s*5/.test(src));
const s999 = lines.filter(l => l.includes('999') && !l.includes('MAX_CUSTOM') && !isComment(l) &&
  /scene|Scene|image|Image|file|File/.test(l));
t('No 999 for scene/image/file', s999.length === 0, s999.length > 0 ? `${s999.length} lines` : '');

// 7. var → let/const
const vars = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&/(^|[;{\(])\s*var\s+/.test(l));
t('No var declarations', vars.length === 0, vars.length ? vars.slice(0,3).map(v=>`L${v.n}`).join(',') : '');

// 8. window._outroParticles removed
const wop = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&l.includes('window._outroParticles'));
t('No window._outroParticles', wop.length === 0, wop.length ? wop.map(v=>`L${v.n}`).join(',') : '');

// 9. CORS proxy order — anti.1.0 uses spread operator, check by line position
const corsStart = lines.findIndex(l => l.includes('CORS_PROXIES') && l.includes('['));
const corsEnd = lines.findIndex((l,i) => i > corsStart && l.includes('];'));
if (corsStart >= 0 && corsEnd >= 0) {
  const corsBlock = lines.slice(corsStart, corsEnd + 1).join('\n');
  const pubIdx = corsBlock.indexOf('whateverorigin');
  const localIdx = corsBlock.indexOf('localhost:3457');
  t('Localhost proxy after public in CORS_PROXIES', pubIdx >= 0 && localIdx >= 0 && localIdx > pubIdx,
    `pub:${pubIdx} local:${localIdx}`);
} else { t('CORS_PROXIES found', false); }
// https://localhost only allowed in LinkedIn server detection, NOT in CORS_PROXIES
const httpsLh = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&/https:\/\/localhost/.test(l)&&!l.includes('linkedin')&&!l.includes('LinkedIn')&&!l.includes('3001'));
t('No https://localhost in CORS proxies', httpsLh.length === 0, httpsLh.length ? httpsLh.map(v=>`L${v.n}`).join(',') : '');
t('No port 3456 reference', !lines.some((l,i) => !isComment(l) && /3456/.test(l)));

// 10. ObjectURLManager.revokeAll()
t('revokeAll() called', /ObjectURLManager\.revokeAll\(\)/.test(src));
const ue = src.match(/useEffect\([\s\S]*?return\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}/g);
t('revokeAll in useEffect cleanup', ue && ue.some(m=>m.includes('revokeAll')));

// 11. sanitizeText
const sm = src.match(/const\s+sanitizeText\s*=\s*\(text\)[\s\S]{0,800}/);
t('sanitizeText data:', sm && sm[0].includes('data:'));
t('sanitizeText vbscript:', sm && sm[0].includes('vbscript:'));
t('sanitizeText HTML entity', sm && sm[0].includes('&#'));

// 12. ErrorHandler.sync
t('ErrorHandler.sync defined', /ErrorHandler\s*=\s*\{[\s\S]*?sync\s*\(/.test(src));
t('ErrorHandler.sync called', /ErrorHandler\.sync\(/.test(src));
const sw = (src.match(/console\.warn\(["']Otomatik senkronizasyon hatası["']/g)||[]).length;
t('No dup sync console.warn', sw === 0, sw ? `${sw} remaining` : '');

// 13. Dynamic date functions
t('_getCurrentMonthYearTR defined', /_getCurrentMonthYearTR/.test(src) && /function\s+_getCurrentMonthYearTR|const\s+_getCurrentMonthYearTR/.test(src));
t('_getCurrentDateTR defined', /_getCurrentDateTR/.test(src) && /function\s+_getCurrentDateTR|const\s+_getCurrentDateTR/.test(src));

// 14. bgmInitialized before loadBGM
const bi = lines.findIndex(l=>l.includes('let bgmInitialized = false'));
const lb = lines.findIndex(l=>/function\s+loadBGM\s*\(|loadBGM\s*=\s*(?:async\s*)?\(/.test(l));
t('bgmInitialized before loadBGM', bi>=0 && lb>=0 && bi<lb, `bgm:L${bi+1} load:L${lb+1}`);

// 15. No import.meta.env
const im = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&l.includes('import.meta.env'));
t('No import.meta.env', im.length === 0, im.length ? im.map(v=>`L${v.n}`).join(',') : '');

// 16. File size sanity
const stat = fs.statSync(FILE);
t('File size > 200KB', stat.size > 200000, `${(stat.size/1024).toFixed(0)}KB`);
t('Line count ~6700', lines.length >= 6700 && lines.length <= 7000, `${lines.length} lines`);

// 17. Duplicate imgType check
const imgTypeCount = (src.match(/\bconst\s+imgType\b/g) || []).length;
t('No duplicate const imgType', imgTypeCount <= 1, `${imgTypeCount} found`);

// 18. processSelectedFiles limit
const pf = src.match(/processSelectedFiles[\s\S]{0,3000}/);
t('processSelectedFiles limit 100', pf && (pf[0].includes('100') || pf[0].includes('MAX_CUSTOM_SCENE_IMAGES')));

// ═══ NEW TESTS for black.3.0 (black_2.4+) ═══

// 19. LinkedIn API integration
t('shareToLinkedInAPI defined', /shareToLinkedInAPI\s*=/.test(src));
t('getLinkedInServerUrl defined', /getLinkedInServerUrl\s*=/.test(src));
t('LinkedIn chunked upload', /upload-chunk/.test(src));
t('LinkedIn share-chunked', /share-chunked/.test(src));
t('blobUrlToBase64 defined', /blobUrlToBase64\s*=/.test(src));
t('LinkedIn 100MB limit', /100\s*\*\s*1024\s*\*\s*1024/.test(src));

// 20. Buffer API integration
t('shareToBufferAPI defined', /shareToBufferAPI\s*=/.test(src));
t('Buffer GraphQL query', /api\.buffer\.com\/graphql/.test(src));
t('Buffer createPost mutation', /createPost/.test(src));
t('Buffer channel detection', /channels\(input:/.test(src));

// 21. Cloud upload failover
t('uploadMediaToCloud defined', /uploadMediaToCloud\s*=/.test(src));
t('catbox.moe endpoint', /litterbox\.catbox\.moe/.test(src));
t('file.io endpoint', /file\.io/.test(src));

// 22. autoSaveVideo + WebM→MP4
t('autoSaveVideo defined', /autoSaveVideo\s*=/.test(src));
t('convertWebMtoMP4 defined', /convertWebMtoMP4\s*=/.test(src));
t('ffmpeg.wasm loaded', /@ffmpeg\/ffmpeg/.test(src));

// 23. Newspaper system
t('NEWSPAPER_DIRECT_CONFIG defined', /NEWSPAPER_DIRECT_CONFIG\s*=/.test(src));
t('fetchGazeteManşetleri defined', /fetchGazeteManşetleri\s*=/.test(src));
t('weserv.nl CORS proxy', /images\.weserv\.nl/.test(src));
t('GazeteCropModal defined', /GazeteCropModal\s*=/.test(src));
t('parseGazeteHtml defined', /parseGazeteHtml\s*=/.test(src));
t('ALLOWED_GAZETELER defined', /ALLOWED_GAZETELER\s*=/.test(src));

// 24. Social media platforms
t('SOCIAL_PLATFORMS defined', /SOCIAL_PLATFORMS\s*=/.test(src));
t('7 social platforms', (src.match(/id:\s*['"](x|linkedin|facebook|instagram|tiktok|pinterest|bluesky)['"]/g) || []).length >= 7);
t('connectedPlatforms localStorage', /ns_connectedPlatforms/.test(src));
t('nativeShare defined', /nativeShare\s*=/.test(src));

// 25. ImageBitmapCache
t('ImageBitmapCache defined', /ImageBitmapCache\s*=/.test(src));
t('createImageBitmap used', /createImageBitmap/.test(src));

// 26. Wikimedia images
t('fetchWikimediaImages defined', /fetchWikimediaImages\s*=/.test(src));
t('Wikimedia API URL', /commons\.wikimedia\.org\/w\/api\.php/.test(src));

// 27. PROXY_AUTH_TOKEN (security fix)
t('PROXY_AUTH_TOKEN constant defined', /const\s+PROXY_AUTH_TOKEN\s*=/.test(src));
// Hardcoded string only allowed in the constant definition, not in header usages
const hardcodedTokenLines = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&l.includes('otonom_proxy_secret_key_883921')&&!l.includes('const PROXY_AUTH_TOKEN'));
t('No hardcoded otonom_proxy_secret (except constant def)', hardcodedTokenLines.length === 0, hardcodedTokenLines.length ? `L${hardcodedTokenLines.map(v=>v.n).join(',')}` : '');

// 28. Dynamic gazete URL dates (security fix)
t('No hardcoded 2026/7/28 in static_gzt URLs', !/2026\/7\/28/.test(src));

// 29. Version history
t('Version history still has black_3.3 (v2.9 section)', /black_3\.3\s*\(black\.3\.3\)/.test(src));

// 30. Music search + preview
t('Music search query state', /musicSearchQuery/.test(src));
t('playMusicPreview defined', /playMusicPreview\s*=/.test(src));

// 31. Voice filters
t('VOICE_OPTIONS defined', /VOICE_OPTIONS\s*=/.test(src));
t('voiceFilters state', /voiceFilters/.test(src));

// 32. ErrorBoundary
t('ErrorBoundary class', /class\s+ErrorBoundary\s+extends\s+React\.Component/.test(src));

// 33. isVideoAsset bug fix
const iva = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&/\bisVideoAsset\b/.test(l));
t('No isVideoAsset reference', iva.length === 0, iva.length ? `L${iva.map(v=>v.n).join(',')}` : '');
t('isVideo variable used in shareToBufferAPI', /const\s+isVideo\s*=/.test(src));

// 34. getLinkedInServerUrl remote origin early-return
const gli = src.match(/getLinkedInServerUrl\s*=\s*async[\s\S]{0,3000}/);
t('getLinkedInServerUrl remote early-return', gli && gli[0].includes('isHttpsRemoteOrigin') && gli[0].includes('return null'));

// 35. Buffer CORS proxy updated
const corg = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&/corsproxy\.org/.test(l));
t('No corsproxy.org', corg.length === 0, corg.length ? `L${corg.map(v=>v.n).join(',')}` : '');
t('corsproxy.io used', /corsproxy\.io/.test(src));
t('allorigins.win used', /allorigins\.win/.test(src));
t('No direct api.buffer.com/graphql in endpoints array', !/,\s*['"]https:\/\/api\.buffer\.com\/graphql['"]\s*\]/.test(src));

// 36. Gazete okuma modu (black_2.6)
t('_isGazeteOkuma flag defined', /_isGazeteOkuma\s*=\s*true/.test(src));
t('Gazete okuma: tek sahne per baslik (no AI prompt)', /imagePrompts:\s*\[\],\s*\n\s*\}\s*\n\s*\]\s*\n\s*\}\);[\s\S]*?addSystemLog.*BAŞLIKLAR/.test(src) || /_isGazeteOkuma[\s\S]{0,500}imagePrompts:\s*\[\]/.test(src));
t('Gazete okuma: thumbnail gazete resmi (AI atlanır)', /_isGazeteOkuma[\s\S]{0,300}thumbnail.*customImage/.test(src));

// 37. Buffer token kontrolü (black_2.7)
t('Buffer token early return', /if\s*\(!token\)[\s\S]{0,400}return\s+0/.test(src));
t('Buffer token UI input', /BUFFER_API_KEY.*onChange.*SafeStorage\.setItem/.test(src));
t('cors.eu.org proxy', /cors\.eu\.org/.test(src));
t('corsproxy.io URL encoded', /corsproxy\.io\/\?url=.*encodeURIComponent/.test(src));

// 38. İddia Analizi prompt geliştirme (black_2.8→3.0)
t('ECONOMIC_DATA has baseline2002', /baseline2002:\s*['"]/.test(src));
t('ECONOMIC_DATA baseline2002 for aclikSiniri', /aclikSiniri:\s*\{[^}]*baseline2002:\s*['"]/.test(src));
t('ECONOMIC_DATA baseline2002 for asgariUcret', /asgariUcret:\s*\{[^}]*baseline2002:\s*['"]/.test(src));
t('ECONOMIC_DATA baseline2002 for dolarTl', /dolarTl:\s*\{[^}]*baseline2002:\s*['"]/.test(src));
t('buildEconomicDataBlock has withBaseline', /withBaseline/.test(src));
t('buildEconomicDataBlock has [2002:] format', /\[2002:\s*\$\{item\.baseline2002\}\]/.test(src));
t('Prompt has ADIM 1 GİRDİYİ ANALİZ ET', /ADIM 1.*GİRDİYİ ANALİZ ET/.test(src));
t('Prompt has ADIM 2 KONU EKONOMİ', /ADIM 2.*KONU EKONOMİ/.test(src));
t('Prompt has ADIM 3 DOĞRULAMA', /ADIM 3.*DOĞRULAMA/.test(src));
t('Prompt has ADIM 4 VİDEO SENARYOSU', /ADIM 4.*VİDEO SENARYOSU/.test(src));
t('Prompt has 2002 BAZ YILI KARŞILAŞTIRMA', /2002 BAZ YILI KARŞILAŞTIRMA/.test(src));
t('Prompt has DÜRÜSTLÜK KURALLARI', /DÜRÜSTLÜK KURALLARI/.test(src));
t('Prompt has BİLMEDİĞİN', /BİLMEDİĞİN/.test(src));
t('Prompt has ASLA uydurma', /ASLA uydurma/.test(src));
t('Prompt has Doğrulanamıyor', /Doğrulanamıyor/.test(src));
t('Prompt has KAYNAK DEĞİLDİR', /KAYNAK DEĞİLDİR/.test(src));
t('Prompt no XXXXX placeholder', !/XXXXX\s*TL/.test(src));
t('Prompt no ZORUNLU EKONOMI VERILERI section', !/ZORUNLU EKONOMI VERILERI/.test(src));
t('Kaynaklar sahnesi has _kaynaklar with veri', /_kaynaklar:\s*allKaynaklar/.test(src));
t('Kaynaklar sahnesi has k.veri', /k\.veri/.test(src));
t('Kaynaklar sahnesi has k.url', /k\.url/.test(src));
t('Kaynaklar sahnesi has kaynakSet dedup', /kaynakSet/.test(src));
t('Kaynaklar sahnesi has KAYNAKLAR VE REFERANSLAR', /KAYNAKLAR VE REFERANSLAR/.test(src));

// ═══ 39. v2.9: TTS hız, konu-dışı ekonomi yasağı, ses-görsel senkron ═══

// SPEECH_RATE config
t('RENDER_CONFIG has SPEECH_RATE 1.0', /SPEECH_RATE:\s*1\.0/.test(src));

// v3.5: playAudio uses fixed SPEECH_RATE (not Math.max with scaleFactor)
t('playAudio uses fixed RENDER_CONFIG.SPEECH_RATE', /source\.playbackRate\.value\s*=\s*RENDER_CONFIG\.SPEECH_RATE/.test(src));
t('playAudio no Math.max with scaleFactor for speech', !/source\.playbackRate\.value\s*=\s*Math\.max\(scaleFactor,\s*RENDER_CONFIG\.SPEECH_RATE\)/.test(src));

// Güzel söz render uses SPEECH_RATE
t('Güzel söz render uses SPEECH_RATE', /playbackRate\.value\s*=\s*RENDER_CONFIG\.SPEECH_RATE/.test(src));

// Konu-dışı ekonomi yasağı — ADIM 2
t('Prompt has KONU EKONOMİ DEĞİLSE', /KONU EKONOMİ DEĞİLSE/.test(src));
t('Prompt has ENJETE ETME', /ENJETE ETME/.test(src));

// Konu-dışı veri yasağı — ADIM 4
t('Prompt has KONU-DIŞI VERİ YASAĞI', /KONU-DIŞI VERİ YASAĞI/.test(src));

// Ses-görsel senkron buffer
t('rawSlideSecs has +0.3 buffer', /\+ 0\.3\).*v2\.9.*ses tam bitsin/.test(src));
t('rawCushion is 0.5', /rawCushion\s*=\s*0\.5/.test(src));
t('playAudio has +0.3 buffer', /\+ 0\.3\).*v2\.9.*ses tam bitsin/.test(src));

// TTS text cleaning — İYİ Parti fix
t('TTS has İYİ Parti fix', /İYİ\\s\+Parti/.test(src) || /İYİ\s\+Parti/.test(src) || src.includes('İYİ Parti'));

// Version history has black_3.3
t('Version history has black_3.3', /black_3\.3\s*\(black\.3\.3\)/.test(src));

// ═══ 40. v3.0 (v3.7'de kaldırıldı): Müzik kalıcı saklama artık yok — sadece yerel IndexedDB ═══

// v3.7: Cloud müzik URL metodları ve ns_cloudMusicUrls key'i kaldırıldı
t('No saveCloudMusicUrls method', !/saveCloudMusicUrls\s*\(urls/.test(src));
t('No getCloudMusicUrls method', !/getCloudMusicUrls\s*\(\s*\)/.test(src));
t('No clearCloudMusicUrls method', !/clearCloudMusicUrls\s*\(\s*\)/.test(src));
t('No removeCloudMusicUrl method', !/removeCloudMusicUrl\s*\(id/.test(src));
t('No ns_cloudMusicUrls key', !/ns_cloudMusicUrls/.test(src));

// handleFolderSelectLegacy sadece IndexedDB'ye kaydeder; bulut upload yapmaz
t('handleFolderSelectLegacy does not upload to cloud', !/uploadMediaToCloud\(blob,\s*file\.name\)/.test(src));
t('handleFolderSelectLegacy saves only to IndexedDB', /saveMusicToLib\(\{ id, name: file\.name, data: b64 \}\)/.test(src));

// loadLocalMusic buluttan geri yükleme yapmaz
t('loadLocalMusic does not call getCloudMusicUrls', !/AssetManagerService\.getCloudMusicUrls\(\)/.test(src));

// deleteMusic cloud URL kaldırmaz
t('deleteMusic does not remove cloud URL', !/removeCloudMusicUrl\(as\)/.test(src));

// ═══ 41. v3.1: İddia Analizi prompt genel yapılandırma ═══

// ADIM 2 artık genel — konu türüne göre kaynak rehberi
t('Prompt has KONU TÜRÜNE GÖRE KAYNAK REHBERİ', /KONU TÜRÜNE GÖRE KAYNAK REHBERİ/.test(src));
t('Prompt has SİYASET / BELEDİYE / HUKUK kaynak', /SİYASET\s*\/\s*BELEDİYE\s*\/\s*HUKUK/.test(src));
t('Prompt has İçişleri Bakanlığı', /İçişleri Bakanlığı/.test(src));
t('Prompt has Adalet Bakanlığı', /Adalet Bakanlığı/.test(src));
t('Prompt has Sağlık Bakanlığı', /Sağlık Bakanlığı/.test(src));
t('Prompt has GOOGLE SEARCH ARACINI AKTİF KULLAN', /GOOGLE SEARCH ARACINI AKTİF KULLAN/.test(src));

// ADIM 3 — İDDİA vs GERÇEK karşılaştırması
t('Prompt has İDDİA NE DİYOR vs GERÇEKTE NE VAR', /İDDİA NE DİYOR.*GERÇEKTE NE VAR/.test(src));

// ADIM 4 — senaryo yapısı değişti
t('Prompt has Hook İddia Gerçek Karşılaştırma', /Hook.*İddia.*Gerçek.*Karşılaştırma/.test(src));
t('Prompt has körü körüne inanmamalı', /körü körüne inanmamalı/.test(src));

// Dürüstlük kurallarına TARAFSIZLIK ve KAYNAK ÇEŞİTLİLİĞİ
t('Prompt has TARAFSIZ OL', /TARAFSIZ OL/.test(src));
t('Prompt has KAYNAK ÇEŞİTLİLİĞİ', /KAYNAK ÇEŞİTLİLİĞİ/.test(src));

// Eski ekonomi-merkezli ADIM 2 başlığı değişti
t('Prompt no longer has ADIM 2 KONU EKONOMİ İSE only', !/ADIM 2 — KONU EKONOMİ İSE: GÜNCEL VERİLER/.test(src));
t('Prompt has ADIM 2 KONUYA GÖRE VERİ KAYNAKLARI', /ADIM 2 — KONUYA GÖRE VERİ KAYNAKLARI/.test(src));

// Mevcut testler korunmalı
t('Prompt still has ADIM 1 GİRDİYİ ANALİZ ET', /ADIM 1.*GİRDİYİ ANALİZ ET/.test(src));
t('Prompt still has ADIM 3 DOĞRULAMA', /ADIM 3.*DOĞRULAMA/.test(src));
t('Prompt still has ADIM 4 VİDEO SENARYOSU', /ADIM 4.*VİDEO SENARYOSU/.test(src));
t('Prompt still has DÜRÜSTLÜK KURALLARI', /DÜRÜSTLÜK KURALLARI/.test(src));
t('Prompt still has KONU EKONOMİ DEĞİLSE', /KONU EKONOMİ DEĞİLSE/.test(src));
t('Prompt still has ENJETE ETME', /ENJETE ETME/.test(src));
t('Prompt still has KONU-DIŞI VERİ YASAĞI', /KONU-DIŞI VERİ YASAĞI/.test(src));
t('Prompt still has 2002 BAZ YILI KARŞILAŞTIRMA', /2002 BAZ YILI KARŞILAŞTIRMA/.test(src));
t('Prompt still has BİLMEDİĞİN', /BİLMEDİĞİN/.test(src));
t('Prompt still has ASLA uydurma', /ASLA uydurma/.test(src));
t('Prompt still has Doğrulanamıyor', /Doğrulanamıyor/.test(src));
t('Prompt still has KAYNAK DEĞİLDİR', /KAYNAK DEĞİLDİR/.test(src));

// Version history has black_3.5
t('Version history has black_3.5', /black_3\.5\s*\(black\.3\.5\)/.test(src));

// ═══ 42. v3.2: TTS normal hız + müzik gazete modu + catbox CORS fix ═══

// SPEECH_RATE 1.0 (normal hız)
t('SPEECH_RATE is 1.0 not 1.25', /SPEECH_RATE:\s*1\.0[,\s]/.test(src));
t('SPEECH_RATE is not 1.25 in config', !/SPEECH_RATE:\s*1\.25[,]/.test(src));

// Müzik seçimi if/else dışında (gazete modunda da çalışır)
t('Music selection outside if/else (v3.14 comment)', /v3\.14.*Kullanıcı müzik seçtiyse onu kullan/.test(src));

// catbox.moe direkt fetch kaldırıldı, uploadMediaToCloud kullanılıyor
t('No direct catbox.moe/user/api.php fetch in folder select', !/fetch\('https:\/\/catbox\.moe\/user\/api\.php'/.test(src));
t('Folder select does NOT use uploadMediaToCloud', !/uploadMediaToCloud\(blob,\s*file\.name\)/.test(src));

// ═══ 43. v3.3: emotionForImage scope fix ═══

// emotionForImage if/else dışında tanımlı (scope fix)
t('emotionForImage defined outside if/else', /const imgStyle.*\n.*const emotionForImage/.test(src));
t('No duplicate emotionForImage in if block', !/if \(this\.state\.script\._isGuzelSoz\)[\s\S]{0,500}const emotionForImage/.test(src));

// ═══ 44. v3.5: timer sync, Ken Burns flicker fix, TTS rate fix, economic date, catbox proxy ═══

// Timer worker uses config
const tw = src.match(/_createTimerWorker\s*=\s*\(\)[\s\S]{0,600}/);
t('_createTimerWorker uses RENDER_CONFIG.TIMER_WORKER_INTERVAL_MS', tw && tw[0].includes('RENDER_CONFIG.TIMER_WORKER_INTERVAL_MS'));
t('TIMER_WORKER_INTERVAL_MS is 1000/30', /TIMER_WORKER_INTERVAL_MS:\s*1000\s*\/\s*30[,\s]/.test(src));

// Ken Burns pan seed computed once per scene
t('renderScene zoomPanSeed defined', /const\s+zoomPanSeed\s*=\s*zoomCoords\s*\?/.test(src));
t('Ken Burns panX uses zoomPanSeed.panX', /const\s+panX\s*=\s+zoomPanSeed\.panX\s*\*\s*t/.test(src));
t('Ken Burns panY uses zoomPanSeed.panY', /const\s+panY\s*=\s+zoomPanSeed\.panY\s*\*\s*t/.test(src));
t('No Math.random inside Ken Burns pan in renderScene', !/const\s+panX\s*=\s*\(\s*Math\.random\(\)\s*-\s*0\.5\)\s*\*\s*20\s*\*\s*t/.test(src));

// ECONOMIC_DATA date updated to 30 Temmuz 2026
t('ECONOMIC_DATA dolarTl dataAsOf 30 Temmuz 2026', /dolarTl:\s*\{[^}]*dataAsOf:\s*['"]30 Temmuz 2026['"]/.test(src));
t('ECONOMIC_DATA euroTl dataAsOf 30 Temmuz 2026', /euroTl:\s*\{[^}]*dataAsOf:\s*['"]30 Temmuz 2026['"]/.test(src));
t('ECONOMIC_DATA gramAltin dataAsOf 30 Temmuz 2026', /gramAltin:\s*\{[^}]*dataAsOf:\s*['"]30 Temmuz 2026['"]/.test(src));
t('ECONOMIC_DATA ceyrekAltin dataAsOf 30 Temmuz 2026', /ceyrekAltin:\s*\{[^}]*dataAsOf:\s*['"]30 Temmuz 2026['"]/.test(src));
t('No old 16 Temmuz 2026 in ECONOMIC_DATA', !/dataAsOf:\s*['"]16 Temmuz 2026['"]/.test(src));

// uploadMediaToCloud catbox/litterbox POST strategy improved
t('uploadMediaToCloud uses direct catbox POST', /url:\s*['"]https:\/\/catbox\.moe\/user\/api\.php['"],\s*proxy:\s*false/.test(src));
t('uploadMediaToCloud catbox allorigins fallback', /catbox allorigins/.test(src));
t('uploadMediaToCloud catbox corsproxy fallback', /catbox corsproxy\.io/.test(src));
t('uploadMediaToCloud litterbox direct POST', /url:\s*['"]https:\/\/litterbox\.catbox\.moe\/resources\/internals\/api\.php['"],\s*label:\s*['"]litterbox direkt['"]/.test(src));
t('uploadMediaToCloud explanatory catbox fail log', /Catbox\.moe yükleme başarısız/.test(src));
t('uploadMediaToCloud explanatory litterbox fail log', /Litterbox yükleme başarısız/.test(src));

// ═══ 45. v3.6: catbox CORS permanent fix via Python proxy ═══

// uploadMediaToCloud tries localhost Python proxy FIRST
t('uploadMediaToCloud tries localhost:3000/upload_cloud_media first', /fetch\('http:\/\/localhost:3000\/upload_cloud_media'/.test(src));
t('uploadMediaToCloud localhost log mentions CORS bypass', /Yerel Python proxy sunucusuna yükleniyor \(catbox CORS bypass\)/.test(src));
t('uploadMediaToCloud fallback log mentions Python proxy fail', /Yerel Python proxy sunucu yükleme başarısız, fallback servislere geçiliyor/.test(src));

// Python server (linkedin_server.py) has catbox/litterbox server-side upload
t('Python server /upload_cloud_media has catbox.moe server-side', /https:\/\/catbox\.moe\/user\/api\.php/.test(pySrc));
t('Python server /upload_cloud_media has litterbox.catbox.moe server-side', /https:\/\/litterbox\.catbox\.moe\/resources\/internals\/api\.php/.test(pySrc));
t('Python server /upload_cloud_media has temp.sh fallback', /https:\/\/temp\.sh\/upload/.test(pySrc));
t('Python server /upload_cloud_media has tmpfiles fallback', /https:\/\/tmpfiles\.org\/api\/v1\/upload/.test(pySrc));
t('Python server /upload_cloud_media returns provider in response', /"provider"\s*:\s*provider_label/.test(pySrc));

// v3.7: manual music folder selection — no auto cloud upload (additional UI/log checks)
t('Version history has black_3.11', /black_3.11\s*\(black\.3.11\)/.test(src));
t('Last line says black_3.18', /OTONOM black_3.18/.test(src));
t('UI text says local listing', /dosyalar yerel olarak listelenir/.test(src));
t('Success log says local saved', /yerel olarak kaydedildi/.test(src));

// ═══ v3.8: İddia Analizi raw media playback + prompt güncellemeleri ═══
t('v3.8: _isRawMedia flag in render', /_isRawMedia/.test(src));
t('v3.8: _originalMedia stored in script', /_originalMedia/.test(src));
t('v3.8: _originalMediaType check', /_originalMediaType/.test(src));
t('v3.8: Raw playback scene unshift', /videoSlides\.unshift/.test(src));
t('v3.8: Raw media skip in chunk processing', /if\s*\(slide\._isRawMedia\)/.test(src));
t('v3.8: Raw video frame-by-frame canvas draw', /drawImageCover\(ctx,\s*rawEl/.test(src));
t('v3.8: Raw audio playback with clickbait image', /rawEl\.play/.test(src));
t('v3.8: Raw media ObjectURL revoke', /ObjectURLManager\.revoke\(rawUrl\)/.test(src));
t('v3.8: Prompt has KARSI-ÖRNEK kuralı', /KAR\u015eI-\u00d6RNEK/.test(src));
t('v3.8: Prompt has KAYNAK ZORUNLULUĞU', /KAYNAK ZORUNLULU/.test(src));
t('v3.8: Prompt has EN GÜNCEL VERİ KURALI', /EN G\u00dcNCEL VER\u0130/.test(src));
t('v3.8: Prompt has Orijinal Medya in senaryo', /Orijinal Medya/.test(src));
t('v3.8: Prompt has "bu bir veridir adalettir"', /bu bir veridir.*adalettir/i.test(src));
t('v3.8: tipLabel is İddia Analizi for iddia_analizi', /tipLabel.*iddia_analizi.*\u0130ddia Analizi/.test(src));

// ═══ v3.9: Raw media audio routing + duration pre-load fix ═══
t('v3.9: createMediaElementSource for raw audio routing', /createMediaElementSource\(rawEl\)/.test(src));
t('v3.9: Raw gain node connects to audioDest', /rawGainNode\.connect\(audioDest\)/.test(src));
t('v3.9: Raw gain node connects to audioCtx.destination', /rawGainNode\.connect\(audioCtx\.destination\)/.test(src));
t('v3.9: Raw media duration async pre-load', /rawMediaDurations/.test(src));
t('v3.9: No placeholder 10.0 return in rawSlideSecs', !/return 10\.0;\s*\/\/ Placeholder/.test(src));
t('v3.9: Raw source node disconnect after playback', /rawSourceNode.*disconnect/.test(src));
t('v3.9: Raw gain node disconnect after playback', /rawGainNode.*disconnect/.test(src));
t('v3.9: Single rawEl element (no separate rawAudioEl)', !/rawAudioEl/.test(src));

// ═══ v3.11: Siyah ekran fix + grafik kuralı + no-text + fade-out ═══
t('v3.11: drawImageContain uses videoWidth', /videoWidth.*naturalWidth.*img\.width/.test(src));
t('v3.11: drawImageCover uses videoWidth', /videoWidth.*naturalWidth.*img\.width/.test(src));
t('v3.11: drawImageContain has early return for zero dims', /if\s*\(iw\s*<\s*1\s*\|\|\s*ih\s*<\s*1\)\s*return/.test(src));
t('v3.11: No seeking in raw video render (no currentTime assignment)', !/rawEl\.currentTime\s*=/.test(src));
t('v3.11: Prompt has GRAFİK/İNFOGRAFİK KURALI', /GRAF\u0130K\/\u0130NFOGRAF\u0130K KURALI/.test(src));
t('v3.11: Prompt has GÖRSEL YAZI KURALI', /G\u00d6RSEL YAZI KURALI/.test(src));
t('v3.11: generateImage has no words no letters', /no words.*no letters.*no labels.*clean visual/.test(src));
t('v3.11: Fade-to-black before outro', /fade-to-black|fadeAlpha.*rgba\(0,0,0/.test(src));
t('v3.11: Version history has black_3.11', /black_3.11\s*\(black\.3.11\)/.test(src));
t('v3.11: Last line says black_3.18', /OTONOM black_3.18/.test(src));

// ═══ v3.11: Çok dilli Güzel Söz (FR/DE/TR) ═══
t('v3.11: _translateQuoteMultilang function exists', /_translateQuoteMultilang/.test(src));
t('v3.11: _translateQuoteMultilang is static async', /static\s+async\s+_translateQuoteMultilang/.test(src));
t('v3.11: Translation returns fr/de/tr', /fr:[\s\S]*?parsed\.fr[\s\S]*?de:[\s\S]*?parsed\.de[\s\S]*?tr:[\s\S]*?parsed\.tr/.test(src));
t('v3.11: _isMultilang flag in return', /_isMultilang:\s*true/.test(src));
t('v3.11: _multilangTexts in return', /_multilangTexts:\s*multilangTexts/.test(src));
t('v3.11: _multilangLabels in return', /_multilangLabels:\s*multilangLabels/.test(src));
t('v3.11: multilangTexts array has fr/de/tr', /translations\.fr.*translations\.de.*translations\.tr/.test(src));
t('v3.11: multilangLabels has FR/DE/TR', /\\[.FR.*DE.*TR.\\]/.test(src));
t('v3.11: videoSlides spokenText uses multilangTexts', /spokenText:\s*multilangTexts\[i\]/.test(src));
t('v3.11: videoSlides topText uses multilangTexts', /topText:\s*multilangTexts\[i\]/.test(src));
t('v3.11: videoSlides has _lang property', /_lang:\s*multilangLabels\[i\]/.test(src));
t('v3.11: Asset gen produces audio for multilang scenes', /_isMultilang[\s\S]{0,200}for[\s\S]{0,50}mi[\s\S]{0,50}slideCount/.test(src));
t('v3.11: renderGuzelSoz checks isMultilang', /const\s+isMultilang\s*=/.test(src));
t('v3.11: renderGuzelSoz has sceneDurations array', /sceneDurations\.push\(segDur\)/.test(src));
t('v3.11: renderGuzelSoz has sceneAudioBuffers', /sceneAudioBuffers\.push/.test(src));
t('v3.11: Multilang audio sequential playback', /source\.start\(startTime\)/.test(src));
t('v3.11: sceneBoundaries calculation', /sceneBoundaries\.push\(cumFrame\)/.test(src));
t('v3.11: currentText uses allTexts in render', /currentText\s*=\s*isMultilang[\s\S]*?allTexts\[currentImageIndex\]/.test(src));
t('v3.11: Language label display in render', /currentLabel\s*=\s*isMultilang[\s\S]*?allLabels\[currentImageIndex\]/.test(src));
t('v3.11: Version history has black_3.11 multilang entry', /black_3\.11[\s\S]*?D\u0130LL\u0130/.test(src));


// ═══ v3.12: İddia Analizi — İfşa Sahnesi Adaletsizlik Odaklı ═══
t('v3.12: APP_VERSION minor is 18', /minor:\s*18/.test(src));
t('v3.12: APP_VERSION hotfix is H3.18', /hotfix:\s*'H3\.18'/.test(src));
t('v3.12: İFŞA VE ADALETSİZLİK KURALI in prompt', /İFŞA VE ADALETSİZLİK KURALI/.test(src));
t('v3.12: Old KARŞI-ÖRNEK VE İFŞA KURALI removed from prompt', !/KARŞI-ÖRNEK VE İFŞA KURALI:/.test(src.replace(/\/\/[^\n]*/g, '')));
t('v3.12: Seçici hedefleme in prompt', /SEÇİCİ HEDEFLEME/.test(src));
t('v3.12: CHP belediyeleri mention in prompt', /CHP\) belediyeleri mi evlerinden alınıyor/.test(src));
t('v3.12: İtibar suikasti in prompt', /İTİBAR SUİKASTİ/.test(src));
t('v3.12: Tüm medyada ifşa mention', /tüm medyada.*ifşa edilerek/i.test(src) || /Tüm medyada.*ifşa edilerek/.test(src));
t('v3.12: Çifte standart in prompt', /ÇİFTE STANDART/.test(src));
t('v3.12: Rakamlar ikincil adaletsizlik birincil in ADIM 3', /Rakamlar ikincil, ADALETSİZLİK birincildir/.test(src));
t('v3.12: Karşılaştırma/İfşa in ADIM 4 senaryo', /Karşılaştırma\/İfşa/.test(src));
t('v3.12: ADIM 4 says RAKAMLARA değil ADALETSİZLİĞE', /RAKAMLARA değil ADALETSİZLİĞE odaklan/.test(src));
t('v3.12: ADIM 4 mentions itibar suikasti', /itibar suikasti yapılıyor mu/.test(src));
t('v3.12: ADIM 4 says adaletsizlik BİRİNCİLDİR', /adaletsizlik BİRİNCİLDİR/.test(src));
t('v3.12: Version history has black_3.12 entry', /black_3\.12/.test(src));
t('v3.12: Version history mentions adaletsizlik', /black_3\.12[\s\S]*?ADALETSİZLİK/.test(src));
t('v3.12: Last line says black_3.18', /OTONOM black_3.18/.test(src));

// ═══ v3.13: Audio Bleed + Altyazı + Chart Overlay + Split-Screen + Watermark ═══
t('v3.13: APP_VERSION minor is 18', /minor:\s*18/.test(src));
t('v3.13: APP_VERSION hotfix is H3.18', /hotfix:\s*'H3\.18'/.test(src));
t('v3.13: playAudio returns sourceNode', /return\s*\{[^}]*sourceNode/.test(src));
t('v3.13: renderScene destructures sourceNode', /\{\s*exactDur,\s*totalDur,\s*audioEndPromise,\s*sourceNode\s*\}/.test(src));
t('v3.13: audioEnded flag in renderScene', /let\s+audioEnded\s*=\s*false/.test(src));
t('v3.13: audioEndPromise sets audioEnded', /audioEndPromise\.then\(\(\)\s*=>\s*\{\s*audioEnded\s*=\s*true/.test(src));
t('v3.13: sourceNode.stop() hard-cut in renderScene', /sourceNode\.stop\(\)/.test(src));
t('v3.13: audioEnded check before stop', /!audioEnded/.test(src));
t('v3.13: renderSonSozScene hard-cut sonSoz', /sonSozResult\.sourceNode/.test(src));
t('v3.13: renderSonSozScene hard-cut yorum', /yorumAudioResult\?\.sourceNode/.test(src));
t('v3.13: calculateSubtitles wordsPerSub is 4', /wordsPerSub\s*=\s*4/.test(src));
t('v3.13: calculateSubtitles no wordsPerSub 2', !/wordsPerSub\s*=\s*2/.test(src));
t('v3.13: subtitle overlap 0.15', /chunkDur\s*\+\s*0\.15/.test(src));
t('v3.13: drawChartOverlay function defined', /drawChartOverlay:\s*\(ctx,\s*chartData/.test(src));
t('v3.13: drawChartOverlay draws bars', /ctx\.fillRect\(bx,\s*by,\s*barW,\s*barH\)/.test(src));
t('v3.13: drawChartOverlay draws value labels', /ctx\.fillText\(String\(item\.value\)/.test(src));
t('v3.13: drawChartOverlay draws item labels', /ctx\.fillText\(item\.label/.test(src));
t('v3.13: chartData overlay called in renderScene', /chartData\.show\s*&&\s*!isThumbnail/.test(src));
t('v3.13: generateImage prompt has no numbers', /no numbers,\s*no digits/.test(src));
t('v3.13: GRAFİK KURALI says canvas overlay', /canvas overlay olarak sonradan eklenecektir/.test(src));
t('v3.13: Raw video uses drawImageCover', /drawImageCover\(ctx,\s*rawEl/.test(src));
t('v3.13: Raw audio uses clean background', /Audio-only.*temiz koyu arka plan/.test(src));
t('v3.13: Watermark overlay top band', /ctx\.fillRect\(0,\s*0,\s*w,\s*h\s*\*\s*0\.06\)/.test(src));
t('v3.13: Watermark overlay bottom band', /ctx\.fillRect\(0,\s*h\s*\*\s*0\.94/.test(src));
t('v3.13: Version history has black_3.13 entry', /black_3\.13/.test(src));
t('v3.13: Version history mentions Audio Bleed', /black_3\.13[\s\S]*?Audio Bleed/.test(src));
t('v3.13: Last line says black_3.18', /OTONOM black_3.18/.test(src));

// ═══ v3.14: Müzik Seçim Bug Fix ═══
t('v3.14: APP_VERSION minor is 18', /minor:\s*18/.test(src));
t('v3.14: APP_VERSION hotfix is H3.18', /hotfix:\s*'H3\.18'/.test(src));
t('v3.14: Workflow checks userBgmId before auto-select', /userBgmId.*isAmbientType/.test(src));
t('v3.14: User music selection takes priority', /userBgmId\s*&&\s*!isAmbientType/.test(src));
t('v3.14: User track found in musicLib', /allMusic\.find\(m\s*=>\s*m\.id\s*===\s*userBgmId\)/.test(src));
t('v3.14: User track sets _bgmId', /this\.state\.script\._bgmId\s*=\s*userTrack\.id/.test(src));
t('v3.14: User track log says kullanıcı seçimi', /kullanıcı seçimi/.test(src));
t('v3.14: No preferences.ambientSound override in workflow', !/this\.state\.preferences\.ambientSound\s*=\s*chosenTrack\.id/.test(src));
t('v3.14: No preferences.customBgMusicName override', !/this\.state\.preferences\.customBgMusicName\s*=\s*chosenTrack\.name/.test(src));
t('v3.14: GuzelSoz no auto music on none', !/ambientSound\s*===\s*'"'"'none'"'"'.*allMusic\[0\]/.test(src));
t('v3.14: GuzelSoz has v3.14 comment', /v3\.14.*none.*otomatik seçme/.test(src));
t('v3.14: Version history has black_3.14 entry', /black_3\.14/.test(src));
t('v3.14: Version history mentions Müzik Seçim', /black_3\.14[\s\S]*?Müzik Seçim/.test(src));
t('v3.14: Last line says black_3.18', /OTONOM black_3\.18/.test(src));

// ═══ v3.15: Instagram FPS Fix (VFR→CFR + WebM→MP4) ═══
t('v3.15: APP_VERSION minor is 18', /minor:\s*18/.test(src));
t('v3.15: APP_VERSION hotfix is H3.18', /hotfix:\s*'H3\.18'/.test(src));
t('v3.15: ffmpeg has -vsync cfr', /'-vsync',\s*'cfr'/.test(src));
t('v3.15: ffmpeg has -vf fps=30', /'-vf',\s*'fps=30'/.test(src));
t('v3.15: ffmpeg still has -r 30', /'-r',\s*'30'/.test(src));
t('v3.15: ffmpeg still has libx264', /'-c:v',\s*'libx264'/.test(src));
t('v3.15: ffmpeg still has yuv420p', /'-pix_fmt',\s*'yuv420p'/.test(src));
t('v3.15: ffmpeg still has +faststart', /'\+faststart'/.test(src));
t('v3.15: shareToBufferAPI converts WebM to MP4', /convertWebMtoMP4\(webmBlob/.test(src));
t('v3.15: shareToBufferAPI checks blob: or .webm', /targetMedia\.startsWith\('blob:'\).*targetMedia\.includes\('\.webm'\)/.test(src));
t('v3.15: targetMedia is let not const', /let\s+targetMedia\s*=/.test(src));
t('v3.15: Version history has black_3.15 entry', /black_3\.15/.test(src));
t('v3.15: Version history mentions Instagram FPS', /black_3\.15[\s\S]*?Instagram FPS/.test(src));
t('v3.15: Version history mentions VFR', /black_3\.15[\s\S]*?VFR/.test(src));
t('v3.15: Version history mentions CFR', /black_3\.15[\s\S]*?CFR/.test(src));
t('v3.15: Last line says black_3.18', /OTONOM black_3\.18/.test(src));

// ═══ v3.16: Export Progress Feedback + Granular ffmpeg Error Handling ═══
t('v3.16: APP_VERSION minor is 18', /minor:\s*18/.test(src));
t('v3.16: APP_VERSION hotfix is H3.18', /hotfix:\s*'H3\.18'/.test(src));
t('v3.16: _getFFmpegFriendlyError exists', /_getFFmpegFriendlyError/.test(src));
t('v3.16: friendly error maps memory', /out of memory.*heap.*memory/i.test(src.replace(/'/g, '')));
t('v3.16: friendly error maps codec', /codec.*unsupported.*not supported/i.test(src.replace(/'/g, '')));
t('v3.16: friendly error maps network', /network.*fetch.*load.*enoent/i.test(src.replace(/'/g, '')));
t('v3.16: friendly error maps corrupt', /invalid data.*corrupt.*damaged/i.test(src.replace(/'/g, '')));
t('v3.16: convertWebMtoMP4 has try/catch', /try\s*\{[\s\S]*?_loadFFmpeg[\s\S]*?\}\s*catch/.test(src.match(/const convertWebMtoMP4[\s\S]{0,2000}/)?.[0] || ''));
t('v3.16: convertWebMtoMP4 throws friendly error', /throw new Error\(friendlyMsg\)/.test(src));
t('v3.16: exportProgress state defined', /const \[exportProgress, setExportProgress\]/.test(src));
t('v3.16: exportProgress has phase field', /exportProgress.*phase/.test(src));
t('v3.16: autoSaveVideo calls setExportProgress', /autoSaveVideo[\s\S]{0,1200}setExportProgress/.test(src));
t('v3.16: autoSaveVideo sets phase converting', /setExportProgress\(\{ phase: 'converting'/.test(src));
t('v3.16: autoSaveVideo sets phase done', /setExportProgress\(\{ phase: 'done'/.test(src));
t('v3.16: autoSaveVideo sets phase error', /setExportProgress\(\{ phase: 'error'/.test(src));
t('v3.16: shareToBufferAPI calls setExportProgress', /shareToBufferAPI[\s\S]{0,4000}setExportProgress/.test(src));
t('v3.16: shareToBufferAPI sets phase uploading', /setExportProgress\(\{ phase: 'uploading'/.test(src));
t('v3.16: handleDownloadVideo calls setExportProgress', /handleDownloadVideo[\s\S]{0,1200}setExportProgress/.test(src));
t('v3.16: Export progress overlay JSX exists', /exportProgress\.phase && !uiState\.isProcessing/.test(src));
t('v3.16: Export overlay shows percent', /exportProgress\.percent.*%/.test(src));
t('v3.16: Export overlay has error state', /exportProgress\.phase === 'error'/.test(src));
t('v3.16: Export overlay has done state', /exportProgress\.phase === 'done'/.test(src));
t('v3.16: Export overlay has progress bar', /exportProgress\.percent.*%\`/.test(src));
t('v3.16: Version history has black_3.16 entry', /black_3\.16/.test(src));
t('v3.16: Version history mentions Export Progress', /black_3\.16[\s\S]*?Export Progress/.test(src));
t('v3.16: Version history mentions Granular ffmpeg', /black_3\.16[\s\S]*?Granular ffmpeg/.test(src));
t('v3.16: Last line says black_3.18', /OTONOM black_3\.18/.test(src));

// ═══ v3.18: Export Presets + Web Speech API + Preview/Low-Res Mode ═══

// EXPORT_PRESETS
t('v3.18: EXPORT_PRESETS defined', /const\s+EXPORT_PRESETS\s*=/.test(src));
t('v3.18: EXPORT_PRESETS has instagram_reels', /instagram_reels/.test(src));
t('v3.18: EXPORT_PRESETS has tiktok', /tiktok/.test(src));
t('v3.18: EXPORT_PRESETS has youtube_shorts', /youtube_shorts/.test(src));
t('v3.18: EXPORT_PRESETS has twitter', /twitter:\s*\{/.test(src));
t('v3.18: EXPORT_PRESETS has facebook', /facebook:\s*\{/.test(src));
t('v3.18: EXPORT_PRESETS has linkedin', /linkedin:\s*\{/.test(src));
t('v3.18: EXPORT_PRESETS has custom', /custom:\s*\{/.test(src));
t('v3.18: instagram_reels is 9:16 1K mp4', /instagram_reels:\s*\{[^}]*aspectRatio:\s*['"]9:16['"][^}]*resolution:\s*['"]1K['"][^}]*videoFormat:\s*['"]mp4['"]/.test(src));
t('v3.18: youtube_shorts is 9:16 2K mp4', /youtube_shorts:\s*\{[^}]*aspectRatio:\s*['"]9:16['"][^}]*resolution:\s*['"]2K['"]/.test(src));
t('v3.18: twitter is 16:9 1K mp4', /twitter:\s*\{[^}]*aspectRatio:\s*['"]16:9['"][^}]*resolution:\s*['"]1K['"]/.test(src));
t('v3.18: EXPORT_PRESETS has bitrate field', /bitrate:\s*4_000_000/.test(src));
t('v3.18: EXPORT_PRESETS has duration field', /duration:\s*['"]30['"]/.test(src));

// CANVAS_DIMENSIONS
t('v3.18: CANVAS_DIMENSIONS defined', /const\s+CANVAS_DIMENSIONS\s*=/.test(src));
t('v3.18: CANVAS_DIMENSIONS has 9:16', /['"]9:16['"]:\s*\{/.test(src));
t('v3.18: CANVAS_DIMENSIONS has 16:9', /['"]16:9['"]:\s*\{/.test(src));
t('v3.18: CANVAS_DIMENSIONS has 1:1', /['"]1:1['"]:\s*\{/.test(src));
t('v3.18: CANVAS_DIMENSIONS 9:16 1K is 720x1280', /['"]9:16['"]:\s*\{[^}]*['"]1K['"]:\s*\[720,\s*1280\]/.test(src));
t('v3.18: CANVAS_DIMENSIONS 9:16 2K is 1080x1920', /['"]9:16['"]:\s*\{[^}]*['"]2K['"]:\s*\[1080,\s*1920\]/.test(src));
t('v3.18: CANVAS_DIMENSIONS 16:9 1K is 1280x720', /['"]16:9['"]:\s*\{[^}]*['"]1K['"]:\s*\[1280,\s*720\]/.test(src));

// Web Speech API
t('v3.18: generateVoiceOverWithWebSpeech defined', /generateVoiceOverWithWebSpeech\s*\(/.test(src));
t('v3.18: generateVoiceOverWithWebSpeech is static async', /static\s+async\s+generateVoiceOverWithWebSpeech/.test(src));
t('v3.18: generateVoiceOverWithWebSpeech uses SpeechSynthesisUtterance', /new\s+SpeechSynthesisUtterance/.test(src));
t('v3.18: generateVoiceOverWithWebSpeech uses speechSynthesis.speak', /speechSynthesis\.speak/.test(src));
t('v3.18: generateVoiceOverWithWebSpeech has _webSpeech flag', /_webSpeech:\s*true/.test(src));
t('v3.18: generateAudio has ttsEngine param', /generateAudio\s*\(\s*text,\s*voice,\s*ttsEngine/.test(src));
t('v3.18: generateAudio checks webspeech engine', /ttsEngine\s*===\s*['"]webspeech['"]/.test(src));
t('v3.18: generateAudio falls back to Gemini on Web Speech fail', /Web Speech başarısız.*Gemini TTS/.test(src));
t('v3.18: Gemini TTS retry falls back to Web Speech', /Web Speech fallback/.test(src));

// Preview/Low-Res mode
t('v3.18: PREVIEW_FPS is 15', /PREVIEW_FPS:\s*15/.test(src));
t('v3.18: PREVIEW_BITRATE is 1_000_000', /PREVIEW_BITRATE:\s*1_000_000/.test(src));
t('v3.18: PREVIEW_SCALE is 0.5', /PREVIEW_SCALE:\s*0\.5/.test(src));
t('v3.18: Render FPS uses previewMode check', /previewMode\s*===\s*true\s*\)\s*\?\s*RENDER_CONFIG\.PREVIEW_FPS/.test(src));
t('v3.18: Render bitrate uses previewMode check', /previewMode\s*===\s*true\s*\)\s*\?\s*RENDER_CONFIG\.PREVIEW_BITRATE/.test(src));
t('v3.18: Canvas dims use previewMode scale', /isPreviewMode.*PREVIEW_SCALE/.test(src));
t('v3.18: Canvas dims from CANVAS_DIMENSIONS', /CANVAS_DIMENSIONS\[aspectRatio\]/.test(src));
t('v3.18: GuzelSoz bitrate uses previewMode', /_guzelSozBitrate.*previewMode.*PREVIEW_BITRATE/.test(src));
t('v3.18: Render bitrate uses EXPORT_PRESETS', /EXPORT_PRESETS\[.*exportPreset\]\?\.bitrate/.test(src));

// UI: Export Preset buttons
t('v3.18: UI has EXPORT_PRESETS buttons', /Object\.entries\(EXPORT_PRESETS\)\.map/.test(src));
t('v3.18: UI exportPreset in config default', /exportPreset:\s*['"]custom['"]/.test(src));
t('v3.18: UI preset click sets config', /setConfig.*exportPreset:\s*key/.test(src));
t('v3.18: UI preset click sets aspectRatio', /setConfig.*aspectRatio:\s*preset\.aspectRatio/.test(src));

// UI: TTS engine toggle
t('v3.18: UI has ttsEngine in config default', /ttsEngine:\s*['"]gemini['"]/.test(src));
t('v3.18: UI has Gemini TTS button', /ttsEngine:\s*['"]gemini['"]/.test(src));
t('v3.18: UI has Web Speech button', /ttsEngine:\s*['"]webspeech['"]/.test(src));

// UI: Preview mode toggle
t('v3.18: UI has previewMode in config default', /previewMode:\s*false/.test(src));
t('v3.18: UI has previewMode toggle button', /previewMode:\s*!config\.previewMode/.test(src));
t('v3.18: Preview mode skips AI image generation', /isPreview\s*\?\s*Promise\.resolve\(null\)/.test(src));
t('v3.18: Preview mode skips TTS generation', /isPreview\s*\?\s*Promise\.resolve\(null\).*generateAudio/.test(src));

// Version history
t('v3.18: Version history has black_3.18 entry', /black_3\.18/.test(src));
t('v3.18: Version history mentions Render Resume', /black_3\.18[\s\S]*?Render Resume/i.test(src));
t('v3.18: Version history mentions SRT', /black_3\.18[\s\S]*?SRT/i.test(src));
t('v3.18: Version history mentions Batch Queue', /black_3\.18[\s\S]*?Batch/i.test(src));
t('v3.18: Last line says black_3.18', /OTONOM black_3\.18/.test(src));

// ═══ v3.18: 12 New Features ═══

// 1. Render Resume
t('v3.18: saveRenderCheckpoint defined', /saveRenderCheckpoint\s*\(/.test(src));
t('v3.18: getRenderCheckpoint defined', /getRenderCheckpoint\s*\(/.test(src));
t('v3.18: clearRenderCheckpoint defined', /clearRenderCheckpoint\s*\(/.test(src));
t('v3.18: saveRenderCheckpoint called in render loop', /saveRenderCheckpoint\(.*jobId.*completedScene/.test(src));

// 2. SRT Export
t('v3.18: generateSRT defined', /generateSRT\s*[:(]/.test(src));
t('v3.18: _formatSRTTime defined', /_formatSRTTime\s*[:(]/.test(src));
t('v3.18: SRT download button exists', /altyazi\.srt/.test(src));

// 3. Custom Thumbnail
t('v3.18: customThumbnail in config', /customThumbnail:\s*null/.test(src));
t('v3.18: customThumbnail override in asset gen', /config\.customThumbnail.*assets\.thumbnail/.test(src));
t('v3.18: Custom Thumbnail upload UI', /customThumbnail.*readAsDataURL/.test(src));

// 4. Auto-Hashtag
t('v3.18: hashtags in responseSchema', /hashtags:\s*\{\s*type:\s*["\']ARRAY["\']/.test(src));
t('v3.18: hashtagInstruction in prompt', /hashtagInstruction|SEKİZİNCİ KURAL.*hashtag/i.test(src));
t('v3.18: hashtags passed to shareToBufferAPI', /shareOpts\.hashtags|options\.hashtags/.test(src));

// 5. Batch Queue
t('v3.18: batchQueue state exists', /batchQueue,\s*setBatchQueue/.test(src));
t('v3.18: batchCurrentIdx state exists', /batchCurrentIdx,\s*setBatchCurrentIdx/.test(src));
t('v3.18: Batch add button exists', /setBatchQueue\(\[\.\.\.batchQueue.*Batch/s.test(src));
t('v3.18: Batch queue UI panel', /Batch Kuyruk/.test(src));

// 6. Scheduled Publishing
t('v3.18: scheduledPublishAt in config', /scheduledPublishAt:\s*null/.test(src));
t('v3.18: scheduledAt in shareToBufferAPI options', /options\.scheduledAt/.test(src));
t('v3.18: datetime-local input for scheduling', /datetime-local/.test(src));

// 7. Video Transitions
t('v3.18: TRANSITION_STYLES defined', /TRANSITION_STYLES\s*=/.test(src));
t('v3.18: drawTransition defined', /drawTransition\s*[:(]/.test(src));
t('v3.18: drawTransition has crossfade', /type === 'crossfade'/.test(src));
t('v3.18: drawTransition has slide', /type === 'slide'/.test(src));
t('v3.18: drawTransition has zoom', /type === 'zoom'/.test(src));
t('v3.18: drawTransition has wipe', /type === 'wipe'/.test(src));
t('v3.18: drawTransition has dissolve', /type === 'dissolve'/.test(src));
t('v3.18: transition config in CustomSelect', /config\.transition.*TRANSITION_STYLES/.test(src));

// 8. Custom Branding
t('v3.18: drawBranding defined', /drawBranding\s*[:(]/.test(src));
t('v3.18: drawBranding called in render loop', /drawBranding\(ctx,\s*w,\s*h/.test(src));
t('v3.18: brandLogo in config', /brandLogo:\s*null/.test(src));
t('v3.18: brandText in config', /brandText:\s*['"]['"]/.test(src));
t('v3.18: Branding UI text input', /Marka adı/.test(src));
t('v3.18: Branding UI logo upload', /brandLogo.*readAsDataURL/.test(src));

// 9. A/B Variations
t('v3.18: abVariation in config', /abVariation:\s*false/.test(src));
t('v3.18: hookVariations in responseSchema', /hookVariations:\s*\{\s*type:\s*["\']ARRAY["\']/.test(src));
t('v3.18: abVariationInstruction in prompt', /abVariationInstruction|DOKUZUNCU KURAL.*hook/i.test(src));
t('v3.18: A/B toggle button in UI', /abVariation.*!config\.abVariation/.test(src));
t('v3.18: hookVariations extraction in workflow', /script\.hookVariations/.test(src));

// 10. Stock Footage
t('v3.18: STOCK_FOOTAGE_CONFIG defined', /STOCK_FOOTAGE_CONFIG\s*=/.test(src));
t('v3.18: fetchStockFootage defined', /fetchStockFootage\s*\(/.test(src));
t('v3.18: fetchStockFootage called in asset gen', /fetchStockFootage\(.*computedPrompt/.test(src));
t('v3.18: useStockFootage in config', /useStockFootage:\s*false/.test(src));
t('v3.18: Stock footage toggle in UI', /useStockFootage.*!config\.useStockFootage/.test(src));

// 11. Multi-language TTS
t('v3.18: generateAudioMultilang defined', /generateAudioMultilang\s*\(/.test(src));
t('v3.18: narrationLanguage in config', /narrationLanguage:\s*['"]tr['"]/.test(src));
t('v3.18: generateAudioMultilang called in workflow', /generateAudioMultilang\(.*nL/.test(src));
t('v3.18: Narration language CustomSelect in UI', /config\.narrationLanguage.*CustomSelect|CustomSelect.*narrationLanguage/.test(src));

// 12. Analytics Dashboard
t('v3.18: ANALYTICS_CONFIG defined', /ANALYTICS_CONFIG\s*=/.test(src));
t('v3.18: fetchBufferAnalytics defined', /fetchBufferAnalytics\s*=/.test(src));
t('v3.18: Analytics button in UI', /ANALİTİK|ANALYTICS/.test(src));
t('v3.18: BarChart3 icon defined', /BarChart3.*svg/.test(src));
t('v3.18: ListPlus icon defined', /ListPlus.*svg/.test(src));

// Version history
t('v3.18: Version history has black_3.18 entry', /black_3\.18/.test(src));
t('v3.18: Last line says black_3.18', /OTONOM black_3\.18/.test(src));

// ═══ RESULTS ═══
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  black.3.18.jsx (black_3.18) TEST RESULTS: ${pass} PASS / ${fail} FAIL / ${pass+fail} TOTAL`);
console.log('═══════════════════════════════════════════════════════════════');
out.forEach(r => console.log(`  ${r}`));
console.log('═══════════════════════════════════════════════════════════════');
if (fail > 0) {
  console.log(`  ❌ ${fail} TEST(LER) BAŞARISIZ — DÜZELTME GEREKİYOR`);
  process.exit(1);
} else {
  console.log(`  ✅ TÜM TESTLER BAŞARILI — black.3.18.jsx (black_3.18) ONAYLANDI`);
  process.exit(0);
}
