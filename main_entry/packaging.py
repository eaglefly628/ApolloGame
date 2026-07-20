"""打包任务（发布屏·每游戏×平台）。"""
import subprocess
import sys
import os
import zipfile
import time
import shutil
import uuid
import threading

from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, c

# ── 打包任务（发布屏：每游戏×每平台 一次「打包」→ 出可分发产物 →「下载」·owner 07-12）──────
# 平台闭集：web=单文件自包含 HTML（双击即玩）· mac=.dmg · win=.zip · handheld=掌机单HTML+tar.gz。
# 内置 src/games 游戏（e/f/g/i/x 有卡带工程）走 VITE_TARGET_GAME 静态 import；生成的库卡带（纯数据
# manifest）web 平台走 scripts/package-web.mjs（内联 manifest 打自包含单 HTML·REQ-PKG 引擎内联钩子已落地）。
# 打包串行（共享 dist-cartridge/·避免并发互踩），一次一个。
_PKG_JOBS: dict = {}
_PKG_JOBS_LOCK = threading.Lock()
_PKG_BUILD_LOCK = threading.Lock()  # 串行化真实构建（vite/electron 共享输出目录）
# 平台 → (人读名, 产物扩展, 是否需 macOS)
_PKG_PLATFORMS = {
    'web':      {'label': '网页版·单文件', 'ext': 'html', 'needMac': False},
    'mac':      {'label': 'Mac 桌面版 .dmg', 'ext': 'dmg', 'needMac': True},
    'win':      {'label': 'Windows 桌面版 .zip', 'ext': 'zip', 'needMac': False},
    'handheld': {'label': '掌机·单HTML', 'ext': 'html', 'needMac': False},
    'zip':      {'label': '工程包 .zip（卡带+资产）', 'ext': 'zip', 'needMac': False},
    'react':    {'label': 'React 独立工程 .zip', 'ext': 'zip', 'needMac': False},
}
# 内置卡带工程游戏（有 src/games 入口·可打卡带/桌面）——与 scripts/dist.py 的 GAME_META 对齐。
_PKG_BUILTIN_META = {
    'game-e': ('ApolloBalatroDeck', 'com.apollo.gamee'),
    'game-f': ('ApolloPixelKingdoms', 'com.apollo.gamef'),
    'game-g': ('FateflipPoker', 'com.apollo.gameg'),
    'game-x': ('RemnantPocket', 'com.apollo.gamex'),
}
# cartridge-entry 能静态 import 的工程游戏（与其 startLoad 分支一致）——不在此集内的 slug=库卡带（纯数据）。
_CARTRIDGE_ENGINE_GAMES = {'game-e', 'game-f', 'game-g', 'game-i', 'game-x'}

def _pkg_job_update(jid: str, **kw) -> None:
    with _PKG_JOBS_LOCK:
        if jid in _PKG_JOBS:
            _PKG_JOBS[jid].update(kw)

def _pkg_job_view(j: dict) -> dict:
    return {'id': j['id'], 'slug': j['slug'], 'platform': j['platform'],
            'platformLabel': _PKG_PLATFORMS.get(j['platform'], {}).get('label', j['platform']),
            'step': j['step'], 'done': j['done'], 'error': j['error'],
            'artifactName': j.get('artifactName'), 'ready': bool(j.get('artifact') and not j['error']),
            'elapsedSec': int(time.time() - j['startedAt'])}

def _run_pkg_job(jid: str, slug: str, platform: str) -> None:
    """后台打包线程。产物路径落 job['artifact']（绝对路径），下载端点据 jid 取。真实构建串行。"""
    try:
        info = _PKG_PLATFORMS[platform]
        # zip=工程包：任何卡带/内置都能出（内存 zip 逻辑复用 _serve_export 的树规则）——先落到 release/ 供下载。
        if platform == 'zip':
            _pkg_job_update(jid, step=1)
            out = _pkg_build_zip(slug)
            _pkg_job_update(jid, done=True, artifact=str(out), artifactName=out.name); return
        # react=独立工程：tools/export-game.mjs 抽出纯游戏闭包 → 自包含 TS+Vite 工程（含 React 封装）→ zip。
        # 任何有 mount 入口的游戏都可（内置 e/f/g/x + 玩法游戏 a/b/c 等）；无 mount 入口的库卡带会报错指路。
        if platform == 'react':
            _pkg_job_update(jid, step=1)
            out = _pkg_build_react(slug)
            _pkg_job_update(jid, done=True, artifact=str(out), artifactName=out.name); return
        # 单文件/桌面/掌机：现管线只支持内置工程游戏。生成的库卡带 → 明确指路（不伪造产物）。
        is_builtin = slug in _PKG_BUILTIN_META
        if not is_builtin:
            _pkg_job_update(jid, done=True, error=(
                f'「{info["label"]}」暂只支持内置工程游戏（e/f/g/x）。生成的卡带打成独立可运行包需引擎'
                '「从内联 manifest 启动」钩子——已记 requests.md 缺口，落地后此项即通。当前可先下「工程包 .zip」。'))
            return
        if info['needMac'] and sys.platform != 'darwin':
            _pkg_job_update(jid, done=True, error=(
                f'Mac .dmg 需在 macOS 上打包（本机 ={sys.platform}）。在你的 Mac 上跑：'
                f'  python3 scripts/dist.py  → 选 {slug} → Mac .dmg。产物在 release/{slug}/bin/。'))
            return
        with _PKG_BUILD_LOCK:  # 串行真实构建
            _pkg_job_update(jid, step=1)
            out = _pkg_build_platform(slug, platform)
        if not out or not out.exists():
            _pkg_job_update(jid, done=True, error='构建完成但未找到产物文件（见服务端日志）'); return
        _pkg_job_update(jid, done=True, artifact=str(out), artifactName=out.name)
        print(c('  [PKG]', 'g'), f'job {jid} → {slug}/{platform} → {out.name}')
    except subprocess.CalledProcessError as e:
        _pkg_job_update(jid, done=True, error=f'构建失败（退出码 {e.returncode}）：{str(e)[:200]}')
    except Exception as e:
        _pkg_job_update(jid, done=True, error=str(e)[:280])

def _pkg_build_zip(slug: str):
    """工程包 zip（卡带本体+资产·排除 mock/快照）——落 release/<slug>/<slug>.zip 供下载端点取。"""
    lib = LIBRARY_DIR / slug
    pub = ROOT / 'public' / 'games' / slug
    out_dir = ROOT / 'release' / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f'{slug}.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        def _add(root_dir, prefix):
            if not root_dir.is_dir():
                return
            for p in sorted(root_dir.rglob('*')):
                if not p.is_file():
                    continue
                parts = p.relative_to(root_dir).parts
                if '.git' in parts or 'snapshots' in parts or 'mock' in parts:
                    continue
                z.write(p, f'{slug}/{prefix}{p.relative_to(root_dir).as_posix()}')
        _add(lib, '')
        _add(pub, 'assets/' if lib.is_dir() else '')
    return out

def _pkg_build_react(slug: str):
    """React 独立工程 zip：tools/export-game.mjs 追游戏 mount 入口的传递依赖闭包 → 剥掉平台
    （launcher/studio/账号/大厅/Steam/Electron/其它游戏）→ 自包含 TS+Vite 工程（<Game{X}/> React 封装
    + 独立 index.html + 对接说明）→ zip 供下载。产物内含 npm i && npm run dev 即可跑的完整源码。"""
    tool = ROOT / 'tools' / 'export-game.mjs'
    if not tool.is_file():
        raise RuntimeError('缺 tools/export-game.mjs（独立导出脚本未就位）')
    work = ROOT / 'release' / slug / 'react-src'
    if work.exists():
        shutil.rmtree(work)
    work.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['node', str(tool), slug, '--out', str(work)],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or '').strip().splitlines()[-1:] or ['']
        raise RuntimeError(
            f'导出失败：{slug} 可能不是带 mount 入口的可玩游戏（纯数据库卡带不支持 React 独立工程）。{tail[0][:160]}')
    out = ROOT / 'release' / slug / f'{slug}-react.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(work.rglob('*')):
            if not p.is_file():
                continue
            parts = p.relative_to(work).parts
            if 'node_modules' in parts or 'dist' in parts:  # 只打源码，不打依赖/构建产物
                continue
            z.write(p, f'{slug}-react/{p.relative_to(work).as_posix()}')
    return out

def _pkg_build_platform(slug: str, platform: str):
    """内置工程游戏的真实构建。web=卡带单文件 HTML；handheld=掌机单HTML；mac/win=electron-builder。"""
    env = os.environ.copy()
    if platform == 'web':
        out_dir = ROOT / 'release' / slug; out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f'{slug}.html'
        if slug in _CARTRIDGE_ENGINE_GAMES:
            # 工程游戏：VITE_TARGET_GAME 静态 import + 单文件。
            env['VITE_TARGET_GAME'] = slug
            env['VITE_SINGLEFILE'] = '1'
            subprocess.run(['npx', 'tsc', '--noEmit'], cwd=ROOT, check=True)
            subprocess.run(['npx', 'vite', 'build', '--config', 'vite.config.cartridge.ts'],
                           cwd=ROOT, check=True, env=env)
            src = ROOT / 'dist-cartridge' / 'cartridge.html'
            if src.exists():
                shutil.copy2(src, out)
        else:
            # 库卡带（纯数据 manifest）：package-web 内联 manifest → 自包含单 HTML（REQ-PKG 引擎内联钩子）。
            subprocess.run(['node', str(ROOT / 'scripts' / 'package-web.mjs'), slug, str(out)],
                           cwd=ROOT, check=True)
        return out
    if platform == 'handheld':
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'build_game.py'), slug], cwd=ROOT, check=True)
        html = ROOT / f'apollo-{slug}-rk3562.html'
        out_dir = ROOT / 'release' / slug; out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / html.name
        if html.exists():
            shutil.move(str(html), str(out))
        return out
    if platform in ('mac', 'win'):
        # 先出卡带工程再用 electron-builder 包（与 dist.py 一致）。
        env['VITE_TARGET_GAME'] = slug
        subprocess.run(['npx', 'tsc', '--noEmit'], cwd=ROOT, check=True)
        subprocess.run(['npx', 'vite', 'build', '--config', 'vite.config.cartridge.ts'], cwd=ROOT, check=True, env=env)
        product_name, app_id = _PKG_BUILTIN_META.get(slug, (slug, f'com.apollo.{slug.replace("-", "")}'))
        out_dir = f'release/{slug}/bin'
        flag = '--mac' if platform == 'mac' else '--win'
        subprocess.run(['npx', 'electron-builder', flag, '--config', 'electron-builder.yml',
                        f'-c.directories.output={out_dir}', f'-c.productName={product_name}',
                        f'-c.appId={app_id}'], cwd=ROOT, check=True)
        binp = ROOT / out_dir
        want = '.dmg' if platform == 'mac' else '.zip'
        hits = sorted(binp.rglob(f'*{want}')) if binp.is_dir() else []
        return hits[0] if hits else None
    return None

def handle_package_job_start(body: dict) -> dict:
    """POST /api/package/job。{slug, platform}。凭据前置校验（合法 slug + 已知平台 + 游戏存在）。"""
    slug = str(body.get('slug') or '').strip()
    platform = str(body.get('platform') or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug}'}
    if platform not in _PKG_PLATFORMS:
        return {'success': False, 'error': f'未知平台: {platform}（web/mac/win/handheld/zip/react）'}
    exists = (LIBRARY_DIR / slug / 'manifest.json').is_file() or (ROOT / 'src' / 'games' / slug).is_dir() \
        or (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file()
    if not exists:
        return {'success': False, 'error': f'游戏不存在: {slug}'}
    jid = uuid.uuid4().hex[:12]
    with _PKG_JOBS_LOCK:
        for old in sorted(_PKG_JOBS.values(), key=lambda x: x['startedAt'])[:-19]:  # 只留最近 20
            _PKG_JOBS.pop(old['id'], None)
        _PKG_JOBS[jid] = {'id': jid, 'slug': slug, 'platform': platform, 'step': 0,
                          'done': False, 'error': None, 'artifact': None, 'artifactName': None,
                          'startedAt': time.time()}
    threading.Thread(target=_run_pkg_job, args=(jid, slug, platform), daemon=True).start()
    print(c('  [PKG]', 'b'), f'job {jid} start · {slug} · {platform}')
    return {'success': True, 'id': jid}

def handle_package_job_get(jid: str) -> dict:
    with _PKG_JOBS_LOCK:
        j = _PKG_JOBS.get(jid)
        return {'success': True, 'job': _pkg_job_view(j)} if j else {'success': False, 'error': f'任务不存在: {jid}'}
