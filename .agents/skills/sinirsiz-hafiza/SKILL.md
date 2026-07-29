---
name: sinirsiz-hafiza
description: Maintains project architecture, settings, and user preferences across sessions. Eliminates the need to re-explain the project every morning. Persists context in BLACKBOX.md and PROJECT_SUMMARY.md.
---

# Sinirsiz-Hafiza: Oturumlar Arası Proje Hafızası

Bu skill, proje mimarisini, ayarları ve kullanıcı tercihlerini oturumlar arası hafızada tutar. Her yeni oturumda projeyi baştan anlatma derdini bitirir.

## Hafıza Kaynakları

### 1. BLACKBOX.md (Global + Project)
- **Global**: `~/.blackboxcli/BLACKBOX.md` — kullanıcı tercihleri, global ayarlar
- **Project**: `BLACKBOX.md` — proje özel bilgiler, versiyon geçmişi

### 2. PROJECT_SUMMARY.md
- Yol: `.blackboxcli/PROJECT_SUMMARY.md`
- İçerik: Genel hedef, anahtar bilgiler, son aksiyonlar, güncel plan
- Her görev sonunda otomatik güncellenir

### 3. save_memory Tool
- Kısa, öz bilgileri kalıcı hafızaya kaydeder
- Proje veya global scope seçilebilir

## Hafızada Tutulan Bilgiler

| Kategori | Örnek |
|----------|-------|
| **Proje mimarisi** | M1-M10 modüler yapı, tek dosya JSX |
| **Versiyon geçmişi** | black_1.9 → 2.2 → 2.3 → 2.4 (anti.1.0) |
| **Dosya yolları** | Canonical: `anti.1.0.jsx`, test: `test_anti.1.0.js` |
| **Sunucu yapılandırması** | gazete-proxy.js:3457, linkedin_server.py:3001/3000 |
| **API anahtarları** | Buffer token, LinkedIn config |
| **Kullanıcı tercihleri** | Türkçe iletişim, gazete listesi, ses ayarları |
| **Bilinen hatalar** | Geçmiş bug'lar ve çözümleri |

## Otomatik Güncelleme Kuralları

1. **Versiyon bump**: `save_memory` + `PROJECT_SUMMARY.md` güncelle
2. **Yeni özellik**: `PROJECT_SUMMARY.md`'e "Recent Actions" altına ekle
3. **Yeni sunucu/bağımlılık**: Hafızaya kaydet
4. **Kullanıcı tercihi**: `save_memory` ile global/project scope'a kaydet

## Mevcut Proje Hafızası

- **Proje**: OTONOM — otonom video üretim uygulaması
- **Canonical dosya**: `C:\Users\skese\Downloads\BlackboxAI\anti.1.0.jsx`
- **Versiyon**: black_2.4 / H2.4
- **Hedef ortam**: Gemini AI Studio Canvas (tek dosya, kopyala-yapıştır)
- **Test**: `test_anti.1.0.js` — 73/73 PASS
- **Proxy**: `gazete-proxy.js` port 3457 HTTP, Windows Startup ile otomatik
- **LinkedIn**: `linkedin_server.py` port 3001 HTTPS / 3000 HTTP
