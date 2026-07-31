#!/usr/bin/env python3
"""
Steam Publisher — ZeroCraft 游戏「一键傻瓜发布到 Steam」工具
================================================================
独立工具（仅 Python 标准库）。把 Electron 游戏经 SteamPipe(steamcmd) 推上 Steam：
  1. 填配置（AppID / 各平台 DepotID / builder 账号 / steamcmd 路径 / 选游戏）
  2. 「构建」      → electron-builder --dir 出"裸目录"（Steam 要的不是 dmg/exe）
  3. 「生成配置」  → 写 app_build.vdf + depot_*.vdf（SteamPipe 配置）
  4. 「一键发布」  → steamcmd +run_app_build → 上传成一个 build
  5. 去 Steamworks 后台 Builds 页 Set Live（防误推，Steam 不给 API）

运行：  python3 serve.py   →  浏览器开 http://127.0.0.1:8799

⚠️ 真上传需要：合作伙伴账号 + 真 AppID/DepotID + 装了 steamcmd。没这些前本工具也能
   跑通配置/生成 VDF/自检；占位 AppID=480 仅供演练。
"""
import http.server, socketserver, json, os, subprocess, threading, urllib.parse, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'web')
REPO = os.path.abspath(os.path.join(ROOT, '..'))     # apollo 仓库根
CONFIG_PATH = os.path.join(ROOT, 'config.json')
OUT = os.path.join(ROOT, 'out')                       # VDF + steamcmd buildoutput
LOG = os.path.join(ROOT, 'run.log')
PORT = int(os.environ.get('PORT', '8799'))
os.makedirs(OUT, exist_ok=True)

GAME_TITLES = {
    'game-e': 'ZeroCraft Balatro Deck（小丑牌）',
    'game-f': 'ZeroCraft Pixel Kingdoms（像素三分天下）',
    'game-g': 'Fateflip Poker（翻命扑克）',
}

DEFAULT_CONFIG = {
    'appId': '480',                 # 480=SpaceWar 演练位；换真 AppID
    'description': 'ZeroCraft build',
    'setLive': '',                  # 分支名；留空=只传不设线上（推荐，后台手动 Set Live）
    'steamcmd': 'steamcmd',         # 命令或绝对路径
    'builder': '',                  # Steam builder 账号名（密码/令牌走 steamcmd 缓存登录）
    'game': 'game-g',
    'depots': [                     # 每平台一个 depot；只填了 depotId 的才会发布
        {'plat': 'win',   'depotId': '', 'content': ''},
        {'plat': 'mac',   'depotId': '', 'content': ''},
        {'plat': 'linux', 'depotId': '', 'content': ''},
    ],
}

# ── 配置读写 ─────────────────────────────────────────────────────────
def load_config():
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if os.path.exists(CONFIG_PATH):
        try:
            saved = json.load(open(CONFIG_PATH, encoding='utf-8'))
            cfg.update({k: saved[k] for k in saved if k in cfg})
        except Exception:
            pass
    return cfg

def save_config(cfg):
    keep = {k: cfg.get(k, DEFAULT_CONFIG[k]) for k in DEFAULT_CONFIG}
    json.dump(keep, open(CONFIG_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return keep

# ── 探测 / 状态 ──────────────────────────────────────────────────────
def detect_steamcmd(cmd):
    if not cmd:
        return {'found': False, 'how': '未填'}
    if os.path.isabs(cmd):
        return {'found': os.path.exists(cmd), 'how': '绝对路径'}
    p = shutil.which(cmd)
    return {'found': bool(p), 'how': p or 'PATH 未找到'}

def find_builds(game):
    """在 release/<game>/bin 下找 electron-builder --dir 产出的裸目录候选。"""
    base = os.path.join(REPO, 'release', game, 'bin')
    cands = []
    if os.path.isdir(base):
        for name in sorted(os.listdir(base)):
            full = os.path.join(base, name)
            # electron-builder 裸目录：*-unpacked / mac / mac-arm64 等
            if os.path.isdir(full) and ('unpacked' in name or name.startswith('mac') or name.startswith('linux')):
                cands.append(full)
    return cands

# ── VDF 生成（SteamPipe）─────────────────────────────────────────────
def depot_vdf(depot_id, content_root):
    return ('"DepotBuild"\n{\n'
            f'    "DepotID" "{depot_id}"\n'
            f'    "contentroot" "{content_root}"\n'
            '    "FileMapping"\n    {\n'
            '        "LocalPath" "*"\n'
            '        "DepotPath" "."\n'
            '        "recursive" "1"\n'
            '    }\n'
            '    "FileExclusion" "*.pdb"\n'
            '}\n')

def app_build_vdf(cfg, active_depots):
    lines = ['"appbuild"\n{\n',
             f'    "appid" "{cfg["appId"]}"\n',
             f'    "desc" "{cfg["description"]}"\n',
             '    "buildoutput" "./buildoutput"\n',
             '    "contentroot" ""\n',
             f'    "setlive" "{cfg.get("setLive", "")}"\n',
             '    "depots"\n    {\n']
    for d in active_depots:
        lines.append(f'        "{d["depotId"]}" "depot_{d["depotId"]}.vdf"\n')
    lines.append('    }\n}\n')
    return ''.join(lines)

def gen_vdf(cfg):
    active = [d for d in cfg['depots'] if str(d.get('depotId', '')).strip()]
    if not str(cfg.get('appId', '')).strip():
        raise ValueError('AppID 为空')
    if not active:
        raise ValueError('没有任何平台填了 DepotID')
    files = {}
    for d in active:
        content = d.get('content') or ''
        if not content:
            raise ValueError(f'{d["plat"]} depot {d["depotId"]} 没指定构建目录(content)')
        name = f'depot_{d["depotId"]}.vdf'
        files[name] = depot_vdf(d['depotId'], content)
    files['app_build.vdf'] = app_build_vdf(cfg, active)
    for name, body in files.items():
        open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)
    # 真 AppID 写进仓库根 steam_appid.txt（构建产物会带上）
    open(os.path.join(REPO, 'steam_appid.txt'), 'w', encoding='utf-8').write(str(cfg['appId']))
    return files

# ── 判词 token 收口（Lead 2026-07-04 派工）─────────────────────────────────
# 全管线对外状态**只用这套稳定字面**——apollo.py 薄代理 / studio 前端认它，消费端不再 scrape
# 日志字符串或猜 ad-hoc 键。改字面 = 破契约，勿动。
PUBLISH_STAGES = ('package', 'genvdf', 'upload')   # 三段命名（Lead 点名·顺序即执行序）
# 段判词（plan / stage_* 用）：某段是否就绪
ST_OK = 'ok'            # 就绪（命令已构造 / 文件已生成）
ST_BLOCKED = 'blocked'  # 缺前置（未填 appId/depot/builder）——可预览可修，非错误
# 任务判词（真跑的子进程用·= 进度口径）
JOB_IDLE = 'idle'       # 从没跑过
JOB_RUNNING = 'running' # 在跑
JOB_DONE = 'done'       # 结束且 exit==0
JOB_ERROR = 'error'     # 结束且 exit!=0
# 动作 → 所属段（进度展示用）
STAGE_OF_ACTION = {'build': 'package', 'gen-and-publish': 'upload', 'publish': 'upload', 'login': 'login'}

# ── 子进程任务 + 实时日志（轮询拉取）──────────────────────────────────
_job = {'proc': None, 'running': False, 'action': None, 'stage': None, 'exit': None, 'started': False}

def start_job(action, argv, cwd):
    if _job['running']:
        raise ValueError('已有任务在跑，等它结束')
    open(LOG, 'w', encoding='utf-8').write(f'$ {" ".join(argv)}\n(cwd: {cwd})\n\n')
    f = open(LOG, 'ab')
    try:
        p = subprocess.Popen(argv, cwd=cwd, stdout=f, stderr=subprocess.STDOUT)
    except FileNotFoundError as e:
        f.write(f'\n[启动失败] {e}\n'.encode('utf-8')); f.close()
        raise ValueError(f'命令找不到：{argv[0]}')
    _job.update(proc=p, running=True, action=action, stage=STAGE_OF_ACTION.get(action),
                exit=None, started=True, logf=f)

    def _wait():
        code = p.wait()
        try: f.write(f'\n\n[结束] exit={code}\n'.encode('utf-8')); f.flush(); f.close()
        except Exception: pass
        _job['exit'] = code
        _job['running'] = False
    threading.Thread(target=_wait, daemon=True).start()

def job_status():
    """任务判词（进度）——单一 token 口径：idle / running / done / error。"""
    if _job['running']:
        return {'status': JOB_RUNNING, 'action': _job['action'], 'stage': _job['stage']}
    if not _job['started']:
        return {'status': JOB_IDLE}
    code = _job['exit']
    return {'status': JOB_DONE if code == 0 else JOB_ERROR,
            'action': _job['action'], 'stage': _job['stage'], 'exit': code}

def build_argv(cfg):
    plats = [d['plat'] for d in cfg['depots'] if str(d.get('depotId', '')).strip()]
    flags = []
    for p in plats:
        flags.append({'win': '--win', 'mac': '--mac', 'linux': '--linux'}.get(p, ''))
    flags = [x for x in flags if x]
    game = cfg['game']
    title = {'game-e': 'ApolloBalatroDeck', 'game-f': 'ApolloPixelKingdoms', 'game-g': 'FateflipPoker'}.get(game, game)
    app_id = {'game-e': 'com.apollo.gamee', 'game-f': 'com.apollo.gamef', 'game-g': 'com.apollo.gameg'}.get(game, f'com.apollo.{game.replace("-", "")}')
    # --dir = 出"裸目录"（Steam 要的，不是 dmg/exe 安装包）
    return (['npx', 'electron-builder'] + flags + ['--dir',
            '--config', 'electron-builder.yml',
            f'-c.directories.output=release/{game}/bin',
            f'-c.productName={title}', f'-c.appId={app_id}'])

def publish_argv(cfg):
    if not cfg.get('builder'):
        raise ValueError('未填 Steam builder 账号')
    vdf = os.path.join(OUT, 'app_build.vdf')
    if not os.path.exists(vdf):
        raise ValueError('还没生成 app_build.vdf（先点「生成配置」）')
    return [cfg['steamcmd'] or 'steamcmd', '+login', cfg['builder'],
            '+run_app_build', vdf, '+quit']

def login_argv(cfg):
    if not cfg.get('builder'):
        raise ValueError('未填 Steam builder 账号')
    return [cfg['steamcmd'] or 'steamcmd', '+login', cfg['builder'], '+quit']

# ── 三段稳定契约（Lead 2026-07-04 派工：package → genVDF → upload）───────────────
# 每段返回统一形状 {stage, status, ...}；status 用收口的判词 token。缺前置记 ST_BLOCKED+reason
# 不抛（预览友好）。这三段 + plan_pipeline = apollo.py 薄代理 / studio 前端消费的稳定面。
def stage_package(cfg):
    """① package：构造 electron-builder --dir 裸目录命令（不执行）。"""
    return {'stage': 'package', 'status': ST_OK, 'cwd': 'REPO', 'argv': build_argv(cfg)}

def stage_genvdf(cfg):
    """② genVDF：写 SteamPipe app_build/depot VDF + 仓库根 steam_appid.txt（幂等·真写）。"""
    try:
        files = gen_vdf(cfg)
        return {'stage': 'genvdf', 'status': ST_OK, 'out': OUT, 'files': sorted(files.keys())}
    except ValueError as e:
        return {'stage': 'genvdf', 'status': ST_BLOCKED, 'reason': str(e)}

def stage_upload(cfg):
    """③ upload：构造 steamcmd +run_app_build 上传命令（不执行）。"""
    try:
        return {'stage': 'upload', 'status': ST_OK, 'cwd': 'OUT', 'argv': publish_argv(cfg)}
    except ValueError as e:
        return {'stage': 'upload', 'status': ST_BLOCKED, 'reason': str(e)}

def plan_pipeline(cfg):
    """dry-run 预览整条三段流水线（package → genVDF → upload），返回稳定判词，**不 build/upload**。
    单一入口固化编排顺序 + 命令构造，供 studio 接入前校验 / GUI 预览；无真账号用 480 即可验编排。
    副作用同「生成配置」：genVDF 段真写 out/*.vdf + steam_appid.txt（幂等）；package/upload 只构造命令。
    真跑仍走 /api/run（build / gen-and-publish）。某段缺前置 → 该段 ST_BLOCKED+reason，不抛。"""
    return [stage_package(cfg), stage_genvdf(cfg), stage_upload(cfg)]

# ── HTTP ─────────────────────────────────────────────────────────────
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body))); self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False), 'application/json; charset=utf-8')

    def _file(self, path):
        if not os.path.exists(path):
            return self._send(404, 'not found', 'text/plain')
        ct = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'}.get(os.path.splitext(path)[1], 'application/octet-stream')
        self._send(200, open(path, 'rb').read(), ct + '; charset=utf-8')

    def _body(self):
        n = int(self.headers.get('Content-Length', '0'))
        return json.loads(self.rfile.read(n) or '{}') if n else {}

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        path = p.path
        if path in ('/', '/index.html'): return self._file(os.path.join(WEB, 'index.html'))
        if path in ('/app.js', '/style.css'): return self._file(os.path.join(WEB, path.lstrip('/')))
        if path == '/api/state':
            cfg = load_config()
            return self._json({
                'config': cfg,
                'games': [{'id': g, 'title': t} for g, t in GAME_TITLES.items()],
                'steamcmd': detect_steamcmd(cfg.get('steamcmd', '')),
                'builds': find_builds(cfg.get('game', 'game-g')),
                'job': job_status(),                              # 收口的进度判词（idle/running/done/error）
                'running': _job['running'], 'action': _job['action'],  # 旧字段留兼容现有 GUI
            })
        if path == '/api/log':
            qs = urllib.parse.parse_qs(p.query)
            off = int(qs.get('offset', ['0'])[0])
            data = b''
            if os.path.exists(LOG):
                with open(LOG, 'rb') as f:
                    f.seek(off); data = f.read()
            return self._json({'offset': off + len(data), 'text': data.decode('utf-8', 'replace'),
                               'job': job_status(), 'running': _job['running']})
        return self._send(404, 'not found', 'text/plain')

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = self._body()
        try:
            if path == '/api/save-config':
                return self._json({'config': save_config(body.get('config', {}))})
            if path == '/api/gen-vdf':
                cfg = save_config(body.get('config', load_config()))
                files = gen_vdf(cfg)
                return self._json({'ok': True, 'files': files, 'dir': OUT})
            if path == '/api/plan':
                # dry-run 预览整条流水线（不 build/upload）；供 studio 接入 / GUI 预览。
                cfg = save_config(body.get('config', load_config()))
                return self._json({'ok': True, 'steps': plan_pipeline(cfg)})
            if path == '/api/run':
                cfg = save_config(body.get('config', load_config()))
                action = body.get('action', '')
                argv = {
                    'build': lambda: build_argv(cfg),
                    'gen-and-publish': lambda: (gen_vdf(cfg), publish_argv(cfg))[1],
                    'publish': lambda: publish_argv(cfg),
                    'login': lambda: login_argv(cfg),
                }.get(action)
                if not argv:
                    return self._json({'error': f'未知操作: {action}'}, 400)
                start_job(action, argv(), REPO if action == 'build' else OUT)
                return self._json({'ok': True, 'action': action})
        except ValueError as e:
            return self._json({'error': str(e)}, 400)
        except Exception as e:
            return self._json({'error': f'{type(e).__name__}: {e}'}, 500)
        return self._send(404, 'not found', 'text/plain')


def main():
    class TS(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
    srv = TS(('127.0.0.1', PORT), Handler)
    url = f'http://127.0.0.1:{PORT}'
    print(f'  Steam Publisher → {url}')
    try:
        import webbrowser, threading as _t
        _t.Timer(0.6, lambda: webbrowser.open(url)).start()
    except Exception:
        pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
