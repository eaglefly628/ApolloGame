"""capgap 协议 + art-ops 协议（结构化提案围栏解析）。"""
import time
import json
import re
from pathlib import Path

from .paths import _now_iso
from .sysutil import APOLLO_DIR

# ── capgap 协议（owner 07-11 批准「缺口→强模型下沉快速通道」·features.capgap 可关）────
# agent 遇到目录词表表达不了的机制：不发明、不硬凑——产一个 ```capgap 结构化提案围栏。
# 服务端校验落 .apollo/cap-gaps.jsonl（追加型台账），壳出卡片；下沉仍走 Lead 裁决→派工，
# 通道只是把「发现缺口→立单」从口口相传变成机器直达。
_CAPGAP_BLOCK_RE = re.compile(r'```capgap[ \t]*\n(.*?)```', re.S)
_CAPGAP_FIELDS = ('title', 'need', 'proposal', 'acceptance')

def _split_capgap(text: str):
    """回复文本 → (剩余文本, gap dict|None)。只认 ```capgap 围栏内含 title/need 的 JSON 对象。"""
    m = _CAPGAP_BLOCK_RE.search(text or '')
    if not m:
        return (text or '').strip(), None
    rest = (text[:m.start()] + text[m.end():]).strip()
    try:
        cand = json.loads(m.group(1))
    except Exception:
        return rest, None  # 非法 JSON：当没提议（对白保留）
    if not isinstance(cand, dict) or not str(cand.get('title', '')).strip() or not str(cand.get('need', '')).strip():
        return rest, None
    gap = {k: str(cand.get(k, '')).strip()[:1200] for k in _CAPGAP_FIELDS}
    return rest, gap

def _capgap_file() -> Path:
    return APOLLO_DIR / 'cap-gaps.jsonl'  # APOLLO_DIR 定义在后文——调用期取（模块序无碍）

def _capgap_record(slug: str, role: str, gap: dict) -> dict:
    entry = {'id': f'gap-{int(time.time())}-{slug}', 'slug': slug, 'role': role, 'at': _now_iso(),
             'status': 'open', **gap}
    f_path = _capgap_file()
    f_path.parent.mkdir(parents=True, exist_ok=True)
    with f_path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    return entry

def handle_capgaps_list(n: int = 50) -> dict:
    f_path = _capgap_file()
    if not f_path.is_file():
        return {'success': True, 'gaps': []}
    try:
        lines = f_path.read_text('utf-8').strip().splitlines()
    except Exception:
        return {'success': True, 'gaps': []}
    gaps = []
    for ln in lines[-max(1, min(n, 200)):]:
        try:
            gaps.append(json.loads(ln))
        except Exception:
            continue
    return {'success': True, 'gaps': list(reversed(gaps))}

# ── art-ops 协议（owner 07-12「工作流要重新设计」——美术 agent 从只会建议到能出手）────
# 美术角色用 ```art-ops 围栏提议操作清单（JSON 数组·regen/batch/replace 三式），服务端只校验形状
# 回 artOps 字段——**绝不代执行**：壳出「美术操作提议」卡，用户 ✔ 确认后逐条调既有 /api/art/* 端点。
_ART_OPS_RE = re.compile(r'```art-ops[ \t]*\n(.*?)```', re.S)
_ART_OPS_KINDS = ('regen', 'batch', 'replace')
_ART_NO_OPS_RE = re.compile(r'art-\d{2,3}')

def _split_art_ops(text: str):
    """回复文本 → (剩余文本, ops 列表|None)。只认 ```art-ops 围栏内合法 JSON 数组（≤10 条）。"""
    m = _ART_OPS_RE.search(text or '')
    if not m:
        return (text or '').strip(), None
    rest = (text[:m.start()] + text[m.end():]).strip()
    try:
        cand = json.loads(m.group(1))
    except Exception:
        return rest, None
    if not isinstance(cand, list) or not cand:
        return rest, None
    ops = []
    for o in cand[:10]:
        if not isinstance(o, dict) or o.get('op') not in _ART_OPS_KINDS:
            continue
        entry = {'op': o['op']}
        if o['op'] == 'regen':
            no = str(o.get('no', '')).strip()
            if not _ART_NO_OPS_RE.fullmatch(no):
                continue
            entry['no'] = no
            q = o.get('query')
            if isinstance(q, str) and q.strip():
                entry['query'] = q.strip()[:300]
        pk = o.get('packId')
        if isinstance(pk, str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', pk):
            entry['packId'] = pk
        ops.append(entry)
    return rest, (ops or None)
