#!/usr/bin/env python3
"""
Apollo Engine Launcher
=====================
Python 入口，同时启动:
1. Vite 开发服务器（前端）
2. API 服务器（工具命令后端）

用法：python3 apollo.py [命令]
"""

import subprocess
import sys
import os
import signal
import time
import webbrowser
import json
import shutil
import base64
import tempfile
import re
import unicodedata
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.request
import urllib.parse
import socket

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

VITE_PORT = 5173
API_PORT = 4000

# ── 跨平台子进程 ──
# Windows 上 npm/npx/vite 是 .cmd 批处理外壳；subprocess 直传裸名 ['npm', ...] 会让
# CreateProcess 找不到可执行映像 → WinError 2。这里在 Windows 经 shell(cmd.exe 按 PATHEXT
# 解析 .cmd)，POSIX 原样执行（行为不变）。所有 npm/npx/git 调用都走它，单点跨平台。
IS_WINDOWS = os.name == 'nt'

def _spawn(cmd: list[str]) -> dict:
    if IS_WINDOWS:
        return {'args': subprocess.list2cmdline(cmd), 'shell': True}
    return {'args': cmd, 'shell': False}

def _git(args: list[str]) -> str:
    """跑 git 并**强制 UTF-8 解码**。Windows 上 subprocess.getoutput / text=True 默认按系统
    ANSI 码页（中文系统=GBK）解码——但 git 输出的中文提交信息是 UTF-8，遇 0x80 之类字节即
    UnicodeDecodeError，曾击穿 /status 的 API 线程。这里显式 utf-8 + errors='replace' 单点根治。
    git 是真 .exe（非 .cmd），无需走 shell。"""
    try:
        r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True,
                           encoding='utf-8', errors='replace', timeout=10)
        return r.stdout.strip()
    except Exception:
        return ''

# ── 颜色输出 ──

def c(text, color):
    colors = {'r': '31', 'g': '32', 'y': '33', 'b': '34', 'm': '35', 'c': '36', 'w': '37', 'dim': '90'}
    return f"\033[{colors.get(color, '0')}m{text}\033[0m"

def banner():
    print()
    print(c("  ╔══════════════════════════════════════╗", 'c'))
    print(c("  ║", 'c') + c("     APOLLO ENGINE LAUNCHER v0.2     ", 'w') + c("║", 'c'))
    print(c("  ║", 'c') + c("     ECS Game Engine · 26 Atoms      ", 'dim') + c("║", 'c'))
    print(c("  ╚══════════════════════════════════════╝", 'c'))
    print()

# ── 进程管理 ──

_processes: list[subprocess.Popen] = []

def _cleanup(sig=None, frame=None):
    print(c("\n  [SHUTDOWN]", 'y'), "Stopping all services...")
    for p in _processes:
        try:
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            p.kill()
    sys.exit(0)

signal.signal(signal.SIGINT, _cleanup)
signal.signal(signal.SIGTERM, _cleanup)

# ── 环境检查 ──

def _missing_deps() -> list[str]:
    """node_modules 里缺哪些 package.json 声明的 dependencies（含 scoped 如 @types/three）。
    check_env 原来只看 node_modules 在不在——但 git pull 新增依赖（如 three/cannon-es）后，旧的
    node_modules 仍在→不重装→Vite 一堵 'could not be resolved' 墙。这里逐个核对，且**读
    package.json 而非硬编码依赖名**，未来加依赖自动覆盖。返回 ['<all>'] 表示 node_modules 整个缺。"""
    nm = ROOT / 'node_modules'
    if not nm.exists():
        return ['<all>']
    try:
        pkg = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    except Exception:
        return []
    deps = list(pkg.get('dependencies', {}).keys())
    return [d for d in deps if not (nm / Path(d)).exists()]

def check_env():
    if not shutil.which('npm') or not shutil.which('node'):
        print(c("  [ERROR]", 'r'), "npm/node not found.")
        sys.exit(1)
    missing = _missing_deps()
    if missing == ['<all>']:
        # 全新 clone：node_modules 整个没有 → 装一次（装完就有，天然不会每次重复）。
        print(c("  [SETUP]", 'y'), "Installing dependencies…（首次 clone）")
        subprocess.call(**_spawn(['npm', 'install']), cwd=ROOT)
    elif missing:
        # node_modules 在、只缺个别依赖（多半 git pull 新增依赖后没重装）。**只告警、绝不自动装**：
        # 每次启动都自动 npm install 有两宗罪——① 装不动的机器（受限网络/离线）上会退化成"每次启动空跑
        # 一遍 npm install"、每次多等好几秒；② 就算装得动，npm install 会动 node_modules/lockfile →
        # Vite 判定依赖变了 → 每次启动都把 three/react 重新预打包一遍（再 +1~2s）。这正是"每次启动时间
        # +1"的根。留一行清楚指引、让用户手动补一次即可，之后启动全走 Vite 暖缓存、飞快。
        print(c("  [WARN]", 'y'), f"缺少依赖 {', '.join(missing)} —— 请手动运行 npm install 补齐（package.json 更新后一次即可）")

# ── 项目信息收集 ──

def get_project_status() -> dict:
    branch = _git(['branch', '--show-current'])
    last_commit = _git(['log', '--oneline', '-1'])
    # 跨平台数测试文件（原 find|wc 是 unix-ism，在 Windows 上失效 → 计数恒 0）。
    src_dir = ROOT / 'src'
    test_count = (
        len(list(src_dir.rglob('*.test.ts')) + list(src_dir.rglob('*.test.tsx')))
        if src_dir.exists()
        else 0
    )

    atom_dir = ROOT / 'src' / 'skills' / 'atoms'
    atoms = len([d for d in atom_dir.iterdir() if d.is_dir() and (d / 'index.ts').exists()]) if atom_dir.exists() else 0

    themes_dir = ROOT / 'src' / 'ui' / 'themes'
    themes = [d.name for d in themes_dir.iterdir() if d.is_dir() and (d / 'spec.md').exists()] if themes_dir.exists() else []

    skills_dir = ROOT / 'wiki' / 'skills'
    skill_count = len(list(skills_dir.glob('*.md'))) if skills_dir.exists() else 0

    games_dir = ROOT / 'docs' / 'game-design'
    games = [f.stem for f in games_dir.glob('*.md')] if games_dir.exists() else []

    return {
        'branch': branch,
        'lastCommit': last_commit,
        'atoms': atoms,
        'testFiles': test_count,
        'themes': themes,
        'skillModules': skill_count,
        'games': games,
    }

def run_command(cmd: list[str], timeout: int = 120) -> dict:
    try:
        result = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True,
                                encoding='utf-8', errors='replace', timeout=timeout)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout[-4000:] if len(result.stdout) > 4000 else result.stdout,
            'stderr': result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr,
            'code': result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {'success': False, 'stdout': '', 'stderr': 'Command timed out', 'code': -1}
    except Exception as e:
        return {'success': False, 'stdout': '', 'stderr': str(e), 'code': -1}

# ── 游戏生成（Claude API / 其他 LLM）──

GAME_GEN_SYSTEM_PROMPT = """You are Apollo Engine's game generator. You create playable 2D games by outputting Assembly blueprints (JSON).

## Output format — a canonical Manifest (JSON ONLY, no markdown, no explanation)

{
  "name": "game name",
  "description": "one line",
  "capabilities": ["a1-transform","b1-velocity", "..."],
  "entities": {
    "entity-id": {
      "Transform": { "x":100,"y":300,"rotation":0,"scaleX":1,"scaleY":1 },
      "Velocity":  { "vx":0,"vy":0,"angular":0 }
    }
  }
}

KEY: `entities` is an OBJECT keyed by entity id; each entity is an OBJECT keyed by component
type (NO "type" field inside the component). `capabilities` lists the engine capability ids to enable.

## Capability catalog — the authoritative vocabulary (ids, component fields, examples)
Enable ONLY ids from this catalog, and use ONLY the components/fields it lists. Each line gives a
capability id, the components it provides (with field signatures), when to use it, and example data
shapes. This catalog is the single source of truth for the vocabulary — do not invent components or
fields, and unknown capability ids are rejected on load.
{CAPABILITY_CATALOG}

## Art assets (optional — use for richer visuals)
- Any Sprite.textureKey may be written as "art:<english keywords>", e.g. "art:skeleton warrior".
- The engine deterministically resolves it against a CC0 32x32 sprite library (4800+ tagged assets); the same query always picks the same sprite. Unresolvable queries fall back to a placeholder, never crash.
- Useful keywords — monsters: undead/skeleton/zombie/demon/dragon/animal/wolf/spider/boss/flying/fire/ice/poison; terrain: floor/wall/grass/lava/water/door/altar/trap; items: sword/axe/bow/armor/shield/potion/book/gold; fx: arrow/bolt/cloud.
- Entities with a Sprite still need a Transform (and a Shape if they collide). If no art fits the theme, use a shape + color instead.

## Rules
- Canvas is 640x400, origin top-left. Include one camera entity centered on the canvas (offsetX 320, offsetY 200) so world coordinates map 1:1 to the screen and entities are visible.
- Keep every entity within 0..640 (x) and 0..400 (y) so it stays on-screen.
- For gravity, apply a small constant downward acceleration per tick (about 0.3-0.8); static bodies such as ground and walls should have zero mass.
- Tint colors are packed as a 0xRRGGBB integer (e.g. red 0xFF0000 == 16711680).

## Minimal Example (bouncing ball + ground)
{"name":"bounce","description":"a ball bounces on the ground","capabilities":["a1-transform","b1-velocity","b2-acceleration","c1-shape","l2-color","d1-overlap-detect","t1-accel-apply","t1-motion-apply","t2-collision-resolve","t2-bounds-clamp"],"entities":{"camera":{"Camera":{"zoom":1,"offsetX":320,"offsetY":200,"rotation":0,"viewportW":640,"viewportH":400}},"ball":{"Transform":{"x":320,"y":60,"rotation":0,"scaleX":1,"scaleY":1},"Velocity":{"vx":2,"vy":0,"angular":0},"Acceleration":{"ax":0,"ay":0.5},"Shape":{"kind":"circle","radius":12},"Color":{"tint":4886754,"alpha":1},"Mass":{"value":1},"Bounds":{"minX":0,"minY":0,"maxX":640,"maxY":400}},"ground":{"Transform":{"x":320,"y":380,"rotation":0,"scaleX":1,"scaleY":1},"Shape":{"kind":"box","width":640,"height":40},"Color":{"tint":3553598,"alpha":1},"Mass":{"value":0}}}}
"""

# 回退能力目录 = **部分应急词汇表**，仅在前端未送 catalog 时兜底；正常路径由 TS 的
# buildCapabilityCatalog 自动派生送来（含全部能力 + 组件字段 + 示例，故 hitbox/prefab/dialogue 等都在）。
# 这 12 条 id 已对照 capability registry 核实存在；不求完整，只保证兜底时也能产出可跑的最小物理游戏。
_FALLBACK_CATALOG = (
    "(Partial fallback vocabulary — the full capability catalog is normally injected by the frontend; "
    "this short list is only a safety net when no catalog was provided.)\n"
    "a1-transform(Transform) · b1-velocity(Velocity) · b2-acceleration(Acceleration) · c1-shape(Shape) · "
    "l2-color(Color) · d1-overlap-detect · t1-accel-apply · t1-motion-apply · t2-collision-resolve · "
    "t2-bounds-clamp(Bounds) · t2-jump · t2-ground-sense"
)

LLM_PROVIDERS = {
    'anthropic': {
        'name': 'Claude (Anthropic)',
        'env_key': 'ANTHROPIC_API_KEY',
        'models': ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    },
    'qwen': {
        'name': 'Qwen (Alibaba DashScope)',
        'env_key': 'DASHSCOPE_API_KEY',
        'models': ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    },
    'openai': {
        'name': 'OpenAI / Compatible',
        'env_key': 'OPENAI_API_KEY',
        'models': ['gpt-4o', 'gpt-4o-mini'],
    },
    'deepseek': {
        'name': 'DeepSeek',
        'env_key': 'DEEPSEEK_API_KEY',
        'models': ['deepseek-chat'],
    },
    'local': {
        'name': 'Local (Ollama)',
        'env_key': '',
        'models': ['llama3', 'qwen2', 'mistral'],
    },
}

# ── Mock provider（测试基建·仅 env 开启时可见）─────────────────────────
# APOLLO_MOCK_LLM=1 → providers 多一个恒 available 的 'mock'：generate 回内置合法 manifest、
# revise 对传入 manifest 做一处确定性小改（改首个实体 Color.tint）、回显完整 JSON。供冒烟/e2e
# 无 API key 可跑全链路。APOLLO_MOCK_BAD_N=<n> → 前 n 次响应回坏 JSON（测服务端 autofix 重试）。
# mock 绝不进默认 providers 列表（无 env 时对生产完全不可见）。
def _mock_enabled() -> bool:
    return os.environ.get('APOLLO_MOCK_LLM', '') in ('1', 'true', 'yes')

# 剩余「坏 JSON」次数（进程级可变状态；autofix 回路每消费一次自减）。
_MOCK_BAD_REMAINING = int(os.environ.get('APOLLO_MOCK_BAD_N') or 0)
# mock 修订用的确定性染色目标（与常见预设色不同 → 测试可断言「确实改了」）。
_MOCK_REVISE_TINT = 0xff0000

# ── BYO-key 配置存储（.apollo-config.json·仓库根·已 gitignore）─────────────
# 结构：{ "providers": { "<id>": { "apiKey"?: str, "model"?: str } }, "default"?: "<id>" }
# key 解析优先级：config > env > .env（get_api_key 据此）。进程内缓存·_save_config 后失效重读。
# 明文存 key 于本地文件——仅本机创作台自用，绝不入引擎仓（.gitignore），GET 回前端一律打码。
CONFIG_PATH = ROOT / '.apollo-config.json'
_CONFIG_CACHE = None  # None=未读；dict=已读缓存。

def _load_config() -> dict:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is None:
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
            _CONFIG_CACHE = data if isinstance(data, dict) else {}
        except Exception:
            _CONFIG_CACHE = {}
    return _CONFIG_CACHE

def _save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    global _CONFIG_CACHE
    _CONFIG_CACHE = None  # 失效缓存，下次读重新加载（PUT 后即时生效）

def _config_provider(pid: str) -> dict:
    p = _load_config().get('providers')
    v = p.get(pid) if isinstance(p, dict) else None
    return v if isinstance(v, dict) else {}

def _config_api_key(pid: str):
    k = _config_provider(pid).get('apiKey')
    return k.strip() if isinstance(k, str) and k.strip() else None

def _config_model(pid: str):
    m = _config_provider(pid).get('model')
    return m if isinstance(m, str) and m.strip() else None

def get_api_key(provider: str) -> str | None:
    if provider == 'mock':
        return 'mock' if _mock_enabled() else None
    # 优先级：config(.apollo-config.json) > env > .env。
    cfg_key = _config_api_key(provider)
    if cfg_key:
        return cfg_key
    info = LLM_PROVIDERS.get(provider, {})
    env_key = info.get('env_key', '')
    if not env_key:
        return 'local'
    key = os.environ.get(env_key, '')
    if not key:
        env_file = ROOT / '.env'
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith(f'{env_key}='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key or None

def get_available_providers() -> list[dict]:
    result = []
    for pid, info in LLM_PROVIDERS.items():
        has_key = get_api_key(pid) is not None
        result.append({
            'id': pid,
            'name': info['name'],
            'models': info['models'],
            'available': has_key,
        })
    if _mock_enabled():
        result.append({'id': 'mock', 'name': 'Mock (test)', 'models': ['mock'], 'available': True})
    return result

def _extract_json(text: str) -> str:
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    return text.strip()

# ── 统一 LLM 传输层（system + messages[{role,content}] → 原始文本）──────────
# generate（单轮）与 autofix（多轮回喂错误）共用一条传输。mock provider 在此短路。
# 各 provider 的 chat 格式差异只在这里消化：anthropic 走独立 system 字段，其余（OpenAI 兼容 /
# Ollama）把 system 折成首条 system message。返回 {success, text} 或 {success:False, error}。
_OPENAI_COMPAT_URLS = {
    'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    'deepseek': 'https://api.deepseek.com/chat/completions',
}

def _provider_request(provider: str, api_key: str, model: str, system: str, messages: list,
                      max_tokens: int = 4096) -> dict:
    if provider == 'mock':
        return _mock_response(system, messages)
    try:
        if provider == 'anthropic':
            url = 'https://api.anthropic.com/v1/messages'
            headers = {'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01'}
            body = json.dumps({'model': model, 'max_tokens': max_tokens, 'system': system, 'messages': messages}).encode()
            fmt, timeout = 'anthropic', 60
        elif provider == 'local':
            url = os.environ.get('OLLAMA_URL', 'http://localhost:11434') + '/api/chat'
            headers = {'Content-Type': 'application/json'}
            body = json.dumps({'model': model, 'stream': False,
                               'messages': [{'role': 'system', 'content': system}, *messages]}).encode()
            fmt, timeout = 'ollama', 120
        else:  # OpenAI 兼容：qwen / deepseek / openai(+兼容端)
            url = _OPENAI_COMPAT_URLS.get(provider) or (
                os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1') + '/chat/completions')
            headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
            body = json.dumps({'model': model, 'max_tokens': max_tokens,
                               'messages': [{'role': 'system', 'content': system}, *messages]}).encode()
            fmt, timeout = 'openai', 60
        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
        if fmt == 'anthropic':
            text = data.get('content', [{}])[0].get('text', '')
        elif fmt == 'ollama':
            text = data.get('message', {}).get('content', '')
        else:
            text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        return {'success': True, 'text': text}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        return {'success': False, 'error': f'API error {e.code}: {err_body[:500]}'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ── Mock 响应（无 key 测试用）──────────────────────────────────────────
def _mock_manifest() -> dict:
    """内置合法 manifest = platformer 预设的规范形态（含 name/description·深拷贝防污染）。"""
    p = PRESET_BLUEPRINTS['platformer']
    return {
        'name': p['name'], 'description': p.get('description', ''),
        'capabilities': list(p['capabilities']),
        'entities': json.loads(json.dumps(p['entities'])),
    }

def _mock_revise(current: dict) -> dict:
    """对传入 manifest 做一处**确定性**小改：优先取首个（按 key 排序）已有 Color 的实体、否则首个实体，
    把其 Color.tint 改成 _MOCK_REVISE_TINT（无 Color 则补一个并确保 l2-color 在 capabilities）。
    回完整 manifest。测试据此断言「确实改了」。"""
    m = json.loads(json.dumps(current)) if isinstance(current, dict) else {'capabilities': [], 'entities': {}}
    entities = m.get('entities')
    if not isinstance(entities, dict) or not entities:
        return _mock_manifest()
    keys = sorted(entities.keys())
    # 优先染一个「可见」（已有 Color）的实体，视觉上更像真的改动，退而求其次取首个。
    target = next((k for k in keys if isinstance(entities[k], dict) and isinstance(entities[k].get('Color'), dict)), keys[0])
    ent = entities[target]
    if isinstance(ent, dict):
        color = ent.get('Color')
        if isinstance(color, dict):
            color['tint'] = _MOCK_REVISE_TINT
        else:
            ent['Color'] = {'tint': _MOCK_REVISE_TINT, 'alpha': 1}
            caps = m.get('capabilities')
            if isinstance(caps, list) and 'l2-color' not in caps:
                caps.append('l2-color')
    return m

def _mock_response(system: str, messages: list) -> dict:
    """按 system 词分流 mock 响应（设计先行流四模式 + 既有 create/revise）：
      · design-chat（system==DESIGN_CHAT_SYSTEM）→ 脚本化对话，第二轮 user 起带 [READY_TO_BREAKDOWN]。
      · design-revise（system==DESIGN_REVISE_SYSTEM）→ 回改过的全文（永远产文本，不受 bad-N 影响）。
      · design-breakdown（system 以 breakdown 头起）→ 固定小 GDD 的 JSON（受 bad-N 影响，测重问）。
      · manifest（create / revise / prototype）→ 内置 manifest；revise 走确定性染色（受 bad-N 影响）。
    _MOCK_BAD_REMAINING>0 时**仅对产 JSON 的模式**先回坏 JSON（每次自减），驱动服务端 autofix / breakdown 重问。"""
    global _MOCK_BAD_REMAINING
    s = system or ''
    # 产文本的两模式：从不注坏 JSON（对它们无意义）。
    if s == DESIGN_CHAT_SYSTEM:
        return {'success': True, 'text': _mock_design_chat(messages)}
    if s == DESIGN_REVISE_SYSTEM:
        return {'success': True, 'text': _mock_design_revise(messages)}
    # 以下皆为产 JSON 的模式：honor bad-N。
    if _MOCK_BAD_REMAINING > 0:
        _MOCK_BAD_REMAINING -= 1
        return {'success': True, 'text': '{ "name": "broken", oops not valid json '}
    if s.startswith(_DESIGN_BREAKDOWN_HEAD):
        return {'success': True, 'text': _mock_breakdown_json()}
    marker = '## Current game manifest'
    revise_src = next((str(m.get('content', '')) for m in messages
                       if m.get('role') == 'user' and marker in str(m.get('content', ''))), None)
    if revise_src is not None:
        try:
            block = revise_src.split(marker, 1)[1].split('## User instruction', 1)[0].strip()
            current = json.loads(_extract_json(block))
        except Exception:
            current = _mock_manifest()
        return {'success': True, 'text': json.dumps(_mock_revise(current), ensure_ascii=False)}
    return {'success': True, 'text': json.dumps(_mock_manifest(), ensure_ascii=False)}

# ── Mock 设计先行流响应（design-chat / design-breakdown / design-revise）────────
def _mock_design_chat(messages: list) -> str:
    """脚本化策划对话：第二轮 user 消息起，末行带 [READY_TO_BREAKDOWN]（前端据此亮「分解」按钮）。"""
    user_turns = sum(1 for m in messages if isinstance(m, dict) and m.get('role') == 'user')
    if user_turns >= 2:
        return ('好，类型与参照物、核心循环、胜负进程、内容规模都聊清楚了——'
                '我会把它分解成 pitch / 系统 / 内容 / 能力总览四份设计稿。\n'
                '[READY_TO_BREAKDOWN]')
    return ('明白了。先锁定核心循环：玩家反复做的那个动作是什么？'
            '（顺带聊聊参照哪些游戏、怎么算赢、大概多少内容量）')

def _mock_breakdown_json() -> str:
    """固定小 GDD（一个「投骰子比大小」系统）：capability-plan 标 2 现有 ✅ + 1 虚构缺口 ⏳。"""
    files = {
        'pitch.md': (
            '# 投骰子比大小\n\n'
            '两名玩家各投一颗骰子，点数大者赢下本回合。先赢 2 回合者获胜。\n\n'
            '参照：吹牛骰 / 大话骰的比点内核，去掉喊注、只留最纯的比大小。\n'),
        'systems/dice-duel.md': (
            '# 系统 · 投骰子比大小\n\n'
            '- 每回合双方各投一颗 1–6 的骰子。\n'
            '- 点数大的一方本回合得 1 分；平局则本回合重投。\n'
            '- 先到 2 分者获胜，回到标题。\n'),
        'content.md': (
            '# 内容规模\n\n'
            '- 1 个对局场景（玩家 vs 简单 AI）。\n'
            '- 目标分数：2。\n'
            '- 无关卡树、无解锁——一局定胜负的最小可玩体。\n'),
        'capability-plan.md': (
            '# 能力总览 capability-plan\n\n'
            '| 系统/规则 | 能力接入 | 状态 |\n'
            '|---|---|---|\n'
            '| 投骰的随机数 | `w1-random`（引擎种子 PRNG，禁裸 Math.random） | ✅ 现有 |\n'
            '| 骰子点数结算 | `t2-dice-roll` | ✅ 现有 |\n'
            '| 三局两胜赛制编排 | `t9-best-of-series`（假想 id） | ⏳ 缺口（现有能力表达不了，待下沉）|\n'),
    }
    return json.dumps({'files': files}, ensure_ascii=False)

def _mock_design_revise(messages: list) -> str:
    """回改过的全文：抽出当前文档正文 + 指令，末尾追加一行确定性「修订」标记（测试据此断言内容变了）。"""
    src = next((str(m.get('content', '')) for m in messages
                if isinstance(m, dict) and m.get('role') == 'user'), '')
    cur, instr = '', ''
    if '## Current document' in src:
        after = src.split('## Current document', 1)[1]
        after = after.split('\n', 1)[1] if '\n' in after else after  # 跳过「(path)」行
        cur = after.split('## Revision instruction', 1)[0].strip()
    if '## Revision instruction' in src:
        instr = src.split('## Revision instruction', 1)[1].split('\n\nOutput', 1)[0].strip()
    body = cur or '# 设计稿'
    return f'{body}\n\n> 修订：{instr or "（细化）"}'

# ── 生成管线：单轮生成 + 服务端 autofix 重试（落地 ai-dev-pipeline §7-5）─────
def _generate_with_autofix(provider: str, api_key: str, model: str, system: str,
                           user_msg: str, autofix: bool, max_attempts: int = 3) -> dict:
    """messages 起于一条 user_msg。每轮：调 LLM → JSON parse →（autofix 时）manifest-check 校验。
    失败把错误文本回喂当作下一轮 user 消息重问，≤max_attempts。传输/网络错误直接返回（不重试网络层）。
    autofix=False：只跑一轮 + 软告警（_validate_blueprint），保持旧 GameCreator 行为不变。"""
    messages = [{'role': 'user', 'content': user_msg}]
    attempts = 0
    fixed_errors: list[str] = []
    limit = max_attempts if autofix else 1
    while attempts < limit:
        attempts += 1
        r = _provider_request(provider, api_key, model, system, messages)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'),
                    'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors}
        text = r['text']
        try:
            manifest = json.loads(_extract_json(text))
        except Exception as e:
            if not autofix:
                return {'success': False, 'error': f'Invalid JSON from LLM: {e}',
                        'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors}
            fixed_errors.append(f'输出不是合法 JSON：{e}')
            messages += [{'role': 'assistant', 'content': text},
                         {'role': 'user', 'content': f'你上次的输出不是合法 JSON（{e}）。只输出完整的 manifest 纯 JSON，不要 markdown 围栏、不要任何解释。'}]
            continue
        if not autofix:
            warnings = _validate_blueprint(manifest)
            return {'success': True, 'error': None, 'blueprint': manifest, 'manifest': manifest,
                    'warnings': warnings, 'attempts': attempts, 'fixed_errors': fixed_errors}
        ok, msg = _run_manifest_check(manifest)
        if ok:
            warnings = _validate_blueprint(manifest)
            return {'success': True, 'error': None, 'blueprint': manifest, 'manifest': manifest,
                    'warnings': warnings, 'attempts': attempts, 'fixed_errors': fixed_errors}
        fixed_errors.append(msg)
        messages += [{'role': 'assistant', 'content': text},
                     {'role': 'user', 'content': f'该 manifest 未通过引擎校验，错误如下：\n{msg}\n请修正并只输出完整的修正后 manifest 纯 JSON。'}]
    return {'success': False, 'error': f'自动修正 {attempts} 次后仍未通过校验，换个说法再试试。',
            'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors,
            'raw_error': fixed_errors[-1] if fixed_errors else None}

# ── 设计先行创作流 · 四模式的引导词（讨论 → 分解 → 对齐 → 原型）─────────────
# 主创作流升级：输入是策划案（或从讨论窗构想对齐）→ AI 分解成 design 目录 → 反复对齐 → 定稿生成原型。
# 渊源=ai-dev-pipeline 六段 [1]Brief[2]Spec 的产品化 + capability-plan 闸门进 To-C 流程。

DESIGN_CHAT_SYSTEM = """You are an experienced game design facilitator. Help a creator turn a rough idea into a concrete, buildable game design through a short conversation. Reply in the creator's language (default 中文). Keep every reply short and concrete.

Guide the discussion to cover FOUR essentials, one focus at a time, asking one sharp follow-up per turn:
1. 类型与参照物 (genre & reference games)
2. 核心循环 (the core loop the player repeats)
3. 胜负与进程 (win/lose conditions & progression)
4. 内容规模 (content scope: how many levels / enemies / cards …)

Do NOT write the design document itself — that is a later step. Only converse to pin down the essentials.
When the four essentials are sufficiently covered, give a one-line summary of what you will break down, then output on a FINAL separate line exactly this marker (nothing after it):
[READY_TO_BREAKDOWN]
Never emit that marker before the essentials are genuinely covered."""

# breakdown 头（mock 据此识别；也是 DESIGN_BREAKDOWN_SYSTEM 的真实开头，务必一致）。
_DESIGN_BREAKDOWN_HEAD = "You are Apollo Engine's game design breakdown generator"
DESIGN_BREAKDOWN_SYSTEM = _DESIGN_BREAKDOWN_HEAD + """. You turn a design discussion (or a pitch) into a small Game Design Document (GDD) as a set of markdown files.

## Output format — STRICT JSON ONLY (no markdown fences, no prose)
{"files": {
  "pitch.md": "<one-paragraph pitch + reference games>",
  "systems/<system-name>.md": "<one file per core system: rules, numbers, states>",
  "content.md": "<content scope: levels / enemies / items counts>",
  "capability-plan.md": "<capability plan, see below>"
}}
Keys MUST be .md filenames; extra systems go under the systems/ subdirectory. Values are the file contents as strings. Always include at least pitch.md and capability-plan.md.

## capability-plan.md — the engine-readiness gate (REQUIRED)
For EACH system/rule in the design, name the engine capability that expresses it, taken ONLY from the capability catalog below, and mark it ✅ 现有 (real id) or ⏳ 缺口 (no existing capability expresses it — a gap to sink into the engine). Use a markdown table. Do NOT invent capabilities as ✅; unknown ones are ⏳ gaps.

## Capability catalog (authoritative capability ids)
{CAPABILITY_CATALOG}
"""

DESIGN_REVISE_SYSTEM = """You are a game design document editor. You are given one markdown design file and a revision instruction. Apply the instruction and output the COMPLETE revised file as markdown. Reply in the file's language. Do NOT wrap the output in code fences and do NOT add any explanation — output only the revised markdown document."""

PROTOTYPE_TASK = """Below is the full Game Design Document (GDD). Read all of it, then output a single Apollo Engine manifest (pure JSON) that is a PLAYABLE FIRST PROTOTYPE of the core loop. It does not need every system — focus on making the core loop visible and runnable. Follow the manifest format and capability catalog rules from the system prompt exactly."""


def _handle_design_chat(provider: str, api_key: str, model: str, body: dict) -> dict:
    """多轮构想讨论（无状态·前端带全 messages）。回复末尾若含 [READY_TO_BREAKDOWN] → ready=True（并从展示文本剥掉标记）。"""
    messages = body.get('messages')
    if not isinstance(messages, list) or not messages:
        return {'success': False, 'error': 'design-chat 需要 messages[]（非空）'}
    msgs = [{'role': m.get('role'), 'content': str(m.get('content', ''))}
            for m in messages if isinstance(m, dict) and m.get('role') in ('user', 'assistant')]
    if not msgs:
        return {'success': False, 'error': 'messages 里没有有效对话轮次'}
    r = _provider_request(provider, api_key, model, DESIGN_CHAT_SYSTEM, msgs)
    if not r.get('success'):
        return {'success': False, 'error': r.get('error', 'LLM 请求失败')}
    text = r['text']
    ready = '[READY_TO_BREAKDOWN]' in text
    reply = text.replace('[READY_TO_BREAKDOWN]', '').strip()
    return {'success': True, 'reply': reply, 'ready': ready}


def _parse_design_files(text: str):
    """校验 breakdown 输出：严格 JSON {files:{path:content}} + 文件名白名单（.md·systems/ 子目录）。
    返回 (True, {rel:content}) 或 (False, 错误文本·供回喂重问)。"""
    try:
        obj = json.loads(_extract_json(text))
    except Exception as e:
        return False, f'输出不是合法 JSON：{e}'
    files = obj.get('files') if isinstance(obj, dict) else None
    if not isinstance(files, dict) or not files:
        return False, '缺少 files 对象（应为 {"files": {"pitch.md": "...", ...}}）'
    clean = {}
    for rel, content in files.items():
        if not _valid_design_relpath(rel):
            return False, f'非法文件名（仅 .md，且只能是顶层或 systems/ 子目录）：{rel!r}'
        if not isinstance(content, str) or not content.strip():
            return False, f'文件内容必须是非空字符串：{rel}'
        clean[rel] = content
    if 'pitch.md' not in clean or 'capability-plan.md' not in clean:
        return False, '至少要包含 pitch.md 与 capability-plan.md'
    return True, clean


def _handle_design_breakdown(provider: str, api_key: str, model: str, body: dict, catalog: str) -> dict:
    """讨论纪要/策划案 → design 目录（一次落盘 + 单个 commit 'design breakdown'）。
    校验（JSON 形状 + 文件名白名单）失败走 autofix 式回喂重问 ≤3 次。前端传 slug（游戏须已建）。"""
    slug = str(body.get('slug') or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': 'design-breakdown 需要合法 slug（先建游戏）'}
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return {'success': False, 'error': f'游戏不存在: {slug}'}
    messages = body.get('messages')
    if not isinstance(messages, list) or not messages:
        return {'success': False, 'error': 'design-breakdown 需要 messages[]（讨论纪要）'}
    transcript = '\n'.join(f'{m.get("role")}: {str(m.get("content", ""))}'
                           for m in messages if isinstance(m, dict) and m.get('role') in ('user', 'assistant'))
    system = DESIGN_BREAKDOWN_SYSTEM.replace('{CAPABILITY_CATALOG}', catalog or _FALLBACK_CATALOG)
    user_msg = '## Design discussion transcript\n' + transcript + '\n\nBreak this down into the GDD files now (STRICT JSON only).'
    msgs = [{'role': 'user', 'content': user_msg}]
    attempts, errors = 0, []
    while attempts < 3:
        attempts += 1
        r = _provider_request(provider, api_key, model, system, msgs)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'), 'attempts': attempts, 'fixed_errors': errors}
        text = r['text']
        ok, res = _parse_design_files(text)
        if ok:
            for rel, content in res.items():
                _write_design_file(game_dir, rel, content)
            _touch_meta(game_dir)
            versioned = _version_save_all(game_dir, 'design breakdown')
            return {'success': True, 'slug': slug, 'files': res, 'attempts': attempts,
                    'fixed_errors': errors, 'versioned': versioned}
        errors.append(res)
        msgs += [{'role': 'assistant', 'content': text},
                 {'role': 'user', 'content': f'你上次的输出有问题：{res}\n只输出严格 JSON：{{"files": {{"pitch.md": "...", "systems/xxx.md": "...", "content.md": "...", "capability-plan.md": "..."}}}}，不要 markdown 围栏、不要解释。'}]
    return {'success': False, 'error': f'分解 {attempts} 次后仍未通过校验，换个说法再试试。',
            'attempts': attempts, 'fixed_errors': errors, 'raw_error': errors[-1] if errors else None}


def _handle_design_revise(provider: str, api_key: str, model: str, body: dict) -> dict:
    """单篇 design 文档修订：{file_path, current_content, instruction} → 修订全文（不落盘，前端拿到再 PUT）。"""
    file_path = str(body.get('file_path') or '').strip()
    current = body.get('current_content')
    instruction = str(body.get('instruction') or '').strip()
    if not _valid_design_relpath(file_path):
        return {'success': False, 'error': f'非法 design 文件名: {file_path!r}'}
    if not isinstance(current, str):
        return {'success': False, 'error': 'design-revise 需要 current_content（字符串）'}
    if not instruction:
        return {'success': False, 'error': 'design-revise 需要 instruction（非空）'}
    user_msg = (f'## Current document ({file_path})\n{current}\n\n'
                f'## Revision instruction\n{instruction}\n\n'
                'Output the COMPLETE revised document as markdown (no code fences, no explanation).')
    r = _provider_request(provider, api_key, model, DESIGN_REVISE_SYSTEM, [{'role': 'user', 'content': user_msg}])
    if not r.get('success'):
        return {'success': False, 'error': r.get('error', 'LLM 请求失败')}
    return {'success': True, 'file_path': file_path, 'content': _strip_fence(r['text'])}


def _handle_prototype(provider: str, api_key: str, model: str, body: dict, system: str) -> dict:
    """design 全文（服务端从磁盘读该 slug 的 design/）→ manifest，走既有 _generate_with_autofix 硬校验回路。"""
    slug = str(body.get('slug') or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': 'prototype 需要合法 slug'}
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return {'success': False, 'error': f'游戏不存在: {slug}'}
    files = _read_design(game_dir)
    if not files:
        return {'success': False, 'error': '该游戏还没有 design 文档，先分解设计稿再生成原型'}
    gdd = '\n\n'.join(f'### {rel}\n{content}' for rel, content in files.items())
    user_msg = PROTOTYPE_TASK + '\n\n## Game Design Document\n' + gdd
    return _generate_with_autofix(provider, api_key, model, system, user_msg, autofix=True)


def _strip_fence(text: str) -> str:
    """剥掉整体被 ``` 围栏包住的 markdown（design-revise 防御：LLM 有时手滑加围栏）。"""
    t = (text or '').strip()
    if t.startswith('```'):
        t = t.split('\n', 1)[1] if '\n' in t else ''
        if t.rstrip().endswith('```'):
            t = t.rstrip()[:-3]
    return t.strip()


def handle_generate(body: dict) -> dict:
    """POST /api/generate 的处理核。mode='create'（默认）从 prompt 生成；mode='revise' 从
    current_manifest + instruction 生成完整修订版；设计先行流四模式 design-chat/design-breakdown/
    design-revise/prototype 见各 _handle_* 。autofix=True 开服务端校验重试回路。"""
    provider = body.get('provider', 'anthropic')
    catalog = body.get('catalog', None)
    mode = body.get('mode', 'create')
    autofix = bool(body.get('autofix', False))
    system = GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', catalog or _FALLBACK_CATALOG)

    if provider != 'mock' and provider not in LLM_PROVIDERS:
        return {'success': False, 'error': f'Unknown provider: {provider}', 'blueprint': None}

    api_key = get_api_key(provider)
    if not api_key:
        env_key = LLM_PROVIDERS.get(provider, {}).get('env_key', '?')
        hint = 'mock provider 未启用（需 APOLLO_MOCK_LLM=1）' if provider == 'mock' else f'Set {env_key} in .env file.'
        return {'success': False, 'error': f'No API key for {provider}. {hint}', 'blueprint': None}

    models = LLM_PROVIDERS.get(provider, {}).get('models') or ['mock']
    model = body.get('model') or _config_model(provider) or models[0]

    # 设计先行流四模式分派（各自的校验器 / 系统词；prototype 复用 manifest 系统词 + autofix）。
    if mode == 'design-chat':
        return _handle_design_chat(provider, api_key, model, body)
    if mode == 'design-breakdown':
        return _handle_design_breakdown(provider, api_key, model, body, catalog)
    if mode == 'design-revise':
        return _handle_design_revise(provider, api_key, model, body)
    if mode == 'prototype':
        return _handle_prototype(provider, api_key, model, body, system)

    if mode == 'revise':
        current = body.get('current_manifest')
        instruction = str(body.get('instruction') or '').strip()
        if not isinstance(current, dict):
            return {'success': False, 'error': 'revise 需要 current_manifest（对象）', 'blueprint': None}
        if not instruction:
            return {'success': False, 'error': 'revise 需要 instruction（非空修改指令）', 'blueprint': None}
        user_msg = (
            '## Current game manifest\n'
            + json.dumps(current, ensure_ascii=False, indent=2)
            + '\n\n## User instruction\n' + instruction
            + '\n\nOutput the COMPLETE revised manifest as pure JSON.'
        )
    else:
        prompt = str(body.get('prompt') or '').strip()
        if not prompt:
            return {'success': False, 'error': 'No prompt provided', 'blueprint': None}
        user_msg = prompt

    return _generate_with_autofix(provider, api_key, model, system, user_msg, autofix)

# ── 设置端点（BYO key 面板 · M3）────────────────────────────────────────
# 面板 provider 顺序：千问第一，anthropic/deepseek/openai 兼容随后，ollama（本地·免 key）末位；
# mock 仅 env 开启时追加。GET 打码回显（绝不回传原文），PUT 写 .apollo-config.json（gitignore）。
SETTINGS_PROVIDER_ORDER = ['qwen', 'anthropic', 'deepseek', 'openai', 'local']

def _mask_key(key: str) -> str:
    """打码：前3位***尾4位；短 key（<8）整体星号。绝不回传原文。"""
    if not key:
        return ''
    if len(key) < 8:
        return '*' * len(key)
    return f'{key[:3]}***{key[-4:]}'

def _settings_view() -> dict:
    """当前设置的**打码**视图：每 provider 的 name/models/model/isLocal/apiKeyMasked/keyAvailable。"""
    cfg = _load_config()
    order = list(SETTINGS_PROVIDER_ORDER)
    if _mock_enabled():
        order.append('mock')
    providers = []
    for pid in order:
        if pid == 'mock':
            info = {'name': 'Mock (测试)', 'models': ['mock'], 'env_key': ''}
        else:
            info = LLM_PROVIDERS.get(pid, {})
        models = list(info.get('models') or [])
        cfg_key = _config_api_key(pid)
        providers.append({
            'id': pid,
            'name': info.get('name', pid),
            'models': models,
            'model': _config_model(pid) or (models[0] if models else None),
            'isLocal': pid == 'local',
            'envKey': info.get('env_key', ''),
            'apiKeyMasked': _mask_key(cfg_key) if cfg_key else '',
            'hasConfigKey': cfg_key is not None,
            'keyAvailable': get_api_key(pid) is not None,
        })
    return {'providers': providers, 'default': cfg.get('default')}

def handle_settings_get() -> dict:
    return _settings_view()

def handle_settings_put(body: dict) -> dict:
    """合并写入 config。apiKey 仅在前端明确送该字段（用户改动过）时才覆盖；空串=清除；未送=保持原值。"""
    cfg = json.loads(json.dumps(_load_config()))  # 深拷贝当前，防误改缓存
    if not isinstance(cfg.get('providers'), dict):
        cfg['providers'] = {}
    incoming = body.get('providers')
    if isinstance(incoming, dict):
        for pid, patch in incoming.items():
            if not isinstance(patch, dict):
                continue
            cur = cfg['providers'].get(pid)
            cur = dict(cur) if isinstance(cur, dict) else {}
            if 'apiKey' in patch:  # 前端只在用户改动该项时才送 apiKey
                ak = patch.get('apiKey')
                if isinstance(ak, str) and ak.strip():
                    cur['apiKey'] = ak.strip()
                else:
                    cur.pop('apiKey', None)  # 空=清除
            if 'model' in patch and isinstance(patch.get('model'), str) and patch['model'].strip():
                cur['model'] = patch['model'].strip()
            cfg['providers'][pid] = cur
    if 'default' in body:
        d = body.get('default')
        if isinstance(d, str) and d:
            cfg['default'] = d
        else:
            cfg.pop('default', None)
    _save_config(cfg)
    return {'success': True, **_settings_view()}  # 回打码视图

def handle_settings_test(body: dict) -> dict:
    """POST /api/settings/test {provider}：用当前生效配置对该 provider 发最小探活请求 → {ok, error?}。
    mock 直接成功；local 探 Ollama /api/version（2s 超时）；云 provider 发 max_tokens=8 的 ping。"""
    provider = str(body.get('provider') or '').strip()
    if provider == 'mock':
        return {'ok': True} if _mock_enabled() else {'ok': False, 'error': 'mock provider 未启用（需 APOLLO_MOCK_LLM=1）'}
    if provider not in LLM_PROVIDERS:
        return {'ok': False, 'error': f'未知 provider: {provider}'}
    if provider == 'local':  # 本地 Ollama：探版本端点，2s 超时（未跑服务即快速失败）。
        base = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
        try:
            with urllib.request.urlopen(urllib.request.Request(base + '/api/version'), timeout=2) as resp:
                resp.read()
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': f'本地 Ollama 未响应（{base}）：{e}'}
    api_key = get_api_key(provider)
    if not api_key:
        return {'ok': False, 'error': '未配置 API Key（先在上方填写并保存）'}
    model = _config_model(provider) or (LLM_PROVIDERS[provider].get('models') or ['?'])[0]
    r = _provider_request(provider, api_key, model,
                          'You are a connectivity probe.', [{'role': 'user', 'content': 'ping'}], max_tokens=8)
    return {'ok': True} if r.get('success') else {'ok': False, 'error': r.get('error', '连接失败')}

VALID_COMPONENT_TYPES = {
    'Transform', 'Velocity', 'Acceleration', 'Mass', 'Shape', 'Overlap',
    'Timer', 'Resource', 'Flag', 'Tag', 'Relation', 'Visibility',
    'RawInput', 'Action', 'Controllable', 'State', 'SpawnRequest',
    'DestroyRequest', 'Sprite', 'Color', 'Frame', 'Sound', 'Camera',
    'Text', 'RandomSeed', 'SpatialIndex', 'Grounded', 'Bounds',
}

def _validate_blueprint(bp: dict) -> list[str]:
    """Validate canonical manifest { name, capabilities:[id], entities:{id:{Comp:{...}}} }; return warnings."""
    warnings = []
    if not isinstance(bp.get('name'), str):
        warnings.append('Missing or invalid "name" field')
    caps = bp.get('capabilities')
    if caps is not None and (not isinstance(caps, list) or not all(isinstance(c, str) for c in caps)):
        warnings.append('"capabilities" must be a list of capability id strings')
    entities = bp.get('entities')
    if not isinstance(entities, dict):
        warnings.append('"entities" must be an object { entityId: { ComponentType: {...} } }')
        return warnings
    if len(entities) == 0:
        warnings.append('Blueprint has zero entities')
    has_camera = False
    for eid, comps in entities.items():
        if not isinstance(comps, dict) or len(comps) == 0:
            warnings.append(f'Entity "{eid}": components must be a non-empty object')
            continue
        for ctype in comps:
            if ctype not in VALID_COMPONENT_TYPES:
                warnings.append(f'Entity "{eid}": unknown component type "{ctype}"')
            if ctype == 'Camera':
                has_camera = True
    if not has_camera:
        warnings.append('No Camera entity found — rendering may fail')
    return warnings

# 物理/球类预设共用的能力 id 集（相机居中静态 → 世界↔屏幕 1:1，实体可见）。
_PHYSICS_CAPS = ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
                 'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp']
_PONG_CAPS = ['a1-transform', 'b1-velocity', 'c1-shape', 'l2-color', 'd1-overlap-detect',
              't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp']
_CAM = {'Camera': {'zoom': 1, 'offsetX': 320, 'offsetY': 200, 'rotation': 0, 'viewportW': 640, 'viewportH': 400}}

# 预设 = 规范 manifest（entities 为对象、capabilities 为能力 id 列表）→ parseManifest 可直接加载进透视器。
PRESET_BLUEPRINTS = {
    'platformer': {
        'name': 'Simple Platformer',
        'description': 'Gravity + platforms',
        'capabilities': _PHYSICS_CAPS,
        'entities': {
            'camera': _CAM,
            'player': {
                'Transform': {'x': 120, 'y': 100, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                'Velocity': {'vx': 0, 'vy': 0, 'angular': 0},
                'Acceleration': {'ax': 0, 'ay': 0.5},
                'Shape': {'kind': 'box', 'width': 20, 'height': 20},
                'Mass': {'value': 1},
                'Color': {'tint': 0x38bdf8, 'alpha': 1},
                'Controllable': {'playerId': 'p1', 'speed': 3},
                'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            },
            'ground': {'Transform': {'x': 320, 'y': 385, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Shape': {'kind': 'box', 'width': 640, 'height': 30}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
            'platform1': {'Transform': {'x': 200, 'y': 300, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 100, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
            'platform2': {'Transform': {'x': 420, 'y': 240, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 100, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
            'platform3': {'Transform': {'x': 150, 'y': 180, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 80, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
        },
    },
    'pong': {
        'name': 'Pong',
        'description': 'Two-player pong',
        'capabilities': _PONG_CAPS,
        'entities': {
            'camera': _CAM,
            'ball': {'Transform': {'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Velocity': {'vx': 3, 'vy': 2, 'angular': 0}, 'Shape': {'kind': 'circle', 'radius': 8},
                     'Mass': {'value': 1}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'paddle-left': {'Transform': {'x': 30, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                            'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 12, 'height': 60},
                            'Mass': {'value': 0}, 'Color': {'tint': 0x38bdf8, 'alpha': 1}, 'Controllable': {'playerId': 'p1', 'speed': 4},
                            'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'paddle-right': {'Transform': {'x': 610, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                             'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 12, 'height': 60},
                             'Mass': {'value': 0}, 'Color': {'tint': 0xe8618c, 'alpha': 1}, 'Controllable': {'playerId': 'p2', 'speed': 4},
                             'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'wall-top': {'Transform': {'x': 320, 'y': 10, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                         'Shape': {'kind': 'box', 'width': 640, 'height': 10}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
            'wall-bottom': {'Transform': {'x': 320, 'y': 390, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                            'Shape': {'kind': 'box', 'width': 640, 'height': 10}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
        },
    },
}

# ── 资产导入（资源库导入器的写盘端，仅本机 dev 用）──

def handle_asset_import(body: dict) -> dict:
    """文件落 assets/ 子树 + assets/index.json 增量条目。

    body = { files: [{path, dataBase64}], entries: [AssetIndexEntry...] }
    安全：路径必须归一化后仍在 assets/ 下（防穿越）；索引重复 id 整批拒绝（原子性：先校验后写）。
    """
    files = body.get('files', [])
    entries = body.get('entries', [])
    if not isinstance(files, list) or not isinstance(entries, list) or not entries:
        return {'success': False, 'error': 'files/entries 形状非法或为空'}

    # ① 路径安全校验（全部先验，后写）
    for f in files:
        rel = str(f.get('path', ''))
        norm = os.path.normpath(rel).replace('\\', '/')
        if not norm.startswith('assets/') or '..' in norm.split('/'):
            return {'success': False, 'error': f'非法路径（必须在 assets/ 下）: {rel}'}

    # ② 索引校验：重复 id 整批拒绝
    idx_path = ROOT / 'assets' / 'index.json'
    try:
        index = json.loads(idx_path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        index = {'version': 1, 'assets': []}
    existing = {a.get('id') for a in index.get('assets', [])}
    dup = [e.get('id') for e in entries if e.get('id') in existing]
    if dup:
        return {'success': False, 'error': f'索引已有同名 id: {", ".join(map(str, dup))}'}
    for e in entries:
        if not e.get('id') or not e.get('type') or e.get('status') not in ('tbf', 'filled'):
            return {'success': False, 'error': f'条目非法: {json.dumps(e, ensure_ascii=False)[:120]}'}

    # ③ 写文件
    written = 0
    for f in files:
        rel = os.path.normpath(str(f.get('path', ''))).replace('\\', '/')
        target = ROOT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base64.b64decode(f.get('dataBase64', '')))
        written += 1

    # ④ 写索引
    index['assets'] = list(index.get('assets', [])) + entries
    idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ASSETS]", 'g'), f"导入 {written} 文件，索引 +{len(entries)} 条")

    # ⑤ 入库主动扫描（本地像素层，零 API 花费、确定性）：颜色/明暗/体量等事实标签合并进新条目。
    #    失败不影响导入（语义层另有可选的 /api/assets/autotag）。
    try:
        subprocess.run(
            **_spawn(['npx', 'vite-node', 'scripts/scan-pixels.ts', '--assets']),
            cwd=ROOT, capture_output=True, timeout=120,
        )
        print(c("  [ASSETS]", 'g'), "像素扫描标签已合并（本地、免费）")
    except Exception:
        pass
    return {'success': True, 'written': written, 'indexAdded': len(entries)}

# ── AI 文本生成资产（tripo 文本→3D · qwen 文本→2D）──────────────────────────────
# 生成"大脑"在 PA 车道的 scripts/ai-gen.mjs（它落文件 + upsert index.json）；本端点只是薄胶水：
# 校验入参 → shell 调脚本（--mock --json）→ 回机读结果给库刷新。真调 API 走脚本内的 env key + 放宽网络。

def handle_asset_generate(body: dict) -> dict:
    """POST /api/assets/generate。body = { adapter:'tripo'|'qwen', prompt:str, game?:str }。
    默认 mock（本环境 GitHub-only 真调被挡）；脚本自行按 env key 决定 mock/真调。"""
    adapter = str(body.get('adapter', '')).strip()
    prompt = str(body.get('prompt', '')).strip()
    game = body.get('game')
    if adapter not in ('tripo', 'qwen'):
        return {'success': False, 'error': f'未知适配器: {adapter or "(空)"}（支持 tripo/qwen）'}
    if not prompt:
        return {'success': False, 'error': 'prompt 不能为空'}
    if len(prompt) > 500:
        return {'success': False, 'error': 'prompt 过长（≤500 字）'}
    cmd = ['node', 'scripts/ai-gen.mjs', adapter, prompt, '--mock', '--json']
    if game:
        g = str(game)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', g):  # 白名单：防注入/路径穿越
            return {'success': False, 'error': f'非法 game 名: {g}'}
        cmd += ['--game', g]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '生成超时（>180s）'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'生成失败: {err[:400]}'}
    line = out.splitlines()[-1] if out else ''  # 末行 JSON（前面可能有 warn）
    try:
        res = json.loads(line)
    except Exception:
        return {'success': False, 'error': f'解析结果失败: {out[:200]}'}
    print(c("  [AI-GEN]", 'g'), f"{adapter} → {res.get('id')} ({res.get('scope')}{' ·mock' if res.get('mock') else ''})")
    return {'success': True, **res}


def handle_asset_generate_providers() -> dict:
    """GET /api/assets/generate/providers。列出各生成 provider 的 envKey / 是否已配 key（脚本打码·绝不回明文）。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/ai-gen.mjs', 'providers']), cwd=ROOT, capture_output=True, timeout=30)
        return {'providers': json.loads(proc.stdout.decode('utf-8', 'replace'))}
    except Exception as e:  # 脚本缺失/解析失败不炸端点
        return {'providers': [], 'error': str(e)}

# ── Vendor：把共享库资产 copy 进某游戏的本地美术目录（右键"copy 到游戏"入口的后端）─────────
# 能力"大脑"在 PA 车道的 scripts/vendor-asset.mjs（copy 文件 + upsert 本地索引·自动按类型归子目录·
# 携 spec/license/provenance.vendoredFrom·幂等）；本端点只是薄胶水：校验 → shell 调 → 回机读结果。

GAME_RE = re.compile(r'game-[a-z0-9]+')

def handle_games_list() -> dict:
    """GET /api/games。枚举 src/games/game-* 为权威游戏列表（标注是否已建本地美术目录）。"""
    games = []
    gdir = ROOT / 'src' / 'games'
    if gdir.is_dir():
        for d in sorted(gdir.iterdir()):
            if d.is_dir() and GAME_RE.fullmatch(d.name):
                has_art = (ROOT / 'public' / 'games' / d.name / 'art' / 'index.json').exists()
                games.append({'id': d.name, 'hasLocalArt': has_art})
    return {'games': games}


def handle_asset_vendor(body: dict) -> dict:
    """POST /api/assets/vendor。body = { id:str（共享库资产 id）, game:str, as?:str（本地 id 覆盖）}。"""
    asset_id = str(body.get('id', '')).strip()
    game = str(body.get('game', '')).strip()
    as_id = body.get('as')
    if not asset_id:
        return {'success': False, 'error': 'id 不能为空'}
    if not GAME_RE.fullmatch(game):  # 白名单：防注入/路径穿越
        return {'success': False, 'error': f'非法 game: {game or "(空)"}'}
    cmd = ['node', 'scripts/vendor-asset.mjs', asset_id, game, '--json']
    if as_id:
        a = str(as_id).strip()
        # 本地 id（贴图 key 风格）：首字符 alnum、字符集 [A-Za-z0-9/_.-]、禁 ".." 段
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*', a) or '..' in a:
            return {'success': False, 'error': f'非法 as id: {a}'}
        cmd += ['--as', a]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'vendor 超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'vendor 失败: {err[:400]}'}
    line = out.splitlines()[-1] if out else ''
    try:
        res = json.loads(line)
    except Exception:
        return {'success': False, 'error': f'解析结果失败: {out[:200]}'}
    print(c("  [VENDOR]", 'g'), f"{asset_id} → {game}")
    return {'success': True, **res}

# ── 资产自动标注（入库主动扫描 / 存量回填共用一条管线；Claude 视觉打语义标签）──

AUTOTAG_SYSTEM = """You tag 2D game sprites for an asset library's search index.
You will see one pixel-art asset, upscaled with nearest-neighbor on a checkerboard (checkerboard = transparency).
Output ONLY a JSON array of 4-10 lowercase english snake_case tags. No prose, no markdown.
Tag what is VISUALLY evident, in priority order:
1. subject kind: creature / humanoid / item / weapon / armor / tile / icon / fx / decal / portrait
2. element or material by palette & motifs: fire / ice / poison / lightning / holy / dark / metal / wood / stone / gold / crystal
3. notable features: wings / horns / weapon / shield / glow / translucent / skeleton / undead_look / armored / robed / hooded
4. body/shape: quadruped / biped / flying / serpentine / blob / large / small
5. for tiles: floor / wall / walkable_look / pattern words (grass / lava / water / brick / sand)
Rules: do not invent game lore; if unsure about a tag, omit it; never output generic words (pixel, game, sprite, art, image, asset)."""

def _autotag_one(image_path: Path, model: str, api_key: str) -> list[str]:
    """单张：放大 6×（复用 scripts/contact-sheet.mjs）→ Claude 视觉 → JSON 标签数组。"""
    fd, tmp_name = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        subprocess.run(
            **_spawn(['node', 'scripts/contact-sheet.mjs', '--out', str(tmp), '--cols', '1', '--scale', '6', str(image_path)]),
            cwd=ROOT, capture_output=True, check=True, timeout=30,
        )
        data = base64.standard_b64encode(tmp.read_bytes()).decode()
    finally:
        tmp.unlink(missing_ok=True)

    req_body = json.dumps({
        'model': model,
        'max_tokens': 300,
        'system': AUTOTAG_SYSTEM,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': data}},
                {'type': 'text', 'text': 'Tag this asset. JSON array only.'},
            ],
        }],
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=req_body,
        headers={'x-api-key': api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        out = json.loads(resp.read().decode())
    text = ''.join(b.get('text', '') for b in out.get('content', []) if b.get('type') == 'text').strip()
    # 防御：剥掉可能的 ```json 围栏后解析
    text = text.strip('`').removeprefix('json').strip()
    tags = json.loads(text)
    return [str(t).strip().lower() for t in tags if isinstance(t, str) and t.strip()][:12]

def handle_asset_autotag(body: dict) -> dict:
    """对 assets/index.json 里的条目跑视觉标注，tags 合并写回（带 provenance.autotag 溯源）。

    body = { entries: [{id, path}], model? }   path 相对仓库根（assets/ 开头）。
    单张失败不拖死整批（results 里逐条给 error）。
    """
    entries = body.get('entries', [])
    if not isinstance(entries, list) or not entries:
        return {'success': False, 'error': 'entries 为空'}
    api_key = get_api_key('anthropic')
    if not api_key:
        return {'success': False, 'error': '缺 ANTHROPIC_API_KEY（写进 .env 后重启 apollo）'}
    model = str(body.get('model') or 'claude-opus-4-8')

    idx_path = ROOT / 'assets' / 'index.json'
    index = json.loads(idx_path.read_text(encoding='utf-8'))
    by_id = {a.get('id'): a for a in index.get('assets', [])}

    results = []
    tagged = 0
    for e in entries:
        eid = str(e.get('id', ''))
        rel = os.path.normpath(str(e.get('path', ''))).replace('\\', '/')
        if not rel.startswith('assets/') or '..' in rel.split('/'):
            results.append({'id': eid, 'error': f'非法路径: {rel}'})
            continue
        if eid not in by_id:
            results.append({'id': eid, 'error': '索引里无此 id'})
            continue
        target = ROOT / rel
        if not target.is_file():
            results.append({'id': eid, 'error': '文件不存在'})
            continue
        try:
            tags = _autotag_one(target, model, api_key)
            entry = by_id[eid]
            old = [t for t in entry.get('tags', []) if isinstance(t, str)]
            entry['tags'] = old + [t for t in tags if t not in old]
            prov = entry.get('provenance') or {}
            prov['autotag'] = {'model': model, 'at': time.strftime('%Y-%m-%d')}
            entry['provenance'] = prov
            tagged += 1
            results.append({'id': eid, 'tags': tags})
            print(c("  [AUTOTAG]", 'g'), f"{eid}: {', '.join(tags)}")
        except Exception as ex:  # 单张失败不拖死整批
            results.append({'id': eid, 'error': str(ex)[:200]})
            print(c("  [AUTOTAG]", 'r'), f"{eid}: {str(ex)[:80]}")

    if tagged:
        idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'success': True, 'tagged': tagged, 'results': results}

# ── 用户游戏库（创作台 v1 地基）──────────────────────────────
# library/<slug>/manifest.json（游戏唯一真相·纯数据）+ meta.json（展示元数据）+ 版本化。
# 版本化：探测到 git 二进制 → 每游戏目录自成一个独立 git 仓（git init + 每次保存 commit）；
#         无 git → snapshots/<ts>.json 降级。library/ 整目录在 .gitignore 里（用户数据不入引擎仓）。
# 安全：一切路径先经 _game_dir 归一化 + 断言在 library/ 子树内（照 handle_asset_import 的防穿越模式，
#       且 slug 白名单 [a-z0-9-] 从根上堵掉 ../ 与斜杠）。所有写操作严格限定 library/ 之下。

LIBRARY_DIR = ROOT / 'library'
_SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]*$')
# 提交署名走本地 -c（不依赖机器有无全局 git 身份，避免 commit 因缺 user.email 失败）。
_GIT_AUTHOR = ['-c', 'user.name=Apollo Studio', '-c', 'user.email=studio@apollo.local']
_GIT_OK = None  # 缓存 git 可用性（写盘前探测一次）。

def _git_ok() -> bool:
    global _GIT_OK
    if _GIT_OK is None:
        _GIT_OK = shutil.which('git') is not None
    return _GIT_OK

def _valid_slug(slug) -> bool:
    return isinstance(slug, str) and 0 < len(slug) <= 64 and '..' not in slug and _SLUG_RE.match(slug) is not None

def _slugify(name: str) -> str:
    """名称 → slug：ascii 化 + 小写 + 非字母数字折成 '-' + 去首尾/合并连字符。空则 'game'。"""
    s = unicodedata.normalize('NFKD', str(name)).encode('ascii', 'ignore').decode('ascii').lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s or 'game'

def _dedup_slug(base: str) -> str:
    """已存在则加 -2/-3… 后缀直到不冲突。"""
    if not (LIBRARY_DIR / base).exists():
        return base
    i = 2
    while (LIBRARY_DIR / f'{base}-{i}').exists():
        i += 1
    return f'{base}-{i}'

def _game_dir(slug: str) -> Path:
    """resolve library/<slug> 并断言仍在 library/ 子树内；非法 slug / 越界 → ValueError。"""
    if not _valid_slug(slug):
        raise ValueError(f'非法 slug: {slug!r}')
    lib = LIBRARY_DIR.resolve()
    d = (LIBRARY_DIR / slug).resolve()
    if d != lib and lib not in d.parents:
        raise ValueError(f'路径越界（必须在 library/ 下）: {slug!r}')
    return d

def _lib_parts(path: str):
    """'/api/library[/<slug>[/<action>]]' → (slug|None, action|None)。"""
    segs = [s for s in path.split('/') if s]  # ['api','library',...]
    rest = segs[2:]
    if not rest:
        return (None, None)
    if len(rest) == 1:
        return (rest[0], None)
    return (rest[0], rest[1])

def _git_game(game_dir: Path, args: list[str], timeout: int = 15):
    return subprocess.run(['git', *args], cwd=str(game_dir), capture_output=True,
                          encoding='utf-8', errors='replace', timeout=timeout)

def _git_commit_all(game_dir: Path, message: str) -> bool:
    """有 git → init（首次）+ add -A + commit，返回 True；无 git → False（调用方走快照降级）。
    空提交（内容没变）返回非零码但无害，照旧返回 True。"""
    if not _git_ok():
        return False
    if not (game_dir / '.git').exists():
        _git_game(game_dir, ['init', '-q'])
    _git_game(game_dir, ['add', '-A'])
    _git_game(game_dir, [*_GIT_AUTHOR, 'commit', '-q', '-m', message])
    return True

def _snapshot(game_dir: Path, manifest: dict) -> str:
    """快照降级：把当前 manifest 落 snapshots/<ts>.json，返回 rev（文件名 stem）。"""
    snap_dir = game_dir / 'snapshots'
    snap_dir.mkdir(exist_ok=True)
    ts = time.strftime('%Y%m%dT%H%M%S')
    p = snap_dir / f'{ts}.json'
    n = 1
    while p.exists():
        p = snap_dir / f'{ts}-{n}.json'
        n += 1
    p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return p.stem

def _version_save(game_dir: Path, manifest: dict, message: str) -> str:
    """存一版：git 提交或快照降级，返回 'git' / 'snapshot'。"""
    if _git_commit_all(game_dir, message):
        return 'git'
    _snapshot(game_dir, manifest)
    return 'snapshot'

def _version_save_all(game_dir: Path, message: str) -> str:
    """存一版（不指定 manifest，用于 design 文档改动）：git 提交整目录；无 git → 快照当前 manifest 作版本标记。"""
    if _git_commit_all(game_dir, message):
        return 'git'
    try:
        manifest = json.loads((game_dir / 'manifest.json').read_text(encoding='utf-8'))
    except Exception:
        manifest = {}
    _snapshot(game_dir, manifest)
    return 'snapshot'

# ── design 目录（设计先行流：pitch/systems/content/capability-plan，与游戏同库同 git 版本化）──
# 路径防护：design/ 子树只许 .md；每个路径段字符白名单 [A-Za-z0-9._-]（堵掉 ../ 与斜杠花招）；
# 形状白名单：顶层 <name>.md 或 systems/<name>.md（深度 ≤2，第二层只能在 systems/ 下）。
_DESIGN_SEG_RE = re.compile(r'^[A-Za-z0-9._-]+$')

def _valid_design_relpath(rel) -> bool:
    if not isinstance(rel, str) or not rel or rel != rel.strip():
        return False
    norm = rel.replace('\\', '/')
    if norm.startswith('/') or norm.endswith('/'):
        return False
    segs = norm.split('/')
    if any(s in ('', '.', '..') or not _DESIGN_SEG_RE.match(s) for s in segs):
        return False
    if not norm.endswith('.md'):
        return False
    if len(segs) == 1:
        return True
    if len(segs) == 2:
        return segs[0] == 'systems'
    return False

def _design_parts(path: str):
    """'/api/library/<slug>/design/<rel...>' → (slug, rel) 或 (None, None)。"""
    segs = [s for s in path.split('/') if s]  # ['api','library',slug,'design',...rel]
    if len(segs) >= 5 and segs[0] == 'api' and segs[1] == 'library' and segs[3] == 'design':
        return segs[2], '/'.join(segs[4:])
    return None, None

def _read_design(game_dir: Path) -> dict:
    """design/ 下所有合法 .md → {相对路径: 内容}（按路径排序·稳定）。"""
    ddir = game_dir / 'design'
    out = {}
    if not ddir.is_dir():
        return out
    for p in sorted(ddir.rglob('*.md')):
        try:
            rel = p.relative_to(ddir).as_posix()
        except Exception:
            continue
        if not _valid_design_relpath(rel):
            continue
        try:
            out[rel] = p.read_text(encoding='utf-8')
        except Exception:
            pass
    return out

def _write_design_file(game_dir: Path, rel: str, content: str) -> None:
    """写单篇 design .md（rel 须已过 _valid_design_relpath）。再断言归一化后仍在 design/ 子树内（纵深防护）。"""
    ddir = (game_dir / 'design').resolve()
    target = (game_dir / 'design' / rel)
    resolved = target.resolve()
    if resolved != ddir and ddir not in resolved.parents:
        raise ValueError(f'design 路径越界: {rel!r}')
    target.parent.mkdir(parents=True, exist_ok=True)
    text = content if content.endswith('\n') else content + '\n'
    target.write_text(text, encoding='utf-8')

def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S')

def _write_meta(game_dir: Path, name: str, provider: str, overrides: dict | None) -> dict:
    now = _now_iso()
    meta = {
        'name': name,
        'subtitle': '',
        'color': '#1e293b',
        'accentColor': '#38bdf8',
        'icon': '🎮',
        'createdAt': now,
        'updatedAt': now,
        'provider': provider,
    }
    if isinstance(overrides, dict):
        meta.update({k: v for k, v in overrides.items() if k in meta and k not in ('createdAt',)})
    _write_json(game_dir / 'meta.json', meta)
    return meta

def _touch_meta(game_dir: Path) -> None:
    p = game_dir / 'meta.json'
    try:
        meta = json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        return
    meta['updatedAt'] = _now_iso()
    _write_json(p, meta)

def _preset_manifest(preset: dict) -> dict:
    """PRESET_BLUEPRINTS 条目 → 纯规范 manifest（只留 capabilities + entities，name/描述归 meta）。"""
    return {'capabilities': list(preset.get('capabilities', [])), 'entities': preset.get('entities', {})}

def _scaffold(slug: str, name: str, manifest: dict, provider: str, meta_overrides: dict | None,
              commit_msg: str) -> tuple:
    """新建游戏目录：写 manifest + meta，落首个版本。返回 (game_dir, meta, versioned)。"""
    game_dir = _game_dir(slug)
    game_dir.mkdir(parents=True, exist_ok=False)
    _write_json(game_dir / 'manifest.json', manifest)
    meta = _write_meta(game_dir, name, provider, meta_overrides)
    versioned = _version_save(game_dir, manifest, commit_msg)
    return game_dir, meta, versioned

def _run_manifest_check(manifest: dict) -> tuple:
    """跑引擎真校验（scripts/manifest-check.mjs 子进程）。返回 (ok, message)。"""
    proc = subprocess.run(
        **_spawn(['npx', 'vite-node', 'scripts/manifest-check.mjs']),
        cwd=ROOT, input=json.dumps(manifest, ensure_ascii=False),
        capture_output=True, encoding='utf-8', errors='replace', timeout=120,
    )
    if proc.returncode == 0:
        return True, (proc.stderr or '').strip()
    return False, (proc.stderr or proc.stdout or '校验失败（无输出）').strip()

def _list_library() -> list:
    out = []
    if not LIBRARY_DIR.exists():
        return out
    for d in sorted(LIBRARY_DIR.iterdir()):
        if not d.is_dir() or not _valid_slug(d.name):
            continue
        try:
            meta = json.loads((d / 'meta.json').read_text(encoding='utf-8'))
        except Exception:
            meta = {}
        try:
            json.loads((d / 'manifest.json').read_text(encoding='utf-8'))
            valid = True
        except Exception:
            valid = False
        ddir = d / 'design'
        has_design = ddir.is_dir() and any(ddir.rglob('*.md'))
        out.append({'slug': d.name, 'meta': meta, 'valid': valid, 'hasDesign': has_design})
    return out

def _history(game_dir: Path) -> dict:
    if _git_ok() and (game_dir / '.git').exists():
        r = _git_game(game_dir, ['log', '--format=%H%x1f%s%x1f%cI', '-50'])
        entries = []
        for line in (r.stdout or '').splitlines():
            parts = line.split('\x1f')
            if len(parts) == 3:
                entries.append({'rev': parts[0], 'subject': parts[1], 'date': parts[2]})
        return {'mode': 'git', 'entries': entries}
    entries = []
    snap_dir = game_dir / 'snapshots'
    if snap_dir.exists():
        for p in sorted(snap_dir.glob('*.json'), reverse=True):
            entries.append({'rev': p.stem, 'subject': 'snapshot', 'date': p.stem})
    return {'mode': 'snapshot', 'entries': entries}

# ── 库端点（返回 (status, data) 元组，供 APIHandler 分派）──

def library_get(path: str) -> tuple:
    slug, action = _lib_parts(path)
    if slug is None:
        return (200, _list_library())
    game_dir = _game_dir(slug)  # 校验 slug / 防越界（非法 → ValueError → 400）
    if not game_dir.is_dir():
        return (404, {'error': f'游戏不存在: {slug}'})
    if action == 'manifest':
        try:
            return (200, json.loads((game_dir / 'manifest.json').read_text(encoding='utf-8')))
        except FileNotFoundError:
            return (404, {'error': 'manifest 不存在'})
        except Exception as e:
            return (400, {'error': f'manifest 解析失败: {e}'})
    if action == 'history':
        return (200, _history(game_dir))
    if action == 'design':
        return (200, {'files': _read_design(game_dir)})
    return (404, {'error': f'未知库端点: {path}'})

def library_design_put(slug: str, rel: str, body: dict) -> tuple:
    """PUT /api/library/<slug>/design/<rel>：写单篇 design .md + commit（note 可选）。仅 .md·路径防护。"""
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return (404, {'success': False, 'error': f'游戏不存在: {slug}'})
    if not _valid_design_relpath(rel):
        return (400, {'success': False, 'error': f'非法 design 路径（仅 .md·顶层或 systems/ 子目录）: {rel!r}'})
    content = body.get('content')
    if not isinstance(content, str):
        return (400, {'success': False, 'error': 'content 必须是字符串'})
    _write_design_file(game_dir, rel, content)
    _touch_meta(game_dir)
    versioned = _version_save_all(game_dir, str(body.get('note') or f'design: {rel}'))
    return (200, {'success': True, 'slug': slug, 'path': rel, 'versioned': versioned})

def library_create(body: dict) -> tuple:
    name = str(body.get('name') or '').strip()
    if not name:
        return (400, {'success': False, 'error': 'name 必填'})
    template = body.get('template')
    if template and template in PRESET_BLUEPRINTS:
        manifest = _preset_manifest(PRESET_BLUEPRINTS[template])
    else:
        manifest = {'capabilities': [], 'entities': {}}
    slug = _dedup_slug(_slugify(name))
    _, meta, versioned = _scaffold(slug, name, manifest, str(body.get('provider') or 'user'),
                                   body.get('meta'), 'create')
    return (200, {'success': True, 'slug': slug, 'meta': meta, 'versioned': versioned})

def library_install_sample(body: dict) -> tuple:
    preset_name = str(body.get('preset') or 'platformer')
    if preset_name not in PRESET_BLUEPRINTS:
        return (400, {'success': False, 'error': f'未知 preset: {preset_name}（可选: {", ".join(PRESET_BLUEPRINTS)}）'})
    preset = PRESET_BLUEPRINTS[preset_name]
    slug = _dedup_slug(_slugify(f'sample-{preset_name}'))
    _, meta, versioned = _scaffold(slug, preset.get('name', preset_name), _preset_manifest(preset),
                                   'sample', None, f'install sample {preset_name}')
    return (200, {'success': True, 'slug': slug, 'meta': meta, 'versioned': versioned})

def library_put_manifest(slug: str, body: dict) -> tuple:
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return (404, {'success': False, 'error': f'游戏不存在: {slug}'})
    manifest = body.get('manifest')
    if not isinstance(manifest, dict):
        return (400, {'success': False, 'error': 'manifest 必须是对象 { capabilities, entities }'})
    ok, msg = _run_manifest_check(manifest)  # 先校验
    if not ok:
        return (400, {'success': False, 'error': msg})  # 校验错误文本（供回喂 LLM 修）
    _write_json(game_dir / 'manifest.json', manifest)  # 后落盘
    _touch_meta(game_dir)
    versioned = _version_save(game_dir, manifest, str(body.get('note') or 'update'))
    return (200, {'success': True, 'slug': slug, 'versioned': versioned, 'warnings': msg})

def library_rollback(slug: str, body: dict) -> tuple:
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return (404, {'success': False, 'error': f'游戏不存在: {slug}'})
    rev = str(body.get('rev') or '').strip()
    if not rev:
        return (400, {'success': False, 'error': 'rev 必填'})
    if _git_ok() and (game_dir / '.git').exists():
        if not re.match(r'^[0-9a-fA-F]{7,40}$', rev):
            return (400, {'success': False, 'error': f'非法 git rev: {rev!r}'})
        r = _git_game(game_dir, ['checkout', rev, '--', 'manifest.json'])
        if r.returncode != 0:
            return (400, {'success': False, 'error': f'git checkout 失败: {(r.stderr or "").strip()[:300]}'})
        _touch_meta(game_dir)
        _git_commit_all(game_dir, f'rollback to {rev}')
        return (200, {'success': True, 'slug': slug, 'rev': rev, 'mode': 'git'})
    # 快照降级：从 snapshots/<rev>.json 恢复。
    if not re.match(r'^[0-9A-Za-z\-T]+$', rev):
        return (400, {'success': False, 'error': f'非法快照 rev: {rev!r}'})
    snap = game_dir / 'snapshots' / f'{rev}.json'
    if not snap.is_file():
        return (404, {'success': False, 'error': f'快照不存在: {rev}'})
    try:
        manifest = json.loads(snap.read_text(encoding='utf-8'))
    except Exception as e:
        return (400, {'success': False, 'error': f'快照解析失败: {e}'})
    _write_json(game_dir / 'manifest.json', manifest)
    _touch_meta(game_dir)
    _snapshot(game_dir, manifest)
    return (200, {'success': True, 'slug': slug, 'rev': rev, 'mode': 'snapshot'})

def _run_bench(manifest: dict) -> tuple:
    """跑 scripts/bench-manifest.mjs 子进程（vite-node·引擎真 ApolloBench 五轴）。返回 (ok, data|error)。"""
    proc = subprocess.run(
        **_spawn(['npx', 'vite-node', 'scripts/bench-manifest.mjs']),
        cwd=ROOT, input=json.dumps(manifest, ensure_ascii=False),
        capture_output=True, encoding='utf-8', errors='replace', timeout=60,
    )
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout or '体检失败（无输出）').strip()
    try:
        # CLI 只在末行输出机读 JSON（stdout 干净）。
        return True, json.loads((proc.stdout or '').strip().splitlines()[-1])
    except Exception as e:
        return False, f'体检输出解析失败: {e}（{(proc.stdout or "")[:200]}）'

def library_bench(slug: str) -> tuple:
    """POST /api/library/<slug>/bench：读该卡带 manifest → CLI 五轴体检 → 透传 {score, pass, axes, ...}。"""
    game_dir = _game_dir(slug)
    if not game_dir.is_dir():
        return (404, {'success': False, 'error': f'游戏不存在: {slug}'})
    try:
        manifest = json.loads((game_dir / 'manifest.json').read_text(encoding='utf-8'))
    except Exception as e:
        return (400, {'success': False, 'error': f'manifest 读取失败: {e}'})
    ok, data = _run_bench(manifest)
    if not ok:
        return (400, {'success': False, 'error': data})
    return (200, {'success': True, **data})

# ── API 服务器 ──

def _lib_dispatch(fn) -> tuple:
    """跑一个返回 (status, data) 的库端点，把 ValueError（非法 slug/越界）折成 400、其它异常折成 500。"""
    try:
        return fn()
    except ValueError as e:
        return (400, {'success': False, 'error': str(e)})
    except Exception as e:
        return (500, {'success': False, 'error': str(e)})

class APIHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = self.path.split('?')[0]

        # 库端点（可变状态码：400 越界 / 404 缺失）——先于遗留 200 端点分派。
        if path == '/api/library' or path.startswith('/api/library/'):
            try:
                status, data = library_get(path)
            except ValueError as e:
                status, data = 400, {'error': str(e)}
            except Exception as e:
                status, data = 500, {'error': str(e)}
            self._send_json(status, data)
            return

        if path == '/api/status':
            data = get_project_status()
        elif path == '/api/test':
            data = run_command(['npx', 'vitest', 'run'])
        elif path == '/api/typecheck':
            data = run_command(['npx', 'tsc', '--noEmit'])
        elif path == '/api/build':
            data = run_command(['npx', 'vite', 'build'])
        elif path == '/api/bench':
            data = run_command(['npx', 'vite-node', 'src/bench/run-bench.ts'])
        elif path == '/api/git-log':
            data = run_command(['git', 'log', '--oneline', '-20'])
        elif path == '/api/git-status':
            data = run_command(['git', 'status', '--short'])
        elif path == '/api/git-pull':
            data = run_command(['git', 'pull', 'origin', 'claude/mainbranch', '--rebase'])
        elif path == '/api/generate/presets':
            data = {name: {'name': bp['name'], 'description': bp['description']} for name, bp in PRESET_BLUEPRINTS.items()}
        elif path.startswith('/api/generate/preset/'):
            preset_name = path.split('/')[-1]
            if preset_name in PRESET_BLUEPRINTS:
                data = {'success': True, 'blueprint': PRESET_BLUEPRINTS[preset_name]}
            else:
                data = {'success': False, 'error': f'Unknown preset: {preset_name}'}
        elif path == '/api/generate/providers':
            data = get_available_providers()
        elif path == '/api/assets/generate/providers':
            data = handle_asset_generate_providers()
        elif path == '/api/games':
            data = handle_games_list()
        elif path == '/api/settings':
            data = handle_settings_get()
        else:
            data = {'error': 'Unknown endpoint'}

        self._send_json(200, data)

    def _read_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if not content_len:
            return {}
        return json.loads(self.rfile.read(content_len).decode())

    def do_POST(self):
        path = self.path.split('?')[0]
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {'success': False, 'error': 'body 不是合法 JSON'})
            return

        # 库写端点（可变状态码）——先分派。
        if path == '/api/library/create':
            self._send_json(*_lib_dispatch(lambda: library_create(body)))
            return
        if path == '/api/library/install-sample':
            self._send_json(*_lib_dispatch(lambda: library_install_sample(body)))
            return
        if path.startswith('/api/library/') and path.endswith('/rollback'):
            slug, _ = _lib_parts(path)
            self._send_json(*_lib_dispatch(lambda: library_rollback(slug, body)))
            return
        if path.startswith('/api/library/') and path.endswith('/bench'):
            slug, _ = _lib_parts(path)
            self._send_json(*_lib_dispatch(lambda: library_bench(slug)))
            return
        if path == '/api/settings/test':
            self._send_json(200, handle_settings_test(body))
            return

        if path == '/api/generate':
            provider = body.get('provider', 'anthropic')
            mode = body.get('mode', 'create')
            label = (body.get('instruction') if mode == 'revise' else body.get('prompt')) or ''
            print(c("  [GENERATE]", 'm'), f"[{provider}·{mode}] {str(label)[:60]}...")
            try:
                data = handle_generate(body)
            except Exception as e:  # 防御：单次生成失败不拖死 API 进程
                data = {'success': False, 'error': f'生成异常: {e}', 'blueprint': None}
            if data.get('success'):
                print(c("  [GENERATE]", 'g'),
                      f"OK: {(data.get('blueprint') or {}).get('name', '?')} (attempts={data.get('attempts')})")
            else:
                print(c("  [GENERATE]", 'r'), f"Failed: {str(data.get('error', '?'))[:80]}")
        elif path == '/api/assets/import':
            try:
                data = handle_asset_import(body)
            except Exception as e:  # 防御：单次导入失败不拖死 API 进程
                data = {'success': False, 'error': f'导入异常: {e}'}
        elif path == '/api/assets/autotag':
            try:
                data = handle_asset_autotag(body)
            except Exception as e:
                data = {'success': False, 'error': f'标注异常: {e}'}
        elif path == '/api/assets/generate':
            try:
                data = handle_asset_generate(body)
            except Exception as e:  # 防御：单次生成失败不拖死 API 进程
                data = {'success': False, 'error': f'生成异常: {e}'}
        elif path == '/api/assets/vendor':
            try:
                data = handle_asset_vendor(body)
            except Exception as e:  # 防御：单次 vendor 失败不拖死 API 进程
                data = {'success': False, 'error': f'vendor 异常: {e}'}
        else:
            data = {'error': 'Unknown POST endpoint'}

        self._send_json(200, data)

    def do_PUT(self):
        path = self.path.split('?')[0]
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(400, {'success': False, 'error': 'body 不是合法 JSON'})
            return
        if path == '/api/settings':
            self._send_json(200, handle_settings_put(body))
            return
        # design 单篇写（/api/library/<slug>/design/<rel...>·rel 可含 systems/ 子路径）——先于 manifest 分派。
        if path.startswith('/api/library/') and '/design/' in path:
            d_slug, rel = _design_parts(path)
            rel = urllib.parse.unquote(rel) if rel else rel
            if d_slug:
                self._send_json(*_lib_dispatch(lambda: library_design_put(d_slug, rel, body)))
                return
        slug, action = _lib_parts(path)
        if path.startswith('/api/library/') and action == 'manifest' and slug:
            self._send_json(*_lib_dispatch(lambda: library_put_manifest(slug, body)))
            return
        self._send_json(404, {'error': 'Unknown PUT endpoint'})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass

def start_api_server():
    server = HTTPServer(('127.0.0.1', API_PORT), APIHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(c("  [API]", 'g'), f"Dev tools API on http://localhost:{API_PORT}")
    return server

# ── 端口检测 ──

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

# ── Vite 服务器 ──

def start_vite():
    proc = subprocess.Popen(
        **_spawn(['npx', 'vite', '--port', str(VITE_PORT)]),
        cwd=ROOT,
    )
    _processes.append(proc)
    print(c("  [VITE]", 'g'), f"Starting dev server on http://localhost:{VITE_PORT}")
    return proc

def wait_for_server(url: str, timeout: int = 30) -> bool:
    # TCP socket 探测，同时试 IPv4(127.0.0.1) 和 IPv6(::1)，端口从 url 解析。
    # 比 urlopen 更快（端口开即成功，无需完整 HTTP 握手）且不受 IPv4/IPv6 绑定影响——
    # 旧 HTTP 探测只打 127.0.0.1，当 Node.js/Vite 把 localhost 解析为 ::1 时全部超时 15s。
    port = int(url.rstrip('/').rsplit(':', 1)[-1])
    start = time.time()
    while time.time() - start < timeout:
        for addr, family in [('127.0.0.1', socket.AF_INET), ('::1', socket.AF_INET6)]:
            try:
                with socket.socket(family, socket.SOCK_STREAM) as s:
                    s.settimeout(0.2)
                    if s.connect_ex((addr, port)) == 0:
                        return True
            except OSError:
                pass
        time.sleep(0.1)
    return False

def _open_browser_when_ready(open_url: str, probe_url: str) -> None:
    # 后台线程：HTTP 探测一成功就立刻开浏览器（= 页面最早能正常加载的瞬间），主线程不阻塞终端。
    # 比"阻塞 wait 完再开"快在：不占住主线程、轮询 0.1s 粒度、就绪即弹（不等满 wait 返回）。
    if wait_for_server(probe_url):
        print(c("  [READY]", 'g'), f"Apollo Launcher: {c(open_url, 'c')}")
    else:
        print(c("  [WARN]", 'y'), f"就绪探测超时，仍尝试打开 → {c(open_url, 'c')}")
    webbrowser.open(open_url)

# ── 命令 ──

def cmd_launcher(player: bool = False):
    check_env()

    # player=True → 创作台玩家模式（空卡带架 + 创作向导；隐藏内置游戏与 DevTools）
    url = f"http://localhost:{VITE_PORT}" + ("/?mode=player" if player else "")

    # 防止二次启动重复开浏览器：若 Vite 端口已占用，说明实例已在运行。
    # 第二个进程的 start_vite() 会因端口冲突立即退出，但 wait_for_server 仍返回 True
    # 再调 webbrowser.open → 弹出多余新标签。已在运行时直接开目标页即可（不重启服务）。
    if is_port_in_use(VITE_PORT):
        print(c("  [INFO]", 'y'), f"Apollo 已在运行 → 直接打开 {c(url, 'c')}")
        print(c("  [INFO]", 'dim'), "如需重启服务，请先在原终端按 Ctrl+C 停止")
        webbrowser.open(url)
        return

    api = start_api_server()
    vite = start_vite()

    # 开浏览器丢后台线程：就绪即弹、主线程不阻塞（探测打 127.0.0.1，浏览器开 localhost 自带 v6→v4 回退）。
    # 只开一次（线程内单次 webbrowser.open）。
    threading.Thread(
        target=_open_browser_when_ready,
        args=(url, f"http://127.0.0.1:{VITE_PORT}"),
        daemon=True,
    ).start()

    print(c("  [INFO]", 'dim'), "服务启动中，就绪即自动开页…（请勿再手动点终端里的链接，会多开一页）")
    print(c("  [INFO]", 'dim'), "Press Ctrl+C to stop all services")
    try:
        vite.wait()
    except KeyboardInterrupt:
        _cleanup()

def cmd_player():
    # 创作台玩家模式一键入口：python apollo.py player
    cmd_launcher(player=True)

def cmd_test():
    check_env()
    sys.exit(subprocess.call(**_spawn(['npx', 'vitest', 'run']), cwd=ROOT))

def cmd_typecheck():
    check_env()
    sys.exit(subprocess.call(**_spawn(['npx', 'tsc', '--noEmit']), cwd=ROOT))

def cmd_build():
    check_env()
    sys.exit(subprocess.call(**_spawn(['npx', 'vite', 'build']), cwd=ROOT))

def cmd_bench():
    # ApolloBench：执行落地体检（借鉴 OpenGame-Bench）。把每个游戏蓝图喂进真实引擎跑分。
    check_env()
    sys.exit(subprocess.call(**_spawn(['npx', 'vite-node', 'src/bench/run-bench.ts']), cwd=ROOT))

def cmd_status():
    banner()
    s = get_project_status()
    print(c("  Branch:", 'w'), s['branch'])
    print(c("  Last commit:", 'w'), s['lastCommit'])
    print(c("  Atoms:", 'c'), f"{s['atoms']}")
    print(c("  Test files:", 'c'), s['testFiles'])
    print(c("  Skill modules:", 'c'), s['skillModules'])
    print(c("  UI themes:", 'c'), f"{len(s['themes'])} ({', '.join(s['themes'])})")
    print(c("  Games:", 'c'), ', '.join(s['games']) if s['games'] else '(none)')
    print()

def cmd_help():
    banner()
    print(c("  Commands:", 'w'))
    print(f"    {c('(default)', 'c').ljust(30)} Launch Game Library + Dev Tools")
    print(f"    {c('player', 'c').ljust(30)} 创作台玩家模式（空卡带架+创作向导·To-C）")
    print(f"    {c('test', 'c').ljust(30)} Run all tests")
    print(f"    {c('typecheck', 'c').ljust(30)} TypeScript type check")
    print(f"    {c('build', 'c').ljust(30)} Production build")
    print(f"    {c('bench', 'c').ljust(30)} ApolloBench 执行落地体检 (每个游戏跑分)")
    print(f"    {c('status', 'c').ljust(30)} Project stats")
    print(f"    {c('help', 'c').ljust(30)} This help")
    print()

def main():
    args = sys.argv[1:]
    if not args:
        banner()
        cmd_launcher()
        return

    dispatch = {
        'launcher': cmd_launcher, 'player': cmd_player, 'test': cmd_test, 'typecheck': cmd_typecheck,
        'build': cmd_build, 'bench': cmd_bench, 'status': cmd_status, 'help': cmd_help, '-h': cmd_help,
    }
    cmd = args[0]
    if cmd in dispatch:
        dispatch[cmd]()
    else:
        print(c(f"  Unknown: {cmd}", 'r'))
        cmd_help()

if __name__ == '__main__':
    main()
