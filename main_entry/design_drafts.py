"""设计草稿（创作中间态持久化）。"""
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path

from .paths import LIBRARY_DIR, _game_dir, _now_iso, _valid_slug, _write_json
from .sysutil import ZEROCRAFT_DIR, dir_or_legacy

# ── 设计草稿（创作中间态持久化：讨论/相变/刷新/换页永不丢）──────────────────
# 病根：DesignStudio 的 messages/phase/files 全在 React useState，无落盘 → 任何相变/刷新=蒸发。
# 存法：未定名草稿 → .zerocraft/design-drafts/<id>.json（gitignore·旧 .apollo/design-drafts/
#   fallback 读，见 sysutil.dir_or_legacy）；卡带定名后随卡带 → library/<slug>/design/draft.json
#   （library/ 已整目录 gitignore）。内容白名单见 _DRAFT_KEYS。
# 路径防护（照 library 端点先例）：id 走严格白名单 [A-Za-z0-9] 起 + [A-Za-z0-9_-]（堵 ../ 与斜杠花招）
#   + 归一化后仍在草稿目录内的纵深断言；named 走 _game_dir 的 slug 校验/越界防护。

DRAFTS_DIR = ZEROCRAFT_DIR / 'design-drafts'  # 写永远落这（新数据不再进旧 .apollo/）
_DRAFT_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')
_DRAFT_KEYS = ('id', 'slug', 'name', 'provider', 'phase', 'ready', 'messages', 'files', 'manifest', 'updatedAt')

def _valid_draft_id(did) -> bool:
    return isinstance(did, str) and _DRAFT_ID_RE.match(did) is not None

def _drafts_dir_read() -> Path:
    """读：`.zerocraft/design-drafts/` 优先，旧 `.apollo/design-drafts/` fallback（未迁移时）。"""
    return dir_or_legacy('design-drafts')

def _draft_unnamed_path(did: str) -> Path:
    """`.zerocraft/design-drafts/<id>.json`（写用·id 须已过 _valid_draft_id）；断言归一化后仍在
    DRAFTS_DIR 内。"""
    base = DRAFTS_DIR.resolve()
    p = (DRAFTS_DIR / f'{did}.json').resolve()
    if p.parent != base:
        raise ValueError(f'草稿路径越界: {did!r}')
    return DRAFTS_DIR / f'{did}.json'

def _draft_named_path(slug: str) -> Path:
    """library/<slug>/design/draft.json（_game_dir 校验 slug/越界）。"""
    return _game_dir(slug) / 'design' / 'draft.json'

def _sanitize_draft(did: str, body: dict) -> dict:
    """按白名单取字段落一份规范草稿记录（服务端盖 id/updatedAt·形状兜底）。"""
    rec: dict = {}
    if isinstance(body, dict):
        for k in _DRAFT_KEYS:
            if k in body:
                rec[k] = body[k]
    rec['id'] = did
    rec['updatedAt'] = _now_iso()
    if not isinstance(rec.get('messages'), list):
        rec['messages'] = []
    if not isinstance(rec.get('files'), dict):
        rec['files'] = {}
    slug = rec.get('slug')
    rec['slug'] = slug if (isinstance(slug, str) and _valid_slug(slug)) else None
    return rec

def _draft_summary(rec: dict) -> dict:
    """列表摘要（不回传全量 messages/files·省带宽）。"""
    msgs = rec.get('messages') if isinstance(rec.get('messages'), list) else []
    return {
        'id': rec.get('id'),
        'slug': rec.get('slug'),
        'name': rec.get('name') or '',
        'phase': rec.get('phase') or 'chat',
        'updatedAt': rec.get('updatedAt') or '',
        'turns': sum(1 for m in msgs if isinstance(m, dict) and m.get('role') == 'user'),
        'messageCount': len(msgs),
    }

def _iter_draft_files():
    """产 (path, rec) 遍历所有草稿文件（未定名 + 各卡带 named）。坏 JSON 跳过。"""
    out = []
    drafts_dir = _drafts_dir_read()
    if drafts_dir.is_dir():
        for p in drafts_dir.glob('*.json'):
            try:
                out.append((p, json.loads(p.read_text(encoding='utf-8'))))
            except Exception:
                pass
    if LIBRARY_DIR.is_dir():
        for d in sorted(LIBRARY_DIR.iterdir()):
            if not d.is_dir() or not _valid_slug(d.name):
                continue
            p = d / 'design' / 'draft.json'
            if p.is_file():
                try:
                    rec = json.loads(p.read_text(encoding='utf-8'))
                    if isinstance(rec, dict):
                        rec.setdefault('slug', d.name)
                    out.append((p, rec))
                except Exception:
                    pass
    return out

def _find_draft(did: str):
    """按 id 定位草稿文件（扫未定名 + named）。返回 (path, rec) 或 (None, None)。"""
    for p, rec in _iter_draft_files():
        if isinstance(rec, dict) and rec.get('id') == did:
            return p, rec
    return None, None

def design_draft_list() -> tuple:
    """GET /api/design-drafts → {drafts:[摘要...]}（updatedAt 时间倒序）。"""
    recs = [rec for _, rec in _iter_draft_files() if isinstance(rec, dict) and rec.get('id')]
    recs.sort(key=lambda r: str(r.get('updatedAt') or ''), reverse=True)
    return (200, {'drafts': [_draft_summary(r) for r in recs]})

def design_draft_get(did: str) -> tuple:
    """GET /api/design-drafts/<id> → {success, draft}（全量·供一键恢复）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    _, rec = _find_draft(did)
    if rec is None:
        return (404, {'success': False, 'error': f'草稿不存在: {did}'})
    return (200, {'success': True, 'draft': rec})

def design_draft_put(did: str, body: dict) -> tuple:
    """PUT /api/design-drafts/<id> → upsert。slug 有效且卡带已存在 → 随卡带落 + 清旧未定名文件（迁移）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    rec = _sanitize_draft(did, body)
    slug = rec.get('slug')
    if slug:
        game_dir = _game_dir(slug)  # 校验 slug / 防越界（非法 → ValueError → 400）
        if game_dir.is_dir():
            target = _draft_named_path(slug)
            target.parent.mkdir(parents=True, exist_ok=True)
            _write_json(target, rec)
            old = _draft_unnamed_path(did)
            if old.exists():
                try:
                    old.unlink()
                except OSError:
                    pass
            return (200, {'success': True, 'id': did, 'slug': slug, 'location': 'named', 'updatedAt': rec['updatedAt']})
        rec['slug'] = None  # slug 无对应卡带（异常）→ 退回未定名，绝不丢
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(_draft_unnamed_path(did), rec)
    return (200, {'success': True, 'id': did, 'slug': None, 'location': 'unnamed', 'updatedAt': rec['updatedAt']})

def design_draft_delete(did: str) -> tuple:
    """DELETE /api/design-drafts/<id> → 弃置（删草稿文件·named 只删 draft.json 不动卡带）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    p, _ = _find_draft(did)
    if p is None:
        return (404, {'success': False, 'error': f'草稿不存在: {did}'})
    try:
        p.unlink()
    except OSError as e:
        return (500, {'success': False, 'error': f'删除失败: {e}'})
    return (200, {'success': True, 'id': did})

def _draft_id_from_path(path: str):
    """'/api/design-drafts/<id>' → id（urldecode）或 None。"""
    segs = [s for s in path.split('/') if s]  # ['api','design-drafts',<id>]
    if len(segs) >= 3 and segs[0] == 'api' and segs[1] == 'design-drafts':
        return urllib.parse.unquote(segs[2])
    return None
