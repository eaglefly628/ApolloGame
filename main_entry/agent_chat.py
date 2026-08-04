"""Workshop 双角色对话编排（handle_agent_chat + 摘要/回复拆分）。"""
import json
import re
import hashlib

from .agent_prompts import AGENT_ART_SYSTEM, AGENT_GD_SYSTEM, AGENT_PE_SYSTEM, _CAPGAP_RULES_ON, _MOCK_LOGIC_TS, _TS_RULES_ON
from .claude_code import _CLAUDE_EFFORTS
from .config import _config_model, _features, _load_config
from .generation import _llm_ify_error
from .library import _read_design
from .llm_log import _llm_log
from .llm_transport import LLM_PROVIDERS, _FALLBACK_CATALOG, _provider_request, get_api_key
from .mock import _mock_revise
from .paths import LIBRARY_DIR, _run_manifest_check, _valid_design_relpath, _valid_slug
from .pipeline_board import _pipeline_cli
from .protocols import _capgap_record, _split_art_ops, _split_capgap
from .sysutil import ROOT
from .ts_carts import _run_cart_logic_check, _split_reply_ts, _ts_cart_enabled
from .workshop_store import _AGENT_ROLES, _ws_file_load, _ws_sessions_save, _ws_http_ctx_load, _ws_http_ctx_save

def _agent_art_digest(slug: str, cap: int = 40) -> str:
    """gd 角色的美术台账摘要：编号/状态/查询词/皮肤槽 + 风格锚。缺台账=明说（不是空串）。"""
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return '(no art ledger yet — it is derived automatically when the manifest is saved)'
    try:
        led = json.loads(f.read_text('utf-8'))
    except Exception:
        return '(art ledger unreadable)'
    lines = []
    style = led.get('artStyle') or {}
    if style.get('stylePrompt') or style.get('packId'):
        lines.append(f"style anchor: pack={style.get('packId') or '-'} · prompt={style.get('stylePrompt') or '-'}")
    for r in (led.get('rows') or [])[:cap]:
        skin = f" skin={r.get('skinKey')}" if r.get('skinKey') else ''
        lines.append(f"{r.get('no')} [{r.get('status')}] {r.get('query', '')}{skin}")
    return '\n'.join(lines) or '(empty ledger)'

def _agent_concept_digest(slug: str) -> str:
    """立项卡摘要 + 生产板当前阶段（owner 2026-08-04「换新会话」接力包）：薄封装既有
    `_pipeline_cli(['board', slug, '--json'])`（board 命令已算好 concept + 八阶段状态·不建第二套
    阶段判定）。短超时（15s，聊天路径不能被拖住）——取不到板（新游戏/CLI 异常/超时）明说，不断链。"""
    try:
        res = _pipeline_cli(['board', slug, '--json'], timeout=15)
    except Exception:
        return '(pipeline board unavailable)'
    if not res.get('ok'):
        return '(pipeline board unavailable — new game or not yet staged)'
    concept = res.get('concept') or {}
    lines = []
    if concept.get('name') or concept.get('pitch'):
        lines.append(f"concept: name={concept.get('name') or '-'} · pitch={concept.get('pitch') or '-'}")
    if concept.get('style'):
        lines.append(f"style note: {concept['style']}")
    if concept.get('refs'):
        lines.append(f"refs: {concept['refs']}")
    stages = res.get('stages') or []
    if stages:
        lines.append('stages: ' + ' '.join(f"{st.get('id')}:{st.get('status')}" for st in stages if isinstance(st, dict)))
    nxt = res.get('next')
    if nxt:
        lines.append(f'next stage: {nxt}')
    return '\n'.join(lines) or '(no concept/board data yet)'


def _agent_design_digest(slug: str, cap_chars: int = 6000) -> str:
    """gd 角色的底案全文注入（超预算按文件截断·文件清单永远完整）。库缺失=明说。"""
    game_dir = LIBRARY_DIR / slug
    if not game_dir.is_dir():
        return '(no design docs — this is a builtin game or docs not created yet)'
    files = _read_design(game_dir)
    if not files:
        return '(no design docs yet — 设计先行流的提纲会落在这里)'
    parts, used = [f"files: {', '.join(files)}"], 0
    for rel, content in files.items():
        take = content if used + len(content) <= cap_chars else content[:max(0, cap_chars - used)] + '\n…(truncated)'
        used += len(take)
        parts.append(f'### {rel}\n{take}')
        if used >= cap_chars:
            break
    return '\n\n'.join(parts)

_DESIGN_BLOCK_RE = re.compile(r'```design[ \t]+([^\n`]+)\n(.*?)```', re.S)

def _split_design_patch(text: str):
    """回复文本 → (剩余文本, path|None, content|None)。只认 ```design <rel.md> 围栏 + 合法 design 相对路径。"""
    m = _DESIGN_BLOCK_RE.search(text or '')
    if not m:
        return (text or '').strip(), None, None
    rel, content = m.group(1).strip(), m.group(2)
    rest = (text[:m.start()] + text[m.end():]).strip()
    if not _valid_design_relpath(rel):
        return rest, None, None  # 非法路径：当没提议（对白保留·不惊扰）
    return rest, rel, content.strip() + '\n'

def _split_reply_manifest(text: str):
    """回复文本 → (对白部分, manifest JSON 串或 None)。只认 ```json 围栏且顶层含 entities 的对象。"""
    if '```json' not in (text or ''):
        return (text or '').strip(), None
    pre, rest = text.split('```json', 1)
    block, _, post = rest.partition('```')
    block = block.strip()
    try:
        cand = json.loads(block)
        if isinstance(cand, dict) and isinstance(cand.get('entities'), dict):
            return (pre + post).strip(), block
    except Exception:
        pass
    return (text or '').strip(), None

def handle_agent_chat(body: dict) -> dict:
    """POST /api/agent/chat {slug, role: 'gd'|'pe', messages:[{role,content}…], provider?, model?, catalog?}。"""
    slug = str(body.get('slug', '')).strip()
    role = str(body.get('role', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if role not in _AGENT_ROLES:
        return {'success': False, 'error': f"role 必须是 {'/'.join(_AGENT_ROLES)}（策划=gd·程序=pe·美术=art）"}
    raw_msgs = body.get('messages')
    if not isinstance(raw_msgs, list) or not raw_msgs:
        return {'success': False, 'error': 'messages 必填（非空数组）'}
    if len(raw_msgs) > 40:
        return {'success': False, 'error': '对话过长（≤40 条·新起话题或摘要后继续）'}
    messages = []
    for m in raw_msgs:
        r = m.get('role') if isinstance(m, dict) else None
        content = m.get('content') if isinstance(m, dict) else None
        if r not in ('user', 'assistant') or not isinstance(content, str):
            return {'success': False, 'error': 'messages 每条须为 {role: user|assistant, content: 字符串}'}
        if len(content) > 8000:
            return {'success': False, 'error': '单条消息过长（≤8000 字）'}
        messages.append({'role': r, 'content': content})
    if messages[-1]['role'] != 'user':
        return {'success': False, 'error': '最后一条须是用户消息'}
    # 当前 manifest（library 优先·内置数据游戏回退 public）——对话上下文的唯一真相
    mf_path = LIBRARY_DIR / slug / 'manifest.json'
    if not mf_path.is_file():
        mf_path = ROOT / 'public' / 'games' / slug / 'manifest.json'
    if not mf_path.is_file():
        return {'success': False, 'error': f'游戏不存在（library 与 public 均无 manifest）: {slug}'}
    try:
        current = json.loads(mf_path.read_text('utf-8'))
    except Exception as e:
        return {'success': False, 'error': f'manifest 解析失败: {e}'}
    try:
        game_name = json.loads((LIBRARY_DIR / slug / 'meta.json').read_text('utf-8')).get('name') or slug
    except Exception:
        game_name = slug

    provider = body.get('provider') or _load_config().get('default') or 'claude-code'
    if provider != 'mock' and provider not in LLM_PROVIDERS:
        return {'success': False, 'error': f'Unknown provider: {provider}'}
    api_key = get_api_key(provider)
    if not api_key:
        env_key = LLM_PROVIDERS.get(provider, {}).get('env_key', '?')
        return {'success': False, 'error': f'{provider} 无可用凭据（配置 {env_key} 或在设置里填）'}
    models = LLM_PROVIDERS.get(provider, {}).get('models') or ['mock']
    model = body.get('model') or _config_model(provider) or models[0]
    if body.get('model') and provider != 'mock' and body['model'] not in models:
        return {'success': False, 'error': f'{provider} 不认识型号 {body["model"]}（可选: {", ".join(models)}）'}
    effort = body.get('effort') or 'high'  # 思考档（owner 07-11「默认 high·可调」·仅订阅通道生效）
    if effort not in _CLAUDE_EFFORTS:
        return {'success': False, 'error': f'effort 必须是 {"/".join(_CLAUDE_EFFORTS)}'}

    # mock 短路（ZEROCRAFT_MOCK_LLM=1·冒烟/e2e 全链）：确定性染色微调 + 过真校验门
    if provider == 'mock':
        revised = _mock_revise(current)
        ok, msg = _run_manifest_check(revised)
        out = {'success': True, 'reply': '（mock）已按要求做一处演示微调：把首个可见实体染红。点「应用改动」落盘。',
               'attempts': 1, 'provider': provider, 'model': model, 'role': role}
        if ok:
            out['manifest'] = revised
        else:
            out['manifestError'] = msg
        if role in ('gd', 'art'):
            out['artHints'] = []
        if role == 'gd' and any(k in messages[-1]['content'] for k in ('底案', '提纲')):  # mock 底案提议（冒烟全链）
            out['designPatch'] = {'path': 'overview.md', 'content': '# 总览（mock 修订）\n'}
        if _features().get('capgap') and '能力缺口' in messages[-1]['content']:  # mock capgap（冒烟全链）
            out['capGap'] = _capgap_record(slug, role, {'title': 'mock 缺口', 'need': '冒烟演示',
                                                        'proposal': '通用能力形状', 'acceptance': '一条测试'})
        if role == 'pe' and _ts_cart_enabled(slug) and 'logic' in messages[-1]['content']:  # mock TS 提议（冒烟全链）
            out['logicPatch'] = {'content': _MOCK_LOGIC_TS.replace('__SLUG__', slug)}
        if role == 'art' and '生成' in messages[-1]['content']:  # mock art-ops 提议（冒烟全链·07-12 工作流重设）
            out['artOps'] = [{'op': 'batch'}, {'op': 'replace'}]
        return out

    tpl = {'gd': AGENT_GD_SYSTEM, 'pe': AGENT_PE_SYSTEM, 'art': AGENT_ART_SYSTEM}[role]
    ts_on = role == 'pe' and _ts_cart_enabled(slug)  # TS 例外（owner 07-11·features.tsCarts+卡带勾）
    logic_text = ''
    if ts_on:
        lf = LIBRARY_DIR / slug / 'logic.ts'
        if lf.is_file():
            try:
                logic_text = lf.read_text('utf-8')[:20000]
            except Exception:
                pass
    design_digest = _agent_design_digest(slug)  # 三角色同吃（owner 07-12「程序凭名字瞎猜」——底案=spec，谁施工谁必读）
    manifest_json = json.dumps(current, ensure_ascii=False)
    art_digest = _agent_art_digest(slug) if role in ('gd', 'art') else ''
    concept_digest = _agent_concept_digest(slug)  # 立项卡+生产板阶段（owner 08-04「换新会话」接力包·三角色同吃）

    # ── token 优化 P0+P1（owner 07-15 review 拍板）────────────────────────────────
    # P0：能力目录抽成**独立首段**（≈1.1 万 token·全角色全游戏共享）→ anthropic 独立缓存断点跨对话复用、
    #     DeepSeek 自动前缀缓存命中；模板占位换成指针句。
    # P1：HTTP 供应商（无 --resume 的全量重发通道）用「**开局冻结上下文**」——底案/manifest/logic/美术摘要
    #     在对话第一轮快照进 system 并全程不变（前缀稳定=多轮缓存全程命中）；中途工件变更不改 system，
    #     改为**末条消息前附更新提示**（最新全文·以此为准），noted 指纹防重复附。CC 通道已有同范式（mf_hash）。
    # concept（立项卡+生产板阶段）不参与 ctx_hash/更新提示——阶段流转不必打断对话；它只在「开局」这一轮
    # 现身（system 只在开局真发·CC resume/HTTP 冻结后的轮次都不重发 system），过时也无害（下轮 换新会话 即换新）。
    ctx = {'design': design_digest, 'manifest': manifest_json, 'art': art_digest, 'logic': logic_text, 'concept': concept_digest}
    ctx_hash = hashlib.sha1('|'.join([design_digest, manifest_json, art_digest, logic_text]).encode()).hexdigest()[:16]
    if provider != 'claude-code':
        stored = _ws_http_ctx_load(slug, role)
        if len(messages) <= 1 or not stored.get('hash') or not isinstance(stored.get('ctx'), dict):
            _ws_http_ctx_save(slug, role, ctx_hash, ctx, ctx_hash)  # 开局（或无快照）：冻结当前版
        else:
            ctx = {k: str(stored['ctx'].get(k, '')) for k in ('design', 'manifest', 'art', 'logic', 'concept')}  # 用冻结版拼 system
            if stored.get('noted') != ctx_hash:  # 工件变了且尚未传达 → 末端更新提示（system 不动·缓存前缀保命中）
                note = ('【提示】游戏工件已更新为最新版（以下为准·开局注入的旧版作废）：\n'
                        + f'\n### 设计底案（最新）\n{design_digest}\n'
                        + f'\n### 当前 manifest（最新）\n```json\n{manifest_json}\n```\n'
                        + (f'\n### Current logic.ts（最新·修订=整文件重发）\n```ts\n{logic_text}```\n' if ts_on and logic_text else '')
                        + (f'\n### 美术台账摘要（最新）\n{art_digest}\n' if art_digest else '') + '\n')
                messages = messages[:-1] + [{'role': 'user', 'content': note + messages[-1]['content']}]
                _ws_http_ctx_save(slug, role, str(stored['hash']), stored['ctx'], ctx_hash)

    ts_rules = ''
    if ts_on:
        ts_rules = _TS_RULES_ON
        if ctx['logic']:
            ts_rules += f"\n### Current logic.ts（修订=整文件重发）\n```ts\n{ctx['logic']}```\n"
    catalog_seg = '### 引擎能力目录（全角色共享·能力 id/组件字段只能从这里选·机读真相）\n' + str(body.get('catalog') or _FALLBACK_CATALOG)
    system_rest = (tpl.replace('{TS_RULES}', ts_rules)
                   .replace('{CAPGAP_RULES}', _CAPGAP_RULES_ON if _features().get('capgap') else '')
                   .replace('{GAME_NAME}', str(game_name)).replace('{GAME_SLUG}', slug)
                   .replace('{CURRENT_MANIFEST}', ctx['manifest'])
                   .replace('{CAPABILITY_CATALOG}', '（见最前『引擎能力目录』共享块——那是唯一词汇表）')
                   .replace('{DESIGN_DOCS}', ctx['design'])
                   .replace('{ART_DIGEST}', ctx['art'])
                   .replace('{CONCEPT_DIGEST}', ctx['concept']))
    system = [catalog_seg, system_rest]  # 传输层：anthropic 逐段缓存断点·其余顺序拼接（str 调用方语义不变）

    # 方案 A（owner 07-11 拍板）：订阅通道用 CC 原生 session——首轮全量注入并抓 session_id，
    # 续轮 --resume 只发增量；manifest/底案变了（应用改动/修订底案后）随增量附最新全文。工件仍是唯一真相。
    session = None
    mf_hash = None
    if provider == 'claude-code':
        # 指纹盖 manifest+底案（07-12 扩）：底案更新也要推给已开的 session——老 session 不用重开即可拿到 spec。
        mf_hash = hashlib.sha1((json.dumps(current, ensure_ascii=False, sort_keys=True) + '\n' + design_digest).encode()).hexdigest()[:16]
        store = _ws_file_load(slug)
        sid = (store.get('sessions') or {}).get(role)
        session = {'id': sid if isinstance(sid, str) else None}
        if session['id']:
            note = ''
            if (store.get('ctxHash') or {}).get(role) != mf_hash:
                note = ('【提示】游戏 manifest 与设计底案已更新为最新版（以下为准·此前版本作废）：\n```json\n'
                        + json.dumps(current, ensure_ascii=False) + '\n```\n\n### 设计底案（spec·施工以此为准）\n'
                        + design_digest + '\n\n')
            messages = [{'role': 'user', 'content': note + messages[-1]['content']}]  # 续轮=只发增量
    attempts = 0
    reply_text, manifest_out, manifest_err = '', None, None
    cur_messages = messages
    while attempts < 2:  # 首轮 + 至多一轮校验错误回喂
        attempts += 1
        r = _provider_request(provider, api_key, model, system, cur_messages, max_tokens=16000, effort=effort, session=session)
        _llm_log(provider=provider, model=model, mode=f'agent-{role}' if attempts == 1 else f'agent-{role}-fix',
                 req=r, validation=None if r.get('success') else 'error',
                 errors=[] if r.get('success') else [r.get('error')], prompt_full='\n\n'.join(system))
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'), 'attempts': attempts}
        text = r['text']
        reply_text, block = _split_reply_manifest(text)
        if block is None:
            manifest_out, manifest_err = None, None
            break  # 纯对白轮：合法结果
        candidate = json.loads(block)  # _split_reply_manifest 已保证可解析
        ok, msg = _run_manifest_check(candidate)
        if ok:
            manifest_out, manifest_err = candidate, None
            break
        manifest_err = msg
        instr, _unknown = _llm_ify_error(msg, candidate)
        if session is not None and session.get('id'):
            # resume 态：assistant 回合已在 session 里——回喂只发修正指令（增量）
            cur_messages = [{'role': 'user', 'content': instr + ' 修好后重发完整回复（对白 + 一个完整 manifest 的 ```json 块）。'}]
        else:
            cur_messages = messages + [{'role': 'assistant', 'content': text},
                                       {'role': 'user', 'content': instr + ' 修好后重发完整回复（对白 + 一个完整 manifest 的 ```json 块）。'}]
    if session is not None and session.get('id'):
        _ws_sessions_save(slug, role, session['id'], mf_hash)  # 下轮 --resume 续聊（CC 侧管窗口/压缩）
    if role == 'gd':  # 底案更新提议（owner 07-11：提纲=活底案·对话可持续修订·确认才落盘）
        reply_text, dpath, dcontent = _split_design_patch(reply_text)
        if dpath:
            design_patch = {'path': dpath, 'content': dcontent}
        else:
            design_patch = None
    else:
        design_patch = None
    # TS 例外：pe 的 ```ts 提议先过装载门（cart-logic-check），过了才回 logicPatch——绝不代落盘，
    # 壳「✔ 应用 TS 逻辑」PUT /api/library/<slug>/logic 才写（与 manifest/底案同一红线）。
    logic_patch, logic_err = None, None
    if ts_on:
        reply_text, ts_content = _split_reply_ts(reply_text)
        if ts_content:
            okl, msgl = _run_cart_logic_check(slug, ts_content)
            if okl:
                logic_patch = {'content': ts_content}
            else:
                logic_err = msgl
    # art-ops：美术操作提议（07-12 工作流重设）——只校验回传，壳确认后才逐条执行（不代执行红线）。
    art_ops = None
    if role == 'art':
        reply_text, art_ops = _split_art_ops(reply_text)
    # capgap：结构化能力缺口提案 → 台账即录（这是记录不是落盘工件·下沉仍走 Lead 裁决）。
    capgap_entry = None
    if _features().get('capgap'):
        reply_text, gap = _split_capgap(reply_text)
        if gap:
            capgap_entry = _capgap_record(slug, role, gap)
    out = {'success': True, 'reply': reply_text, 'attempts': attempts, 'provider': provider, 'model': model, 'role': role,
           'elapsedMs': r.get('elapsedMs'), 'usage': r.get('usage')}
    if session is not None and session.get('id'):
        out['sessionId'] = session['id']  # 该角色当前 CC session（owner 07-12 亮到壳上）
    if manifest_out is not None:
        out['manifest'] = manifest_out
    elif manifest_err:
        out['manifestError'] = manifest_err
    if design_patch:
        out['designPatch'] = design_patch
    if logic_patch:
        out['logicPatch'] = logic_patch
    elif logic_err:
        out['logicError'] = logic_err
    if capgap_entry:
        out['capGap'] = capgap_entry
    if art_ops:
        out['artOps'] = art_ops
    if role in ('gd', 'art'):
        out['artHints'] = sorted(set(re.findall(r'\bart-\d{2,3}\b', reply_text)))
    return out
