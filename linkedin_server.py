# ============================================================================
# LINKEDIN & BUFFER AUTOMATIC PUBLISHER & SECURE PROXY SERVER
# ============================================================================

import os
import sys
import json
import time
import shutil
import base64
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception as e:
        print(f"[INIT WARN] stdout reconfigure: {e}")

# ----------------------------------------------------------------------------
# 1. ENVIRONMENT & SECRETS LOADER (.env)
# ----------------------------------------------------------------------------
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())
        except Exception as e:
            print(f"[ENV WARN] .env okunamadi: {e}")

load_env()

CLIENT_ID = os.environ.get("LINKEDIN_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("LINKEDIN_CLIENT_SECRET", "")
BUFFER_API_KEY = os.environ.get("BUFFER_API_KEY", "")
LOCAL_PROXY_SECRET = os.environ.get("LOCAL_PROXY_SECRET", "")
REDIRECT_URI = "http://localhost:3000/callback/linkedin"
PORT = 3000

TOKEN_FILE = os.path.join(os.path.dirname(__file__), "linkedin_token.json")
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp_chunks")

os.makedirs(TEMP_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# 2. TLS ADAPTER & HTTP SESSIONS
# ----------------------------------------------------------------------------
class LegacyTLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context()
        ctx.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

# Standart güvenli TLS oturumu (küresel downgrade olmadan)
proxy_session = requests.Session()

def get_legacy_session():
    s = requests.Session()
    s.mount('https://', LegacyTLSAdapter())
    return s

# ----------------------------------------------------------------------------
# 3. DOMAIN & CORS WHITE-LISTING (SECURITY)
# ----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001"
]

ALLOWED_PROXY_DOMAINS = [
    "images.unsplash.com",
    "tmpfiles.org",
    "temp.sh",
    "file.io",
    "api.buffer.com",
    "api.linkedin.com",
    "codetabs.com",
    "wikimedia.org",
    "upload.wikimedia.org",
    "githubusercontent.com"
]

def is_allowed_origin(origin):
    if not origin:
        return True
    if origin in ALLOWED_ORIGINS:
        return True
    if origin.endswith(".scf.usercontent.goog") or origin.endswith(".ngrok-free.dev") or origin.endswith(".ngrok.io"):
        return True
    if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
        return True
    return False

def is_safe_proxy_url(target_url):
    try:
        parsed = urllib.parse.urlparse(target_url)
        if parsed.scheme not in ["http", "https"]:
            return False, "Sadece http/https desteklenmektedir."
        hostname = parsed.hostname
        if not hostname:
            return False, "Gecersiz hostname."
        
        hostname_lower = hostname.lower()
        if hostname_lower in ["localhost", "127.0.0.1", "0.0.0.0", "::1"] or hostname_lower.endswith(".local"):
            return False, "Yerel adreslere proxy izni verilmiyor (SSRF Engeli)."
        if hostname_lower.startswith("10.") or hostname_lower.startswith("192.168.") or hostname_lower.startswith("169.254."):
            return False, "Ic ag adreslerine proxy izni verilmiyor (SSRF Engeli)."
        
        domain_allowed = any(hostname_lower == d or hostname_lower.endswith("." + d) for d in ALLOWED_PROXY_DOMAINS)
        if not domain_allowed:
            return False, f"Domain '{hostname}' izin verilen proxy listesinde degil."
        return True, ""
    except Exception as e:
        return False, str(e)

def cleanup_stale_chunks():
    if not os.path.exists(TEMP_DIR):
        return
    now = time.time()
    for item in os.listdir(TEMP_DIR):
        item_path = os.path.join(TEMP_DIR, item)
        if os.path.isdir(item_path):
            try:
                # 1 saatten eski gecici klasorleri temizle
                if now - os.path.getmtime(item_path) > 3600:
                    shutil.rmtree(item_path, ignore_errors=True)
                    print(f"[CLEANUP] Eski gecici klasor silindi: {item}")
            except Exception as e:
                print(f"[CLEANUP ERR] {e}")

# ----------------------------------------------------------------------------
# 4. TOKEN & AUTH UTILS
# ----------------------------------------------------------------------------
def load_token():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[TOKEN ERR] {e}")
    return None

def save_token(data):
    try:
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[SAVE TOKEN ERR] {e}")

def decode_jwt_payload(jwt_str):
    try:
        parts = jwt_str.split('.')
        if len(parts) >= 2:
            padding = '=' * ((4 - len(parts[1]) % 4) % 4)
            b64 = parts[1] + padding
            decoded = base64.urlsafe_b64decode(b64).decode('utf-8')
            return json.loads(decoded)
    except Exception as e:
        print(f"[JWT ERR] {e}")
    return {}

def get_person_urn(access_token, token_json=None):
    headers = {"Authorization": f"Bearer {access_token}"}
    
    if token_json and "id_token" in token_json:
        payload = decode_jwt_payload(token_json["id_token"])
        sub = payload.get("sub")
        name = payload.get("name") or payload.get("given_name", "LinkedIn User")
        if sub:
            print(f"[LINKEDIN] Person URN found from ID Token: urn:li:person:{sub}")
            return f"urn:li:person:{sub}", name

    try:
        r = requests.get("https://api.linkedin.com/v2/userinfo", headers=headers, timeout=10)
        if r.ok:
            info = r.json()
            sub = info.get("sub")
            if sub:
                print(f"[LINKEDIN] Person URN found from userinfo: urn:li:person:{sub}")
                return f"urn:li:person:{sub}", info.get("name", "LinkedIn User")
    except Exception as e:
        print(f"[LINKEDIN WARN] userinfo failed: {e}")
    
    try:
        r2 = requests.get("https://api.linkedin.com/v2/me", headers=headers, timeout=10)
        if r2.ok:
            info2 = r2.json()
            person_id = info2.get("id")
            name = f"{info2.get('localizedFirstName', '')} {info2.get('localizedLastName', '')}".strip()
            if person_id:
                print(f"[LINKEDIN] Person URN found from /me: urn:li:person:{person_id}")
                return f"urn:li:person:{person_id}", name
    except Exception as e:
        print(f"[LINKEDIN WARN] /v2/me failed: {e}")
    
    raise Exception("Kullanıcı kimliği (URN) hiçbir endpoint'ten alınamadı.")

def parse_multipart_data(fp, content_type, content_length):
    boundary = content_type.split("boundary=")[1].encode()
    raw_data = fp.read(content_length)
    
    parts = raw_data.split(b"--" + boundary)
    fields = {}
    files = {}

    for part in parts:
        if not part or part == b"--\r\n" or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        
        header_part, body = part.split(b"\r\n\r\n", 1)
        if body.endswith(b"\r\n"):
            body = body[:-2]
        
        headers_lines = header_part.decode('latin1').split("\r\n")
        disp_line = [h for h in headers_lines if "Content-Disposition" in h]
        if not disp_line:
            continue
        
        disp = disp_line[0]
        name_match = urllib.parse.parse_qs(disp.replace('; ', '&').replace('"', ''))
        
        name = None
        filename = None
        for key, val in name_match.items():
            if 'name' in key.lower():
                name = val[0]
            if 'filename' in key.lower():
                filename = val[0]
        
        if filename:
            files[name] = {"filename": filename, "data": body}
        elif name:
            fields[name] = body.decode('utf-8', errors='ignore').strip()
            
    return fields, files

# ----------------------------------------------------------------------------
# 5. HTTP REQUEST HANDLER
# ----------------------------------------------------------------------------
class LinkedInHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        origin = self.headers.get("Origin", "") if hasattr(self, 'headers') and self.headers else ""
        allow_origin = origin if is_allowed_origin(origin) and origin else ("*" if not origin else "null")
        self.send_header("Access-Control-Allow-Origin", allow_origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Local-Proxy-Auth, ngrok-skip-browser-warning")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def verify_auth(self):
        auth_hdr = self.headers.get("X-Local-Proxy-Auth")
        if auth_hdr and auth_hdr == LOCAL_PROXY_SECRET:
            return True
        origin = self.headers.get("Origin", "")
        if is_allowed_origin(origin):
            return True
        client_ip = self.client_address[0] if hasattr(self, 'client_address') else ""
        if client_ip in ["127.0.0.1", "::1", "localhost"]:
            return True
        return False

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def send_html(self, status_code, html_content):
        self.send_response(status_code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(html_content.encode("utf-8"))

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        if path == "/" or path == "":
            token_data = load_token()
            is_auth = token_data is not None and "access_token" in token_data
            self.send_json(200, {
                "status": "ok",
                "authenticated": is_auth,
                "user_name": token_data.get("name") if is_auth else None,
                "login_url": f"http://localhost:{PORT}/login"
            })
            return

        if path == "/proxy":
            if not self.verify_auth():
                self.send_json(403, {"error": "Yetkisiz proxy erişimi."})
                return

            target_url = query.get("url", [None])[0]
            if not target_url:
                self.send_json(400, {"error": "Missing url query param"})
                return

            safe, reason = is_safe_proxy_url(target_url)
            if not safe:
                self.send_json(403, {"error": f"SSRF Korumasi: {reason}"})
                return

            try:
                r = proxy_session.get(target_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }, timeout=15)
                if r.status_code == 200:
                    content_type = r.headers.get("Content-Type", "image/jpeg")
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_cors_headers()
                    self.end_headers()
                    try:
                        self.wfile.write(r.content)
                    except Exception as ew:
                        print(f"[PROXY WRITE ERR] {ew}")
                    return
                else:
                    self.send_json(r.status_code, {"error": f"Upstream returned {r.status_code}"})
                    return
            except Exception as e:
                self.send_json(500, {"error": str(e)})
                return

        if path == "/login":
            scope = "openid profile w_member_social email"
            params = {
                "response_type": "code",
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "scope": scope
            }
            auth_url = "https://www.linkedin.com/oauth/v2/authorization?" + urllib.parse.urlencode(params)
            self.send_response(302)
            self.send_header("Location", auth_url)
            self.end_headers()
            return

        if path == "/callback/linkedin":
            code = query.get("code", [None])[0]
            if not code:
                err = query.get("error_description", ["Yetkilendirme reddedildi."])[0]
                self.send_html(400, f"<h2>Hata: {err}</h2>")
                return
            
            token_url = "https://www.linkedin.com/oauth/v2/accessToken"
            payload = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI
            }
            res = requests.post(token_url, data=payload)
            if not res.ok:
                self.send_html(400, f"<h2>Token Alma Hatası</h2><pre>{res.text}</pre>")
                return
            
            token_json = res.json()
            access_token = token_json.get("access_token")
            
            try:
                person_urn, user_name = get_person_urn(access_token, token_json)
                token_json["person_urn"] = person_urn
                token_json["name"] = user_name
                save_token(token_json)
                
                success_html = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>LinkedIn Bağlantısı Başarılı</title>
                    <style>
                        body {{ font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                        .card {{ background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 450px; }}
                        h1 {{ color: #38bdf8; margin-bottom: 10px; }}
                        p {{ color: #94a3b8; font-size: 16px; line-height: 1.5; }}
                        .badge {{ background: #0284c7; color: white; padding: 6px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 15px; }}
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>🚀 LinkedIn Bağlantısı Başarılı!</h1>
                        <p>Tebrikler <strong>{user_name}</strong>! LinkedIn hesabınız uygulamaya başarıyla bağlandı.</p>
                        <div class="badge">Hazır! Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.</div>
                    </div>
                </body>
                </html>
                """
                self.send_html(200, success_html)
            except Exception as e:
                self.send_html(500, f"<h2>Kullanıcı profili alınamadı:</h2><p>{str(e)}</p>")
            return

        self.send_json(404, {"error": "Bulunamadı"})

    def do_POST(self):
        if not self.verify_auth():
            self.send_json(403, {"error": "Yetkisiz işlem kısıtlaması."})
            return

        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        if path == "/buffer/share-all":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
                body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
                
                text = body.get("text", "OTONOM Haber")
                media_url = body.get("media_url")
                auth_header = self.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header.split("Bearer ")[1].strip()
                else:
                    token = body.get("token") or BUFFER_API_KEY
                
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
                
                # 1. Get account & organization ID
                q_account = "query { account { id email organizations { id name } } }"
                r_acc = requests.post("https://api.buffer.com/graphql", json={"query": q_account}, headers=headers, timeout=15)
                org_id = "69f5d86d8c5763cde0026fb0"
                if r_acc.ok:
                    acc_data = r_acc.json().get("data", {}).get("account", {})
                    orgs = acc_data.get("organizations", [])
                    if orgs:
                        org_id = orgs[0]["id"]
                
                # 2. Get channels
                q_channels = "query GetChannels($input: ChannelsInput!) { channels(input: $input) { id name service } }"
                r_chan = requests.post("https://api.buffer.com/graphql", json={"query": q_channels, "variables": {"input": {"organizationId": org_id}}}, headers=headers, timeout=15)
                channels = r_chan.json().get("data", {}).get("channels", []) if r_chan.ok else []
                
                if not channels:
                    channels = [
                        {"id": "6a50b10040483446288e397b", "name": "Twitter (serefkeser)", "service": "twitter"},
                        {"id": "69f5d9145c4c051afa01c2f7", "name": "Instagram (keser4881)", "service": "instagram"},
                        {"id": "6a69a6cf0dc384370e2ef6ea", "name": "TikTok", "service": "tiktok"}
                    ]
                
                # 3. Post to each channel
                results = []
                is_video = bool(media_url and (".mp4" in media_url or ".webm" in media_url or "otonom_video" in media_url))
                asset_obj = {"video": {"url": media_url}} if is_video else ({"image": {"url": media_url}} if media_url else None)
                
                mutation = """
                mutation CreatePost($input: CreatePostInput!) {
                  createPost(input: $input) {
                    ... on PostActionSuccess { post { id status } }
                    ... on InvalidInputError { message }
                    ... on UnexpectedError { message }
                    ... on LimitReachedError { message }
                  }
                }
                """
                
                for ch in channels:
                    inp = {
                        "channelId": ch["id"],
                        "text": text,
                        "mode": "shareNow",
                        "schedulingType": "automatic",
                        "needsApproval": False
                    }
                    if asset_obj:
                        inp["assets"] = [asset_obj]
                    
                    if ch.get("service") == "instagram":
                        inp["metadata"] = {"instagram": {"type": "reel" if is_video else "post", "shouldShareToFeed": True}}
                    elif ch.get("service") == "tiktok":
                        inp["metadata"] = {"tiktok": {}}
                    
                    r_post = requests.post("https://api.buffer.com/graphql", json={"query": mutation, "variables": {"input": inp}}, headers=headers, timeout=20)
                    if r_post.ok:
                        results.append({"channel": ch["name"], "status": "success", "data": r_post.json()})
                    else:
                        results.append({"channel": ch["name"], "status": "error", "error": r_post.text})
                
                self.send_json(200, {"status": "success", "channels_count": len(channels), "results": results})
                return
            except Exception as e:
                self.send_json(500, {"error": str(e)})
                return

        if path == "/buffer_proxy":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
                body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
                
                auth_header = self.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header.split("Bearer ")[1].strip()
                else:
                    token = body.get("token") or BUFFER_API_KEY
                
                gql_payload = {
                    "query": body.get("query"),
                    "variables": body.get("variables", {})
                }
                r_buf = requests.post(
                    "https://api.buffer.com/graphql",
                    json=gql_payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    timeout=20
                )
                try:
                    resp_data = r_buf.json()
                except Exception:
                    resp_data = {"error": r_buf.text}
                self.send_json(r_buf.status_code, resp_data)
                return
            except Exception as e:
                self.send_json(500, {"error": str(e)})
                return

        if path == "/upload_cloud_media":
            content_type = self.headers.get("Content-Type", "")
            content_length = int(self.headers.get("Content-Length", 0))
            fields, files = parse_multipart_data(self.rfile, content_type, content_length)
            
            media_file = files.get("file") or (list(files.values())[0] if files else None)
            if not media_file:
                self.send_json(400, {"error": "No file uploaded"})
                return

            filename = media_file.get("filename", "video.mp4")
            data = media_file.get("data", b"")

            # v3.6: Server-side catbox/litterbox upload avoids browser CORS limits.
            # Catbox first (permanent), then litterbox (72h), then temp.sh/tmpfiles fallbacks.
            catbox_attempts = [
                ("https://catbox.moe/user/api.php", "catbox.moe"),
                ("https://litterbox.catbox.moe/resources/internals/api.php", "litterbox.catbox.moe (72h)")
            ]
            for cat_url, provider_label in catbox_attempts:
                try:
                    print(f"[CLOUD UPLOAD] Trying {provider_label} server-side...")
                    mfd = {
                        "reqtype": (None, "fileupload"),
                        "fileToUpload": (filename, data)
                    }
                    if provider_label.startswith("litterbox"):
                        mfd["time"] = (None, "72h")
                    r_cat = requests.post(cat_url, files=mfd, timeout=60)
                    print(f"[CLOUD UPLOAD] {provider_label} HTTP {r_cat.status_code}")
                    if r_cat.status_code == 200:
                        pub_url = r_cat.text.strip()
                        if pub_url.startswith("http"):
                            print(f"[CLOUD UPLOAD] ✓ Success {provider_label}: {pub_url}")
                            self.send_json(200, {"success": True, "url": pub_url, "provider": provider_label})
                            return
                except Exception as e:
                    print(f"[CLOUD UPLOAD WARN] {provider_label} failed: {e}")

            try:
                print("[CLOUD UPLOAD] Trying temp.sh fallback...")
                r1 = requests.post("https://temp.sh/upload", files={"file": (filename, data)}, timeout=30)
                if r1.status_code == 200:
                    pub_url = r1.text.strip()
                    if pub_url.startswith("http"):
                        self.send_json(200, {"success": True, "url": pub_url, "provider": "temp.sh"})
                        return
            except Exception as e:
                print(f"[CLOUD UPLOAD WARN] temp.sh failed: {e}")

            try:
                print("[CLOUD UPLOAD] Trying tmpfiles.org fallback...")
                r2 = requests.post("https://tmpfiles.org/api/v1/upload", files={"file": (filename, data)}, timeout=30)
                if r2.status_code == 200:
                    j2 = r2.json()
                    if j2.get("status") == "success" and j2.get("data", {}).get("url"):
                        direct_url = j2["data"]["url"].replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/")
                        self.send_json(200, {"success": True, "url": direct_url, "provider": "tmpfiles"})
                        return
            except Exception as e:
                print(f"[CLOUD UPLOAD WARN] tmpfiles failed: {e}")

            self.send_json(500, {"error": "Bulut yüklemesi başarısız oldu"})
            return

        token_data = load_token()
        if not token_data or "access_token" not in token_data:
            self.send_json(401, {
                "detail": f"LinkedIn girişi yapılmamış. Lütfen tıkla ve giriş yap: http://localhost:{PORT}/login"
            })
            return

        access_token = token_data["access_token"]
        person_urn = token_data["person_urn"]

        if path == "/linkedin/upload-chunk":
            content_type = self.headers.get("Content-Type", "")
            content_length = int(self.headers.get("Content-Length", 0))
            
            fields, files = parse_multipart_data(self.rfile, content_type, content_length)
            
            upload_id = fields.get("upload_id")
            chunk_index = fields.get("chunk_index")
            chunk_file = files.get("chunk")
            
            if not upload_id or chunk_index is None or not chunk_file:
                self.send_json(400, {"detail": "Eksik parametre: upload_id, chunk_index veya chunk dosyası yok."})
                return

            chunk_dir = os.path.join(TEMP_DIR, upload_id)
            os.makedirs(chunk_dir, exist_ok=True)
            
            chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_index}.bin")
            with open(chunk_path, "wb") as f:
                f.write(chunk_file["data"])
                
            self.send_json(200, {"status": "ok", "chunk_index": chunk_index})
            return

        if path == "/linkedin/share-chunked":
            content_type = self.headers.get("Content-Type", "")
            content_length = int(self.headers.get("Content-Length", 0))
            
            fields, _ = parse_multipart_data(self.rfile, content_type, content_length)
            
            upload_id = fields.get("upload_id")
            commentary = fields.get("commentary", "")
            
            if not upload_id:
                self.send_json(400, {"detail": "upload_id bulunamadı."})
                return

            chunk_dir = os.path.join(TEMP_DIR, upload_id)
            if not os.path.exists(chunk_dir):
                self.send_json(400, {"detail": f"Geçersiz upload_id: {upload_id}"})
                return

            try:
                video_path = os.path.join(chunk_dir, "final_video.mp4")
                chunk_files = sorted(
                    [f for f in os.listdir(chunk_dir) if f.startswith("chunk_")],
                    key=lambda x: int(x.split("_")[1].split(".")[0])
                )

                with open(video_path, "wb") as outfile:
                    for fname in chunk_files:
                        fpath = os.path.join(chunk_dir, fname)
                        with open(fpath, "rb") as infile:
                            outfile.write(infile.read())

                video_size = os.path.getsize(video_path)
                print(f"[LINKEDIN] Birleştirilen video boyutu: {video_size / 1024 / 1024:.2f} MB")

                reg_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
                reg_body = {
                    "registerUploadRequest": {
                        "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
                        "owner": person_urn,
                        "serviceRelationships": [
                            {
                                "relationshipType": "OWNER",
                                "identifier": "urn:li:userGeneratedContent"
                            }
                        ]
                    }
                }
                r_reg = requests.post(reg_url, headers=headers, json=reg_body)
                if not r_reg.ok:
                    raise Exception(f"Asset kayıt hatası: {r_reg.text}")

                reg_data = r_reg.json()
                asset_urn = reg_data["value"]["asset"]
                upload_url = reg_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]

                print(f"[LINKEDIN] Video binary yükleniyor...")
                with open(video_path, "rb") as vf:
                    upload_headers = {
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/octet-stream"
                    }
                    r_up = requests.put(upload_url, headers=upload_headers, data=vf)
                    if not r_up.ok:
                        raise Exception(f"Video binary yükleme hatası: {r_up.text}")

                print(f"[LINKEDIN] Gönderi yayınlanıyor...")
                post_url = "https://api.linkedin.com/v2/ugcPosts"
                post_body = {
                    "author": person_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "media": [
                                {
                                    "status": "READY",
                                    "description": {"text": "Video"},
                                    "media": asset_urn,
                                    "title": {"text": "Video"}
                                }
                            ],
                            "shareCommentary": {"text": commentary},
                            "shareMediaCategory": "VIDEO"
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                r_post = requests.post(post_url, headers=headers, json=post_body)
                if not r_post.ok:
                    raise Exception(f"LinkedIn Post paylaşma hatası: {r_post.text}")

                post_res = r_post.json()
                print(f"[LINKEDIN] ✓ Video Başarıyla Paylaşıldı! Post ID: {post_res.get('id')}")

                self.send_json(200, {
                    "status": "success",
                    "id": post_res.get("id"),
                    "message": "Video LinkedIn'de başarıyla paylaşıldı! 🚀"
                })
            except Exception as e:
                print(f"[LINKEDIN HATA]: {str(e)}")
                self.send_json(500, {"detail": str(e)})
            finally:
                # Başarılı veya başarısız fark etmeksizin gecici chunk klasorunu temizle
                if os.path.exists(chunk_dir):
                    shutil.rmtree(chunk_dir, ignore_errors=True)
            return

        if path == "/linkedin/share":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            data = json.loads(body_bytes.decode("utf-8"))

            commentary = data.get("commentary", "")
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            post_url = "https://api.linkedin.com/v2/ugcPosts"
            post_body = {
                "author": person_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": commentary},
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            r_post = requests.post(post_url, headers=headers, json=post_body)
            if not r_post.ok:
                self.send_json(500, {"detail": f"LinkedIn paylaşılamadı: {r_post.text}"})
                return
            
            post_res = r_post.json()
            self.send_json(200, {"status": "success", "id": post_res.get("id")})
            return

import ssl
import threading

HTTPS_PORT = 3001

def ensure_ssl_cert():
    cert_path = os.path.join(os.path.dirname(__file__), "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "key.pem")
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        try:
            from OpenSSL import crypto
            key = crypto.PKey()
            key.generate_key(crypto.TYPE_RSA, 2048)
            cert = crypto.X509()
            cert.get_subject().CN = 'localhost'
            cert.set_serial_number(1000)
            cert.gmtime_adj_notBefore(0)
            cert.gmtime_adj_notAfter(365*24*60*60)
            cert.set_issuer(cert.get_subject())
            cert.set_pubkey(key)
            cert.sign(key, 'sha256')
            with open(cert_path, 'wb') as f:
                f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
            with open(key_path, 'wb') as f:
                f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key))
            print("[SSL] Self-signed sertifika hazir (cert.pem, key.pem).")
        except Exception as e:
            print(f"[SSL WARN] Sertifika olusturulamadi: {e}")
    return cert_path, key_path

from socketserver import ThreadingMixIn

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def start_http_server():
    try:
        httpd = ThreadedHTTPServer(('', PORT), LinkedInHandler)
        print(f"[HTTP SERVER] Aktif: http://localhost:{PORT}")
        httpd.serve_forever()
    except Exception as e:
        print(f"[HTTP SERVER ERR] {e}")

def start_https_server():
    cert_path, key_path = ensure_ssl_cert()
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        return
    try:
        httpd = ThreadedHTTPServer(('', HTTPS_PORT), LinkedInHandler)
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
        httpd.socket = ssl_ctx.wrap_socket(httpd.socket, server_side=True)
        print(f"[HTTPS SERVER] Aktif: https://localhost:{HTTPS_PORT}")
        httpd.serve_forever()
    except Exception as e:
        print(f"[HTTPS SERVER WARN] {e}")

def run_server():
    cleanup_stale_chunks()
    print("============================================================")
    print("[LINKEDIN & BUFFER SERVER] Sunucular Baslatiliyor...")
    
    t_http = threading.Thread(target=start_http_server, daemon=True)
    t_https = threading.Thread(target=start_https_server, daemon=True)
    
    t_http.start()
    t_https.start()
    
    print(f"[SERVER] HTTP Adresi: http://localhost:{PORT}")
    print(f"[SERVER] HTTPS Adresi: https://localhost:{HTTPS_PORT}")
    print(f"[SERVER] Giris URL: http://localhost:{PORT}/login")
    print("============================================================")
    
    try:
        t_http.join()
    except KeyboardInterrupt:
        print("\nSunucu durduruldu.")

if __name__ == "__main__":
    run_server()
