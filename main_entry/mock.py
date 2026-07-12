"""Mock provider + Mock 响应 + Mock 设计流响应 + mock 计数器/染色（写穿透属主）。"""
import os
import json

from .blueprints import PRESET_BLUEPRINTS
from .design_prompts import DESIGN_CHAT_SYSTEM, DESIGN_REVISE_SYSTEM, _DESIGN_BREAKDOWN_HEAD

# ── Mock provider（测试基建·仅 env 开启时可见）─────────────────────────
# APOLLO_MOCK_LLM=1 → providers 多一个恒 available 的 'mock'：generate 回内置合法 manifest、
# revise 对传入 manifest 做一处确定性小改（改首个实体 Color.tint）、回显完整 JSON。供冒烟/e2e
# 无 API key 可跑全链路。APOLLO_MOCK_BAD_N=<n> → 前 n 次响应回坏 JSON（测服务端 autofix 重试）。
# mock 绝不进默认 providers 列表（无 env 时对生产完全不可见）。
def _mock_enabled() -> bool:
    return os.environ.get('APOLLO_MOCK_LLM', '') in ('1', 'true', 'yes')

# 剩余「坏 JSON」次数（进程级可变状态；autofix 回路每消费一次自减）。
_MOCK_BAD_REMAINING = int(os.environ.get('APOLLO_MOCK_BAD_N') or 0)
# 剩余「校验不过的 manifest」次数：产**合法 JSON 但含未知能力**（驱动 manifest-check 失败 →
# 服务端错误指令化 + 词汇族扩 + 轮次裁剪回路，弱模基准自证用）。每消费一次自减。
_MOCK_BAD_MANIFEST_REMAINING = int(os.environ.get('APOLLO_MOCK_BAD_MANIFEST_N') or 0)
# mock 修订用的确定性染色目标（与常见预设色不同 → 测试可断言「确实改了」）。
_MOCK_REVISE_TINT = 0xff0000

def _extract_json(text: str) -> str:
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    return text.strip()

# ── Mock 响应（无 key 测试用）──────────────────────────────────────────
def _mock_manifest() -> dict:
    """内置合法 manifest = platformer 预设的规范形态（含 name/description·深拷贝防污染）。"""
    p = PRESET_BLUEPRINTS['platformer']
    return {
        'name': p['name'], 'description': p.get('description', ''),
        'capabilities': list(p['capabilities']),
        'entities': json.loads(json.dumps(p['entities'])),
    }

def _mock_revise(current: dict) -> dict:
    """对传入 manifest 做一处**确定性**小改：优先取首个（按 key 排序）已有 Color 的实体、否则首个实体，
    把其 Color.tint 改成 _MOCK_REVISE_TINT（无 Color 则补一个并确保 l2-color 在 capabilities）。
    回完整 manifest。测试据此断言「确实改了」。"""
    m = json.loads(json.dumps(current)) if isinstance(current, dict) else {'capabilities': [], 'entities': {}}
    entities = m.get('entities')
    if not isinstance(entities, dict) or not entities:
        return _mock_manifest()
    keys = sorted(entities.keys())
    # 优先染一个「可见」（已有 Color）的实体，视觉上更像真的改动，退而求其次取首个。
    target = next((k for k in keys if isinstance(entities[k], dict) and isinstance(entities[k].get('Color'), dict)), keys[0])
    ent = entities[target]
    if isinstance(ent, dict):
        color = ent.get('Color')
        if isinstance(color, dict):
            color['tint'] = _MOCK_REVISE_TINT
        else:
            ent['Color'] = {'tint': _MOCK_REVISE_TINT, 'alpha': 1}
            caps = m.get('capabilities')
            if isinstance(caps, list) and 'l2-color' not in caps:
                caps.append('l2-color')
    return m

def _mock_response(system: str, messages: list) -> dict:
    """按 system 词分流 mock 响应（设计先行流四模式 + 既有 create/revise）：
      · design-chat（system==DESIGN_CHAT_SYSTEM）→ 脚本化对话，第二轮 user 起带 [READY_TO_BREAKDOWN]。
      · design-revise（system==DESIGN_REVISE_SYSTEM）→ 回改过的全文（永远产文本，不受 bad-N 影响）。
      · design-breakdown（system 以 breakdown 头起）→ 固定小 GDD 的 JSON（受 bad-N 影响，测重问）。
      · manifest（create / revise / prototype）→ 内置 manifest；revise 走确定性染色（受 bad-N 影响）。
    _MOCK_BAD_REMAINING>0 时**仅对产 JSON 的模式**先回坏 JSON（每次自减），驱动服务端 autofix / breakdown 重问。"""
    global _MOCK_BAD_REMAINING, _MOCK_BAD_MANIFEST_REMAINING
    s = system or ''
    # 产文本的两模式：从不注坏 JSON（对它们无意义）。
    if s == DESIGN_CHAT_SYSTEM:
        return {'success': True, 'text': _mock_design_chat(messages)}
    if s == DESIGN_REVISE_SYSTEM:
        return {'success': True, 'text': _mock_design_revise(messages)}
    # 以下皆为产 JSON 的模式：honor bad-N（坏 JSON）→ 再 honor bad-manifest-N（合法 JSON·校验不过）。
    if _MOCK_BAD_REMAINING > 0:
        _MOCK_BAD_REMAINING -= 1
        return {'success': True, 'text': '{ "name": "broken", oops not valid json '}
    if _MOCK_BAD_MANIFEST_REMAINING > 0:
        _MOCK_BAD_MANIFEST_REMAINING -= 1
        bad = _mock_manifest()
        bad['capabilities'] = list(bad['capabilities']) + ['zz-mock-bogus-cap']  # 未知能力 → manifest-check 拒
        return {'success': True, 'text': json.dumps(bad, ensure_ascii=False)}
    if s.startswith(_DESIGN_BREAKDOWN_HEAD):
        return {'success': True, 'text': _mock_breakdown_json()}
    # template-edit：user_msg 带「## Baseline manifest」→ 对基线做确定性小改（revise 式染色）回全文。
    tpl_marker = '## Baseline manifest'
    tpl_src = next((str(m.get('content', '')) for m in messages
                    if m.get('role') == 'user' and tpl_marker in str(m.get('content', ''))), None)
    if tpl_src is not None:
        b = tpl_src.split(tpl_marker, 1)[1].split('## 用户想要', 1)[0]
        i, j = b.find('{'), b.rfind('}')
        try:
            base = json.loads(b[i:j + 1]) if 0 <= i < j else _mock_manifest()
        except Exception:
            base = _mock_manifest()
        return {'success': True, 'text': json.dumps(_mock_revise(base), ensure_ascii=False)}
    marker = '## Current game manifest'
    revise_src = next((str(m.get('content', '')) for m in messages
                       if m.get('role') == 'user' and marker in str(m.get('content', ''))), None)
    if revise_src is not None:
        try:
            block = revise_src.split(marker, 1)[1].split('## User instruction', 1)[0].strip()
            current = json.loads(_extract_json(block))
        except Exception:
            current = _mock_manifest()
        return {'success': True, 'text': json.dumps(_mock_revise(current), ensure_ascii=False)}
    return {'success': True, 'text': json.dumps(_mock_manifest(), ensure_ascii=False)}

# ── Mock 设计先行流响应（design-chat / design-breakdown / design-revise）────────
def _mock_design_chat(messages: list) -> str:
    """脚本化策划对话：第二轮 user 消息起，末行带 [READY_TO_BREAKDOWN]（前端据此亮「分解」按钮）。"""
    user_turns = sum(1 for m in messages if isinstance(m, dict) and m.get('role') == 'user')
    if user_turns >= 2:
        return ('好，类型与参照物、核心循环、胜负进程、内容规模都聊清楚了——'
                '我会把它分解成 pitch / 系统 / 内容 / 能力总览四份设计稿。\n'
                '[READY_TO_BREAKDOWN]')
    return ('明白了。先锁定核心循环：玩家反复做的那个动作是什么？'
            '（顺带聊聊参照哪些游戏、怎么算赢、大概多少内容量）')

def _mock_breakdown_json() -> str:
    """固定小 GDD（一个「投骰子比大小」系统）：capability-plan 标 2 现有 ✅ + 1 虚构缺口 ⏳。"""
    files = {
        'pitch.md': (
            '# 投骰子比大小\n\n'
            '两名玩家各投一颗骰子，点数大者赢下本回合。先赢 2 回合者获胜。\n\n'
            '参照：吹牛骰 / 大话骰的比点内核，去掉喊注、只留最纯的比大小。\n'),
        'systems/dice-duel.md': (
            '# 系统 · 投骰子比大小\n\n'
            '- 每回合双方各投一颗 1–6 的骰子。\n'
            '- 点数大的一方本回合得 1 分；平局则本回合重投。\n'
            '- 先到 2 分者获胜，回到标题。\n'),
        'content.md': (
            '# 内容规模\n\n'
            '- 1 个对局场景（玩家 vs 简单 AI）。\n'
            '- 目标分数：2。\n'
            '- 无关卡树、无解锁——一局定胜负的最小可玩体。\n'),
        'capability-plan.md': (
            '# 能力总览 capability-plan\n\n'
            '| 系统/规则 | 能力接入 | 状态 |\n'
            '|---|---|---|\n'
            '| 投骰的随机数 | `w1-random`（引擎种子 PRNG，禁裸 Math.random） | ✅ 现有 |\n'
            '| 骰子点数结算 | `t2-dice-roll` | ✅ 现有 |\n'
            '| 三局两胜赛制编排 | `t9-best-of-series`（假想 id） | ⏳ 缺口（现有能力表达不了，待下沉）|\n'),
    }
    return json.dumps({'files': files}, ensure_ascii=False)

def _mock_design_revise(messages: list) -> str:
    """回改过的全文：抽出当前文档正文 + 指令，末尾追加一行确定性「修订」标记（测试据此断言内容变了）。"""
    src = next((str(m.get('content', '')) for m in messages
                if isinstance(m, dict) and m.get('role') == 'user'), '')
    cur, instr = '', ''
    if '## Current document' in src:
        after = src.split('## Current document', 1)[1]
        after = after.split('\n', 1)[1] if '\n' in after else after  # 跳过「(path)」行
        cur = after.split('## Revision instruction', 1)[0].strip()
    if '## Revision instruction' in src:
        instr = src.split('## Revision instruction', 1)[1].split('\n\nOutput', 1)[0].strip()
    body = cur or '# 设计稿'
    return f'{body}\n\n> 修订：{instr or "（细化）"}'
