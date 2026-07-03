#!/usr/bin/env python3
"""创作台 · 设计先行流后端冒烟（mock provider·无需 API key）。

覆盖：design 端点 CRUD（GET 树 / PUT 单篇 + commit）、路径攻击必 4xx、四模式 mock
（design-chat 两轮后 READY / design-breakdown 落 4 文件含 capability-plan ✅⏳ /
design-revise 改全文 / prototype 出合法 manifest）、breakdown 坏 JSON 重问（autofix 式）、
文件名白名单单元校验、hasDesign 标记。起进程内 API 服务打真 HTTP。任一步失败 exit 1。

用法：python3 scripts/studio-design-smoke.py
"""
import sys
import os
import json
import socket
import shutil
import http.client
from pathlib import Path

os.environ['APOLLO_MOCK_LLM'] = '1'
os.environ.pop('APOLLO_MOCK_BAD_N', None)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0
CREATED_SLUGS = []


def _free_port() -> int:
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def _req(method: str, path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=180)
    payload = json.dumps(body) if body is not None else None
    headers = {'Content-Type': 'application/json'} if payload is not None else {}
    conn.request(method, path, body=payload, headers=headers)
    resp = conn.getresponse(); txt = resp.read().decode(); conn.close()
    return resp.status, (json.loads(txt) if txt else {})


def post(path, body): return _req('POST', path, body)
def put(path, body): return _req('PUT', path, body)
def get(path): return _req('GET', path)


def check(label: str, cond: bool, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f'  ok   {label}')
    else:
        FAIL += 1; print(f'  FAIL {label}  {detail}')


print(f'[smoke] design-first flow on :{PORT}  mock_enabled={apollo._mock_enabled()}')

# ── 0) 单元：_valid_design_relpath 路径白名单 ──────────────────────────
good = ['pitch.md', 'content.md', 'capability-plan.md', 'systems/dice.md', 'systems/a-b_c.md']
bad = ['', 'pitch.txt', '../evil.md', 'systems/../../etc/passwd', 'a/b/c.md', 'foo/bar.md',
       '/abs.md', 'systems/', 'systems/x.txt', 'pi tch.md', 'systems/中文.md']
check('relpath 白名单：合法全过', all(apollo._valid_design_relpath(r) for r in good),
      [r for r in good if not apollo._valid_design_relpath(r)])
check('relpath 白名单：攻击/非法全拒', all(not apollo._valid_design_relpath(r) for r in bad),
      [r for r in bad if apollo._valid_design_relpath(r)])

# ── 1) 建游戏（design 流的落盘目标） ─────────────────────────────────
st, d = post('/api/library/create', {'name': 'Design Smoke Game'})
slug = d.get('slug')
if slug:
    CREATED_SLUGS.append(slug)
check('建库成功（拿到 slug）', st == 200 and d.get('success') and bool(slug), f'{st} {d}')

# 新库还没 design → hasDesign False
st, lst = get('/api/library')
row = next((x for x in lst if x.get('slug') == slug), None)
check('新库 hasDesign=False', bool(row) and row.get('hasDesign') is False, f'{row}')

# 空 design GET → files 空对象
st, d = get(f'/api/library/{slug}/design')
check('空 design GET → {files:{}}', st == 200 and d.get('files') == {}, f'{st} {d}')

# ── 2) design-chat：第一轮不 ready，第二轮 ready ──────────────────────
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-chat',
                               'messages': [{'role': 'user', 'content': '我想做个骰子游戏'}]})
check('design-chat 第一轮 → success 且 ready=False', st == 200 and d.get('success') and d.get('ready') is False,
      f'{st} {str(d)[:120]}')
check('design-chat 第一轮回复不含标记（已剥离）', '[READY_TO_BREAKDOWN]' not in str(d.get('reply', '')), f'{d.get("reply")}')

st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-chat', 'messages': [
    {'role': 'user', 'content': '我想做个骰子游戏'},
    {'role': 'assistant', 'content': '核心循环是什么？'},
    {'role': 'user', 'content': '两人各投一颗骰子比大小，先赢两局者胜'},
]})
check('design-chat 第二轮 → ready=True', st == 200 and d.get('success') and d.get('ready') is True, f'{st} {str(d)[:120]}')
check('design-chat ready 时回复也已剥标记', '[READY_TO_BREAKDOWN]' not in str(d.get('reply', '')), f'{d.get("reply")}')

# design-chat 缺 messages → 失败
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-chat', 'messages': []})
check('design-chat 空 messages → 失败', not d.get('success') and 'messages' in str(d.get('error', '')), f'{str(d)[:120]}')

# ── 3) design-breakdown：落 4 文件（含 capability-plan ✅⏳） ─────────────
discuss = [{'role': 'user', 'content': '骰子比大小'}, {'role': 'assistant', 'content': '好'},
           {'role': 'user', 'content': '先赢两局'}]
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-breakdown',
                               'slug': slug, 'messages': discuss, 'catalog': 'w1-random · t2-dice-roll'})
check('breakdown → success', st == 200 and d.get('success'), f'{st} {str(d)[:160]}')
files = d.get('files') or {}
check('breakdown → 4 文件', len(files) == 4, f'keys={list(files)}')
check('breakdown → 含 pitch/systems/content/capability-plan',
      'pitch.md' in files and 'content.md' in files and 'capability-plan.md' in files
      and any(k.startswith('systems/') for k in files), f'{list(files)}')
cap = files.get('capability-plan.md', '')
check('capability-plan 标 2 现有 ✅（w1-random / t2-dice-roll）',
      'w1-random' in cap and 't2-dice-roll' in cap and cap.count('✅') >= 2, f'{cap[:120]}')
check('capability-plan 标 1 缺口 ⏳', '⏳' in cap, f'{cap[:120]}')
check('breakdown versioned=git（可版本化）', d.get('versioned') in ('git', 'snapshot'), f'{d.get("versioned")}')

# breakdown 后 hasDesign=True
st, lst = get('/api/library')
row = next((x for x in lst if x.get('slug') == slug), None)
check('breakdown 后 hasDesign=True', bool(row) and row.get('hasDesign') is True, f'{row}')

# 磁盘落盘可读回（GET design）
st, d = get(f'/api/library/{slug}/design')
disk = d.get('files') or {}
check('GET design → 磁盘 4 文件读回', st == 200 and len(disk) == 4, f'{list(disk)}')

# design 目录进了 git（history 里出现「design breakdown」提交）
st, h = get(f'/api/library/{slug}/history')
subjects = [e.get('subject') for e in h.get('entries', [])]
check('history 含「design breakdown」提交', 'design breakdown' in subjects, f'{subjects}')

# ── 4) design-revise（改全文，不落盘）→ PUT 落盘 ──────────────────────
orig = disk['pitch.md']
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-revise',
                               'file_path': 'pitch.md', 'current_content': orig,
                               'instruction': '加一句副标题：谁运气好谁赢'})
check('design-revise → success + content', st == 200 and d.get('success') and isinstance(d.get('content'), str), f'{st} {str(d)[:120]}')
revised = d.get('content', '')
check('design-revise 内容确实变了（含修订标记）', revised != orig and '修订' in revised, f'{revised[:120]}')

# PUT 落盘该修订
commits_before = len(subjects)
st, d = put(f'/api/library/{slug}/design/pitch.md', {'content': revised, 'note': '对齐 pitch'})
check('PUT design/pitch.md → success', st == 200 and d.get('success'), f'{st} {str(d)[:120]}')

st, d = get(f'/api/library/{slug}/design')
check('GET design → pitch.md 已更新为修订版', d['files'].get('pitch.md', '').strip() == revised.strip(), f'{d["files"].get("pitch.md","")[:80]}')
st, h = get(f'/api/library/{slug}/history')
check('PUT design → commit 数增（版本化生效）', len(h.get('entries', [])) > commits_before, f'{len(h.get("entries", []))} vs {commits_before}')

# PUT 到 systems/ 子目录也行
st, d = put(f'/api/library/{slug}/design/systems/new-sys.md', {'content': '# 新系统\n占位', 'note': '加系统'})
check('PUT design/systems/new-sys.md → success', st == 200 and d.get('success'), f'{st} {str(d)[:120]}')

# ── 5) 路径攻击必 4xx ────────────────────────────────────────────────
st, d = put(f'/api/library/{slug}/design/../../evil.md', {'content': 'x'})
check('PUT design 路径穿越（../../evil.md）→ 4xx', st >= 400, f'{st} {str(d)[:80]}')
st, d = put(f'/api/library/{slug}/design/systems/../../../etc/passwd', {'content': 'x'})
check('PUT design 深穿越（systems/../../../）→ 4xx', st >= 400, f'{st} {str(d)[:80]}')
st, d = put(f'/api/library/{slug}/design/notes.txt', {'content': 'x'})
check('PUT design 非 .md（notes.txt）→ 4xx', st >= 400, f'{st} {str(d)[:80]}')
st, d = put(f'/api/library/{slug}/design/a/b/deep.md', {'content': 'x'})
check('PUT design 超深路径（a/b/deep.md）→ 4xx', st >= 400, f'{st} {str(d)[:80]}')
st, d = put('/api/library/..%2f..%2fescape/design/pitch.md', {'content': 'x'})
check('PUT design 非法 slug（..%2f）→ 4xx', st >= 400, f'{st} {str(d)[:80]}')

# ── 6) 文件名白名单：breakdown 坏形状被 _parse_design_files 拒 ──────────
ok, _ = apollo._parse_design_files(json.dumps({'files': {'evil.txt': 'x', 'pitch.md': 'y'}}))
check('_parse_design_files 拒非 .md 键', not ok)
ok, _ = apollo._parse_design_files(json.dumps({'files': {'systems/x.md': 'a'}}))
check('_parse_design_files 拒缺 pitch/capability-plan', not ok)
ok, _ = apollo._parse_design_files('not json at all')
check('_parse_design_files 拒非 JSON', not ok)
ok, res = apollo._parse_design_files(json.dumps({'files': {'pitch.md': 'p', 'capability-plan.md': 'c'}}))
check('_parse_design_files 收合法最小集', ok and set(res) == {'pitch.md', 'capability-plan.md'})

# ── 7) breakdown 坏 JSON 重问（autofix 式 ≤3 次） ─────────────────────
apollo._MOCK_BAD_REMAINING = 2
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-breakdown',
                               'slug': slug, 'messages': discuss, 'catalog': 'cat'})
check('breakdown 坏2次→第3次通过（attempts=3）', st == 200 and d.get('success') and d.get('attempts') == 3, f'{st} attempts={d.get("attempts")} {str(d)[:100]}')
check('breakdown 重问 fixed_errors=2', len(d.get('fixed_errors', [])) == 2, f'{d.get("fixed_errors")}')

apollo._MOCK_BAD_REMAINING = 5
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'design-breakdown',
                               'slug': slug, 'messages': discuss, 'catalog': 'cat'})
check('breakdown 坏满3次→失败（人话）', st == 200 and not d.get('success') and '换个说法' in str(d.get('error', '')), f'{str(d)[:120]}')
apollo._MOCK_BAD_REMAINING = 0

# ── 8) prototype：design 全文 → 合法 manifest（走硬校验回路） ────────────
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'prototype', 'slug': slug, 'catalog': 'cat'})
check('prototype → success + manifest', st == 200 and d.get('success') and isinstance((d.get('manifest') or {}).get('entities'), dict), f'{st} {str(d)[:140]}')

# prototype 坏 JSON 也走 autofix
apollo._MOCK_BAD_REMAINING = 2
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'prototype', 'slug': slug, 'catalog': 'cat'})
check('prototype 坏2次→第3次通过（attempts=3）', st == 200 and d.get('success') and d.get('attempts') == 3, f'attempts={d.get("attempts")}')
apollo._MOCK_BAD_REMAINING = 0

# prototype 缺 design → 失败（新建一个空库）
st, d2 = post('/api/library/create', {'name': 'Empty Design Game'})
empty_slug = d2.get('slug')
if empty_slug:
    CREATED_SLUGS.append(empty_slug)
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'prototype', 'slug': empty_slug, 'catalog': 'cat'})
check('prototype 无 design → 失败（引导先分解）', not d.get('success') and 'design' in str(d.get('error', '')), f'{str(d)[:120]}')

# ── 9) 不存在的 slug → 404 ───────────────────────────────────────────
st, d = get('/api/library/nope-nope/design')
check('GET design 不存在游戏 → 404', st == 404, f'{st}')

# ── 清理造的库数据 ───────────────────────────────────────────────────
for s in CREATED_SLUGS:
    shutil.rmtree(ROOT / 'library' / s, ignore_errors=True)

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
