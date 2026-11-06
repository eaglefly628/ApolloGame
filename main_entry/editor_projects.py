"""AI 原生编辑器 · 项目端点（docs/design/ai-native-editor-2026-11-01.md）。

owner 2026-11-01 定：项目结构走 B（编辑器侧索引 `project.json`·引擎与 manifest 格式不动）；
手工权限走乙（人可在属性面板调**标量数值**，改动与 AI 改动进同一条记录）；新游戏一律 `new<n>` 编号，
老游戏只保兼容不迁移。

新项目就是一张普通库卡带（library/new<n>/），入口场景就是 `manifest.json`——所以既有的运行器、
AI 对话（/api/agent/chat）、版本历史、美术台账全部照常可用；`project.json` 只是在它上面加一层资产索引。

  GET  /api/editor/projects                        → new<n> 项目列表
  POST /api/editor/projects            {name}      → 建下一个 new<n>（骨架：场景×2 + UI 屏 + 数据表 + 设计文档）
  GET  /api/editor/projects/<slug>                 → project.json 原文
  GET  /api/editor/projects/<slug>/file?path=…     → 读一个**已登记**资产文件
  POST /api/editor/projects/<slug>/edit {path, pointer, value} → 乙档手调：只改已有标量、类型不变
  POST /api/editor/projects/<slug>/note {path, summary} → AI 改动落同一条记录（编辑器应用 AI 结果后调）
  GET  /api/editor/projects/<slug>/changes         → 改动记录（人 + AI 同一条流·最新在后）

安全：读写只认 project.json 里登记过的路径（且过同一套相对路径规则）；结构性改动一律拒收——那是 AI 的活。
"""
import json
import re
from pathlib import Path

from .blueprints import PRESET_BLUEPRINTS
from .library import _preset_manifest, _scaffold, _version_save_all
from .paths import LIBRARY_DIR, _game_dir, _now_iso, _write_json

NEW_RE = re.compile(r'^new([1-9][0-9]*)$')
_SEG_RE = re.compile(r'^[A-Za-z0-9_\-一-鿿]+(\.(json|md))?$')
CHANGES_FILE = 'changes.jsonl'
UI_LOCKED_KEYS = ('type', 'id')  # UI 节点结构键：改了等于换控件 / 断引用
MAX_FILE_BYTES = 2 * 1024 * 1024


def _log(level: str, msg: str) -> None:
    print(f'[editor] {level}: {msg}', flush=True)


def _safe_rel(p) -> bool:
    """与前端 isSafeRelPath 同规：正斜杠分段、无回溯/绝对/隐藏段、扩展名 .json/.md。"""
    if not isinstance(p, str) or not p or len(p) > 200 or p.startswith('/') or '\\' in p:
        return False
    segs = p.split('/')
    if any(not s or s in ('.', '..') or s.startswith('.') for s in segs):
        return False
    return p.endswith('.json') or p.endswith('.md')


def _project_dir(slug: str) -> Path:
    if not isinstance(slug, str) or not NEW_RE.match(slug):
        raise ValueError(f'不是新游戏编号 new<n>: {slug!r}')
    return _game_dir(slug)


def _read_project(slug: str) -> dict:
    d = _project_dir(slug)
    f = d / 'project.json'
    if not f.is_file():
        raise FileNotFoundError(f'{slug} 没有 project.json')
    data = json.loads(f.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or not isinstance(data.get('assets'), list):
        raise ValueError('project.json 缺 assets 数组')
    return data


def _registered_path(slug: str, rel: str) -> Path:
    """只放行 project.json 里登记过的、过安全规则的文件。"""
    if not _safe_rel(rel):
        raise ValueError(f'非法路径: {rel!r}')
    listed = {a.get('path') for a in _read_project(slug)['assets'] if isinstance(a, dict)}
    if rel not in listed:
        raise ValueError(f'未在 project.json 登记: {rel}')
    d = _project_dir(slug)
    target = (d / rel).resolve()
    if d not in target.parents:
        raise ValueError(f'路径越界: {rel}')
    return target


def _next_slug() -> str:
    used = [int(m.group(1)) for d in (LIBRARY_DIR.iterdir() if LIBRARY_DIR.exists() else []) if (m := NEW_RE.match(d.name))]
    return f'new{max(used, default=0) + 1}'


def handle_projects_list() -> tuple:
    out = []
    if LIBRARY_DIR.exists():
        for d in LIBRARY_DIR.iterdir():
            m = NEW_RE.match(d.name)
            if not m or not (d / 'project.json').is_file():
                continue
            try:
                p = json.loads((d / 'project.json').read_text(encoding='utf-8'))
                name, count = str(p.get('name') or d.name), len(p.get('assets') or [])
            except Exception as e:
                _log('reject', f'{d.name}/project.json 读不了：{e}')
                name, count = d.name, 0
            changes = d / CHANGES_FILE
            out.append({'id': d.name, 'n': int(m.group(1)), 'name': name, 'assets': count,
                        'updated': int(max((d / 'project.json').stat().st_mtime, changes.stat().st_mtime if changes.exists() else 0))})
    out.sort(key=lambda x: x['n'])
    for x in out:
        x.pop('n')
    return (200, {'success': True, 'projects': out})


def _skeleton(slug: str, name: str) -> dict:
    """新项目骨架：每样资产各一份可跑/可看的最小数据，让人一打开就看见「项目长什么样」。"""
    level2 = _preset_manifest(PRESET_BLUEPRINTS['pong'])
    hud = {'type': 'Panel', 'id': 'hud', 'props': {'title': name}, 'children': [
        {'type': 'Label', 'id': 'score', 'props': {'text': '分数 0'}},
        {'type': 'Button', 'id': 'pause', 'props': {'label': '暂停', 'action': 'pause'}},
    ]}
    tuning = {'player': {'speed': 3, 'jump': 9, 'lives': 3}, 'difficulty': {'enemySpeed': 1.5, 'spawnEvery': 120}}
    overview = (f'# {name}\n\n'
                '> 本文档是设计底案：AI 读它理解这个游戏；人在编辑器里预览、指认、调数值。\n\n'
                '## 一句话玩法\n\n（待和 AI 一起写）\n')
    project = {'schema': 1, 'id': slug, 'name': name, 'entry': 'scenes/main', 'assets': [
        {'id': 'scenes/main', 'type': 'scene', 'name': '主关卡', 'path': 'manifest.json'},
        {'id': 'scenes/level-2', 'type': 'scene', 'name': '第二关', 'path': 'scenes/level-2.json'},
        {'id': 'ui/hud', 'type': 'ui', 'name': '战斗 HUD', 'path': 'ui/hud.json'},
        {'id': 'data/tuning', 'type': 'table', 'name': '数值表', 'path': 'data/tuning.json'},
        {'id': 'docs/overview', 'type': 'doc', 'name': '设计总览', 'path': 'design/overview.md'},
    ]}
    return {'project.json': project, 'scenes/level-2.json': level2, 'ui/hud.json': hud,
            'data/tuning.json': tuning, 'design/overview.md': overview}


def handle_project_create(body: dict) -> tuple:
    name = str((body or {}).get('name') or '').strip()[:60]
    slug = _next_slug()
    name = name or f'新游戏 {slug[3:]}'
    manifest = _preset_manifest(PRESET_BLUEPRINTS['platformer'])
    game_dir, _meta, _v = _scaffold(slug, name, manifest, 'user', {'editorProject': True}, f'新建项目 {slug}')
    for rel, content in _skeleton(slug, name).items():
        f = game_dir / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, str):
            f.write_text(content, encoding='utf-8')
        else:
            f.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    _version_save_all(game_dir, f'项目骨架 {slug}')
    _log('commit', f'新建 {slug}「{name}」')
    return (200, {'success': True, 'id': slug, 'name': name})


def handle_project_get(slug: str) -> tuple:
    try:
        return (200, {'success': True, 'project': _read_project(slug)})
    except FileNotFoundError as e:
        return (404, {'success': False, 'error': str(e)})


def handle_project_file(slug: str, rel: str) -> tuple:
    try:
        target = _registered_path(slug, rel)
    except FileNotFoundError as e:
        return (404, {'success': False, 'error': str(e)})
    if not target.is_file():
        return (404, {'success': False, 'error': f'文件不存在: {rel}'})
    if target.stat().st_size > MAX_FILE_BYTES:
        return (413, {'success': False, 'error': '文件过大'})
    text = target.read_text(encoding='utf-8')
    if rel.endswith('.md'):
        return (200, {'success': True, 'path': rel, 'text': text})
    try:
        return (200, {'success': True, 'path': rel, 'json': json.loads(text)})
    except ValueError as e:
        return (200, {'success': True, 'path': rel, 'text': text, 'parseError': str(e)})


def _kind(v) -> str:
    if isinstance(v, bool):
        return 'boolean'
    if isinstance(v, (int, float)):
        return 'number'
    if isinstance(v, str):
        return 'string'
    return 'json'


def handle_project_edit(slug: str, body: dict) -> tuple:
    """乙档手调：pointer 必须指向**已有标量**，新值同类型；结构/类型变化一律拒（让 AI 改）。"""
    rel, pointer, value = body.get('path'), body.get('pointer'), body.get('value')
    if not isinstance(pointer, list) or not pointer or not all(isinstance(k, (str, int)) and not isinstance(k, bool) for k in pointer):
        return (400, {'success': False, 'error': 'pointer 须为非空 [键/下标] 数组'})
    try:
        target = _registered_path(slug, rel)
    except FileNotFoundError as e:
        return (404, {'success': False, 'error': str(e)})
    if not rel.endswith('.json'):
        return (400, {'success': False, 'error': '只能手调 JSON 资产的数值'})
    asset_type = next((a.get('type') for a in _read_project(slug)['assets'] if isinstance(a, dict) and a.get('path') == rel), None)
    if asset_type == 'ui' and pointer[-1] in UI_LOCKED_KEYS:
        _log('reject', f'{slug}:{rel} UI 结构键 {pointer[-1]}')
        return (400, {'success': False, 'error': f'UI 控件的 {pointer[-1]} 是结构，不能手调——请让 AI 改'})
    data = json.loads(target.read_text(encoding='utf-8'))
    parent = data
    for k in pointer[:-1]:
        if isinstance(parent, dict) and isinstance(k, str) and k in parent:
            parent = parent[k]
        elif isinstance(parent, list) and isinstance(k, int) and 0 <= k < len(parent):
            parent = parent[k]
        else:
            _log('reject', f'{slug}:{rel} 指针不存在 {pointer}')
            return (400, {'success': False, 'error': f'字段不存在: {pointer}'})
    last = pointer[-1]
    exists = (isinstance(parent, dict) and isinstance(last, str) and last in parent) or \
             (isinstance(parent, list) and isinstance(last, int) and 0 <= last < len(parent))
    if not exists:
        _log('reject', f'{slug}:{rel} 指针不存在 {pointer}')
        return (400, {'success': False, 'error': f'字段不存在: {pointer}（新增字段请让 AI 做）'})
    old = parent[last]
    if _kind(old) == 'json' or _kind(old) != _kind(value) or (isinstance(value, float) and value != value):
        _log('reject', f'{slug}:{rel} {pointer} 类型 {_kind(old)}→{_kind(value)}')
        return (400, {'success': False, 'error': f'只能改标量且类型不变（原 {_kind(old)}，新 {_kind(value)}）——结构改动请让 AI 做'})
    if old == value:
        return (200, {'success': True, 'unchanged': True})
    parent[last] = value
    _write_json(target, data)
    change = {'at': _now_iso(), 'by': 'human', 'path': rel, 'pointer': pointer, 'from': old, 'to': value}
    d = _project_dir(slug)
    with open(d / CHANGES_FILE, 'a', encoding='utf-8') as f:
        f.write(json.dumps(change, ensure_ascii=False) + '\n')
    _version_save_all(d, f'手调 {rel} {".".join(str(k) for k in pointer)}: {old} → {value}')
    _log('commit', f'{slug}:{rel} {pointer} {old!r} → {value!r}')
    return (200, {'success': True, 'change': change})


def handle_project_changes(slug: str, limit: int = 100) -> tuple:
    f = _project_dir(slug) / CHANGES_FILE
    if not f.is_file():
        return (200, {'success': True, 'changes': []})
    rows = []
    for line in f.read_text(encoding='utf-8').splitlines()[-limit:]:
        try:
            rows.append(json.loads(line))
        except ValueError:
            continue
    return (200, {'success': True, 'changes': rows})


def handle_project_note(slug: str, body: dict) -> tuple:
    """AI 改动进同一条记录：编辑器把 AI 结果落盘后调它（by=ai·只记摘要，字节级差异在版本历史里）。"""
    rel, summary = body.get('path'), str(body.get('summary') or '').strip()[:500]
    if not summary:
        return (400, {'success': False, 'error': 'summary 必填'})
    try:
        _registered_path(slug, rel)
    except FileNotFoundError as e:
        return (404, {'success': False, 'error': str(e)})
    change = {'at': _now_iso(), 'by': 'ai', 'path': rel, 'summary': summary}
    with open(_project_dir(slug) / CHANGES_FILE, 'a', encoding='utf-8') as f:
        f.write(json.dumps(change, ensure_ascii=False) + '\n')
    _log('commit', f'{slug}:{rel} AI 改动记录')
    return (200, {'success': True, 'change': change})


# ── 链接外部平台素材（三平台整合 I1）：只往 project.json 加一条 ref 资产，不复制素材 ──
# owner 判乙只放开「调数值」；链接素材属于资产管理（相当于 Unity 的导入），不改游戏数据本身，
# 故作为人可直接做的第二件事放开——游戏里怎么**用**这条素材，仍由 AI 改场景。
REF_TYPES = ('image', 'model', 'motion', 'audio')
_PLATFORM_RE = re.compile(r'^[a-z0-9][a-z0-9-]{0,31}$')
_ASSET_SEG_RE = re.compile(r'[^a-z0-9-]+')


def _asset_id_for(type_: str, ref_id: str, taken: set) -> str:
    seg = _ASSET_SEG_RE.sub('-', ref_id.lower()).strip('-')[:48] or 'item'
    base = f'{type_}/{seg}'
    aid, n = base, 2
    while aid in taken:
        aid, n = f'{base}-{n}', n + 1
    return aid


def handle_project_link(slug: str, body: dict) -> tuple:
    type_ = body.get('type')
    ref = body.get('ref') if isinstance(body.get('ref'), dict) else {}
    platform, ref_id = ref.get('platform'), ref.get('id')
    name = str(body.get('name') or '').strip()[:80]
    if type_ not in REF_TYPES:
        return (400, {'success': False, 'error': f'type 须为 {"/".join(REF_TYPES)}'})
    if not isinstance(platform, str) or not _PLATFORM_RE.match(platform) or not isinstance(ref_id, str) or not ref_id or len(ref_id) > 200:
        return (400, {'success': False, 'error': 'ref 须为 {platform, id}'})
    d = _project_dir(slug)
    project = _read_project(slug)
    for a in project['assets']:
        r = a.get('ref') if isinstance(a, dict) else None
        if isinstance(r, dict) and r.get('platform') == platform and r.get('id') == ref_id:
            _log('decision', f'{slug} 已链接过 {platform}:{ref_id}')
            return (200, {'success': True, 'asset': a, 'existing': True})
    taken = {a.get('id') for a in project['assets'] if isinstance(a, dict)}
    asset = {'id': _asset_id_for(type_, ref_id, taken), 'type': type_, **({'name': name} if name else {}),
             'ref': {'platform': platform, 'id': ref_id}}
    project['assets'].append(asset)
    _write_json(d / 'project.json', project)
    change = {'at': _now_iso(), 'by': 'human', 'path': 'project.json', 'summary': f'链接 {platform}:{ref_id} → {asset["id"]}'}
    with open(d / CHANGES_FILE, 'a', encoding='utf-8') as f:
        f.write(json.dumps(change, ensure_ascii=False) + '\n')
    _version_save_all(d, change['summary'])
    _log('commit', f'{slug} {change["summary"]}')
    return (200, {'success': True, 'asset': asset, 'change': change})
