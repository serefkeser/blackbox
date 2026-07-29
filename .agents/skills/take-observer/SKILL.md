---
name: take-observer
description: Silently monitors background processes, servers (linkedin_server.py, gazete-proxy.js), and background tasks while you work. Detects crashes, port conflicts, and health issues. Optimizes resource usage.
---

# Take-Observer: Arka Plan Süreç İzleyici

Bu skill, siz çalışırken arka plandaki süreçleri, sunucuları ve arka plan görevlerini sessizce izler ve optimize eder.

## İzlenen Süreçler

### 1. gazete-proxy.js
- **Yol**: `C:\Users\skese\gazete-proxy.js`
- **Port**: 3457 (HTTP)
- **Endpoint'ler**: `/gazeteoku`, `/aydinlik`, `/yenimesaj`, `/proxy?url=...`, `/health`
- **Otomatik başlatma**: `gazete-proxy-silent.vbs` (Windows Startup)
- **Health check**: `curl http://localhost:3457/health` → `{"status":"ok"}`

### 2. linkedin_server.py
- **Yol**: `C:\Users\skese\Downloads\BlackboxAI\linkedin_server.py`
- **Port**: 3001 (HTTPS) / 3000 (HTTP)
- **Endpoint'ler**: `/linkedin/share`, `/linkedin/upload-chunk`, `/linkedin/share-chunked`, `/buffer/share-all`
- **Auth**: `X-Local-Proxy-Auth` header ile `PROXY_AUTH_TOKEN`
- **Token**: `linkedin_token.json` dosyasında OAuth token

### 3. OmniRoute (kurulum bekliyor)
- **Port**: 20128
- **Endpoint**: `http://localhost:20128/v1` (OpenAI-compatible)
- **Dashboard**: `http://localhost:20128`

## İzleme Komutları

### Health Check (gazete-proxy)
```bash
curl -s http://localhost:3457/health
```

### Health Check (linkedin_server)
```bash
curl -s https://localhost:3001/ -k
```

### Port Kullanımı
```bash
netstat -ano | findstr ":3457 :3001 :3000 :20128"
```

### Süreç Listesi
```bash
tasklist | findstr "node python"
```

## Otomatik Müdahale Senaryoları

| Durum | Aksiyon |
|-------|---------|
| gazete-proxy çöktü | `node gazete-proxy.js` ile yeniden başlat |
| linkedin_server çöktü | `python linkedin_server.py` ile yeniden başlat |
| Port çakışması | Eski süreci `taskkill /PID <pid> /F` ile kapat |
| LinkedIn token expired | `linkedin_token.json`'u yenile |
| Yüksek bellek | Gereksiz süreçleri kapat |

## VBS Silent Launcher
- **Yol**: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gazete-proxy-silent.vbs`
- Windows açılışında otomatik çalışır
- Konsol penceresi göstermez
