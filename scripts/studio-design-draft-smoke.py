#!/usr/bin/env python3
"""创作台 · 设计草稿持久化后端冒烟（无需 API key·进程内起 API 打真 HTTP）。

覆盖 BUG-STUDIO-设计中间态丢失 的第一必达项——草稿 CRUD 生命周期：
  未定名 PUT → 落 .apollo/design-drafts/<id>.json（不进 library）→ GET 列表/按 id 取全量 →
  定名（建库后带 slug）再 PUT → 迁移到 library/<slug>/design/draft.json + 旧未定名文件被清 →
  DELETE 弃置 → 消失（named 只删 draft.json·卡带本体不动）。
  路径攻击（../、斜杠、超长 id）必 4xx；坏 JSON 草稿文件被列表跳过不炸。
任一步失败 exit 1。用法：python3 scripts/studio-design-draft-smoke.py
"""
import sys
import os
import json
import socket
import shutil
import http.client
from pathlib import Path

os.environ.setdefault('APOLLO_MOCK_LLM', '1')

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0
CREATED_SLUGS = []
CREATED_DRAFT_IDS = []


def _free_port() -> int:
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def _req(method: str, path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=60)
    payload = json.dumps(body) if body is not None else None
    headers = {'Content-Type': 'application/json'} if payload is not None else {}
    conn.request(method, path, body=payload, headers=headers)
    resp = conn.getresponse(); txt = resp.read().decode(); conn.close()
    return resp.status, (json.loads(txt) if txt else {})


def post(path, body): return _req('POST', path, body)
def put(path, body): return _req('PUT', path, body)
def get(path): return _req('GET', path)
def delete(path): return _req('DELETE', path)


def check(label: str, cond: bool, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f'  ok   {label}')
    else:
        FAIL += 1; print(f'  FAIL {label}  {detail}')


print(f'[smoke] design-draft persistence on :{PORT}')

UNNAMED_ID = 'draft-smoke-unnamed'
CREATED_DRAFT_IDS.append(UNNAMED_ID)

# ── 0) 单元：草稿 id 白名单 ─────────────────────────────────────────────
good_ids = ['abc', 'd-123-xyz', 'A1_b2-c3', 'x' * 64]
bad_ids = ['', '..', '../evil', 'a/b', 'a b', 'a.json', '-lead', 'x' * 65, 'zh中文']
check('draft-id 白名单：合法全过', all(apollo._valid_draft_id(i) for i in good_ids),
      [i for i in good_ids if not apollo._valid_draft_id(i)])
check('draft-id 白名单：攻击/非法全拒', all(not apollo._valid_draft_id(i) for i in bad_ids),
      [i for i in bad_ids if apollo._valid_draft_id(i)])

# ── 1) 空列表 ──────────────────────────────────────────────────────────
st, d = get('/api/design-drafts')
before_ids = {x.get('id') for x in d.get('drafts', [])}
check('GET /api/design-drafts → {drafts:[...]}', st == 200 and isinstance(d.get('drafts'), list), f'{st} {d}')

# ── 2) 未定名草稿 PUT → 落 .apollo/design-drafts/<id>.json（不进 library）──
draft = {
    'phase': 'chat',
    'ready': False,
    'name': '骰子对决草稿',
    'provider': 'deepseek',
    'messages': [
        {'role': 'user', 'content': '我想做个两人投骰子比大小的游戏'},
        {'role': 'assistant', 'content': '核心循环是什么？'},
    ],
    'files': {},
}
st, d = put(f'/api/design-drafts/{UNNAMED_ID}', draft)
check('未定名 PUT → success + location=unnamed', st == 200 and d.get('success') and d.get('location') == 'unnamed', f'{st} {d}')
check('未定名 PUT → updatedAt 盖章', bool(d.get('updatedAt')), f'{d}')
unnamed_path = apollo.DRAFTS_DIR / f'{UNNAMED_ID}.json'
check('落盘 .apollo/design-drafts/<id>.json 存在', unnamed_path.is_file(), str(unnamed_path))
disk = json.loads(unnamed_path.read_text(encoding='utf-8')) if unnamed_path.is_file() else {}
check('落盘内容含 messages/phase/name（白名单字段）',
      disk.get('phase') == 'chat' and len(disk.get('messages', [])) == 2 and disk.get('name') == '骰子对决草稿', f'{disk}')
check('落盘 slug=None（未定名）', disk.get('slug') is None, f'{disk.get("slug")}')

# 未定名不得污染 library
st, lib = get('/api/library')
check('未定名草稿不进 library 列表', all(x.get('slug') != UNNAMED_ID for x in lib), f'{[x.get("slug") for x in lib]}')

# ── 3) GET 列表含它 + 摘要形状；GET 按 id 取全量 ─────────────────────────
st, d = get('/api/design-drafts')
row = next((x for x in d.get('drafts', []) if x.get('id') == UNNAMED_ID), None)
check('列表含未定名草稿', bool(row), f'{d}')
check('摘要含 turns/phase/updatedAt（不回全量 messages）',
      bool(row) and row.get('turns') == 1 and row.get('phase') == 'chat' and 'messages' not in row, f'{row}')

st, d = get(f'/api/design-drafts/{UNNAMED_ID}')
check('GET by id → success + 全量 draft', st == 200 and d.get('success') and isinstance(d.get('draft'), dict), f'{st} {str(d)[:100]}')
check('全量 draft 有 2 条 messages（一键恢复可用）', len(d.get('draft', {}).get('messages', [])) == 2, f'{d.get("draft")}')

# ── 4) 定名：建库 → 带 slug 再 PUT → 迁移到 library/<slug>/design/draft.json ──
st, cr = post('/api/library/create', {'name': 'Draft Smoke Game'})
slug = cr.get('slug')
if slug:
    CREATED_SLUGS.append(slug)
check('建库成功（拿到 slug）', st == 200 and bool(slug), f'{st} {cr}')

named = dict(draft)
named['slug'] = slug
named['phase'] = 'design'
named['files'] = {'pitch.md': '# 骰子对决\n两人比大小'}
st, d = put(f'/api/design-drafts/{UNNAMED_ID}', named)
check('定名 PUT → success + location=named', st == 200 and d.get('success') and d.get('location') == 'named', f'{st} {d}')
named_path = apollo.LIBRARY_DIR / slug / 'design' / 'draft.json'
check('迁移到 library/<slug>/design/draft.json', named_path.is_file(), str(named_path))
check('旧未定名文件被清（迁移·不留双份）', not unnamed_path.exists(), f'{unnamed_path} still exists')

# 列表现在把它算 named（slug 归属该卡带）
st, d = get('/api/design-drafts')
row = next((x for x in d.get('drafts', []) if x.get('id') == UNNAMED_ID), None)
check('列表：草稿现归属 slug（定名）', bool(row) and row.get('slug') == slug and row.get('phase') == 'design', f'{row}')

# GET by id 仍能取到（named 位置）
st, d = get(f'/api/design-drafts/{UNNAMED_ID}')
check('定名后 GET by id 仍取到全量', st == 200 and d.get('success') and d.get('draft', {}).get('slug') == slug, f'{str(d)[:100]}')

# ── 5) 路径攻击必 4xx ───────────────────────────────────────────────────
st, _ = put('/api/design-drafts/..%2f..%2fevil', {'phase': 'chat'})
check('PUT 草稿 ../ 穿越 → 4xx', st >= 400, f'{st}')
st, _ = get('/api/design-drafts/..%2f..%2fetc')
check('GET 草稿 ../ 穿越 → 4xx', st >= 400, f'{st}')
st, _ = delete('/api/design-drafts/..%2f..%2fevil')
check('DELETE 草稿 ../ 穿越 → 4xx', st >= 400, f'{st}')
st, _ = get('/api/design-drafts/' + 'x' * 200)
check('GET 草稿 超长 id → 4xx', st >= 400, f'{st}')

# 不存在的 id → 404
st, _ = get('/api/design-drafts/no-such-draft-xyz')
check('GET 不存在草稿 → 404', st == 404, f'{st}')
st, _ = delete('/api/design-drafts/no-such-draft-xyz')
check('DELETE 不存在草稿 → 404', st == 404, f'{st}')

# ── 6) 坏 JSON 草稿文件不炸列表 ─────────────────────────────────────────
apollo.DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
bad_file = apollo.DRAFTS_DIR / 'draft-smoke-bad.json'
bad_file.write_text('{ not json at all', encoding='utf-8')
st, d = get('/api/design-drafts')
check('坏 JSON 草稿被列表跳过（不 500）', st == 200 and isinstance(d.get('drafts'), list), f'{st} {str(d)[:80]}')
bad_file.unlink(missing_ok=True)

# ── 7) DELETE 弃置 → 消失（named 只删 draft.json·卡带本体不动）────────────
st, d = delete(f'/api/design-drafts/{UNNAMED_ID}')
check('DELETE named 草稿 → success', st == 200 and d.get('success'), f'{st} {d}')
check('draft.json 已删', not named_path.exists(), f'{named_path} still exists')
check('卡带本体（manifest.json）未被删', (apollo.LIBRARY_DIR / slug / 'manifest.json').is_file(), '卡带被误删')
st, d = get('/api/design-drafts')
check('弃置后列表不再含它', all(x.get('id') != UNNAMED_ID for x in d.get('drafts', [])), f'{d}')

# ── 清理 ────────────────────────────────────────────────────────────────
for s in CREATED_SLUGS:
    shutil.rmtree(ROOT / 'library' / s, ignore_errors=True)
for i in CREATED_DRAFT_IDS:
    (apollo.DRAFTS_DIR / f'{i}.json').unlink(missing_ok=True)

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
