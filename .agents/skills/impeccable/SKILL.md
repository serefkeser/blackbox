---
name: impeccable
description: Combines vibe coding with high-quality frontend architecture. Delivers modern color palettes, smooth animations, and polished UI components. Tailwind CSS + React patterns for Gemini Canvas single-file deployment.
---

# Impeccable: Yüksek Kaliteli Frontend Mimarisi

Bu skill, vibe coding ile yüksek kaliteli frontend mimarisini birleştirir. Modern renk paletleri, akıcı animasyonlar ve şık UI bileşenleri sunar.

## Tasarım Prensipleri

### 1. Renk Paleti (Mevcut Proje)
```
Arka plan:     #0B0F19 (slate-950)
Kart:          #0F172A (slate-900)
Border:        #1E293B (slate-800)
Birincil:      #4F46E5 (indigo-600)
İkincil:       #7C3AED (violet-600)
Vurgu:         #E11D48 (rose-600)
Başarı:        #059669 (emerald-600)
Uyarı:         #D97706 (amber-600)
Metin:         #E2E8F0 (slate-200)
Alt metin:     #94A3B8 (slate-400)
```

### 2. Tipografi
- Font: `Inter` (Google Fonts) — Canvas ortamında CDN'den yüklenir
- Başlık: `font-black` (900) — büyük boyutlar
- Gövde: `font-medium` (500) — okunabilir
- Etiket: `font-bold` (700) — küçük boyutlar, uppercase tracking

### 3. Animasyon Kuralları
- `transition-all` — tüm değişimlerde
- `active:scale-95` — buton tıklama geri bildirimi
- `animate-spin` — loading durumları
- `animate-pulse` — canlı/aktif durumlar
- Hover: `hover:bg-*` ile renk geçişi
- Shadow: `shadow-lg shadow-indigo-500/20` — derinlik hissi

### 4. Bileşen Pattern'leri
- **CustomSelect**: Açılır menü (mevcut pattern kullan)
- **GazeteCropModal**: `React.memo` + fare takipli kırpma
- **ErrorBoundary**: Beyaz ekran önleme
- **ImageBitmapCache**: GPU görsel önbellekleme
- **Progress overlay**: `fixed inset-0 backdrop-blur-md z-50`

### 5. Gemini Canvas Kısıtları
- **Tek dosya** — import/export yok
- **Tailwind CDN** — `<script src="https://cdn.tailwindcss.com">` ile
- **SVG icon system** — lucide-react yerine inline SVG (ICONS objesi)
- **React global** — `window.React` üzerinden
- **No build tools** — doğrudan JSX çalışır

## UI Bileşen Şablonları

### Kart
```jsx
<div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl">
  {/* içerik */}
</div>
```

### Buton (Birincil)
```jsx
<button className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
  <Icon size={14} /> Etiket
</button>
```

### Input
```jsx
<input className="w-full bg-black/30 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 transition" />
```

### Tab
```jsx
<button className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
  Etiket
</button>
```
