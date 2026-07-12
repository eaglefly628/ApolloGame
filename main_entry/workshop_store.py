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
