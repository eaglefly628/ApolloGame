"""低模生成四件：能力目录切片/题材裁剪 + 模板起步增量修改。"""
import json
import re

from .generation import _generate_with_autofix
from .llm_transport import GAME_GEN_SYSTEM_PROMPT, _FALLBACK_CATALOG
from .templates import CAPABILITY_FAMILIES, TEMPLATE_KEYWORDS, TEMPLATE_LIBRARY, _BASE_ATOM_IDS, _template_manifest

# ② 词汇按题材裁剪：把前端送来的**全量** catalog 文本按能力 id 切块 → 只保留需要的子集（模板已用族 +
#   基础原子 + 命中题材族）。buildCapabilityCatalog 不动（引擎域）；纯字符串切片，确定性、字节稳定。
_CAT_BLOCK_RE = re.compile(r'^- (\S+) ')

def _catalog_blocks(full: str):
    """catalog 文本 → [(id, block_text)]（每块 = 「- id (...)」起、到下一块前止；保原顺序）。"""
    blocks, cur_id, cur = [], None, []
    for line in (full or '').split('\n'):
        m = _CAT_BLOCK_RE.match(line)
        if m:
            if cur_id is not None:
                blocks.append((cur_id, '\n'.join(cur)))
            cur_id, cur = m.group(1), [line]
        elif cur_id is not None:
            cur.append(line)
    if cur_id is not None:
        blocks.append((cur_id, '\n'.join(cur)))
    return blocks

def _catalog_block_ids(full: str) -> set:
    return {bid for bid, _ in _catalog_blocks(full)}

def _slice_catalog(full: str, keep_ids) -> str:
    """按 keep_ids 选块（保原顺序）。无块结构（fallback 单行目录）或一个都没命中 → 原样返回，绝不给空词表。"""
    blocks = _catalog_blocks(full)
    if not blocks:
        return full
    keep = set(keep_ids)
    picked = [txt for bid, txt in blocks if bid in keep]
    return '\n'.join(picked) if picked else full

def _template_family_ids(template: dict, families) -> list:
    """模板已用能力 + 基础原子 + 命中题材族 → 去重保序的能力 id 列表（喂 _slice_catalog）。"""
    ids = list(_BASE_ATOM_IDS) + list(template.get('capabilities', []))
    for fam in families:
        ids += CAPABILITY_FAMILIES.get(fam, [])
    seen, out = set(), []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out

def _pick_template(prompt: str):
    """① 关键词 → 最近的能跑模板 + 题材族（纯数据映射·首个命中胜·默认物理弹跳）。返回 (template, families)。"""
    p = (prompt or '').lower()
    for key, families, kws in TEMPLATE_KEYWORDS:
        if any(kw.lower() in p for kw in kws):
            return TEMPLATE_LIBRARY[key], list(families)
    return TEMPLATE_LIBRARY['bounce'], ['platform']

TEMPLATE_EDIT_TASK = (
    "Below is a runnable baseline Apollo Engine manifest (it already passes engine validation) and the "
    "game the user wants. Modify the baseline into the user's game by editing ONLY what the idea needs — "
    "rename entities, tweak numbers, swap colors/art, add or remove a few entities. Reuse the baseline's "
    "capabilities and shape wherever possible. Enable ONLY capability ids that appear in the catalog in the "
    "system prompt. Output the COMPLETE modified manifest as pure JSON (no markdown, no explanation)."
)

def _handle_template_edit(provider: str, api_key: str, model: str, body: dict, catalog: str) -> dict:
    """① 模板起步 + 增量修改（默认路径）：关键词选模板 → 注入题材子集词表 → LLM 改基线出完整 manifest。
    ② 校验错误点名未裁进来的真实能力 → 下轮补该族全量（rebuild_system）。走 autofix 硬校验回路。"""
    prompt = str(body.get('prompt') or '').strip()
    if not prompt:
        return {'success': False, 'error': 'template-edit 需要 prompt（一句话创意）', 'blueprint': None}
    full = catalog or _FALLBACK_CATALOG
    template, families = _pick_template(prompt)
    keep = _template_family_ids(template, families)
    known_ids = _catalog_block_ids(full)

    def _rebuild(unknown_ids):
        added = False
        for cid in unknown_ids:
            if cid in known_ids and cid not in keep:  # 是真实能力、只是被裁掉了 → 补它 + 它整族
                keep.append(cid)
                added = True
                for _fam, ids in CAPABILITY_FAMILIES.items():
                    if cid in ids:
                        for x in ids:
                            if x in known_ids and x not in keep:
                                keep.append(x)
        if not added:
            return None
        return GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', _slice_catalog(full, keep))

    system = GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', _slice_catalog(full, keep))
    baseline = _template_manifest(template)
    user_msg = (TEMPLATE_EDIT_TASK
                + '\n\n## Baseline manifest（已能通过引擎校验的可运行基线·题材=' + template['key'] + '）\n'
                + json.dumps(baseline, ensure_ascii=False, indent=2)
                + '\n\n## 用户想要的游戏\n' + prompt
                + '\n\nOutput the COMPLETE modified manifest as pure JSON.')
    res = _generate_with_autofix(provider, api_key, model, system, user_msg, autofix=True,
                                 log_mode='template-edit', rebuild_system=_rebuild)
    res['template'] = template['key']
    return res
