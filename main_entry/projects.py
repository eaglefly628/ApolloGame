"""「存为项目」S1/S2 落点端点（REQ-S18PANEL ①·PST 域 2026-08-16）。

病根（owner 实撞）：控制台的「生成」从 S3 骨架起步——S1 立项卡 / S2 玩法档在面板上没有落点：
提纲没有存盘按钮、策划案够不到 docs/design/<slug>/、缺口无处对齐、关掉界面对话就丢。

POST /api/projects {slug, brief, gdd?, gaps?, sessions?}
  ① `_valid_slug` 校验（非法/越界 → 拒·全程一个文件都不写）；
  ② 建 docs/design/<slug>/ 落：
     · brief.md（必填·S1 立项卡）
     · gdd.md（有则落·**没带或空串绝不把已有 gdd 覆盖/清空**——幂等④）
     · capability-gaps.json（有则落·形状=工单表 `[{id,title,priority,route,state,ticket,blocks[]}]`·
       **只落盘不裁决**——裁决仍走缺口裁决协议；S2 的 gap-check 门是主程半件，本端点不碰
       scripts/game-pipeline.mjs。route 是分流闭集 engine/requests-3d/pui（工单明示「必须的不是装饰」），
       state 只查形状不闭集——状态机语义归主程半件消费时定）；
  ③ 把当前对话认领到项目（工单验收点名「关掉浏览器再开，策划案与对话都还在」）：
     · 内容认领：设计先行单槽草稿（.zerocraft/workshop-chats/_design-draft.json）的对话若属本项目
       （draft.slug 为空或 == slug）→ 整份写进 .zerocraft/workshop-chats/<slug>.json 的 chats.gd
       （策划角色·进「编辑工坊」即恢复·从此不随单槽草稿被清/被下一个想法顶掉）。守门与
       handle_agent_chats_put 同规格（user/assistant · ≤8000 字 · 末 80 条）；既有更长的 gd 历史
       （认领后又在工坊聊过）不被更短草稿覆盖；sessions/ctxHash（CC resume 台账）原样保留。
     · session 认领：body 带 sessions（{gd|pe|art: CC session id}·编辑工坊场景）→ 逐角色
       `_ws_sessions_save` 落绑定（ctxHash 存空 = 下轮全量重注入·无害）。设计先行流对话是无状态
       HTTP（design-chat 不产 CC session），可不带。
  ④ 幂等：重复 POST = 更新不炸；gdd/gaps 没带 = 已有文件原样不动；对话认领整份覆盖不追加（不重复）。

**先验证后落盘**：任何一处坏体（非法 slug / brief 缺失 / gaps 形状不对 / sessions 不合法）→
一个文件都不写、一条对话都不动，不留半截现场。

边界（防加宽）：不做 S1–S8 按钮/灯（那是主程半件②③的消费面）、不做缺口编辑/裁决 UI、无 GET 列表。
"""
import json
import re

from .design_ingest import _design_dir
from .paths import _valid_slug
from .workshop_store import _AGENT_ROLES, _WORKSHOP_CHATS_DIR, _ws_file_load, _ws_sessions_save
from .workshop_state import _WS_DRAFT_FILE

_MAX_MD_BYTES = 2 * 1024 * 1024  # brief/gdd 单篇上限（同 design_ingest 单文件收稿 2MB 口径）
_MAX_GAPS = 200
_GAP_ROUTES = ('engine', 'requests-3d', 'pui')  # 工单定死的分流闭集（10 硬槽 / P3D 独立池 / PUI）
_GAP_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
_GAP_PRIORITY_RE = re.compile(r'^P[0-3]$')
_GAP_STATE_RE = re.compile(r'^[a-z][a-z0-9-]{0,31}$')  # 只查形状：小写 token（open/delivered/…）·语义归主程门
_GAP_BLOCK_RE = re.compile(r'^S[1-8]$')


def _norm_gap(i: int, g) -> tuple:
    """单条缺口形状校验 + 归一。返回 (True, normalized) 或 (False, 错误文本)。
    只保留工单表的 7 个键（多余键丢弃·防夹带自由数据进机读产物）。"""
    if not isinstance(g, dict):
        return False, f'gaps[{i}] 必须是对象'
    gid = g.get('id')
    if not isinstance(gid, str) or not _GAP_ID_RE.match(gid):
        return False, f'gaps[{i}].id 非法（[A-Za-z0-9._-]·≤64·字母数字起头）: {gid!r}'
    title = g.get('title')
    if not isinstance(title, str) or not title.strip() or len(title) > 200:
        return False, f'gaps[{i}].title 必须是非空字符串（≤200 字）'
    prio = str(g.get('priority', '')).strip().upper()
    if not _GAP_PRIORITY_RE.match(prio):
        return False, f'gaps[{i}].priority 必须是 P0–P3: {g.get("priority")!r}'
    route = str(g.get('route', '')).strip()
    if route not in _GAP_ROUTES:
        return False, f'gaps[{i}].route 必须是 {"/".join(_GAP_ROUTES)}（缺口分流池·工单明示必填）: {route!r}'
    state = str(g.get('state', '')).strip().lower()
    if not _GAP_STATE_RE.match(state):
        return False, f'gaps[{i}].state 必须是小写 token（如 open/delivered·≤32）: {g.get("state")!r}'
    ticket = g.get('ticket', '')
    if ticket is None:
        ticket = ''
    if not isinstance(ticket, str) or len(ticket) > 128:
        return False, f'gaps[{i}].ticket 必须是字符串（≤128·可空）'
    blocks_in = g.get('blocks', [])
    if not isinstance(blocks_in, list):
        return False, f'gaps[{i}].blocks 必须是数组（可空·元素 S1–S8）'
    blocks, seen = [], set()
    for b in blocks_in:
        bb = str(b).strip().upper()
        if not _GAP_BLOCK_RE.match(bb):
            return False, f'gaps[{i}].blocks 元素必须是 S1–S8: {b!r}'
        if bb not in seen:
            seen.add(bb)
            blocks.append(bb)
    return True, {'id': gid, 'title': title.strip(), 'priority': prio, 'route': route,
                  'state': state, 'ticket': ticket.strip(), 'blocks': blocks}


def _norm_gaps(gaps) -> tuple:
    """gaps 整体形状校验。返回 (True, [normalized…]) 或 (False, 错误文本)。裸数组=与主程半件的机读契约。"""
    if not isinstance(gaps, list):
        return False, 'gaps 必须是数组 [{id,title,priority,route,state,ticket,blocks[]}]'
    if len(gaps) > _MAX_GAPS:
        return False, f'gaps 超限（>{_MAX_GAPS} 条）'
    out, ids = [], set()
    for i, g in enumerate(gaps):
        ok, res = _norm_gap(i, g)
        if not ok:
            return False, res
        if res['id'] in ids:
            return False, f'gaps id 重复: {res["id"]!r}'
        ids.add(res['id'])
        out.append(res)
    return True, out


def _load_draft() -> dict:
    """读设计先行单槽草稿（无/坏 = 空 dict·不炸）。"""
    try:
        d = json.loads(_WS_DRAFT_FILE.read_text('utf-8'))
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _claim_conversation(slug: str, sessions) -> dict:
    """把当前对话认领到项目（模块头 ③）。sessions 已在 handler 层校验。"""
    out = {'msgs': 0, 'sessions': []}
    if isinstance(sessions, dict):
        for role, sid in sessions.items():
            _ws_sessions_save(slug, role, sid.strip(), '')  # ctxHash 空 → 下轮全量重注入（无害）
            out['sessions'].append(role)
    draft = _load_draft()
    dslug = draft.get('slug')
    msgs = draft.get('msgs') if isinstance(draft.get('msgs'), list) else []
    if not msgs or dslug not in (None, slug):
        return out  # 无草稿对话 / 草稿属别的项目 → 不认领（绝不跨项目搬对话）
    clean = []
    for m in msgs[-80:]:  # 守门与 handle_agent_chats_put 同规格
        role = m.get('role') if isinstance(m, dict) else None
        content = m.get('content') if isinstance(m, dict) else None
        if role in ('user', 'assistant') and isinstance(content, str) and len(content) <= 8000:
            row = {'role': role, 'content': content}
            if isinstance(m.get('meta'), str) and len(m['meta']) <= 200:
                row['meta'] = m['meta']
            clean.append(row)
    if not clean:
        return out
    d = _ws_file_load(slug)  # 保留 sessions/ctxHash/其他角色 chats（勿抹 resume 台账）
    if not isinstance(d.get('chats'), dict):
        d['chats'] = {}
    cur = d['chats'].get('gd')
    if isinstance(cur, list) and len(cur) > len(clean):
        out['note'] = '项目里的策划对话已更长——保留既有历史，不用较短草稿覆盖'
        return out
    d.setdefault('version', 1)
    d['slug'] = slug
    d['chats']['gd'] = clean  # 整份覆盖不追加（幂等·重复认领不重复）
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), 'utf-8')
    out['msgs'] = len(clean)
    return out


def handle_project_save(body: dict) -> dict:
    """POST /api/projects {slug, brief, gdd?, gaps?, sessions?}——契约见模块头。"""
    slug = str(body.get('slug', '') or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    brief = body.get('brief')
    if not isinstance(brief, str) or not brief.strip():
        return {'success': False, 'error': '需要 brief（立项卡正文·非空字符串）'}
    if len(brief.encode('utf-8')) > _MAX_MD_BYTES:
        return {'success': False, 'error': 'brief 超限（>2MB·设计档应是自包含 MD）'}
    gdd = body.get('gdd')
    if gdd is not None:
        if not isinstance(gdd, str):
            return {'success': False, 'error': 'gdd 必须是字符串（或不带）'}
        if not gdd.strip():
            gdd = None  # 空串视同没带——幂等④：绝不把已有 gdd 覆盖为空
        elif len(gdd.encode('utf-8')) > _MAX_MD_BYTES:
            return {'success': False, 'error': 'gdd 超限（>2MB·设计档应是自包含 MD）'}
    gaps = body.get('gaps')
    norm_gaps = None
    if gaps is not None:
        ok, norm_gaps = _norm_gaps(gaps)
        if not ok:
            return {'success': False, 'error': norm_gaps}
    sessions = body.get('sessions')
    if sessions is not None:
        if not isinstance(sessions, dict):
            return {'success': False, 'error': 'sessions 必须是对象 {gd|pe|art: sessionId}'}
        for role, sid in sessions.items():
            if role not in _AGENT_ROLES:
                return {'success': False, 'error': f"sessions 角色必须是 {'/'.join(_AGENT_ROLES)}: {role!r}"}
            if not isinstance(sid, str) or not sid.strip() or len(sid) > 128:
                return {'success': False, 'error': f'sessions.{role} 不是合法 session id'}
    # ── 全部验证通过才碰磁盘（拒坏体不留半截现场）──────────────────────────────
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return {'success': False, 'error': str(e)}
    d.mkdir(parents=True, exist_ok=True)
    wrote, skipped = [], []
    (d / 'brief.md').write_text(brief if brief.endswith('\n') else brief + '\n', 'utf-8')
    wrote.append('brief.md')
    if gdd is not None:
        (d / 'gdd.md').write_text(gdd if gdd.endswith('\n') else gdd + '\n', 'utf-8')
        wrote.append('gdd.md')
    else:
        skipped.append('gdd.md')
    if norm_gaps is not None:
        (d / 'capability-gaps.json').write_text(
            json.dumps(norm_gaps, ensure_ascii=False, indent=2) + '\n', 'utf-8')
        wrote.append('capability-gaps.json')
    else:
        skipped.append('capability-gaps.json')
    claimed = _claim_conversation(slug, sessions)
    return {'success': True, 'slug': slug, 'dir': f'docs/design/{slug}',
            'wrote': wrote, 'skipped': skipped, 'claimed': claimed}
