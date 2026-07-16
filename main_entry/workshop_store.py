"""工坊对话持久化底座（session 台账 + 角色闭集）。"""
import json

from .sysutil import ROOT

_AGENT_ROLES = ('gd', 'pe', 'art')

_WORKSHOP_CHATS_DIR = ROOT / '.apollo' / 'workshop-chats'

def _ws_file_load(slug: str) -> dict:
    f = _WORKSHOP_CHATS_DIR / f'{slug}.json'
    try:
        d = json.loads(f.read_text('utf-8'))
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}

def _ws_sessions_save(slug: str, role: str, sid: str, ctx_hash: str) -> None:
    """记该卡带该角色的原生 CC session id + 上次注入的 manifest 指纹（方案 A·resume）。"""
    d = _ws_file_load(slug)
    d.setdefault('version', 1)
    d['slug'] = slug
    d.setdefault('sessions', {})[role] = sid
    d.setdefault('ctxHash', {})[role] = ctx_hash
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), 'utf-8')

def _ws_http_ctx_load(slug: str, role: str) -> dict:
    """HTTP 供应商「开局冻结上下文」读取（token 优化 P1）。无=空 dict。"""
    v = (_ws_file_load(slug).get('httpCtx') or {}).get(role)
    return v if isinstance(v, dict) else {}

def _ws_http_ctx_save(slug: str, role: str, ctx_hash: str, ctx: dict, noted: str) -> None:
    """HTTP 供应商的「开局冻结上下文」（token 优化 P1·与 CC 通道 mf_hash 同范式）：
    hash=冻结版指纹·ctx=冻结四段全文（design/manifest/art/logic）·noted=最近已传达给对话的指纹。
    对话全程 system 用冻结版（前缀稳定→DeepSeek 自动缓存/anthropic 断点全程命中）；
    中途 manifest/底案/logic 变更→末端「更新提示」附最新全文（noted 防重复附）。"""
    d = _ws_file_load(slug)
    d.setdefault('version', 1)
    d['slug'] = slug
    d.setdefault('httpCtx', {})[role] = {'hash': ctx_hash, 'ctx': ctx, 'noted': noted}
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), 'utf-8')
