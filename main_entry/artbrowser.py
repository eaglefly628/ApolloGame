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
import base64
import json
import re
import subprocess

from .games_list import _builtin_games_meta
from .paths import LIBRARY_DIR, _valid_slug, _write_json
from .sysutil import ROOT, _spawn
from .t2_replace import _ART_NO_RE, handle_art_upload

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


# ── A3 · 历史与回滚（REQ-ARTPIPE2 A3·PST 域）─────────────────────────────────────────
# 零新存储——git 就是备份（总纲红线）。历史列表=`git log --follow`；任意版本预览=`git show rev:path`
# 字节流；回退=取历史字节走既有 `POST /api/art/upload` 语义落盘+台账行更新（保号），绝不 `git checkout`
# （那样不留台账痕迹——写台账更新才是唯一被认可的落盘门）。

_REV_RE = re.compile(r'^[0-9a-f]{7,40}$')
_HISTORY_EXT_CT = {
    'png': 'image/png', 'webp': 'image/webp', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml', 'glb': 'model/gltf-binary', 'json': 'application/json; charset=utf-8',
}


def _served_path_to_repo_rel(path):
    """servedPath（`/games/<slug>/...` 或 `/assets/...`·台账/索引里现成的站点 URL）→ 仓库相对路径
    （供 `git log`/`git show` 用）。路径穿越防护沿 `design_ingest.design_preview_path` 先例：归一化后
    仍须落在对应静态根内（同 `_serve_public_games`/`_serve_assets` 的纵深断言）。失败返回 (None, 错误信息)。"""
    p = str(path or '').strip()
    if not p:
        return None, '缺 path'
    if p.startswith('/games/'):
        base = (ROOT / 'public' / 'games').resolve()
        rel = p[len('/games/'):]
    elif p.startswith('/assets/'):
        base = (ROOT / 'assets').resolve()
        rel = p[len('/assets/'):]
    else:
        return None, 'path 必须以 /games/ 或 /assets/ 开头（servedPath 原样传·同网格缩略图 URL）'
    if not rel or rel.endswith('/'):
        return None, 'path 缺文件名'
    root_resolved = ROOT.resolve()
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
        target.relative_to(root_resolved)
    except ValueError:
        return None, '路径越界'
    return target.relative_to(root_resolved).as_posix(), None


def _git_log_follow(repo_rel: str, limit: int = 60) -> list:
    """`git log --follow` 该文件的提交列表（新→旧·hash/date/message 首行）。用 ASCII unit separator
    （\\x1f）分栏——message 本身可能含空格/冒号，不能拿它们当分隔符。文件从未入库/已被 git rm → 空列表
    （非错误——「零历史」是合法态，不是失败）。"""
    try:
        r = subprocess.run(
            ['git', 'log', '--follow', f'-{max(1, min(200, limit))}', '--format=%H\x1f%h\x1f%ad\x1f%s',
             '--date=short', '--', repo_rel],
            cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=15)
    except Exception:
        return []
    out = (r.stdout or '').strip()
    if not out:
        return []
    commits = []
    for line in out.split('\n'):
        parts = line.split('\x1f')
        if len(parts) != 4:
            continue
        h, short, d, msg = parts
        commits.append({'hash': h, 'shortHash': short, 'date': d, 'message': msg})
    return commits


def handle_artbrowser_history(path) -> dict:
    """GET /api/artbrowser/history?path=<servedPath>。该文件的 git 提交列表（详情栏「历史」tab）。"""
    repo_rel, err = _served_path_to_repo_rel(path)
    if err:
        return {'success': False, 'error': err}
    commits = _git_log_follow(repo_rel)
    return {'success': True, 'path': path, 'repoRelPath': repo_rel, 'commits': commits}


def resolve_history_blob(path, rev):
    """`GET /api/artbrowser/history-blob?path=&rev=` 用：校验 + `git show rev:path` 出字节（供 server.py
    的二进制专用路由直出，不落临时文件）。rev 白名单 `^[0-9a-f]{7,40}$`（防命令注入）。
    返回 (ok, bytes|错误信息, content_type)。"""
    rev = str(rev or '').strip()
    if not _REV_RE.fullmatch(rev):
        return False, f'非法版本号: {rev or "(空)"}', None
    repo_rel, err = _served_path_to_repo_rel(path)
    if err:
        return False, err, None
    try:
        r = subprocess.run(['git', 'show', f'{rev}:{repo_rel}'], cwd=ROOT, capture_output=True, timeout=15)
    except Exception as e:
        return False, f'git show 失败: {e}', None
    if r.returncode != 0 or not r.stdout:
        return False, '该版本取不到此文件（可能是改名前/后的另一路径，或版本号有误）', None
    ext = repo_rel.rsplit('.', 1)[-1].lower() if '.' in repo_rel else ''
    ctype = _HISTORY_EXT_CT.get(ext, 'application/octet-stream')
    return True, r.stdout, ctype


def handle_artbrowser_restore(body: dict) -> dict:
    """POST /api/artbrowser/restore {slug, no, path, rev}（详情栏「历史」tab「回退到此版」）。
    取该 rev 的历史字节 → 走既有 `POST /api/art/upload` 语义落盘+台账行更新（保号）——不直接
    `git checkout`（总纲红线：浏览器一切「回退」经写台账留痕的正路，绝非静默改工作树）。
    provenance 记 `restore-from:<rev>`（人读可溯源·落在已成功的 upload 结果之上，不改 upload 本身语义）。"""
    slug = str(body.get('slug', '')).strip()
    no = str(body.get('no', '')).strip()
    path = str(body.get('path', '')).strip()
    rev = str(body.get('rev', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    ok, data, _ct = resolve_history_blob(path, rev)
    if not ok:
        return {'success': False, 'error': data}
    ext = path.rsplit('.', 1)[-1].lower() if '.' in path else ''
    if ext not in ('png', 'webp', 'jpg', 'jpeg', 'glb'):
        return {'success': False, 'error': f'非法扩展名: {ext or "(空)"}（png/webp/jpg/glb）'}
    res = handle_art_upload({'slug': slug, 'no': no, 'dataBase64': base64.b64encode(data).decode('ascii'), 'ext': ext})
    if not res.get('success'):
        return res
    # 落盘已成功——追加可溯源标记（锦上添花·失败不回滚已落地的替换结果）。
    try:
        led_f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
        ledger = json.loads(led_f.read_text('utf-8')) if led_f.is_file() else None
        if ledger:
            row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
            if isinstance(row, dict):
                prov = row.get('provenance')
                if isinstance(prov, dict):
                    prov['restoreFrom'] = f'restore-from:{rev}'
                hist = row.get('history')
                if isinstance(hist, list) and hist:
                    hist[-1]['restoreFromRev'] = rev
                _write_json(led_f, ledger)
                res['row'] = row
    except Exception:
        pass
    return res


# ── A4 · 替换工作流·消费方反查（REQ-ARTPIPE2 A4·PST 域）─────────────────────────────
# 替换四钮（重新生成/换库/换皮/上传替换）在壳前端直接薄封装既有 /api/art/{regenerate,swap,reskin,upload}
# 端点（零逻辑重写·同 ArtLedgerPanel 语义）；本模块只加「消费方视图」这一项新读接口。

def _walk_json_str_paths(obj, target: str, path: str = '', out=None, cap: int = 200) -> list:
    """递归找 obj 里等于 target 的字符串值·记它的人读 JSON 路径（如 entities.player.Sprite.textureKey）。
    只读遍历·不第二真相——manifest 本身就是真相，这里只是给「谁在用它」拼一份可读清单。cap 防病理输入。"""
    if out is None:
        out = []
    if len(out) >= cap:
        return out
    if isinstance(obj, dict):
        for k, v in obj.items():
            _walk_json_str_paths(v, target, f'{path}.{k}' if path else str(k), out, cap)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _walk_json_str_paths(v, target, f'{path}[{i}]', out, cap)
    elif isinstance(obj, str) and obj == target:
        out.append(path or '(根)')
    return out


def handle_artbrowser_consumers(slug, no) -> dict:
    """GET /api/artbrowser/consumers?slug=&no=（详情栏「替换/消费方」tab）。反查该台账行的引用键
    （skinKey 优先·否则退回 gen.localId）落在哪——① 该游戏 manifest.json 全量 grep（library 卡带/内置
    数据游戏两处都试）② 该游戏本地 art/index.json 里的别名条目（同一文件被起了别的 id）。只读拼视图·
    只读 grep 现成文件，不建第二真相。编译期「代码游戏」（美术写死在 TS 源码·无 manifest.json 可 grep）
    → manifest 侧空手，退回台账行自带的 slot/ref 字段（那就是唯一能拿到的「谁在用」信息，如实说明）。"""
    slug = str(slug or '').strip()
    no = str(no or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    rows = _ledger_rows(_read_game_ledger(slug))
    row = next((r for r in rows if r.get('no') == no), None)
    if row is None:
        return {'success': False, 'error': f'台账无此编号: {no}'}
    key = row.get('skinKey') or ((row.get('gen') or {}).get('localId')) or ((row.get('gen') or {}).get('servedPath'))
    if not key:
        return {'success': True, 'slug': slug, 'no': no, 'key': None, 'consumers': [], 'manifestChecked': False,
                'note': '该行无可反查的引用键（skinKey / gen.localId / gen.servedPath 均缺——多半是还没写回的占位行）'}
    manifest_checked = False
    consumers = []
    for mp, label in ((LIBRARY_DIR / slug / 'manifest.json', f'library/{slug}/manifest.json'),
                       (ROOT / 'public' / 'games' / slug / 'manifest.json', f'public/games/{slug}/manifest.json')):
        if not mp.is_file():
            continue
        manifest_checked = True
        mf = _read_json(mp)
        for p in _walk_json_str_paths(mf, key):
            consumers.append({'file': label, 'path': p, 'kind': 'manifest'})
    # 本地 index.json 别名（同一底层文件被另起了 id·换掉这行连带影响那个别名）。
    idx = _read_json(ROOT / 'public' / 'games' / slug / 'art' / 'index.json')
    served = (row.get('gen') or {}).get('servedPath')
    if served and isinstance(idx.get('assets'), list):
        for a in idx['assets']:
            if isinstance(a, dict) and a.get('id') != key and a.get('path') == served:
                consumers.append({'file': f'public/games/{slug}/art/index.json', 'path': f"id={a.get('id')}", 'kind': 'alias'})
    fallback_note = None
    if not manifest_checked:
        slot = row.get('slot') if isinstance(row.get('slot'), dict) else None
        ref = row.get('ref') if isinstance(row.get('ref'), dict) else None
        if slot and slot.get('entity'):
            consumers.append({'file': '（编译期代码游戏·无 manifest.json 可 grep）', 'kind': 'declared-slot',
                               'path': f"entities.{slot.get('entity')}.{slot.get('component', '')}.{slot.get('field', '')}".rstrip('.')})
        elif ref and (ref.get('component') or ref.get('mechanism')):
            consumers.append({'file': '（编译期代码游戏·无 manifest.json 可 grep）', 'kind': 'declared-ref',
                               'path': f"{ref.get('mechanism', '')}:{ref.get('component', '')}.{ref.get('field', '')}".strip(':').rstrip('.')})
        else:
            fallback_note = '这是编译期代码游戏（美术写死在 games/ 源码里）——无 manifest.json 可反查，台账行也没留 slot/ref，只能人工搜源码。'
    return {'success': True, 'slug': slug, 'no': no, 'key': key, 'manifestChecked': manifest_checked,
            'consumers': consumers, 'count': len(consumers), **({'note': fallback_note} if fallback_note else {})}
