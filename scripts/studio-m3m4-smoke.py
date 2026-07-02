#!/usr/bin/env python3
"""创作台 v1 · M3+M4 冒烟测试（设置页 BYO key + 卡带体检 · mock provider·无需真 key）。

覆盖：
  M3 settings — PUT 写 → GET 打码回显（绝不回原文） → get_api_key 优先级 config>env（设假 env 对照）
                → POST /api/settings/test（mock ok / 未配置 provider 报错）
  M4 bench    — install-sample 出一盘 → POST /api/library/<slug>/bench 出五轴分（score 合理）
  安全        — .apollo-config.json 被 git 忽略

起进程内 API 服务打真 HTTP。任一步失败 exit 1。造的库数据 + config 结束清理。
用法：python3 scripts/studio-m3m4-smoke.py
"""
import sys
import os
import json
import socket
import shutil
import subprocess
import http.client
from pathlib import Path

os.environ['APOLLO_MOCK_LLM'] = '1'  # 开 mock provider（import 前置·供 test 端点 ok）

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0
CREATED = []  # 待清理 slug
CONFIG_PATH = apollo.CONFIG_PATH
CONFIG_BACKUP = CONFIG_PATH.read_bytes() if CONFIG_PATH.exists() else None  # 有则备份还原


def _free_port() -> int:
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = _free_port()
apollo.API_PORT = PORT
# 干净起点：清掉可能存在的 config（跑完还原备份）。
if CONFIG_PATH.exists():
    CONFIG_PATH.unlink()
apollo._CONFIG_CACHE = None
apollo.start_api_server()


def req(method: str, path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=120)
    data = json.dumps(body) if body is not None else None
    conn.request(method, path, body=data, headers={'Content-Type': 'application/json'})
    resp = conn.getresponse(); txt = resp.read().decode(); conn.close()
    try:
        parsed = json.loads(txt) if txt else {}
    except Exception:
        parsed = {'_raw': txt}
    return resp.status, parsed


def check(label: str, cond: bool, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f'  ok   {label}')
    else:
        FAIL += 1; print(f'  FAIL {label}  {detail}')


print(f'[smoke] M3/M4 settings+bench on :{PORT}  mock={apollo._mock_enabled()}')

# ─────────────────────────  M3 设置页  ─────────────────────────
# 0) GET 空配置 → provider 顺序千问第一，mock 在（env 开）
st, d = req('GET', '/api/settings')
ids = [p['id'] for p in d.get('providers', [])]
check('GET settings → 200', st == 200 and isinstance(d.get('providers'), list), f'{st} {str(d)[:120]}')
check('provider 顺序：千问(qwen)第一', ids[:1] == ['qwen'], f'ids={ids}')
check('provider 含 ollama(local·免 key)', 'local' in ids, f'ids={ids}')
check('mock provider 可见（env 开）', 'mock' in ids, f'ids={ids}')
qwen0 = next((p for p in d['providers'] if p['id'] == 'qwen'), {})
check('空配置下 qwen 未配置 key', not qwen0.get('hasConfigKey') and qwen0.get('apiKeyMasked') == '', f'{qwen0}')

# 1) 设个假 env 作优先级对照（config 应盖 env）
os.environ['DASHSCOPE_API_KEY'] = 'ENV-qwen-should-be-overridden'
check('对照：仅 env 时 get_api_key(qwen)=env', apollo.get_api_key('qwen') == 'ENV-qwen-should-be-overridden')

# 2) PUT 写 qwen config key + model
st, d = req('PUT', '/api/settings', {'providers': {'qwen': {'apiKey': 'CONFIG-qwen-secret-KEY-1234', 'model': 'qwen-plus'}}, 'default': 'qwen'})
check('PUT settings → 200 success', st == 200 and d.get('success'), f'{st} {str(d)[:120]}')
qwen1 = next((p for p in d.get('providers', []) if p['id'] == 'qwen'), {})
check('PUT 回显：hasConfigKey + model 生效 + default', qwen1.get('hasConfigKey') and qwen1.get('model') == 'qwen-plus' and d.get('default') == 'qwen', f'{qwen1} default={d.get("default")}')

# 3) GET 打码：apiKeyMasked = 前3***尾4，绝不含原文
st, d = req('GET', '/api/settings')
qwen2 = next((p for p in d['providers'] if p['id'] == 'qwen'), {})
masked = qwen2.get('apiKeyMasked', '')
check('GET 打码：apiKeyMasked=前3***尾4', masked == 'CON***1234', f'masked={masked!r}')
check('GET 绝不回传原文 key', 'CONFIG-qwen-secret-KEY-1234' not in json.dumps(d), 'raw key 泄漏！')

# 4) 优先级 config>env：config 已配 → get_api_key 取 config（盖 env）
check('优先级 config>env：取 config key', apollo.get_api_key('qwen') == 'CONFIG-qwen-secret-KEY-1234',
      f'got={apollo.get_api_key("qwen")!r}')

# 5) 未改动该项的 PUT（只送 model）不覆盖 key
st, d = req('PUT', '/api/settings', {'providers': {'qwen': {'model': 'qwen-turbo'}}})
check('model-only PUT 不动 key', apollo.get_api_key('qwen') == 'CONFIG-qwen-secret-KEY-1234',
      f'got={apollo.get_api_key("qwen")!r}')

# 6) test 端点：mock → ok
st, d = req('POST', '/api/settings/test', {'provider': 'mock'})
check('test mock → ok', st == 200 and d.get('ok') is True, f'{st} {d}')

# 7) test 端点：未配置 provider（deepseek 无 key）→ 报错
os.environ.pop('DEEPSEEK_API_KEY', None)
st, d = req('POST', '/api/settings/test', {'provider': 'deepseek'})
check('test 未配置 provider → ok False + 错误文本', st == 200 and d.get('ok') is False and d.get('error'), f'{st} {d}')

# 8) test 端点：未知 provider → 报错
st, d = req('POST', '/api/settings/test', {'provider': 'nope-xyz'})
check('test 未知 provider → ok False', st == 200 and d.get('ok') is False, f'{st} {d}')

# 9) 状态灯增强：config 配了云 key → providers 端点 available=True（M1 只认 env，M3 认 config）
st, d = req('GET', '/api/generate/providers')
qwen_av = next((p for p in d if p['id'] == 'qwen'), {})
check('config 云 key → providers.available=True（状态灯转绿依据）', qwen_av.get('available') is True, f'{qwen_av}')

# ─────────────────────────  M4 体检  ─────────────────────────
# 10) 装一盘 sample → bench 出五轴分
st, d = req('POST', '/api/library/install-sample', {'preset': 'platformer'})
slug = d.get('slug')
check('install-sample → 200 + slug', st == 200 and slug, f'{st} {d}')
if slug:
    CREATED.append(slug)

st, d = req('POST', f'/api/library/{slug}/bench', {})
axes = d.get('axes', [])
axis_names = [a.get('name') for a in axes]
check('bench → 200 success', st == 200 and d.get('success'), f'{st} {str(d)[:160]}')
check('bench → score 合理（0..100 数值）', isinstance(d.get('score'), int) and 0 <= d['score'] <= 100, f'score={d.get("score")}')
check('bench → 五轴齐（Structure/Load/Determinism/Numeric/Visual）',
      axis_names == ['Structure', 'Load', 'Determinism', 'Numeric', 'Visual'], f'axes={axis_names}')
check('bench → sample-platformer 高分（应满分附近·pass=True）', d.get('score', 0) >= 70 and d.get('pass') is True, f'score={d.get("score")} pass={d.get("pass")}')
check('bench → threshold=70', d.get('threshold') == 70, f'threshold={d.get("threshold")}')

# 11) bench 未知游戏 → 404
st, d = req('POST', '/api/library/no-such-game-xyz/bench', {})
check('bench 未知游戏 → 404', st == 404, f'{st} {d}')

# ─────────────────────────  安全  ─────────────────────────
# 12) .apollo-config.json 被 git 忽略
r = subprocess.run(['git', 'check-ignore', '.apollo-config.json'], cwd=ROOT, capture_output=True, encoding='utf-8')
check('.apollo-config.json 被 git 忽略', r.returncode == 0 and '.apollo-config.json' in (r.stdout or ''), f'rc={r.returncode} out={r.stdout!r}')

# ── 清理 ──
os.environ.pop('DASHSCOPE_API_KEY', None)
for s in CREATED:
    try:
        shutil.rmtree(apollo.LIBRARY_DIR / s)
    except Exception as e:
        print(f'  warn cleanup {s}: {e}')
try:
    if apollo.LIBRARY_DIR.exists() and not any(apollo.LIBRARY_DIR.iterdir()):
        apollo.LIBRARY_DIR.rmdir()
except Exception:
    pass
# 还原 config 备份（无备份则删掉冒烟造的 config）
if CONFIG_BACKUP is not None:
    CONFIG_PATH.write_bytes(CONFIG_BACKUP)
elif CONFIG_PATH.exists():
    CONFIG_PATH.unlink()

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
