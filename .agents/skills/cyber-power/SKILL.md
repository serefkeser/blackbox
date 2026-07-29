---
name: cyber-power
description: Deep planning before coding. Examines error logs without truncation, identifies root causes, and never marks a task complete without verification. Combines systematic debugging with thorough root-cause analysis.
---

# Cyber-Power: Derin Planlama ve Kök Neden Analizi

Bu skill, kod yazmadan önce derinlemesine planlama yapar, hata loglarını kısıntısız inceleyerek kök nedeni tespit eder ve doğrulama yapılmadan işlemi tamamlamaz.

## Çalışma Prensipleri

### 1. Önce Plan, Sonra Kod
- Görevi küçük adımlara böl
- Her adım için etki alanını tanımla (hangi dosyalar, hangi modüller)
- Bağımlılıkları haritala
- Riskli değişiklikleri işaretle

### 2. Hata Loglarını Kısıntısız İnce
- Hata mesajını tam oku — truncation'a izin verme
- Stack trace'in tamamını analiz et
- İlgili dosya ve satırları `read_file` ile gör
- Hata örüntüsünü (pattern) tespit et: ilk oluşum, tekrar sıklığı, tetikleyici koşul

### 3. Kök Neden Tespiti
- **Sembptom ≠ Kök neden**: Yüzeydeki hatayı düzeltme, kaynağı bul
- 5 Neden Tekniği: "Neden?" sorusunu 5 kez sorarak kök nedeni bul
- Benzer hatalar geçmişte yaşandı mı? `sinirsiz-hafiza`'dan kontrol et
- Düzeltmenin yan etkileri var mı? Tüm bağımlı kod yollarını kontrol et

### 4. Doğrulama Zorunlu
- Düzeltme sonrası: build/compile çalıştır
- Test suite'i çalıştır (varsa)
- Fonksiyonel test yap
- **Hiçbir görev doğrulanmadan "tamamlandı" olarak işaretlenmez**

## Hata Analizi Workflow

```
Hata Log → Tam Oku → Stack Trace → İlgili Dosyaları Oku
    → Kök Neden Tespit → Plan Oluştur → Düzelt → Doğrula
```

## Proje Bağlamı

- **Canonical dosya**: `anti.1.0.jsx` (black_2.4) — 5.607 satır
- **Test**: `test_anti.1.0.js` — 73 test, `node test_anti.1.0.js`
- **Proxy**: `gazete-proxy.js` port 3457 HTTP
- **LinkedIn**: `linkedin_server.py` port 3001 HTTPS / 3000 HTTP
- **Node.js**: v24.18.0
