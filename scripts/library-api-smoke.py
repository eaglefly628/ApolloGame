#!/usr/bin/env python3
"""创作台 v1 库地基 —— apollo.py 库端点冒烟测试。

起 API 服务（进程内，随机空闲端口）→ create → GET 列表/manifest → PUT 合法/非法
→ history → rollback → 路径穿越（`..`）必须 4xx → 清理。任一步失败 exit 1。

用法：python3 scripts/library-api-smoke.py
"""
import sys
import os
import json
import socket
import shutil
import http.client
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0
CREATED = []  # 待清理的 slug


def _free_port() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def req(method: str, raw_path: str, body=None):
    """用 http.client 发原始路径（不做 urllib 的 `..` 归一化，才能真测穿越）。"""
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=180)
    data = json.dumps(body) if body is not None else None
    conn.request(method, raw_path, body=data, headers={'Content-Type': 'application/json'})
    resp = conn.getresponse()
    txt = resp.read().decode()
    conn.close()
    try:
        parsed = json.loads(txt) if txt else {}
    except Exception:
        parsed = {'_raw': txt}
    return resp.status, parsed


def check(label: str, cond: bool, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ok   {label}')
    else:
        FAIL += 1
        print(f'  FAIL {label}  {detail}')


VALID = {
    'capabilities': ['a1-transform', 'b1-velocity', 'c1-shape', 'l2-color'],
    'entities': {
        'ball': {
            'Transform': {'x': 320, 'y': 60, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
            'Velocity': {'vx': 2, 'vy': 0, 'angular': 0},
            'Shape': {'kind': 'circle', 'radius': 12},
            'Color': {'tint': 4886754, 'alpha': 1},
        },
    },
}
# Transform.x 声明为 number，给字符串 → 引擎 parseManifest 判 error → PUT 应 400。
INVALID = {
    'capabilities': ['a1-transform', 'c1-shape'],
    'entities': {'ball': {'Transform': {'x': 'NOPE', 'y': 60, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'circle', 'radius': 12}}},
}

print(f'[smoke] library API on :{PORT}  git={"yes" if apollo._git_ok() else "no (snapshot fallback)"}')

# 1) create
st, d = req('POST', '/api/library/create', {'name': 'Smoke Test Game!!', 'template': 'pong'})
check('create → 200 + slug', st == 200 and d.get('success') and d.get('slug'), f'{st} {d}')
slug = d.get('slug')
if slug:
    CREATED.append(slug)
print(f'       slug={slug}  versioned={d.get("versioned")}')

# 2) list contains it
st, d = req('GET', '/api/library')
check('GET /api/library 含新游戏', st == 200 and any(g.get('slug') == slug and g.get('valid') for g in d),
      f'{st} {d}')

# 3) get manifest (pong preset copied in)
st, d = req('GET', f'/api/library/{slug}/manifest')
check('GET manifest → 200 + entities', st == 200 and isinstance(d.get('entities'), dict) and d['entities'],
      f'{st} {str(d)[:120]}')

# 4) PUT valid → 200
st, d = req('PUT', f'/api/library/{slug}/manifest', {'manifest': VALID, 'note': 'smoke valid save'})
check('PUT 合法 manifest → 200', st == 200 and d.get('success'), f'{st} {d}')

# 5) PUT invalid → 400 with error text
st, d = req('PUT', f'/api/library/{slug}/manifest', {'manifest': INVALID, 'note': 'should reject'})
check('PUT 非法 manifest → 400 + 错误文本', st == 400 and not d.get('success') and 'Transform.x' in str(d.get('error', '')),
      f'{st} {d}')

# 5b) manifest on disk unchanged after rejected PUT (still VALID's ball with numeric x)
st, d = req('GET', f'/api/library/{slug}/manifest')
check('非法 PUT 未污染磁盘', st == 200 and d['entities']['ball']['Transform']['x'] == 320, f'{st} {str(d)[:120]}')

# 6) history has >= 2 revs (create + valid put)
st, d = req('GET', f'/api/library/{slug}/history')
entries = d.get('entries', [])
check('GET history → >=2 版本', st == 200 and len(entries) >= 2, f'{st} mode={d.get("mode")} n={len(entries)}')
first_rev = entries[-1]['rev'] if entries else None  # 最旧 = create

# 7) rollback to oldest rev
st, d = req('POST', f'/api/library/{slug}/rollback', {'rev': first_rev})
check('rollback 到首版 → 200', st == 200 and d.get('success'), f'{st} {d}')

# 8) path traversal — literal `..` segment must 4xx and never leak files
for bad in [f'/api/library/../{slug}/manifest', '/api/library/..%2Fapollo.py/manifest']:
    st, d = req('GET', bad)
    check(f'穿越防护 {bad} → 4xx', 400 <= st < 500, f'{st} {str(d)[:80]}')
# PUT 穿越也须挡
st, d = req('PUT', '/api/library/../evil/manifest', {'manifest': VALID})
check('PUT 穿越 `..` → 4xx', 400 <= st < 500, f'{st} {str(d)[:80]}')

# 9) create missing name → 400
st, d = req('POST', '/api/library/create', {'template': 'pong'})
check('create 缺 name → 400', st == 400 and not d.get('success'), f'{st} {d}')

# 10) install-sample
st, d = req('POST', '/api/library/install-sample', {'preset': 'platformer'})
check('install-sample → 200', st == 200 and d.get('success') and d.get('slug'), f'{st} {d}')
if d.get('slug'):
    CREATED.append(d['slug'])

# 11) unknown game → 404
st, d = req('GET', '/api/library/no-such-game-xyz/manifest')
check('未知游戏 → 404', st == 404, f'{st} {d}')

# ── 清理 ──
for s in CREATED:
    try:
        shutil.rmtree(apollo.LIBRARY_DIR / s)
    except Exception as e:
        print(f'  warn cleanup {s}: {e}')
# 若 library/ 空了顺手删掉
try:
    if apollo.LIBRARY_DIR.exists() and not any(apollo.LIBRARY_DIR.iterdir()):
        apollo.LIBRARY_DIR.rmdir()
except Exception:
    pass

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
