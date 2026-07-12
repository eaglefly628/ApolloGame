"""素材库虚拟分组。"""
import json
from pathlib import Path

from .sysutil import APOLLO_DIR

# ── 素材库虚拟分组（owner 07-12「拖拽分组·虚拟层级·不动真目录」）────────────────
# 纯工作台状态（gitignored）：{groups:[{id,name,items:[assetId…]}]}。素材本体一动不动——
# 分组只是收藏夹式的引用列表，同一素材可进多组、删组不删素材。
_MATLIB_GROUPS_FILE = None  # 延迟求值（APOLLO_DIR 定义在后文）

def _matlib_groups_file() -> Path:
    return APOLLO_DIR / 'matlib-groups.json'

def handle_matlib_groups_get() -> dict:
    f = _matlib_groups_file()
    if not f.is_file():
        return {'success': True, 'groups': []}
    try:
        d = json.loads(f.read_text('utf-8'))
        g = d.get('groups') if isinstance(d, dict) else None
        return {'success': True, 'groups': g if isinstance(g, list) else []}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_matlib_groups_put(body: dict) -> dict:
    groups = body.get('groups')
    if not isinstance(groups, list) or len(groups) > 200:
        return {'success': False, 'error': 'groups 必须是数组（≤200 组）'}
    clean = []
    for g in groups:
        if not isinstance(g, dict):
            return {'success': False, 'error': '每组必须是 {id, name, items}'}
        name = str(g.get('name', '')).strip()[:40]
        gid = str(g.get('id', '')).strip()[:40]
        items = g.get('items')
        if not name or not gid or not isinstance(items, list) or len(items) > 10000:
            return {'success': False, 'error': '组要有 id/name·items ≤10000'}
        clean.append({'id': gid, 'name': name,
                      'items': [str(i)[:200] for i in items if isinstance(i, str) and i.strip()]})
    f = _matlib_groups_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps({'version': 1, 'groups': clean}, ensure_ascii=False, indent=1), 'utf-8')
    return {'success': True, 'count': len(clean)}
