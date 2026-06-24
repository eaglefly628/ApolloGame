#!/usr/bin/env python3
"""
Cartridge Station — Apollo 掌机「OS 编辑器」
================================================================
独立工具（仅 Python 标准库，与掌机 start.sh 的 python3 http.server 同栈）。

工作流：
  1. 加载基座 OS（CartridgeOS HTML）
  2. 添加 / 移除 / 替换 游戏（游戏 = <name>.tar.gz 构建包，内含 cartridge.html+assets）
  3. Settings：逐游戏 按键映射表（自动填 / 手动填）
  4. 打包 → 产出新版 OS（tar.gz）：
        cartridge.html   = 基座 OS（注入了 games 列表 + 各游戏 keymap）
        games/<id>/...    = 每个游戏的构建
        start.sh          = python3 http.server + chromium --kiosk

运行：  python3 serve.py   →  浏览器开 http://127.0.0.1:8777
"""
import http.server, socketserver, json, io, os, re, shutil, tarfile, urllib.parse, webbrowser, threading

ROOT    = os.path.dirname(os.path.abspath(__file__))
WEB     = os.path.join(ROOT, 'web')
LIBRARY = os.path.join(ROOT, 'library')       # library/<id>/  每个游戏构建解包
BASE    = os.path.join(ROOT, 'base')          # base/os.html   基座 OS
PORT    = int(os.environ.get('PORT', '8777'))
for d in (LIBRARY, BASE):
    os.makedirs(d, exist_ok=True)

# ── 默认按键映射（CartridgeOS PICO-8 六键掌机方案）─────────────────────
DEFAULT_KEYMAP = [
    {"id": "up",     "label": "D-Pad ↑", "keys": ["ArrowUp", "KeyW"],        "gamepad": [12]},
    {"id": "down",   "label": "D-Pad ↓", "keys": ["ArrowDown", "KeyS"],      "gamepad": [13]},
    {"id": "left",   "label": "D-Pad ←", "keys": ["ArrowLeft", "KeyA"],      "gamepad": [14]},
    {"id": "right",  "label": "D-Pad →", "keys": ["ArrowRight", "KeyD"],     "gamepad": [15]},
    {"id": "a",      "label": "O · 确认", "keys": ["KeyZ", "KeyC", "Space"],  "gamepad": [0, 3]},
    {"id": "b",      "label": "X · 取消", "keys": ["KeyX", "KeyV"],           "gamepad": [1, 2]},
    {"id": "start",  "label": "START",   "keys": ["Enter"],                  "gamepad": [9]},
    {"id": "select", "label": "SELECT",  "keys": ["ShiftRight"],             "gamepad": [8]},
    {"id": "menu",   "label": "MENU",    "keys": ["Escape"],                 "gamepad": [16]},
]
import copy
def default_keymap():
    return copy.deepcopy(DEFAULT_KEYMAP)

def safe_id(name):
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)

# ── 卡带元数据 ────────────────────────────────────────────────────────
def parse_meta(cart_dir, pkg_name):
    base = re.sub(r'\.tar\.gz$|\.tgz$', '', pkg_name)
    m = re.search(r'game-([a-z0-9]+)-([a-z0-9]+)$', base)
    game_code = m.group(1) if m else ''
    hw = m.group(2) if m else ''
    title = base
    idx = os.path.join(cart_dir, 'cartridge.html')
    if os.path.exists(idx):
        try:
            t = open(idx, encoding='utf-8', errors='ignore').read(4000)
            mt = re.search(r'<title>(.*?)</title>', t, re.I | re.S)
            if mt and mt.group(1).strip():
                title = mt.group(1).strip()
        except Exception:
            pass
    nfiles, nbytes = 0, 0
    for dp, _, fns in os.walk(cart_dir):
        for fn in fns:
            if fn == '.station.json':
                continue
            nfiles += 1
            try: nbytes += os.path.getsize(os.path.join(dp, fn))
            except OSError: pass
    return {
        "id": os.path.basename(cart_dir), "pkg": pkg_name,
        "title": title if title != base else f"Apollo {game_code.upper()}" if game_code else title,
        "rawtitle": title, "game": game_code, "hw": hw,
        "files": nfiles, "bytes": nbytes,
        "entry": "cartridge.html" if os.path.exists(idx) else None,
        "playable": os.path.exists(idx),
        "keymap": default_keymap(),
    }

def meta_path(cid): return os.path.join(LIBRARY, cid, '.station.json')

def read_meta(cid):
    p = meta_path(cid)
    if os.path.exists(p):
        try: return json.load(open(p, encoding='utf-8'))
        except Exception: pass
    return parse_meta(os.path.join(LIBRARY, cid), cid)

def write_meta(cid, meta):
    json.dump(meta, open(meta_path(cid), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

def list_library():
    out = []
    for name in sorted(os.listdir(LIBRARY)):
        if os.path.isdir(os.path.join(LIBRARY, name)):
            out.append(read_meta(name))
    return out

# ── 自动探测游戏用到的按键 → 生成 keymap ──────────────────────────────
KEY_TOKENS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD',
              'KeyZ','KeyX','KeyC','KeyV','Space','Enter','Escape','ShiftRight','ShiftLeft','Tab']
def auto_keymap(cid):
    """扫描游戏构建 JS，统计它实际监听的键 → 在默认布局上标注 detected。"""
    d = os.path.join(LIBRARY, cid)
    found = set()
    for dp, _, fns in os.walk(d):
        for fn in fns:
            if fn.endswith('.js') or fn.endswith('.html'):
                try:
                    txt = open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
                    for tok in KEY_TOKENS:
                        if tok in txt:
                            found.add(tok)
                except Exception:
                    pass
    km = default_keymap()
    for b in km:
        b["detected"] = any(k in found for k in b.get("keys", []))
    return km, sorted(found)

def add_package(pkg_name, data_bytes, keep_keymap=None):
    cid = safe_id(re.sub(r'\.tar\.gz$|\.tgz$', '', pkg_name))
    dest = os.path.join(LIBRARY, cid)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data_bytes), mode='r:gz') as tf:
        for m in tf.getmembers():
            mp = os.path.normpath(m.name).lstrip('./')
            if mp.startswith('..') or os.path.isabs(mp):
                continue
            target = os.path.join(dest, mp)
            if m.isdir():
                os.makedirs(target, exist_ok=True)
            elif m.isfile():
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with tf.extractfile(m) as src, open(target, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
    meta = parse_meta(dest, pkg_name)
    if keep_keymap:
        meta["keymap"] = keep_keymap
    write_meta(cid, meta)
    return meta

def remove_package(cid):
    d = os.path.join(LIBRARY, safe_id(cid))
    if os.path.isdir(d) and os.path.commonpath([d, LIBRARY]) == LIBRARY:
        shutil.rmtree(d); return True
    return False

# ── 基座 OS ───────────────────────────────────────────────────────────
OS_PATH = os.path.join(BASE, 'os.html')
def os_status():
    if os.path.exists(OS_PATH):
        return {"loaded": True, "bytes": os.path.getsize(OS_PATH)}
    return {"loaded": False, "bytes": 0}

def save_base_os(data_bytes):
    with open(OS_PATH, 'wb') as f:
        f.write(data_bytes)
    return os_status()

# ── 打包：注入基座 OS + 捆绑游戏 → 新版 OS tar.gz ─────────────────────
GRADS = ['linear-gradient(160deg,#1A0A05,#100A15,#050308)',
         'linear-gradient(160deg,#05121A,#0A1015,#03050A)',
         'linear-gradient(160deg,#1A0518,#120A15,#08030A)',
         'linear-gradient(160deg,#0A1A05,#0F1010,#030A05)']

def build_game_objects(metas):
    """把库里游戏转成 CartridgeOS 的 g 对象（pgame.url + keymap）。"""
    objs = []
    for i, c in enumerate(metas):
        objs.append({
            "id": "gen-" + c["id"],
            "num": f"{i+1:03d}",
            "title": c["title"],
            "genre": (c["game"] and f"Apollo / {c['game'].upper()}") or "Apollo",
            "tags": [t for t in ["APOLLO", c["hw"].upper() if c["hw"] else "", "CARTRIDGE"] if t],
            "rating": "T", "ratingFull": "TEEN",
            "grad": GRADS[i % len(GRADS)], "accent": "#00dfa0", "color": "#00dfa0",
            "desc": f"Apollo game build · {c['pkg']}",
            "pgame": {"url": f"./games/{c['id']}/{c['entry'] or 'cartridge.html'}"},
            "keymap": c.get("keymap", default_keymap()),
            "_ts": 0,
        })
    return objs

OS_START = """#!/bin/sh
# Apollo OS — RK3562 Linux
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"; PORT=8080; cd "$SCRIPT_DIR"
echo "  Apollo OS server on $PORT..."
python3 -m http.server $PORT --bind 127.0.0.1 & SERVER_PID=$!; sleep 1
URL="http://127.0.0.1:$PORT/cartridge.html"
if command -v chromium-browser >/dev/null 2>&1; then chromium-browser --kiosk --noerrdialogs --no-sandbox "$URL"
elif command -v chromium >/dev/null 2>&1; then chromium --kiosk --noerrdialogs --no-sandbox "$URL"
elif command -v google-chrome >/dev/null 2>&1; then google-chrome --kiosk --noerrdialogs "$URL"
else echo "  Open manually: $URL"; fi
kill $SERVER_PID 2>/dev/null || true
"""

def inject_os(os_html, game_objs):
    """把 games 注入基座 OS：在 <body> 后插 seed 脚本写 localStorage.cart_library_v2。"""
    seed = ("<script>/* cartridge-station: injected game set */(function(){try{"
            "localStorage.setItem('cart_library_v2'," + json.dumps(json.dumps(game_objs, ensure_ascii=False)) + ");"
            "}catch(e){console.warn('seed failed',e);}})();</script>")
    m = re.search(r'<body[^>]*>', os_html, re.I)
    if m:
        i = m.end()
        return os_html[:i] + "\n" + seed + "\n" + os_html[i:]
    return seed + os_html

def pack_os(ids, out_name):
    if not os.path.exists(OS_PATH):
        raise ValueError("还没加载基座 OS（先点「加载 OS」）")
    lib = {c["id"]: c for c in list_library()}
    chosen = [lib[i] for i in ids if i in lib]
    if not chosen:
        raise ValueError("没选要放进 OS 的游戏")
    os_html = open(OS_PATH, encoding='utf-8', errors='ignore').read()
    injected = inject_os(os_html, build_game_objects(chosen))
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tf:
        def add_str(arc, text, mode=0o644):
            b = text.encode('utf-8'); ti = tarfile.TarInfo('./' + arc); ti.size = len(b); ti.mode = mode
            tf.addfile(ti, io.BytesIO(b))
        add_str('cartridge.html', injected)
        add_str('start.sh', OS_START, mode=0o755)
        for c in chosen:
            tf.add(os.path.join(LIBRARY, c["id"]), arcname='./games/' + c["id"], recursive=True)
    return buf.getvalue()

# ── HTTP ──────────────────────────────────────────────────────────────
class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def _json(self, obj, code=200): self._send(code, json.dumps(obj, ensure_ascii=False), code and 'application/json; charset=utf-8')
    def _file(self, path):
        if not os.path.exists(path) or os.path.isdir(path): return self._send(404, 'not found', 'text/plain')
        ct = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
              '.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp',
              '.svg':'image/svg+xml','.wasm':'application/wasm','.mp3':'audio/mpeg','.ogg':'audio/ogg'}
        ext = os.path.splitext(path)[1].lower()
        with open(path, 'rb') as f:
            self._send(200, f.read(), ct.get(ext, 'application/octet-stream') + ('; charset=utf-8' if ext in ('.html','.js','.css','.json','.svg') else ''))

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        if p in ('/', '/index.html'): return self._file(os.path.join(WEB, 'index.html'))
        if p in ('/app.js', '/style.css'): return self._file(os.path.join(WEB, p.lstrip('/')))
        if p == '/api/state': return self._json({"os": os_status(), "cartridges": list_library()})
        if p.startswith('/preview/'):
            rest = urllib.parse.unquote(p[len('/preview/'):]); cid, _, sub = rest.partition('/')
            base = os.path.join(LIBRARY, safe_id(cid)); target = os.path.normpath(os.path.join(base, sub or 'cartridge.html'))
            if os.path.commonpath([target, base]) != base: return self._send(403, 'forbidden', 'text/plain')
            return self._file(target)
        return self._send(404, 'not found', 'text/plain')

    def do_POST(self):
        u = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(u.query)
        length = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(length) if length else b''
        try:
            if u.path == '/api/load-os':
                return self._json({"ok": True, "os": save_base_os(body)})
            if u.path == '/api/add':
                name = qs.get('name', ['game.tar.gz'])[0]
                # 替换时保留旧 keymap
                cid = safe_id(re.sub(r'\.tar\.gz$|\.tgz$', '', name)); keep = None
                if qs.get('replace') and os.path.exists(meta_path(cid)):
                    keep = read_meta(cid).get('keymap')
                return self._json({"ok": True, "cartridge": add_package(name, body, keep_keymap=keep)})
            if u.path == '/api/remove':
                return self._json({"ok": remove_package(json.loads(body or b'{}').get('id', ''))})
            if u.path == '/api/keymap/set':
                req = json.loads(body or b'{}'); cid = safe_id(req.get('id', ''))
                meta = read_meta(cid); meta['keymap'] = req.get('keymap', default_keymap()); write_meta(cid, meta)
                return self._json({"ok": True})
            if u.path == '/api/keymap/auto':
                cid = safe_id(json.loads(body or b'{}').get('id', '')); km, found = auto_keymap(cid)
                meta = read_meta(cid); meta['keymap'] = km; write_meta(cid, meta)
                return self._json({"ok": True, "keymap": km, "detected": found})
            if u.path == '/api/pack':
                req = json.loads(body or b'{}')
                name = safe_id(req.get('name', 'apollo-os'))
                data = pack_os(req.get('ids', []), name)
                return self._send(200, data, 'application/gzip',
                                  extra={'Content-Disposition': f'attachment; filename="{name}.tar.gz"'})
        except Exception as e:
            return self._json({"ok": False, "error": str(e)}, code=400)
        return self._send(404, 'not found', 'text/plain')
    def log_message(self, *a): pass

class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True

def main():
    srv = TS(('127.0.0.1', PORT), Handler); url = f'http://127.0.0.1:{PORT}'
    print(f'  Cartridge Station ▸ {url}\n  库: {LIBRARY}\n  基座 OS: {"已加载" if os_status()["loaded"] else "未加载"}')
    try: threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    except Exception: pass
    try: srv.serve_forever()
    except KeyboardInterrupt: print('\n  bye.')

if __name__ == '__main__':
    main()
