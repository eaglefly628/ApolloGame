"""工坊会话重置 + 对话历史 + 设计草稿现场持久化。"""
import json

from .paths import _valid_slug
from .workshop_store import _AGENT_ROLES, _WORKSHOP_CHATS_DIR, _ws_file_load

def handle_agent_session_reset(body: dict) -> dict:
    """POST /api/agent/session/reset {slug, role}。归档重开（owner 07-12「session 越开越多·要能 archive」）：
    只解绑该角色的 CC session id+指纹——聊天记录保留；下一轮自动开新 session 并全量重注入
    （system+末 30 条历史+底案+manifest），等于一次干净的上下文压实。旧 session 文件留在 CC 侧无害。"""
    slug = str(body.get('slug', '')).strip()
    role = str(body.get('role', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if role not in _AGENT_ROLES:
        return {'success': False, 'error': f"role 必须是 {'/'.join(_AGENT_ROLES)}"}
    d = _ws_file_load(slug)
    had = bool((d.get('sessions') or {}).get(role))
    if had:
        d['sessions'].pop(role, None)
        (d.get('ctxHash') or {}).pop(role, None)
        _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
        (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), 'utf-8')
    return {'success': True, 'slug': slug, 'role': role, 'hadSession': had}

def handle_agent_chats_get(slug: str) -> dict:
    """GET /api/agent/chats?slug=<slug>。工坊对话历史（每卡带每角色·owner 07-11「session 持久性」）。
    存 .apollo/workshop-chats/<slug>.json（gitignored·不进卡带版本史——聊天是工作台状态不是游戏数据）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    empty = {r: [] for r in _AGENT_ROLES}
    f = _WORKSHOP_CHATS_DIR / f'{slug}.json'
    if not f.is_file():
        return {'success': True, 'chats': empty}
    try:
        data = json.loads(f.read_text('utf-8'))
        chats = data.get('chats') if isinstance(data, dict) else None
        out = {r: (chats.get(r) if isinstance(chats, dict) and isinstance(chats.get(r), list) else []) for r in _AGENT_ROLES}
        # 各角色当前 CC session id（owner 07-12「标题栏下亮出来」）——三角色三独立 session 的可见证据。
        sess = data.get('sessions') if isinstance(data, dict) else None
        sessions = {r: (sess.get(r) if isinstance(sess, dict) and isinstance(sess.get(r), str) else None) for r in _AGENT_ROLES}
        return {'success': True, 'chats': out, 'sessions': sessions}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_agent_chats_put(body: dict) -> dict:
    """PUT /api/agent/chats {slug, chats:{gd|pe|art: [{role,content}…]}}。整份覆盖写（壳每轮回复后自动存）。
    守门：角色白名单·每条 {user|assistant, str≤8000}·每角色只留末 80 条（防无限膨胀）。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    chats_in = body.get('chats')
    if not isinstance(chats_in, dict):
        return {'success': False, 'error': 'chats 必填（对象 {gd|pe|art: 消息数组}）'}
    out = {}
    for r in _AGENT_ROLES:
        msgs = chats_in.get(r)
        clean = []
        for m in (msgs if isinstance(msgs, list) else [])[-80:]:
            role = m.get('role') if isinstance(m, dict) else None
            content = m.get('content') if isinstance(m, dict) else None
            if role in ('user', 'assistant') and isinstance(content, str) and len(content) <= 8000:
                row = {'role': role, 'content': content}
                if isinstance(m.get('meta'), str) and len(m['meta']) <= 200:
                    row['meta'] = m['meta']  # 用量小字（⏱/tokens）随史保留
                clean.append(row)
        out[r] = clean
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    keep = _ws_file_load(slug)  # 保留 sessions/ctxHash（resume 台账·勿被对话覆盖抹掉）
    payload = {'version': 1, 'slug': slug, 'chats': out}
    for k in ('sessions', 'ctxHash'):
        if isinstance(keep.get(k), dict):
            payload[k] = keep[k]
    (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=1), 'utf-8')
    return {'success': True, 'counts': {r: len(out[r]) for r in _AGENT_ROLES}}


_WS_DRAFT_FILE = _WORKSHOP_CHATS_DIR / '_design-draft.json'

def handle_ws_draft_get() -> dict:
    """GET /api/workshop/draft。设计先行现场（聊天/阶段/名字/slug）——杀服务/刷新回来接着干
    （owner 07-11「杀掉重开还要重来吗」）。单槽：本机单人工作台，一次只推进一个新游戏构想。"""
    if not _WS_DRAFT_FILE.is_file():
        return {'success': True, 'draft': None}
    try:
        return {'success': True, 'draft': json.loads(_WS_DRAFT_FILE.read_text('utf-8'))}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_ws_draft_put(body: dict) -> dict:
    """PUT /api/workshop/draft {draft: {...}|null}。null=清槽（原型入库后）。守门：形状白名单+长度上限。"""
    draft = body.get('draft')
    if draft is None:
        _WS_DRAFT_FILE.unlink(missing_ok=True)
        return {'success': True, 'cleared': True}
    if not isinstance(draft, dict):
        return {'success': False, 'error': 'draft 必须是对象或 null'}
    phase = draft.get('phase')
    if phase not in ('chat', 'docs'):
        return {'success': False, 'error': "phase 必须是 chat/docs"}
    slug = draft.get('slug')
    if slug is not None and not _valid_slug(str(slug)):
        return {'success': False, 'error': f'非法 slug: {slug}'}
    msgs = []
    for m in (draft.get('msgs') if isinstance(draft.get('msgs'), list) else [])[-60:]:
        r = m.get('role') if isinstance(m, dict) else None
        content = m.get('content') if isinstance(m, dict) else None
        if r in ('user', 'assistant') and isinstance(content, str) and len(content) <= 8000:
            row = {'role': r, 'content': content}
            if isinstance(m.get('meta'), str) and len(m['meta']) <= 200:
                row['meta'] = m['meta']
            msgs.append(row)
    clean = {'version': 1, 'phase': phase, 'name': str(draft.get('name') or '')[:80],
             'slug': slug, 'ready': bool(draft.get('ready')), 'msgs': msgs}
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    _WS_DRAFT_FILE.write_text(json.dumps(clean, ensure_ascii=False, indent=1), 'utf-8')
    return {'success': True}
