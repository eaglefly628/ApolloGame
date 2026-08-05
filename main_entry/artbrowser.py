"""资产浏览器（REQ-ARTPIPE2 A2 · PST 域 · workshop 原生「🗂 资产浏览器」入口的数据端点）。

薄封装——**不造第二真相**：只读拼视图，三源现读现拼：
  · 各游戏 `public/games/<slug>/art/art-ledger.json`（美术台账·真相=引擎消费的那份 JSON）
  · 各游戏 `docs/design/<slug>/design-ledger.json`（设计稿收稿箱台账·draft/final）
  · 共享库 `assets/index.json`（项目资产索引）
黑户/死账/缺来源徽标数据外调既有 `scripts/art-ledger-guard.mjs --json`（REQ-ARTPIPE2 A1 · Lead 施工）——
本模块绝不重新实现黑户/死账判定，只 shell 出该脚本读它的既有机器可读输出（同 `_art_replace_cli` 先例）。

三档 `scope`：
  · 'index'（缺省/空）→ 目录树顶层：游戏清单（各游戏计数徽标）+ 共享库汇总。
  · 'shared'          → 共享库分组（assets/index.json 按 category 分组·大类目截断+计数，非全量倒库）。
  · '<slug>'          → 该游戏分组（按 art-ledger kind 分组 + 设计稿组 + 黑户合成组）+ 可选槽位清单
                          （给拖入登记 UI 的槽位选择用·no 与该游戏 art-ledger 行一一对应）。

预览图不走 base64——统一给 servedPath 风格的站点 URL（`/games/**` · `/assets/**`），由 zerocraft.py 既有
静态路由直出（同 ArtLedgerPanel/AssetLibrary 先例），本模块不碰文件字节。
"""
import json
import subprocess

from .games_list import _builtin_games_meta
from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, _spawn

# ── 分组标签（人读·纯展示层常量，不是第二真相——键取自台账/索引里真实出现的字段值）───────
GAME_KIND_LABEL = {
    'texture': '🖼 纹理/贴图', 'sprite': '🎞 精灵/角色', 'bg': '🏞 背景', 'model3d': '🧊 3D 模型',
    'design-doc': '📄 设计稿（收稿箱）', 'black-household': '⚠ 黑户（磁盘有文件·台账无行）',
}
GAME_KIND_ORDER = ['texture', 'sprite', 'bg', 'model3d', 'design-doc', 'black-household']

SHARED_CAT_LABEL = {
    'icon.ui': '🔘 UI 图标', 'emoji': '😀 Emoji', 'illustration': '🖼 插画', 'sheet': '🧩 图集',
    'mahjong': '🀄 麻将牌', 'playing-card': '🃏 扑克牌', 'cards': '🎴 卡牌', 'styleset.ui': '🎨 UI 风格集',
    'texture': '🖼 贴图', 'material': '🧱 材质', 'styleset.3d': '🧊 3D 风格集', 'styleset.fx': '✨ 特效风格集',
    'chip': '🔵 筹码', 'background': '🏞 背景', 'bgm': '🔊 音乐', 'portrait': '🧑 立绘', 'skybox': '🌌 天空盒',
    'mesh': '🧊 网格',
}
SHARED_GROUP_CAP = 200  # 单分组返回上限（30822 张贴图不能整份塞一次响应·超出部分给 total 供前端提示"用素材库屏搜索"）


def _run_guard(args: list) -> dict:
    """shell `scripts/art-ledger-guard.mjs <args> --json`（同 `_art_replace_cli` 先例）。
    该脚本 --json 模式**只输出纯 JSON**（自己的头注释保证·无追加判词行），任何异常/超时/解析失败一律
    退化为 {}（徽标只是锦上添花——guard 拉不到不该挡浏览）。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/art-ledger-guard.mjs', *args]),
                               cwd=ROOT, capture_output=True, timeout=30)
    except Exception:
        return {}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if not out:
        return {}
    try:
        return json.loads(out)
    except Exception:
        return {}


def _discover_game_slugs() -> list:
    """guard 不可用时的兜底发现（与 guard 自己的 discoverGames 同口径：有 art/ 目录即算）。"""
    base = ROOT / 'public' / 'games'
    if not base.is_dir():
        return []
    return sorted(d.name for d in base.iterdir() if d.is_dir() and (d / 'art').is_dir())


def _read_json(path) -> dict:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text('utf-8'))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _read_game_ledger(slug: str) -> dict:
    return _read_json(ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json')


def _ledger_rows(ledger: dict) -> list:
    """rows + pending 合一·退役行（status=retired，槽位已消失的墓碑编号）不进浏览器视图。"""
    rows = ledger.get('rows')
    pending = ledger.get('pending')
    out = list(rows) if isinstance(rows, list) else []
    if isinstance(pending, list):
        out += pending
    return [r for r in out if isinstance(r, dict) and r.get('status') != 'retired']


def _read_design_ledger(slug: str) -> list:
    data = _read_json(ROOT / 'docs' / 'design' / slug / 'design-ledger.json')
    entries = data.get('entries')
    return entries if isinstance(entries, list) else []


def _shared_index() -> list:
    data = _read_json(ROOT / 'assets' / 'index.json')
    assets = data.get('assets')
    return assets if isinstance(assets, list) else []


def _game_title(slug: str) -> str:
    """卡带取 library/<slug>/meta.json 的 name；内置游戏取 launcher.tsx 解析出的 title；都没有则原样返回 slug。"""
    meta = _read_json(LIBRARY_DIR / slug / 'meta.json')
    if meta.get('name'):
        return str(meta['name'])
    bm = _builtin_games_meta().get(slug) or {}
    return str(bm.get('title') or slug)


def _ext_kind(served_path: str) -> str:
    ext = served_path.rsplit('.', 1)[-1].lower() if '.' in served_path else ''
    return 'model3d' if ext == 'glb' else 'texture'


def _row_thumb(row: dict):
    gen = row.get('gen') if isinstance(row.get('gen'), dict) else {}
    sp = gen.get('servedPath')
    return sp if isinstance(sp, str) and sp else None


# ── scope='index'（顶层：游戏清单 + 共享库汇总）───────────────────────────────────────

def _index_tree() -> dict:
    guard = _run_guard(['--json'])
    guard_games = {g.get('game'): g for g in (guard.get('games') or []) if isinstance(g, dict)}
    slugs = sorted(guard_games.keys()) if guard_games else _discover_game_slugs()
    out_games = []
    for slug in slugs:
        g = guard_games.get(slug) or {}
        rows = _ledger_rows(_read_game_ledger(slug))
        design = _read_design_ledger(slug)
        final_n = sum(1 for r in rows if r.get('status') == 'approved') + sum(1 for e in design if e.get('status') == 'final')
        draft_n = (len(rows) - sum(1 for r in rows if r.get('status') == 'approved')) + \
            (len(design) - sum(1 for e in design if e.get('status') == 'final'))
        out_games.append({
            'slug': slug, 'title': _game_title(slug),
            'counts': {
                'total': len(rows) + len(design), 'final': final_n, 'draft': draft_n,
                'blackHousehold': len(g.get('blackHouseholds') or []),
                'deadAccount': len(g.get('deadAccounts') or []),
                'missingProvenance': len(g.get('missingProvenance') or []),
            },
        })
    assets = _shared_index()
    by_cat = {}
    for a in assets:
        if isinstance(a, dict):
            by_cat[str(a.get('category') or a.get('type') or 'other')] = by_cat.get(str(a.get('category') or a.get('type') or 'other'), 0) + 1
    return {
        'success': True, 'scope': 'index', 'games': out_games,
        'shared': {'count': len(assets), 'byCategory': by_cat},
        'guardVerdict': guard.get('verdict'),
    }


# ── scope='<slug>'（该游戏的分组 + 槽位清单）──────────────────────────────────────────

def _game_tree(slug: str) -> dict:
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    guard = _run_guard([slug, '--json'])
    g0 = next((g for g in (guard.get('games') or []) if isinstance(g, dict) and g.get('game') == slug), {})
    dead_nos = {d.get('no') for d in (g0.get('deadAccounts') or []) if isinstance(d, dict)}
    black_paths = g0.get('blackHouseholds') or []

    rows = _ledger_rows(_read_game_ledger(slug))
    groups_map: dict = {}
    slots = []
    for row in rows:
        no = row.get('no')
        kind = row.get('kind') or 'other'
        label = row.get('desc') or row.get('query') or ((row.get('slot') or {}).get('entity')) or no or '(无编号)'
        badge = 'dead' if no in dead_nos else ('final' if row.get('status') == 'approved' else 'draft')
        item = {
            'id': f'{slug}:{no}', 'source': 'art-ledger', 'slug': slug, 'no': no, 'kind': kind,
            'label': label, 'status': row.get('status'), 'badge': badge,
            'thumbUrl': _row_thumb(row), 'servedPath': (row.get('gen') or {}).get('servedPath'),
            'query': row.get('query'), 'desc': row.get('desc'),
            'provenance': row.get('provenance') if isinstance(row.get('provenance'), dict) else None,
        }
        groups_map.setdefault(kind, []).append(item)
        if no:
            slots.append({'no': no, 'label': label, 'status': row.get('status')})

    design_entries = _read_design_ledger(slug)
    if design_entries:
        d_items = []
        for e in design_entries:
            if not isinstance(e, dict):
                continue
            fname = e.get('filename')
            d_items.append({
                'id': f'{slug}:design:{fname}', 'source': 'design-ledger', 'slug': slug,
                'kind': 'design-doc', 'label': fname, 'status': e.get('status'),
                'badge': 'final' if e.get('status') == 'final' else 'draft', 'thumbUrl': None,
                'sha256': e.get('sha256'), 'receivedAt': e.get('receivedAt'),
                'note': e.get('note'), 'by': e.get('by'),
                'previewHref': f'/api/design/preview?slug={slug}&file={fname}' if fname else None,
            })
        if d_items:
            groups_map['design-doc'] = d_items

    if black_paths:
        bh_items = []
        for sp in black_paths:
            if not isinstance(sp, str):
                continue
            bh_items.append({
                'id': f'{slug}:bh:{sp}', 'source': 'black-household', 'slug': slug,
                'kind': _ext_kind(sp), 'label': sp.rsplit('/', 1)[-1], 'status': 'unregistered',
                'badge': 'blackhouse', 'thumbUrl': sp, 'servedPath': sp,
            })
        groups_map['black-household'] = bh_items

    groups = [{'key': k, 'label': GAME_KIND_LABEL.get(k, f'📦 {k}'), 'items': v} for k, v in groups_map.items()]
    groups.sort(key=lambda g: GAME_KIND_ORDER.index(g['key']) if g['key'] in GAME_KIND_ORDER else 99)

    return {
        'success': True, 'scope': slug, 'slug': slug, 'title': _game_title(slug),
        'groups': groups, 'slots': slots,
        'guard': {
            'blackHouseholds': len(black_paths), 'deadAccounts': len(g0.get('deadAccounts') or []),
            'missingProvenance': len(g0.get('missingProvenance') or []),
        },
    }


# ── scope='shared'（assets/index.json 按 category 分组）─────────────────────────────

def _shared_tree() -> dict:
    assets = _shared_index()
    groups_map: dict = {}
    for a in assets:
        if not isinstance(a, dict):
            continue
        cat = str(a.get('category') or a.get('type') or 'other')
        groups_map.setdefault(cat, []).append(a)
    groups = []
    for cat, arr in groups_map.items():
        total = len(arr)
        capped = arr[:SHARED_GROUP_CAP]
        items = []
        for a in capped:
            path = a.get('path')
            status = a.get('status')
            items.append({
                'id': a.get('id'), 'source': 'shared', 'kind': str(a.get('type') or cat),
                'label': a.get('id'), 'status': status, 'badge': 'final' if status == 'filled' else 'draft',
                'thumbUrl': (f'/assets/{path}' if isinstance(path, str) and path else None),
                'desc': a.get('description'), 'license': a.get('license'), 'category': cat,
            })
        groups.append({
            'key': cat, 'label': SHARED_CAT_LABEL.get(cat, f'📦 {cat}'), 'items': items,
            'total': total, 'truncated': total > len(items),
        })
    groups.sort(key=lambda g: -g['total'])
    return {'success': True, 'scope': 'shared', 'groups': groups}


def handle_artbrowser_tree(scope) -> dict:
    """GET /api/artbrowser/tree?scope=index|shared|<slug>（缺省=index）。"""
    s = str(scope or '').strip()
    if s in ('', 'index', 'all'):
        return _index_tree()
    if s == 'shared':
        return _shared_tree()
    return _game_tree(s)
