"""内置游戏元信息/封面 + 游戏列表 + 能力目录端点。"""
import subprocess
import json
import re

from .config import _gen_env
from .paths import GAME_RE, _valid_slug
from .sysutil import ROOT, _spawn, c

_BUILTIN_META_CACHE = None

def _builtin_games_meta() -> dict:
    """从 src/launcher.tsx 的 `GAMES: GameEntry[]` 解析内置游戏元信息（icon/title/subtitle/description…）
    —— 单一真相在 launcher（只读解析·不改它）。壳的「引擎内置」卡片据此显示图标+简介，
    而非只剩一个编号（owner 07-12「内置游戏的图标/介绍没了」）。解析失败则回落空 dict（退化=只显 id）。"""
    global _BUILTIN_META_CACHE
    if _BUILTIN_META_CACHE is not None:
        return _BUILTIN_META_CACHE
    meta: dict = {}
    try:
        src = (ROOT / 'src' / 'launcher.tsx').read_text('utf-8')
        m = re.search(r'const\s+GAMES\s*:\s*GameEntry\[\]\s*=\s*\[(.*?)\n\]', src, re.S)
        body = m.group(1) if m else ''
        # 单引号字符串（容忍转义 \'）——逐对象按 id 切
        def _field(obj: str, key: str) -> str:
            fm = re.search(key + r"\s*:\s*'((?:[^'\\]|\\.)*)'", obj)
            return fm.group(1).replace("\\'", "'") if fm else ''
        # 以 `id: '...'` 为锚把 body 切成若干对象块
        ids = list(re.finditer(r"id\s*:\s*'([a-z0-9-]+)'", body))
        for i, mm in enumerate(ids):
            gid = mm.group(1)
            start = mm.start()
            end = ids[i + 1].start() if i + 1 < len(ids) else len(body)
            obj = body[start:end]
            meta[gid] = {'title': _field(obj, 'title'), 'subtitle': _field(obj, 'subtitle'),
                         'description': _field(obj, 'description'), 'icon': _field(obj, 'icon'),
                         'color': _field(obj, 'color'), 'accentColor': _field(obj, 'accentColor'),
                         'status': _field(obj, 'status')}
    except Exception as e:
        print(c('  [GAMES]', 'y'), f'内置游戏元信息解析失败（退化为只显 id）: {e}')
    _BUILTIN_META_CACHE = meta
    return meta

def _game_cover_url(slug: str):
    """游戏封面/图标（AI 文生图产物·public/games/<slug>/cover.png）的站点 URL——带 mtime 破缓存
    （重生成后卡片即刷新）。无则 None（卡片回落 emoji 图标/默认矢量）。owner 07-12。"""
    p = ROOT / 'public' / 'games' / slug / 'cover.png'
    if p.is_file():
        try:
            return f'/games/{slug}/cover.png?t={int(p.stat().st_mtime)}'
        except Exception:
            return f'/games/{slug}/cover.png'
    return None

def handle_game_cover_generate(slug: str, body: dict) -> dict:
    """POST /api/games/<slug>/cover {prompt, mock?}。文生图（qwen 2D·无 key/显式 mock 走占位）生成
    游戏封面/图标 → public/games/<slug>/cover.png（表现资产·不进美术台账）→ 我的游戏库卡片外观即用
    （替换默认 emoji/矢量图标·owner 07-12）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug}'}
    prompt = str(body.get('prompt') or '').strip()
    if not prompt:
        return {'success': False, 'error': '封面提示词不能为空'}
    if len(prompt) > 500:
        return {'success': False, 'error': 'prompt 过长（≤500 字）'}
    cmd = ['node', 'scripts/ai-gen.mjs', 'cover', slug, prompt, '--json'] + (['--mock'] if body.get('mock') else [])
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=180, env=_gen_env())
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '封面生成超时（>180s）'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'封面生成失败: {err[:400]}'}
    line = out.splitlines()[-1] if out else ''
    try:
        res = json.loads(line)
    except Exception:
        return {'success': False, 'error': f'解析结果失败: {out[:200]}'}
    print(c("  [COVER]", 'g'), f"{slug} → cover.png{' ·mock' if res.get('mock') else ''}")
    return {'success': True, 'coverUrl': _game_cover_url(slug), 'mock': res.get('mock')}

def handle_games_list() -> dict:
    """GET /api/games。枚举 src/games/game-* 为权威游戏列表（标注是否已建本地美术目录 +
    内置游戏元信息 icon/title/description·从 launcher.tsx 解析 + 封面 coverUrl 若已生成）。"""
    games = []
    gdir = ROOT / 'src' / 'games'
    bmeta = _builtin_games_meta()
    if gdir.is_dir():
        for d in sorted(gdir.iterdir()):
            if d.is_dir() and GAME_RE.fullmatch(d.name):
                has_art = (ROOT / 'public' / 'games' / d.name / 'art' / 'index.json').exists()
                entry = {'id': d.name, 'hasLocalArt': has_art}
                minfo = bmeta.get(d.name)
                if minfo:
                    entry.update({k: v for k, v in minfo.items() if v})  # 只并非空字段
                cover = _game_cover_url(d.name)
                if cover:
                    entry['coverUrl'] = cover
                games.append(entry)
    return {'games': games}

_CATALOG_CACHE = None

def handle_catalog() -> dict:
    """GET /api/catalog。引擎全量能力目录（buildCapabilityCatalog 服务端 parity·进程内缓存）——
    Workshop 壳无 vite 侧 import，生成/程序对话的词汇表从这取（REQ-WORKSHOP A）。"""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is None:
        try:
            proc = subprocess.run(**_spawn(['npx', 'vite-node', 'scripts/dump-capability-catalog.mjs']),
                                  cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=120)
            _CATALOG_CACHE = proc.stdout if proc.returncode == 0 and (proc.stdout or '').strip() else ''
        except Exception:
            _CATALOG_CACHE = ''
    return {'success': bool(_CATALOG_CACHE), 'catalog': _CATALOG_CACHE or None}
