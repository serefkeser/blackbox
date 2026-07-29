---
name: find-skills
description: Scans the skill library and plugins to automatically detect and activate the right tool for each task. Acts as a meta-skill router that inspects task requirements and dispatches to the most appropriate skill.
---

# Find-Skills: Otomatik Skill Tespit ve Yönlendirme

Bu skill, gelen görevin türünü analiz eder ve `.agents/skills/` dizinindeki tüm skill'leri tarayarak en uygun olanı otomatik seçer.

## Çalışma Mantığı

1. **Görev Analizi**: Kullanıcı isteğini kategorize eder:
   - Frontend/UI → `impeccable`
   - Hata ayıklama/Planlama → `cyber-power`
   - Hafıza/Kontekst → `sinirsiz-hafiza`
   - Sunucu/Arka plan izleme → `take-observer`
   - Sosyal medya paylaşımı → `buffer`
   - AI model yönlendirme → `omniroute`
   - Skill tespiti → `find-skills` (self)

2. **Skill Tarama**: `.agents/skills/*/SKILL.md` dosyalarını okur, `name` ve `description` alanlarını eşleştirir.

3. **Otomatik Aktivasyon**: En uygun skill'in talimatlarını yükler ve çalıştırır.

## Kullanım Senaryoları

- "Bu hatayı düzelt" → `cyber-power` + `find-skills` birlikte çalışır
- "Şık bir UI yap" → `impeccable` aktive edilir
- "linkedin_server.py durumunu kontrol et" → `take-observer` aktive edilir
- "Proje ayarlarını hatırla" → `sinirsiz-hafiza` aktive edilir

## Skill Dizini

| Skill | Görev |
|-------|-------|
| `find-skills` | Skill tespit ve yönlendirme |
| `cyber-power` | Derin planlama + hata kök neden analizi |
| `sinirsiz-hafiza` | Oturumlar arası proje hafızası |
| `impeccable` | Yüksek kaliteli frontend mimarisi |
| `take-observer` | Arka plan süreç/sunucu izleme |
| `buffer` | Sosyal medya otomatik paylaşım |
| `omniroute` | Çoklu AI provider yönlendirme |
