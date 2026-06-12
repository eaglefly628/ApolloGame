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
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.request
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

def check_env():
    if not shutil.which('npm') or not shutil.which('node'):
        print(c("  [ERROR]", 'r'), "npm/node not found.")
        sys.exit(1)
    if not (ROOT / 'node_modules').exists():
        print(c("  [SETUP]", 'y'), "Installing dependencies...")
        subprocess.call(**_spawn(['npm', 'install']), cwd=ROOT)

# ── 项目信息收集 ──

def get_project_status() -> dict:
    branch = subprocess.getoutput('git branch --show-current')
    last_commit = subprocess.getoutput('git log --oneline -1')
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
        result = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, text=True, timeout=timeout)
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

## Available Atom Components (26 total)

Position: Transform { x, y, rotation, scaleX, scaleY }
Motion: Velocity { vx, vy, angular }, Acceleration { ax, ay }, Mass { value }
Geometry: Shape { kind: 'box'|'circle', width?, height?, radius? }
Collision: Overlap { entityA, entityB, normalX, normalY, depth }
Time: Timer { id, elapsed, duration, loop }
Values: Resource { id, current, min, max }, Flag { id, active }
Tags: Tag { flags (bitmask) }, Relation { kind, targetId }
Visibility: Visibility { visible, active }
Input: RawInput { source, key?, x?, y? }, Action { name, value }, Controllable { playerId, speed }
State: State { fsmId, current, previous }
Lifecycle: SpawnRequest { templateId, x, y }, DestroyRequest { entityId }
Render: Sprite { textureKey, anchorX, anchorY, zOrder }, Color { tint (hex number), alpha }
  Frame { index, total }, Sound { clipId, volume, loop }
  Camera { zoom, offsetX, offsetY, rotation, viewportW, viewportH }
  Text { content, fontSize, fontFamily, anchor, lineSpacing }
World: RandomSeed { seed, sequence }, SpatialIndex { cellSize, kind }
Physics: Grounded (marker), Bounds { minX, minY, maxX, maxY }

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

## Capability ids (enable ONLY ids from this catalog; component fields + examples included)
{CAPABILITY_CATALOG}
For a platformer/physics game enable exactly:
["a1-transform","b1-velocity","b2-acceleration","c1-shape","l2-color","d1-overlap-detect","t1-accel-apply","t1-motion-apply","t2-collision-resolve","t2-bounds-clamp"]

## Art assets (optional — use for richer visuals)
- Any Sprite.textureKey may be written as "art:<english keywords>", e.g. Sprite{ "textureKey": "art:skeleton warrior" }.
- The engine deterministically resolves it against a CC0 32x32 sprite library (4800+ tagged assets); the same query always picks the same sprite. Unresolvable queries fall back to a placeholder, never crash.
- Useful keywords — monsters: undead/skeleton/zombie/demon/dragon/animal/wolf/spider/boss/flying/fire/ice/poison; terrain: floor/wall/grass/lava/water/door/altar/trap; items: sword/axe/bow/armor/shield/potion/book/gold; fx: arrow/bolt/cloud.
- Entities with Sprite still need Transform (and Shape if they collide). If no art fits the theme, use Shape+Color instead.

## Rules
- Canvas 640x400, origin top-left. Include a "camera" entity with Camera centered: offsetX:320, offsetY:200 (so world coords map 1:1 to screen and entities are visible).
- Color { tint: 0xRRGGBB number, alpha:1 }. Ground/walls Mass{value:0}. Players Controllable{playerId,speed}. Bounds keeps entities on-screen.
- Gravity = constant Acceleration.ay per tick (0.3-0.8). Keep all entities within 0..640 x 0..400.
- Unknown capability ids are rejected on load, so only use ids from the list above.

## Minimal Example (bouncing ball + ground)
{"name":"bounce","description":"a ball bounces on the ground","capabilities":["a1-transform","b1-velocity","b2-acceleration","c1-shape","l2-color","d1-overlap-detect","t1-accel-apply","t1-motion-apply","t2-collision-resolve","t2-bounds-clamp"],"entities":{"camera":{"Camera":{"zoom":1,"offsetX":320,"offsetY":200,"rotation":0,"viewportW":640,"viewportH":400}},"ball":{"Transform":{"x":320,"y":60,"rotation":0,"scaleX":1,"scaleY":1},"Velocity":{"vx":2,"vy":0,"angular":0},"Acceleration":{"ax":0,"ay":0.5},"Shape":{"kind":"circle","radius":12},"Color":{"tint":4886754,"alpha":1},"Mass":{"value":1},"Bounds":{"minX":0,"minY":0,"maxX":640,"maxY":400}},"ground":{"Transform":{"x":320,"y":380,"rotation":0,"scaleX":1,"scaleY":1},"Shape":{"kind":"box","width":640,"height":40},"Color":{"tint":3553598,"alpha":1},"Mass":{"value":0}}}}
"""

# 回退能力目录（前端未送 catalog 时用；正常路径由 TS 的 buildCapabilityCatalog 自动派生送来，
# 含全部能力 + 组件字段 + 示例，故 hitbox/prefab/dialogue 等都在）。
_FALLBACK_CATALOG = (
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

def get_api_key(provider: str) -> str | None:
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
    return result

def call_llm(prompt: str, provider: str = 'anthropic', model: str | None = None, catalog: str | None = None) -> dict:
    """Call LLM API to generate game blueprint. Supports multiple providers.

    catalog: 前端从引擎 ALL_CAPABILITIES 自动派生的能力目录（buildCapabilityCatalog）。注入 System
    Prompt 的 {CAPABILITY_CATALOG} 占位符 → 任何能力一登记即对 AI 可见，零 prompt 维护、不漂移。"""
    api_key = get_api_key(provider)
    if not api_key:
        env_key = LLM_PROVIDERS.get(provider, {}).get('env_key', '?')
        return {
            'success': False,
            'error': f'No API key for {provider}. Set {env_key} in .env file.',
            'blueprint': None,
        }

    dispatch = {
        'anthropic': _call_anthropic,
        'qwen': _call_qwen,
        'openai': _call_openai_compatible,
        'deepseek': _call_deepseek,
        'local': _call_ollama,
    }
    fn = dispatch.get(provider)
    if not fn:
        return {'success': False, 'error': f'Unknown provider: {provider}', 'blueprint': None}

    default_model = LLM_PROVIDERS[provider]['models'][0]
    system = GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', catalog or _FALLBACK_CATALOG)
    return fn(prompt, api_key, model or default_model, system)

def _extract_json(text: str) -> str:
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    return text.strip()

def _call_anthropic(prompt: str, api_key: str, model: str, system: str) -> dict:
    url = 'https://api.anthropic.com/v1/messages'
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'system': system,
        'messages': [{'role': 'user', 'content': prompt}],
    }).encode()
    return _do_llm_request(url, headers, body)

def _call_qwen(prompt: str, api_key: str, model: str, system: str) -> dict:
    url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_openai_compatible(prompt: str, api_key: str, model: str, system: str) -> dict:
    base_url = os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
    url = f'{base_url}/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_deepseek(prompt: str, api_key: str, model: str, system: str) -> dict:
    url = 'https://api.deepseek.com/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_ollama(prompt: str, _key: str, model: str, system: str) -> dict:
    url = os.environ.get('OLLAMA_URL', 'http://localhost:11434') + '/api/chat'
    headers = {'Content-Type': 'application/json'}
    body = json.dumps({
        'model': model,
        'stream': False,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            text = data.get('message', {}).get('content', '')
            text = _extract_json(text)
            blueprint = json.loads(text)
            warnings = _validate_blueprint(blueprint)
            return {'success': True, 'error': None, 'blueprint': blueprint, 'warnings': warnings}
    except Exception as e:
        return {'success': False, 'error': str(e), 'blueprint': None}

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

def _do_llm_request(url: str, headers: dict, body: bytes, openai_format: bool = False) -> dict:
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            if openai_format:
                text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            else:
                text = data.get('content', [{}])[0].get('text', '')
            text = _extract_json(text)
            blueprint = json.loads(text)
            warnings = _validate_blueprint(blueprint)
            return {
                'success': True,
                'error': None,
                'blueprint': blueprint,
                'warnings': warnings,
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        return {'success': False, 'error': f'API error {e.code}: {err_body[:500]}', 'blueprint': None}
    except json.JSONDecodeError as e:
        return {'success': False, 'error': f'Invalid JSON from LLM: {e}', 'blueprint': None}
    except Exception as e:
        return {'success': False, 'error': str(e), 'blueprint': None}

# 物理/球类预设共用的能力 id 集（与 game-a 同源；相机居中静态 → 世界↔屏幕 1:1，实体可见）。
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

# ── API 服务器 ──

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        path = self.path.split('?')[0]

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
        else:
            data = {'error': 'Unknown endpoint'}

        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_len).decode()) if content_len else {}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        path = self.path.split('?')[0]

        if path == '/api/generate':
            prompt = body.get('prompt', '')
            provider = body.get('provider', 'anthropic')
            model = body.get('model', None)
            catalog = body.get('catalog', None)  # 前端从引擎 ALL_CAPABILITIES 自动派生的能力目录
            if not prompt:
                data = {'success': False, 'error': 'No prompt provided', 'blueprint': None}
            else:
                print(c("  [GENERATE]", 'm'), f"[{provider}] {prompt[:60]}...")
                data = call_llm(prompt, provider, model, catalog)
                if data['success']:
                    print(c("  [GENERATE]", 'g'), f"Generated: {data['blueprint'].get('name', '?')}")
                else:
                    print(c("  [GENERATE]", 'r'), f"Failed: {data.get('error', '?')[:80]}")
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
        else:
            data = {'error': 'Unknown POST endpoint'}

        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

def cmd_launcher():
    check_env()

    url = f"http://localhost:{VITE_PORT}"

    # 防止二次启动重复开浏览器：若 Vite 端口已占用，说明实例已在运行。
    # 第二个进程的 start_vite() 会因端口冲突立即退出，但 wait_for_server 仍返回 True
    # 再调 webbrowser.open → 弹出多余新标签。在这里提前退出即可避免。
    if is_port_in_use(VITE_PORT):
        print(c("  [INFO]", 'y'), f"Apollo 已在运行 → {c(url, 'c')}")
        print(c("  [INFO]", 'dim'), "如需重启，请先在原终端按 Ctrl+C 停止服务")
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
    print(c("  Atoms:", 'c'), f"{s['atoms']}/26")
    print(c("  Test files:", 'c'), s['testFiles'])
    print(c("  Skill modules:", 'c'), s['skillModules'])
    print(c("  UI themes:", 'c'), f"{len(s['themes'])} ({', '.join(s['themes'])})")
    print(c("  Games:", 'c'), ', '.join(s['games']) if s['games'] else '(none)')
    print()

def cmd_help():
    banner()
    print(c("  Commands:", 'w'))
    print(f"    {c('(default)', 'c').ljust(30)} Launch Game Library + Dev Tools")
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
        'launcher': cmd_launcher, 'test': cmd_test, 'typecheck': cmd_typecheck,
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
