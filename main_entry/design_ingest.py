"""设计稿收发（REQ-DESIGNLINE 过渡轨②③·PST 域 2026-08-04）：收稿箱落盘 + 台账登记 + 定稿人门。

背景：owner 手动在 Claude Design 网页做设计稿（.dc.html），手动搬运进项目——本模块消灭搬运的「收」
半边（起草需求单一键复制的「发」半边纯前端拼装，不占后端）。落点 docs/design/<slug>/（与既有游戏
设计稿同目录·非 library/ 子树——沿用仓库既有 `docs/design/<game>/*.dc.html` 摆放先例)；台账每游戏一份
`design-ledger.json`（filename/sha256/receivedAt/size/status，draft→final 沿 wizardSignoff 先例：
note 必须真人手填、永远空起、不代填）。
"""
import base64
import hashlib
import json
import re
from pathlib import Path

from .paths import _now_iso, _valid_slug, _write_json
from .sysutil import ROOT, c

DESIGN_DOCS_DIR = ROOT / 'docs' / 'design'
_MAX_BYTES = 2 * 1024 * 1024  # 2MB 上限（设计稿应自包含·非夹带大体积媒体的仓库）
_ACCEPT_EXT_RE = re.compile(r'\.(dc\.html|html)$', re.IGNORECASE)  # 上传接受名单（原名判定用）
_STEM_RE_BAD = re.compile(r'[^A-Za-z0-9_-]+')
_EXTERNAL_SCRIPT_RE = re.compile(r'<script\b[^>]*\bsrc\s*=', re.IGNORECASE | re.DOTALL)  # 拒收外链脚本


def _design_dir(slug: str) -> Path:
    """resolve docs/design/<slug> 并断言仍在 docs/design/ 子树内（同 _game_dir 先例）。非法 slug/越界 → ValueError。"""
    if not _valid_slug(slug):
        raise ValueError(f'非法 slug: {slug!r}')
    base = DESIGN_DOCS_DIR.resolve()
    d = (DESIGN_DOCS_DIR / slug).resolve()
    if d != base and base not in d.parents:
        raise ValueError(f'路径越界（必须在 docs/design/ 下）: {slug!r}')
    return d


def _ledger_path(slug: str) -> Path:
    return _design_dir(slug) / 'design-ledger.json'


def _read_ledger(slug: str) -> dict:
    p = _ledger_path(slug)
    if not p.is_file():
        return {'version': 1, 'slug': slug, 'entries': []}
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or not isinstance(data.get('entries'), list):
            return {'version': 1, 'slug': slug, 'entries': []}
        return data
    except Exception:
        return {'version': 1, 'slug': slug, 'entries': []}


def _sanitize_stem(raw: str) -> str:
    """原名/screen 名 → 安全 stem（非 [A-Za-z0-9_-] 折成 '-'·去首尾·封顶 80 字·空则兜底）。"""
    s = _STEM_RE_BAD.sub('-', str(raw or '').strip()).strip('-')
    return s[:80] or 'design'


def _dedup_stem(dir_path: Path, stem: str) -> str:
    """重名自动 -v2/-v3…顺延（绝不覆盖）——返回最终不冲突的 `<stem>.dc.html` 文件名。"""
    cand = f'{stem}.dc.html'
    i = 2
    while (dir_path / cand).exists():
        cand = f'{stem}-v{i}.dc.html'
        i += 1
    return cand


def handle_design_ingest(body: dict) -> dict:
    """POST /api/design/ingest {slug, filename, dataBase64, screenName?}。base64 收稿（JSON body·同
    /api/art/upload 先例）——仅收 .html/.dc.html·≤2MB·拒收含 `<script src=` 外链的稿（设计稿应自包含）
    → 落 docs/design/<slug>/<原名或 screenName>.dc.html（重名 -v2 顺延·绝不覆盖，落盘一律统一为
    .dc.html 扩展名）+ 登记 docs/design/<slug>/design-ledger.json（status: draft）。"""
    slug = str(body.get('slug') or '').strip()
    orig_name = str(body.get('filename') or '').strip()
    screen_name = str(body.get('screenName') or '').strip()
    data_b64 = body.get('dataBase64')
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not orig_name:
        return {'success': False, 'error': '缺 filename'}
    if not _ACCEPT_EXT_RE.search(orig_name):
        return {'success': False, 'error': '只收 .html / .dc.html'}
    if not isinstance(data_b64, str) or not data_b64:
        return {'success': False, 'error': '缺 dataBase64'}
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception as e:
        return {'success': False, 'error': f'base64 解码失败: {e}'}
    if not raw:
        return {'success': False, 'error': '上传内容为空'}
    if len(raw) > _MAX_BYTES:
        return {'success': False, 'error': f'超过 2MB 上限（{len(raw)} 字节）'}
    try:
        text = raw.decode('utf-8')
    except Exception as e:
        return {'success': False, 'error': f'非 UTF-8 文本: {e}'}
    if _EXTERNAL_SCRIPT_RE.search(text):
        return {'success': False, 'error': '拒收：含 <script src= 外链——设计稿应自包含（内联脚本/样式）'}
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return {'success': False, 'error': str(e)}
    d.mkdir(parents=True, exist_ok=True)
    stem_source = screen_name or re.sub(r'\.(dc\.html|html)$', '', orig_name, flags=re.IGNORECASE)
    stem = _sanitize_stem(stem_source)
    final_name = _dedup_stem(d, stem)
    target = d / final_name
    target.write_bytes(raw)
    sha256 = hashlib.sha256(raw).hexdigest()
    ledger = _read_ledger(slug)
    ledger['slug'] = slug
    entry = {'filename': final_name, 'sha256': sha256, 'receivedAt': _now_iso(), 'size': len(raw), 'status': 'draft'}
    ledger['entries'] = list(ledger.get('entries', [])) + [entry]
    _write_json(_ledger_path(slug), ledger)
    print(c("  [DESIGN]", 'g'), f"收稿 {slug}/{final_name}（{len(raw)}B·sha256={sha256[:12]}…）")
    return {'success': True, 'slug': slug, 'filename': final_name, 'sha256': sha256, 'entry': entry}


def handle_design_ledger_get(slug: str) -> dict:
    """GET /api/design/ledger?slug=<slug> → {success, entries:[...]}（该游戏已在档 .dc.html 列表）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    ledger = _read_ledger(slug)
    return {'success': True, 'slug': slug, 'entries': ledger.get('entries', [])}


def handle_design_finalize(body: dict) -> dict:
    """POST /api/design/finalize {slug, filename, note, by?}。人门定稿：draft→final（note 必填·永远
    真人手填·不代填——沿 wizardSignoff 先例）。final=「在档=1:1 复刻基准」铁律的挂载对象。"""
    slug = str(body.get('slug') or '').strip()
    filename = str(body.get('filename') or '').strip()
    note = str(body.get('note') or '').strip()
    by = str(body.get('by') or '').strip() or 'owner'
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not filename:
        return {'success': False, 'error': '缺 filename'}
    if not note:
        return {'success': False, 'error': '定稿必须带 note（review 内容落账·不许空签）'}
    if len(note) > 500 or len(by) > 40:
        return {'success': False, 'error': 'note ≤500 字 · by ≤40 字'}
    ledger = _read_ledger(slug)
    entries = ledger.get('entries', [])
    hit = next((e for e in entries if isinstance(e, dict) and e.get('filename') == filename), None)
    if hit is None:
        return {'success': False, 'error': f'台账无此文件: {filename}'}
    hit['status'] = 'final'
    hit['note'] = note
    hit['by'] = by
    hit['finalizedAt'] = _now_iso()
    ledger['entries'] = entries
    _write_json(_ledger_path(slug), ledger)
    print(c("  [DESIGN]", 'g'), f"定稿 {slug}/{filename}（by={by}）")
    return {'success': True, 'slug': slug, 'filename': filename, 'entry': hit}


def design_preview_path(slug: str, filename: str):
    """校验 + 定位 docs/design/<slug>/<filename> 供只读预览伺服。basename-only（禁 / 与 ..）+ 归一化后
    仍在该游戏设计目录内的纵深断言（同 _serve_public_games 先例）。返回 (ok, Path|错误信息)。"""
    if not _valid_slug(slug):
        return False, f'非法 slug: {slug or "(空)"}'
    filename = str(filename or '')
    if not filename or Path(filename).name != filename or not _ACCEPT_EXT_RE.search(filename):
        return False, f'非法文件名: {filename or "(空)"}'
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return False, str(e)
    target = (d / filename).resolve()
    try:
        target.relative_to(d.resolve())
    except ValueError:
        return False, '路径越界'
    return True, target
