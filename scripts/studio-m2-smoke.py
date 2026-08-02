#!/usr/bin/env python3
"""创作台 v1 · M2 生成管线冒烟测试（mock provider·无需 API key）。

覆盖 /api/generate 的全链路：mock provider 可见性、autofix 重试（恢复 + 耗尽）、
非 autofix 坏 JSON 即失败、revise 确定性修改。起进程内 API 服务打真 HTTP。任一步失败 exit 1。

用法：python3 scripts/studio-m2-smoke.py
"""
import sys
import os
import json
import socket
import http.client
from pathlib import Path

os.environ['ZEROCRAFT_MOCK_LLM'] = '1'          # 开 mock provider（import 前置）
os.environ.pop('ZEROCRAFT_MOCK_BAD_N', None)    # 坏 JSON 次数由测试逐项直接控 _MOCK_BAD_REMAINING

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0


def _free_port() -> int:
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def post(path: str, body: dict):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=180)
    conn.request('POST', path, body=json.dumps(body), headers={'Content-Type': 'application/json'})
    resp = conn.getresponse(); txt = resp.read().decode(); conn.close()
    return resp.status, (json.loads(txt) if txt else {})


def get(path: str):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=30)
    conn.request('GET', path); resp = conn.getresponse(); txt = resp.read().decode(); conn.close()
    return resp.status, (json.loads(txt) if txt else {})


def check(label: str, cond: bool, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f'  ok   {label}')
    else:
        FAIL += 1; print(f'  FAIL {label}  {detail}')


print(f'[smoke] M2 generate pipeline on :{PORT}  mock_enabled={apollo._mock_enabled()}')

# 0) mock provider 可见（env 开启）
st, d = get('/api/generate/providers')
check('providers 含 mock（env 开）', st == 200 and any(p.get('id') == 'mock' and p.get('available') for p in d), f'{st} {d}')

# 1) autofix 恢复：前 2 次坏 JSON → 第 3 次通过 → attempts=3, fixed_errors=2
apollo._MOCK_BAD_REMAINING = 2
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'create', 'prompt': '做个弹跳小球', 'autofix': True})
check('autofix 恢复 → success', st == 200 and d.get('success'), f'{st} {str(d)[:160]}')
check('autofix 恢复 → attempts=3', d.get('attempts') == 3, f'attempts={d.get("attempts")}')
check('autofix 恢复 → fixed_errors=2', len(d.get('fixed_errors', [])) == 2, f'{d.get("fixed_errors")}')
check('autofix 恢复 → manifest 合法可载', isinstance((d.get('manifest') or {}).get('entities'), dict), f'{str(d.get("manifest"))[:80]}')
good_manifest = d.get('manifest')

# 2) autofix 耗尽：坏 JSON 次数 > 上限 → 3 次仍坏 → 失败 + attempts=3, fixed_errors=3
apollo._MOCK_BAD_REMAINING = 5
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'create', 'prompt': 'x', 'autofix': True})
check('autofix 耗尽 → 失败', st == 200 and not d.get('success'), f'{st} {str(d)[:120]}')
check('autofix 耗尽 → attempts=3', d.get('attempts') == 3, f'attempts={d.get("attempts")}')
check('autofix 耗尽 → fixed_errors=3', len(d.get('fixed_errors', [])) == 3, f'{d.get("fixed_errors")}')
check('autofix 耗尽 → 人话提示', '换个说法' in str(d.get('error', '')), f'{d.get("error")}')

# 3) 非 autofix + 坏 JSON → 即失败（不重试）attempts=1
apollo._MOCK_BAD_REMAINING = 1
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'create', 'prompt': 'x', 'autofix': False})
check('非 autofix 坏 JSON → 即失败 attempts=1', st == 200 and not d.get('success') and d.get('attempts') == 1, f'{st} {str(d)[:120]}')

# 4) revise：确定性小改（首个可见实体 Color.tint → _MOCK_REVISE_TINT）
apollo._MOCK_BAD_REMAINING = 0
current = {'capabilities': good_manifest['capabilities'], 'entities': good_manifest['entities']}
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'revise',
                               'current_manifest': current, 'instruction': '把玩家染成红色', 'autofix': True})
check('revise → success attempts=1', st == 200 and d.get('success') and d.get('attempts') == 1, f'{st} {str(d)[:120]}')
rev = d.get('manifest') or {}
ents = rev.get('entities', {})
# 找回被染色的实体：应有某实体 Color.tint == _MOCK_REVISE_TINT
tinted = [k for k, e in ents.items() if isinstance(e, dict) and isinstance(e.get('Color'), dict)
          and e['Color'].get('tint') == apollo._MOCK_REVISE_TINT]
check('revise → 确定性改了一处 Color.tint', len(tinted) == 1, f'tinted={tinted} tint_expect={apollo._MOCK_REVISE_TINT}')
check('revise → 其余结构不塌（entities 仍在）', len(ents) == len(current['entities']), f'{len(ents)} vs {len(current["entities"])}')

# 5) revise 缺 instruction → 400 语义（success False）
st, d = post('/api/generate', {'provider': 'mock', 'mode': 'revise', 'current_manifest': current, 'autofix': True})
check('revise 缺 instruction → 失败', not d.get('success') and 'instruction' in str(d.get('error', '')), f'{str(d)[:120]}')

# 6) mock 未启用时不可见（子函数级验证：临时关 env）
os.environ['ZEROCRAFT_MOCK_LLM'] = '0'
check('mock 关闭 → get_api_key(mock)=None', apollo.get_api_key('mock') is None)
check('mock 关闭 → providers 不含 mock', not any(p.get('id') == 'mock' for p in apollo.get_available_providers()))
os.environ['ZEROCRAFT_MOCK_LLM'] = '1'

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
