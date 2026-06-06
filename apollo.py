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
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.request

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

## Assembly Blueprint Format

Output ONLY valid JSON, no markdown, no explanation:
{
  "name": "game name",
  "description": "one line description",
  "entities": [
    {
      "id": "unique-entity-id",
      "components": [
        { "type": "Transform", "x": 100, "y": 300, "rotation": 0, "scaleX": 1, "scaleY": 1 },
        { "type": "Velocity", "vx": 0, "vy": 0, "angular": 0 },
        ...more components
      ]
    }
  ],
  "config": {
    "gravity": 0.5,
    "worldBounds": { "minX": 0, "minY": 0, "maxX": 640, "maxY": 400 },
    "background": "#16213e"
  }
}

## Rules
- Canvas is 640x400 pixels, origin top-left
- Use Color { tint: 0xRRGGBB (number), alpha: 1.0 } for entity colors
- Ground/walls use Mass { value: 0 } (immovable)
- Players use Controllable { playerId: "p1"/"p2", speed: 3 }
- Add Bounds component to keep entities in world
- Include at least one Camera entity
- Gravity is applied as constant Acceleration.ay per tick (0.3-0.8 typical)
- Create a FUN, playable game that works with the available atoms

## Minimal Example (bouncing ball + ground)
{"name":"bounce","description":"A ball bouncing on the ground","entities":[{"id":"camera","components":[{"type":"Camera","zoom":1,"offsetX":0,"offsetY":0,"rotation":0,"viewportW":640,"viewportH":400}]},{"id":"ball","components":[{"type":"Transform","x":320,"y":50,"rotation":0,"scaleX":1,"scaleY":1},{"type":"Velocity","vx":2,"vy":0,"angular":0},{"type":"Acceleration","ax":0,"ay":0.5},{"type":"Shape","kind":"circle","radius":12},{"type":"Color","tint":4886754,"alpha":1},{"type":"Mass","value":1},{"type":"Bounds","minX":0,"minY":0,"maxX":640,"maxY":400}]},{"id":"ground","components":[{"type":"Transform","x":320,"y":380,"rotation":0,"scaleX":1,"scaleY":1},{"type":"Shape","kind":"box","width":640,"height":40},{"type":"Color","tint":3553598,"alpha":1},{"type":"Mass","value":0}]}],"config":{"gravity":0.5,"worldBounds":{"minX":0,"minY":0,"maxX":640,"maxY":400},"background":"#0f172a"}}
"""

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

def call_llm(prompt: str, provider: str = 'anthropic', model: str | None = None) -> dict:
    """Call LLM API to generate game blueprint. Supports multiple providers."""
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
    return fn(prompt, api_key, model or default_model)

def _extract_json(text: str) -> str:
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    return text.strip()

def _call_anthropic(prompt: str, api_key: str, model: str) -> dict:
    url = 'https://api.anthropic.com/v1/messages'
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'system': GAME_GEN_SYSTEM_PROMPT,
        'messages': [{'role': 'user', 'content': prompt}],
    }).encode()
    return _do_llm_request(url, headers, body)

def _call_qwen(prompt: str, api_key: str, model: str) -> dict:
    url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'messages': [
            {'role': 'system', 'content': GAME_GEN_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_openai_compatible(prompt: str, api_key: str, model: str) -> dict:
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
            {'role': 'system', 'content': GAME_GEN_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_deepseek(prompt: str, api_key: str, model: str) -> dict:
    url = 'https://api.deepseek.com/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    body = json.dumps({
        'model': model,
        'max_tokens': 4096,
        'messages': [
            {'role': 'system', 'content': GAME_GEN_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt},
        ],
    }).encode()
    return _do_llm_request(url, headers, body, openai_format=True)

def _call_ollama(prompt: str, _key: str, model: str) -> dict:
    url = os.environ.get('OLLAMA_URL', 'http://localhost:11434') + '/api/chat'
    headers = {'Content-Type': 'application/json'}
    body = json.dumps({
        'model': model,
        'stream': False,
        'messages': [
            {'role': 'system', 'content': GAME_GEN_SYSTEM_PROMPT},
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
    """Validate blueprint structure, return list of warnings (empty = ok)."""
    warnings = []
    if not isinstance(bp.get('name'), str):
        warnings.append('Missing or invalid "name" field')
    if not isinstance(bp.get('entities'), list):
        warnings.append('Missing or invalid "entities" array')
        return warnings
    if len(bp['entities']) == 0:
        warnings.append('Blueprint has zero entities')
    has_camera = False
    for i, ent in enumerate(bp['entities']):
        if not isinstance(ent.get('id'), str):
            warnings.append(f'Entity {i}: missing "id"')
        comps = ent.get('components', [])
        if not isinstance(comps, list) or len(comps) == 0:
            warnings.append(f'Entity "{ent.get("id", i)}": no components')
        for comp in comps:
            ctype = comp.get('type', '')
            if ctype not in VALID_COMPONENT_TYPES:
                warnings.append(f'Entity "{ent.get("id", i)}": unknown component type "{ctype}"')
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

PRESET_BLUEPRINTS = {
    'platformer': {
        'name': 'Simple Platformer',
        'description': 'Jump between platforms, collect items',
        'entities': [
            {'id': 'camera', 'components': [
                {'type': 'Camera', 'zoom': 1, 'offsetX': 0, 'offsetY': 0, 'rotation': 0, 'viewportW': 640, 'viewportH': 400},
            ]},
            {'id': 'player', 'components': [
                {'type': 'Transform', 'x': 100, 'y': 300, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Velocity', 'vx': 0, 'vy': 0, 'angular': 0},
                {'type': 'Acceleration', 'ax': 0, 'ay': 0.5},
                {'type': 'Shape', 'kind': 'box', 'width': 20, 'height': 20},
                {'type': 'Mass', 'value': 1},
                {'type': 'Color', 'tint': 0x38bdf8, 'alpha': 1},
                {'type': 'Controllable', 'playerId': 'p1', 'speed': 3},
                {'type': 'Bounds', 'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            ]},
            {'id': 'ground', 'components': [
                {'type': 'Transform', 'x': 320, 'y': 385, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 640, 'height': 30},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x334155, 'alpha': 1},
            ]},
            {'id': 'platform1', 'components': [
                {'type': 'Transform', 'x': 200, 'y': 300, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 100, 'height': 12},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x475569, 'alpha': 1},
            ]},
            {'id': 'platform2', 'components': [
                {'type': 'Transform', 'x': 420, 'y': 240, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 100, 'height': 12},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x475569, 'alpha': 1},
            ]},
            {'id': 'platform3', 'components': [
                {'type': 'Transform', 'x': 150, 'y': 180, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 80, 'height': 12},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x475569, 'alpha': 1},
            ]},
        ],
        'config': {'gravity': 0.5, 'worldBounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}, 'background': '#16213e'},
    },
    'pong': {
        'name': 'Pong',
        'description': 'Classic two-player pong',
        'entities': [
            {'id': 'camera', 'components': [
                {'type': 'Camera', 'zoom': 1, 'offsetX': 0, 'offsetY': 0, 'rotation': 0, 'viewportW': 640, 'viewportH': 400},
            ]},
            {'id': 'ball', 'components': [
                {'type': 'Transform', 'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Velocity', 'vx': 3, 'vy': 2, 'angular': 0},
                {'type': 'Shape', 'kind': 'circle', 'radius': 8},
                {'type': 'Mass', 'value': 1},
                {'type': 'Color', 'tint': 0xfbbf24, 'alpha': 1},
                {'type': 'Bounds', 'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            ]},
            {'id': 'paddle-left', 'components': [
                {'type': 'Transform', 'x': 30, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Velocity', 'vx': 0, 'vy': 0, 'angular': 0},
                {'type': 'Shape', 'kind': 'box', 'width': 12, 'height': 60},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x38bdf8, 'alpha': 1},
                {'type': 'Controllable', 'playerId': 'p1', 'speed': 4},
                {'type': 'Bounds', 'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            ]},
            {'id': 'paddle-right', 'components': [
                {'type': 'Transform', 'x': 610, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Velocity', 'vx': 0, 'vy': 0, 'angular': 0},
                {'type': 'Shape', 'kind': 'box', 'width': 12, 'height': 60},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0xe8618c, 'alpha': 1},
                {'type': 'Controllable', 'playerId': 'p2', 'speed': 4},
                {'type': 'Bounds', 'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            ]},
            {'id': 'wall-top', 'components': [
                {'type': 'Transform', 'x': 320, 'y': -5, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 640, 'height': 10},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x334155, 'alpha': 1},
            ]},
            {'id': 'wall-bottom', 'components': [
                {'type': 'Transform', 'x': 320, 'y': 405, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                {'type': 'Shape', 'kind': 'box', 'width': 640, 'height': 10},
                {'type': 'Mass', 'value': 0},
                {'type': 'Color', 'tint': 0x334155, 'alpha': 1},
            ]},
        ],
        'config': {'gravity': 0, 'worldBounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}, 'background': '#0f172a'},
    },
}

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
            if not prompt:
                data = {'success': False, 'error': 'No prompt provided', 'blueprint': None}
            else:
                print(c("  [GENERATE]", 'm'), f"[{provider}] {prompt[:60]}...")
                data = call_llm(prompt, provider, model)
                if data['success']:
                    print(c("  [GENERATE]", 'g'), f"Generated: {data['blueprint'].get('name', '?')}")
                else:
                    print(c("  [GENERATE]", 'r'), f"Failed: {data.get('error', '?')[:80]}")
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

# ── Vite 服务器 ──

def start_vite():
    proc = subprocess.Popen(
        **_spawn(['npx', 'vite', '--port', str(VITE_PORT)]),
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    _processes.append(proc)
    print(c("  [VITE]", 'g'), f"Starting dev server on http://localhost:{VITE_PORT}")
    return proc

def wait_for_server(url: str, timeout: int = 15) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False

# ── 命令 ──

def cmd_launcher():
    check_env()
    api = start_api_server()
    vite = start_vite()

    url = f"http://localhost:{VITE_PORT}"
    if wait_for_server(url):
        print(c("  [READY]", 'g'), f"Apollo Launcher: {c(url, 'c')}")
        webbrowser.open(url)
    else:
        print(c("  [WARN]", 'y'), "Opening anyway...")
        webbrowser.open(url)

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
        'build': cmd_build, 'status': cmd_status, 'help': cmd_help, '-h': cmd_help,
    }
    cmd = args[0]
    if cmd in dispatch:
        dispatch[cmd]()
    else:
        print(c(f"  Unknown: {cmd}", 'r'))
        cmd_help()

if __name__ == '__main__':
    main()
