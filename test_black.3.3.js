const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const FILE = path.join(__dirname, 'black.3.3.jsx');
const src = fs.readFileSync(FILE, 'utf-8');
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

// 3. APP_VERSION (updated to 3.3)
t('APP_VERSION major=3', /APP_VERSION\s*=\s*\{[\s\S]*?major:\s*3[,\s]/.test(src));
t('APP_VERSION minor=3', /APP_VERSION\s*=\s*\{[\s\S]*?minor:\s*3[,\s]/.test(src));
t('APP_VERSION hotfix=H3.3', /hotfix:\s*['"]H3\.3['"]/.test(src));

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
const vars = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>!isComment(l)&&/\bvar\s+/.test(l));
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
t('Line count ~5800', lines.length >= 5500 && lines.length <= 5900, `${lines.length} lines`);

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
t('Version history has black_3.3', /black_3\.3\s*\(black\.3\.3\)/.test(src));
t('Last line says black_3.3', /OTONOM black_3\.3/.test(src));

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

// playAudio uses SPEECH_RATE
t('playAudio uses RENDER_CONFIG.SPEECH_RATE', /Math\.max\(scaleFactor,\s*RENDER_CONFIG\.SPEECH_RATE\)/.test(src));

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
t('Version history has black_3.3 (v2.9 section)', /black_3\.3\s*\(black\.3\.3\)/.test(src));
t('Last line says black_3.3 (v2.9 section)', /OTONOM black_3\.3/.test(src));

// ═══ 40. v3.0: Müzik kalıcı saklama — catbox.moe + localStorage ═══

// Cloud müzik URL metodları
t('saveCloudMusicUrls defined', /saveCloudMusicUrls\s*\(/.test(src));
t('getCloudMusicUrls defined', /getCloudMusicUrls\s*\(\s*\)/.test(src));
t('clearCloudMusicUrls defined', /clearCloudMusicUrls\s*\(\s*\)/.test(src));
t('removeCloudMusicUrl defined', /removeCloudMusicUrl\s*\(/.test(src));

// localStorage key
t('ns_cloudMusicUrls key used', /ns_cloudMusicUrls/.test(src));

// catbox.moe upload via uploadMediaToCloud in handleFolderSelectLegacy
t('folder select uses uploadMediaToCloud for cloud backup', /uploadMediaToCloud\(blob,\s*file\.name\)/.test(src));
t('folder select saves cloud URLs', /AssetManagerService\.saveCloudMusicUrls\(cloudUrls\)/.test(src));

// loadLocalMusic: cloud restore when IndexedDB empty
t('loadLocalMusic has cloud restore', /IndexedDB boş.*buluttan geri/i.test(src));
t('cloud restore uses corsproxy', /corsproxy\.io.*encodeURIComponent.*cu\.url/.test(src));

// deleteMusic: removes cloud URL
t('deleteMusic removes cloud URL', /removeCloudMusicUrl\(as\)/.test(src));

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

// Version history has black_3.3
t('Version history has black_3.3', /black_3\.3\s*\(black\.3\.3\)/.test(src));
t('Last line says black_3.3', /OTONOM black_3\.3/.test(src));

// ═══ 42. v3.2: TTS normal hız + müzik gazete modu + catbox CORS fix ═══

// SPEECH_RATE 1.0 (normal hız)
t('SPEECH_RATE is 1.0 not 1.25', /SPEECH_RATE:\s*1\.0[,\s]/.test(src));
t('SPEECH_RATE is not 1.25 in config', !/SPEECH_RATE:\s*1\.25[,]/.test(src));

// Müzik seçimi if/else dışında (gazete modunda da çalışır)
t('Music selection outside if/else (v3.2 comment)', /v3\.2.*Müzik seçimi.*if\/else dışında/.test(src));

// catbox.moe direkt fetch kaldırıldı, uploadMediaToCloud kullanılıyor
t('No direct catbox.moe/user/api.php fetch in folder select', !/fetch\('https:\/\/catbox\.moe\/user\/api\.php'/.test(src));
t('Folder select uses uploadMediaToCloud', /uploadMediaToCloud\(blob,\s*file\.name\)/.test(src));

// ═══ 43. v3.3: emotionForImage scope fix ═══

// emotionForImage if/else dışında tanımlı (scope fix)
t('emotionForImage defined outside if/else', /const imgStyle.*\n.*const emotionForImage/.test(src));
t('No duplicate emotionForImage in if block', !/if \(this\.state\.script\._isGuzelSoz\)[\s\S]{0,500}const emotionForImage/.test(src));

// ═══ RESULTS ═══
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  black.3.3.jsx (black_3.3) TEST RESULTS: ${pass} PASS / ${fail} FAIL / ${pass+fail} TOTAL`);
console.log('═══════════════════════════════════════════════════════════════');
out.forEach(r => console.log(`  ${r}`));
console.log('═══════════════════════════════════════════════════════════════');
if (fail > 0) {
  console.log(`  ❌ ${fail} TEST(LER) BAŞARISIZ — DÜZELTME GEREKİYOR`);
  process.exit(1);
} else {
  console.log(`  ✅ TÜM TESTLER BAŞARILI — black.3.3.jsx (black_3.3) ONAYLANDI`);
  process.exit(0);
}
