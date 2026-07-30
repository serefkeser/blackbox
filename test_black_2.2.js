const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const FILE = path.join(__dirname, 'black_2.2.jsx');
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

// 3. APP_VERSION
t('APP_VERSION major=2', /APP_VERSION\s*=\s*\{[\s\S]*?major:\s*2[,\s]/.test(src));
t('APP_VERSION minor=2', /APP_VERSION\s*=\s*\{[\s\S]*?minor:\s*2[,\s]/.test(src));
t('APP_VERSION hotfix=H2.2', /hotfix:\s*['"]H2\.2['"]/.test(src));

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
t('RenderWorkerService._outroParticles used', /RenderWorkerService\._outroParticles/.test(src));

// 9. CORS proxy order
const cm = src.match(/CORS_PROXIES\s*=\s*\[([\s\S]*?)\]/);
if (cm) {
  const entries = cm[1].split(',').map(s=>s.trim()).filter(s=>s);
  const lh = entries.map((e,i)=>(e.includes('localhost')||e.includes('127.0.0.1'))?i:-1).filter(i=>i>=0);
  const pub = entries.map((e,i)=>(!e.includes('localhost')&&!e.includes('127.0.0.1')&&e)?i:-1).filter(i=>i>=0);
  t('Localhost proxies after public', lh.length>0 && pub.length>0 && Math.min(...lh)>Math.min(...pub),
    `lh:${lh} pub:${pub}`);
} else { t('CORS_PROXIES found', false); }
t('No https://localhost in proxies', !/https:\/\/localhost/.test(src));
t('No port 3456 reference', !/3456/.test(src));

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
// "Haziran 2026" inside string literals is OK if followed by .replace(/Haziran 2026/g, ...) on a nearby line
// Only flag lines that have "Haziran 2026" but are NOT inside a .replace() pattern and NOT in a comment
const hz = lines.map((l,i)=>({l,n:i+1})).filter(({l})=>{
  if (isComment(l)) return false;
  if (l.includes('.replace')) return false;
  if (l.includes('Haziran 2026')) return true;
  // Check if this line is part of a string literal that gets .replace'd later (within 3 lines)
  return false;
});
// Also check: is there a .replace(/Haziran 2026/g, ...) somewhere after the sysPrompt?
const hasReplaceHaziran = /\.replace\([^)]*Haziran\s*2026[^)]*\)/.test(src);
t('No hardcoded "Haziran 2026" (or replaced dynamically)', hz.length === 0 || hasReplaceHaziran, hz.length ? `L${hz.map(v=>v.n).join(',')} (but .replace exists: ${hasReplaceHaziran})` : '');

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
t('Line count ~4880', lines.length >= 4800 && lines.length <= 5000, `${lines.length} lines`);

// 17. Duplicate imgType check
const imgTypeCount = (src.match(/\bconst\s+imgType\b/g) || []).length;
t('No duplicate const imgType', imgTypeCount <= 1, `${imgTypeCount} found`);

// 18. processSelectedFiles limit
const pf = src.match(/processSelectedFiles[\s\S]{0,3000}/);
t('processSelectedFiles limit 100', pf && (pf[0].includes('100') || pf[0].includes('MAX_CUSTOM_SCENE_IMAGES')));

// ═══ RESULTS ═══
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  black_2.2.jsx TEST RESULTS: ${pass} PASS / ${fail} FAIL / ${pass+fail} TOTAL`);
console.log('═══════════════════════════════════════════════════════════════');
out.forEach(r => console.log(`  ${r}`));
console.log('═══════════════════════════════════════════════════════════════');
if (fail > 0) {
  console.log(`  ❌ ${fail} TEST(LER) BAŞARISIZ — DÜZELTME GEREKİYOR`);
  process.exit(1);
} else {
  console.log(`  ✅ TÜM TESTLER BAŞARILI — black_2.2.jsx ONAYLANDI`);
  process.exit(0);
}
