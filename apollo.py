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
import io
import zipfile
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

## Art assets (give every visual entity a skin slot — REQUIRED for the reskin pipeline)
- Every entity that represents something a player looks at (characters, enemies, items, terrain tiles, projectiles, backgrounds) SHOULD carry a Sprite whose textureKey is an "art:<english keywords>" reference — e.g. "art:skeleton warrior", "art:forest floor tile". That art: reference IS the replaceable skin slot the art pipeline later swaps for generated art. A game made of only shape+color blocks (no art: slots) cannot be reskinned — avoid that.
- Write art: queries as DETAILED image briefs, not bare nouns: subject + distinguishing features + color/mood + view angle, 4-10 words. Good: "art:armored skeleton knight, glowing red eyes, top-down". Bad: "art:enemy". The art pipeline feeds these words straight to a text-to-image model — the richer the query, the better every generated skin.
- The engine deterministically resolves "art:" against a CC0 32x32 sprite library (4800+ tagged assets); the same query always picks the same sprite. Unresolvable queries fall back to a placeholder, never crash.
- Useful keywords — monsters: undead/skeleton/zombie/demon/dragon/animal/wolf/spider/boss/flying/fire/ice/poison; terrain: floor/wall/grass/lava/water/door/altar/trap; items: sword/axe/bow/armor/shield/potion/book/gold; fx: arrow/bolt/cloud.
- Entities with a Sprite still need a Transform (and a Shape if they collide). Use shape+color only for pure abstractions (HUD bars, hitboxes) that genuinely have no art.

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
    # 订阅通道（owner 2026-07-10 拍板「不买 API·不花新钱」·spec=workshop-spec-2026-07-10.md §2.1）：
    # 走本机 Claude Code CLI headless（`claude -p`），凭订阅（已登录）或 setup-token（CLAUDE_CODE_OAUTH_TOKEN）。
    # 档位=CLI 模型别名（opus=默认主力·fable=展示档更强·sonnet=量产档），不硬编日期型号。
    'claude-code': {
        'name': 'Claude Code（订阅·零 API 费）',
        'env_key': 'CLAUDE_CODE_OAUTH_TOKEN',
        'models': ['opus', 'fable', 'sonnet'],
    },
    'anthropic': {
        'name': 'Claude (Anthropic API·BYO key)',
        # 弃用型号修复（claude-sonnet-4-20250514 已 2026-06-15 退役）→ 当前代次
        'env_key': 'ANTHROPIC_API_KEY',
        'models': ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
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
# 剩余「校验不过的 manifest」次数：产**合法 JSON 但含未知能力**（驱动 manifest-check 失败 →
# 服务端错误指令化 + 词汇族扩 + 轮次裁剪回路，弱模基准自证用）。每消费一次自减。
_MOCK_BAD_MANIFEST_REMAINING = int(os.environ.get('APOLLO_MOCK_BAD_MANIFEST_N') or 0)
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

GEN_KEY_NAMES = ('DASHSCOPE_API_KEY', 'TRIPO_API_KEY', 'MESHY_API_KEY')

def _gen_env() -> dict:
    """美术生成子进程的 env：进程 env + 设置面板配置的生成 key（config.genKeys；千问缺省回退
    providers.qwen.apiKey——DashScope 一 key 两用）。env 已有的**不覆盖**（显式 env 优先）。key 绝不打印/落日志。"""
    env = dict(os.environ)
    cfg = _load_config()
    gk = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
    for name in GEN_KEY_NAMES:
        v = gk.get(name)
        if isinstance(v, str) and v.strip() and not env.get(name):
            env[name] = v.strip()
    if not env.get('DASHSCOPE_API_KEY'):
        q = _config_api_key('qwen')
        if q:
            env['DASHSCOPE_API_KEY'] = q
    return env

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
    if not key and provider == 'claude-code' and shutil.which('claude'):
        return 'cli'  # 本机 CLI 已登录即可用（订阅凭据在 CLI 侧·无需 token）——sentinel 不是密钥不入日志
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

# ── LLM 交互日志（每次往返落一行 JSONL·排障用·REQ-STUDIO 心跳单第 0 项）──────────
# 目录 .apollo/llm-logs/YYYY-MM-DD.jsonl（gitignore）。**API key 绝不落盘**；prompt/response 全文
# 默认不落（只落字符数），APOLLO_LOG_VERBOSE=1 才落全文（本地排障）。best-effort：任何异常都吞掉，
# 绝不让日志拖垮一次生成。「三轮失败是什么」从此 `cat` 一下 jsonl 就有答案。
LLM_LOGS_DIR = ROOT / '.apollo' / 'llm-logs'

def _log_verbose() -> bool:
    return os.environ.get('APOLLO_LOG_VERBOSE', '') in ('1', 'true', 'yes')

def _trunc(s, n: int = 200) -> str:
    s = '' if s is None else str(s)
    return s if len(s) <= n else s[:n] + '…'

def _llm_log(*, provider: str, model: str, mode: str, req: dict,
             validation=None, errors=None, prompt_full: str = '', response_full: str = '') -> None:
    """把一次 LLM 往返落一行 JSONL。req = _provider_request 的返回（含 promptChars/responseChars/elapsedMs/usage）。
    行 schema：{ts, provider, model, mode, promptChars, responseChars, validation, errors[≤200字], elapsedMs, usage?}。"""
    try:
        rec = {
            'ts': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'provider': provider,
            'model': model,
            'mode': mode,
            'promptChars': req.get('promptChars', 0),
            'responseChars': req.get('responseChars', 0),
            'validation': validation,
            'errors': [_trunc(e) for e in (errors or []) if e],
            'elapsedMs': req.get('elapsedMs', 0),
        }
        usage = req.get('usage')
        if usage:
            rec['usage'] = usage
        if not req.get('success'):
            rec['error'] = _trunc(req.get('error'))
        if _log_verbose():  # 本地排障：落 prompt/response 全文（仍不含 API key——key 只在 HTTP 头）
            rec['prompt'] = prompt_full
            rec['response'] = response_full or req.get('text', '')
        LLM_LOGS_DIR.mkdir(parents=True, exist_ok=True)
        fname = LLM_LOGS_DIR / (time.strftime('%Y-%m-%d') + '.jsonl')
        with fname.open('a', encoding='utf-8') as f:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
    except Exception:
        pass  # 日志失败绝不影响生成

# ── 统一 LLM 传输层（system + messages[{role,content}] → 原始文本）──────────
# generate（单轮）与 autofix（多轮回喂错误）共用一条传输。mock provider 在此短路。
# 各 provider 的 chat 格式差异只在这里消化：anthropic 走独立 system 字段，其余（OpenAI 兼容 /
# Ollama）把 system 折成首条 system message。返回 {success, text} 或 {success:False, error}。
_OPENAI_COMPAT_URLS = {
    'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    'deepseek': 'https://api.deepseek.com/chat/completions',
}

# ── Claude Code 订阅通道（owner 2026-07-10「不买 API·不花新钱」·spec=workshop-spec §2.1）──────
# 机制：spawn 本机 Claude Code CLI headless（`claude -p`·prompt 走 stdin 防 ARG_MAX·JSON 出）。
# 凭据：CLAUDE_CODE_OAUTH_TOKEN（`claude setup-token` 产出·config>env>.env）或 CLI 已登录（sentinel 'cli'）。
# 安全铁律（spec §四）：子进程只当**纯文本生成器**——内建工具全禁 + 单轮 + 空工作目录（三重闸：
# 即使某闸失效也无仓库可读可写）；token 只进子进程 env，绝不落日志/回显。
_CLAUDE_CODE_TOOLS_OFF = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite'
_CLAUDE_CODE_CWD = ROOT / '.apollo' / 'claude-code-cwd'  # 专用空目录（gitignore 的 .apollo 下）

_CLAUDE_EFFORTS = ('low', 'medium', 'high', 'xhigh', 'max')

def _claude_code_args(model: str, effort: str = 'high') -> list:
    """CLI 参数（纯函数·冒烟断言工具面全禁/单轮/JSON 出）。effort 默认 high（owner 07-11「默认 4.8 high」）。"""
    if effort not in _CLAUDE_EFFORTS:
        effort = 'high'
    return ['claude', '-p', '--output-format', 'json', '--model', model, '--effort', effort,
            '--max-turns', '1', '--disallowedTools', _CLAUDE_CODE_TOOLS_OFF]

def _claude_code_transcript(system: str, messages: list) -> str:
    """system + 多轮 messages → 单段 stdin 文本（v1 确定性拼接·好测；SDK session/resume 记 v2）。"""
    lines = [system or '', '', '--- 以下是对话记录（续写最后一个 [助手] 回合·直接输出回复内容） ---', '']
    for m in messages:
        lines.append('[用户]' if m.get('role') == 'user' else '[助手]')
        lines.append(str(m.get('content', '')))
        lines.append('')
    lines.append('[助手]')
    return '\n'.join(lines)

def _claude_code_request(api_key: str, model: str, system: str, messages: list, effort: str = 'high') -> dict:
    if not shutil.which('claude'):
        return {'success': False, 'error': '未找到 claude CLI——装 Claude Code 后 `claude setup-token`（订阅通道·workshop-spec §2.1）'}
    env = dict(os.environ)
    if api_key and api_key != 'cli':
        env['CLAUDE_CODE_OAUTH_TOKEN'] = api_key
    _CLAUDE_CODE_CWD.mkdir(parents=True, exist_ok=True)
    try:
        proc = subprocess.run(**_spawn(_claude_code_args(model, effort)), input=_claude_code_transcript(system, messages),
                              capture_output=True, encoding='utf-8', errors='replace',
                              timeout=300, cwd=_CLAUDE_CODE_CWD, env=env)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Claude Code 订阅通道超时（300s）——深思考/大 manifest·稍后重试'}
    except Exception as e:
        return {'success': False, 'error': f'Claude Code 启动失败: {e}'}
    out = (proc.stdout or '').strip()
    if proc.returncode != 0:
        tail = ((proc.stderr or '').strip() or out)[-400:]
        low = tail.lower()
        if 'limit' in low or 'rate' in low or 'usage' in low or '额度' in tail:
            return {'success': False, 'error': f'订阅额度暂满或受限（额度窗恢复后重试）: {tail[:200]}'}
        return {'success': False, 'error': f'Claude Code 退出码 {proc.returncode}: {tail[:300]}'}
    try:
        data = json.loads(out)
    except Exception:
        try:  # 兜底：偶发前置告警行 → 取末行 JSON
            data = json.loads(out.splitlines()[-1])
        except Exception:
            return {'success': False, 'error': f'Claude Code 输出解析失败: {out[:200]}'}
    text = data.get('result') if isinstance(data, dict) else None
    if not isinstance(text, str):
        return {'success': False, 'error': f'Claude Code 无 result 字段: {str(data)[:200]}'}
    usage = data.get('usage') if isinstance(data.get('usage'), dict) else None
    return {'success': True, 'text': text, 'usage': usage}

def _provider_request(provider: str, api_key: str, model: str, system: str, messages: list,
                      max_tokens: int = 4096, effort: str = 'high') -> dict:
    # 度量（供 _llm_log）：promptChars = system + 全 messages 内容字节；elapsedMs = 本轮墙钟；
    # usage = provider 回的 token 数（若有）。这些是 additive，不改任何调用方语义。
    prompt_chars = len(system or '') + sum(len(str(m.get('content', ''))) for m in messages)
    t0 = time.time()
    # 控制台打点（owner 07-11「详细 debug 日志对齐」）：传输层唯一咽喉——所有 LLM 往返（生成/对话/autofix）
    # 都过这里，进出各一行即可对齐「卡在哪」。逐笔 JSONL 明细照旧在 .apollo/llm-logs/。
    if provider != 'mock':
        print(c('  [LLM]', 'b'), f'→ {provider}/{model} · prompt {prompt_chars:,} 字 · {len(messages)} msg', flush=True)

    def _meta(d: dict) -> dict:
        d.setdefault('promptChars', prompt_chars)
        d.setdefault('responseChars', len(d.get('text', '') or ''))
        d.setdefault('elapsedMs', int((time.time() - t0) * 1000))
        if provider != 'mock':
            tag = ('  [LLM]', 'g') if d.get('success') else ('  [LLM]', 'r')
            what = f"回 {d['responseChars']:,} 字" if d.get('success') else f"✗ {str(d.get('error', ''))[:120]}"
            print(c(*tag), f'← {provider}/{model} · {d["elapsedMs"] / 1000:.1f}s · {what}', flush=True)
        return d

    if provider == 'mock':
        return _meta(_mock_response(system, messages))
    if provider == 'claude-code':
        return _meta(_claude_code_request(api_key, model, system, messages, effort))
    try:
        if provider == 'anthropic':
            url = 'https://api.anthropic.com/v1/messages'
            headers = {'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01'}
            # 当前代次合规（4.7+·spec §2.2）：adaptive thinking；不发采样参数（发即 400）；
            # system 尾块打 cache_control（catalog 大而稳·多轮编辑省输入费）；max_tokens 抬底
            # （thinking 计入输出预算·太小会把 manifest 掐半截）。
            body = json.dumps({
                'model': model, 'max_tokens': max(max_tokens, 16000),
                'thinking': {'type': 'adaptive'},
                'system': [{'type': 'text', 'text': system, 'cache_control': {'type': 'ephemeral'}}],
                'messages': messages,
            }).encode()
            fmt, timeout = 'anthropic', 300
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
        usage = None
        if fmt == 'anthropic':
            # 4.7+ 响应可含 thinking 块——遍历 blocks 取 text，绝不假设 content[0] 是文本；
            # refusal 明报错不静默（安全分类器拒答=HTTP 200·stop_reason='refusal'）。
            if data.get('stop_reason') == 'refusal':
                return _meta({'success': False, 'error': 'Claude 安全分类器拒答（refusal）——换个说法或换模型档再试'})
            text = ''.join(b.get('text', '') for b in data.get('content', []) if b.get('type') == 'text')
            usage = data.get('usage')
        elif fmt == 'ollama':
            text = data.get('message', {}).get('content', '')
            usage = {k: data[k] for k in ('prompt_eval_count', 'eval_count') if k in data} or None
        else:
            text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            usage = data.get('usage')
        return _meta({'success': True, 'text': text, 'usage': usage})
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        return _meta({'success': False, 'error': f'API error {e.code}: {err_body[:500]}'})
    except Exception as e:
        return _meta({'success': False, 'error': str(e)})

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
    global _MOCK_BAD_REMAINING, _MOCK_BAD_MANIFEST_REMAINING
    s = system or ''
    # 产文本的两模式：从不注坏 JSON（对它们无意义）。
    if s == DESIGN_CHAT_SYSTEM:
        return {'success': True, 'text': _mock_design_chat(messages)}
    if s == DESIGN_REVISE_SYSTEM:
        return {'success': True, 'text': _mock_design_revise(messages)}
    # 以下皆为产 JSON 的模式：honor bad-N（坏 JSON）→ 再 honor bad-manifest-N（合法 JSON·校验不过）。
    if _MOCK_BAD_REMAINING > 0:
        _MOCK_BAD_REMAINING -= 1
        return {'success': True, 'text': '{ "name": "broken", oops not valid json '}
    if _MOCK_BAD_MANIFEST_REMAINING > 0:
        _MOCK_BAD_MANIFEST_REMAINING -= 1
        bad = _mock_manifest()
        bad['capabilities'] = list(bad['capabilities']) + ['zz-mock-bogus-cap']  # 未知能力 → manifest-check 拒
        return {'success': True, 'text': json.dumps(bad, ensure_ascii=False)}
    if s.startswith(_DESIGN_BREAKDOWN_HEAD):
        return {'success': True, 'text': _mock_breakdown_json()}
    # template-edit：user_msg 带「## Baseline manifest」→ 对基线做确定性小改（revise 式染色）回全文。
    tpl_marker = '## Baseline manifest'
    tpl_src = next((str(m.get('content', '')) for m in messages
                    if m.get('role') == 'user' and tpl_marker in str(m.get('content', ''))), None)
    if tpl_src is not None:
        b = tpl_src.split(tpl_marker, 1)[1].split('## 用户想要', 1)[0]
        i, j = b.find('{'), b.rfind('}')
        try:
            base = json.loads(b[i:j + 1]) if 0 <= i < j else _mock_manifest()
        except Exception:
            base = _mock_manifest()
        return {'success': True, 'text': json.dumps(_mock_revise(base), ensure_ascii=False)}
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
                           user_msg: str, autofix: bool, max_attempts: int = 3,
                           *, log_mode: str = 'generate', rebuild_system=None) -> dict:
    """messages 起于一条 user_msg。每轮：调 LLM → JSON parse →（autofix 时）manifest-check 校验。
    失败时**把错误改写成一句可执行修改指令**回喂重问，≤max_attempts。传输/网络错误直接返回（不重试网络层）。

    token/缓存卫生（REQ-STUDIO 低模 ④）：回喂只带「base_user + 上一轮 assistant + 本轮错误指令」，
    **裁掉更早轮次的失败输出**（防对话超线性膨胀）；system 逐轮字节稳定（除非 rebuild_system 主动扩词表）。
    词汇按需扩（低模 ②）：错误点名"未知能力"且它其实是被裁掉的真实能力 → rebuild_system 补它整族。
    每轮落一行 LLM 交互日志（心跳单第 0 项）。autofix=False：只跑一轮 + 软告警，保持旧 GameCreator 行为。"""
    base_user = {'role': 'user', 'content': user_msg}
    attempts = 0
    fixed_errors: list[str] = []       # 原始校验错误（回前端「查看原始校验错误」区块）
    fix_instructions: list[str] = []   # LLM 化的可执行修改指令（回喂 LLM）
    cur_system = system
    last_assistant = None
    last_instruction = None
    limit = max_attempts if autofix else 1
    while attempts < limit:
        attempts += 1
        # 轮次裁剪：首轮只 base_user；重试轮 = base_user + 上一轮输出 + 本轮错误指令（不累积历史失败）。
        if last_assistant is None:
            messages = [base_user]
        else:
            messages = [base_user,
                        {'role': 'assistant', 'content': last_assistant},
                        {'role': 'user', 'content': last_instruction}]
        mode_label = log_mode if attempts == 1 else f'autofix-{attempts}'
        r = _provider_request(provider, api_key, model, cur_system, messages)
        if not r.get('success'):
            _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                     validation='error', errors=[r.get('error')], prompt_full=cur_system)
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'),
                    'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors,
                    'fix_instructions': fix_instructions}
        text = r['text']
        try:
            manifest = json.loads(_extract_json(text))
        except Exception as e:
            raw = f'输出不是合法 JSON：{e}'
            instr = ('你上次的输出不是合法 JSON。只输出完整 manifest 的纯 JSON 对象'
                     '（从 { 开始到 } 结束），不要 markdown 围栏、不要任何解释文字。')
            _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                     validation='fail', errors=[raw], prompt_full=cur_system, response_full=text)
            if not autofix:
                return {'success': False, 'error': f'Invalid JSON from LLM: {e}',
                        'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors,
                        'fix_instructions': fix_instructions}
            fixed_errors.append(raw)
            fix_instructions.append(instr)
            last_assistant, last_instruction = text, instr
            continue
        if not autofix:
            _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                     validation='skip', errors=[], prompt_full=cur_system, response_full=text)
            warnings = _validate_blueprint(manifest)
            return {'success': True, 'error': None, 'blueprint': manifest, 'manifest': manifest,
                    'warnings': warnings, 'attempts': attempts, 'fixed_errors': fixed_errors,
                    'fix_instructions': fix_instructions}
        ok, msg = _run_manifest_check(manifest)
        _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                 validation='pass' if ok else 'fail', errors=[] if ok else [msg],
                 prompt_full=cur_system, response_full=text)
        if ok:
            warnings = _validate_blueprint(manifest)
            return {'success': True, 'error': None, 'blueprint': manifest, 'manifest': manifest,
                    'warnings': warnings, 'attempts': attempts, 'fixed_errors': fixed_errors,
                    'fix_instructions': fix_instructions}
        instr, unknown_ids = _llm_ify_error(msg, manifest)
        fixed_errors.append(msg)
        fix_instructions.append(instr)
        if rebuild_system and unknown_ids:  # 错误点名未知能力 → 尝试补该族全量（下轮 system 换新）
            new_sys = rebuild_system(unknown_ids)
            if new_sys:
                cur_system = new_sys
        last_assistant, last_instruction = text, instr
    return {'success': False, 'error': f'自动修正 {attempts} 次后仍未通过校验，换个说法再试试。',
            'blueprint': None, 'attempts': attempts, 'fixed_errors': fixed_errors,
            'fix_instructions': fix_instructions, 'raw_error': fixed_errors[-1] if fixed_errors else None}

# ── 低模生成四件（REQ-STUDIO·让弱模型不在 81 项词表里从零作曲）─────────────────
# ③ 校验错误 LLM 化：把 manifest-check 的机读错误改写成「一句可执行修改指令」（指名 entity/字段 +
#   合法值示例）。侵入最小方案=纯 apollo.py 侧字符串映射层，不改引擎校验器（manifest-check.mjs）。
_RE_UNKNOWN_CAP = re.compile(r'未知 capability id[:：]\s*(.+?)（')
# formatIssues 形状：「<entity>.<Comp>.<field> —— <Comp>.<field> 应为 number，实为 string」，
# 把 entity.Comp.field 与其后的 应为<type> 绑起来抽取（entity id 允许连字符）。
_RE_COMP_TYPE = re.compile(
    r'([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*——\s*[A-Za-z0-9_]+\.[A-Za-z0-9_]+\s*应为\s*(number|boolean)')

def _llm_ify_error(msg: str, manifest: dict):
    """manifest-check 机读错误 → (可执行修改指令, 名到的未知能力 id 集)。unknown 供词汇族按需扩用。"""
    msg = msg or ''
    lines: list[str] = []
    unknown: set[str] = set()
    m = _RE_UNKNOWN_CAP.search(msg)
    if m:
        caps = [c.strip() for c in re.split(r'[,，、]\s*', m.group(1)) if c.strip()]
        unknown.update(caps)
        cap_list = '、'.join(f'`{c}`' for c in caps)
        lines.append(f'capabilities 数组里出现了目录中没有的能力 id：{cap_list}。把它们删掉，'
                     f'或替换成"能力目录"里真实列出的 id（未知 id 会被引擎拒绝加载）。')
    for ent, comp, field, typ in _RE_COMP_TYPE.findall(msg)[:8]:
        example = '0 这样的纯数字（不要加引号）' if typ == 'number' else 'true 或 false（布尔·不要加引号）'
        lines.append(f'实体 `{ent}` 的组件 `{comp}` 的字段 `{field}` 必须是 {typ}——把它的值改成 {example}。')
    if not lines:  # 结构/其它错误：原样给 + 通用可执行包装
        lines.append(f'上一版 manifest 没通过引擎校验：{_trunc(msg, 300)}。请据此修正。')
    instruction = ('该 manifest 未通过引擎校验，请按下面逐条修改（只改需要改的，其余保持原样），'
                   '然后只输出完整的修正后 manifest 纯 JSON：\n- ' + '\n- '.join(lines))
    return instruction, unknown

# ② 词汇按题材裁剪：把前端送来的**全量** catalog 文本按能力 id 切块 → 只保留需要的子集（模板已用族 +
#   基础原子 + 命中题材族）。buildCapabilityCatalog 不动（引擎域）；纯字符串切片，确定性、字节稳定。
_CAT_BLOCK_RE = re.compile(r'^- (\S+) ')

def _catalog_blocks(full: str):
    """catalog 文本 → [(id, block_text)]（每块 = 「- id (...)」起、到下一块前止；保原顺序）。"""
    blocks, cur_id, cur = [], None, []
    for line in (full or '').split('\n'):
        m = _CAT_BLOCK_RE.match(line)
        if m:
            if cur_id is not None:
                blocks.append((cur_id, '\n'.join(cur)))
            cur_id, cur = m.group(1), [line]
        elif cur_id is not None:
            cur.append(line)
    if cur_id is not None:
        blocks.append((cur_id, '\n'.join(cur)))
    return blocks

def _catalog_block_ids(full: str) -> set:
    return {bid for bid, _ in _catalog_blocks(full)}

def _slice_catalog(full: str, keep_ids) -> str:
    """按 keep_ids 选块（保原顺序）。无块结构（fallback 单行目录）或一个都没命中 → 原样返回，绝不给空词表。"""
    blocks = _catalog_blocks(full)
    if not blocks:
        return full
    keep = set(keep_ids)
    picked = [txt for bid, txt in blocks if bid in keep]
    return '\n'.join(picked) if picked else full

def _template_family_ids(template: dict, families) -> list:
    """模板已用能力 + 基础原子 + 命中题材族 → 去重保序的能力 id 列表（喂 _slice_catalog）。"""
    ids = list(_BASE_ATOM_IDS) + list(template.get('capabilities', []))
    for fam in families:
        ids += CAPABILITY_FAMILIES.get(fam, [])
    seen, out = set(), []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out

def _pick_template(prompt: str):
    """① 关键词 → 最近的能跑模板 + 题材族（纯数据映射·首个命中胜·默认物理弹跳）。返回 (template, families)。"""
    p = (prompt or '').lower()
    for key, families, kws in TEMPLATE_KEYWORDS:
        if any(kw.lower() in p for kw in kws):
            return TEMPLATE_LIBRARY[key], list(families)
    return TEMPLATE_LIBRARY['bounce'], ['platform']

TEMPLATE_EDIT_TASK = (
    "Below is a runnable baseline Apollo Engine manifest (it already passes engine validation) and the "
    "game the user wants. Modify the baseline into the user's game by editing ONLY what the idea needs — "
    "rename entities, tweak numbers, swap colors/art, add or remove a few entities. Reuse the baseline's "
    "capabilities and shape wherever possible. Enable ONLY capability ids that appear in the catalog in the "
    "system prompt. Output the COMPLETE modified manifest as pure JSON (no markdown, no explanation)."
)

def _handle_template_edit(provider: str, api_key: str, model: str, body: dict, catalog: str) -> dict:
    """① 模板起步 + 增量修改（默认路径）：关键词选模板 → 注入题材子集词表 → LLM 改基线出完整 manifest。
    ② 校验错误点名未裁进来的真实能力 → 下轮补该族全量（rebuild_system）。走 autofix 硬校验回路。"""
    prompt = str(body.get('prompt') or '').strip()
    if not prompt:
        return {'success': False, 'error': 'template-edit 需要 prompt（一句话创意）', 'blueprint': None}
    full = catalog or _FALLBACK_CATALOG
    template, families = _pick_template(prompt)
    keep = _template_family_ids(template, families)
    known_ids = _catalog_block_ids(full)

    def _rebuild(unknown_ids):
        added = False
        for cid in unknown_ids:
            if cid in known_ids and cid not in keep:  # 是真实能力、只是被裁掉了 → 补它 + 它整族
                keep.append(cid)
                added = True
                for _fam, ids in CAPABILITY_FAMILIES.items():
                    if cid in ids:
                        for x in ids:
                            if x in known_ids and x not in keep:
                                keep.append(x)
        if not added:
            return None
        return GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', _slice_catalog(full, keep))

    system = GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', _slice_catalog(full, keep))
    baseline = _template_manifest(template)
    user_msg = (TEMPLATE_EDIT_TASK
                + '\n\n## Baseline manifest（已能通过引擎校验的可运行基线·题材=' + template['key'] + '）\n'
                + json.dumps(baseline, ensure_ascii=False, indent=2)
                + '\n\n## 用户想要的游戏\n' + prompt
                + '\n\nOutput the COMPLETE modified manifest as pure JSON.')
    res = _generate_with_autofix(provider, api_key, model, system, user_msg, autofix=True,
                                 log_mode='template-edit', rebuild_system=_rebuild)
    res['template'] = template['key']
    return res

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
    _llm_log(provider=provider, model=model, mode='chat', req=r,
             validation='n/a' if r.get('success') else 'error',
             errors=[] if r.get('success') else [r.get('error')],
             prompt_full=DESIGN_CHAT_SYSTEM, response_full=r.get('text', ''))
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
        mode_label = 'breakdown' if attempts == 1 else f'autofix-{attempts}'
        r = _provider_request(provider, api_key, model, system, msgs)
        if not r.get('success'):
            _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                     validation='error', errors=[r.get('error')], prompt_full=system)
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'), 'attempts': attempts, 'fixed_errors': errors}
        text = r['text']
        ok, res = _parse_design_files(text)
        _llm_log(provider=provider, model=model, mode=mode_label, req=r,
                 validation='pass' if ok else 'fail', errors=[] if ok else [res],
                 prompt_full=system, response_full=text)
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
    _llm_log(provider=provider, model=model, mode='design-revise', req=r,
             validation='n/a' if r.get('success') else 'error',
             errors=[] if r.get('success') else [r.get('error')],
             prompt_full=DESIGN_REVISE_SYSTEM, response_full=r.get('text', ''))
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
    return _generate_with_autofix(provider, api_key, model, system, user_msg, autofix=True, log_mode='prototype')


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
    # 低模默认路径（REQ-STUDIO 低模 ①）：从最近的能跑模板做增量修改（题材子集词表 + 校验回路）。
    if mode == 'template-edit':
        return _handle_template_edit(provider, api_key, model, body, catalog)

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

    return _generate_with_autofix(provider, api_key, model, system, user_msg, autofix,
                                  log_mode='revise' if mode == 'revise' else 'generate')

# ── Workshop 双角色对话（POST /api/agent/chat·REQ-WORKSHOP B·spec=workshop-spec §2.3）────
# 策划（gd）/程序（pe）两入口共用编排：全量 messages + 当前 manifest 上下文 → 网关（订阅通道
# claude-code / BYO key 皆可）。回复=对白 reply；模型提出具体改动时输出**完整 manifest** 的
# ```json 块——服务端过 _run_manifest_check（一轮错误回喂修正）后才回传 manifest 字段。
# **绝不代落盘**——「应用改动」是前端显式 PUT（spec §四红线：对话是入口，工件是唯一真相）。

AGENT_CHAT_COMMON = """You are the Apollo Workshop copilot for the game "{GAME_NAME}" (slug: {GAME_SLUG}).
Reply in Chinese, conversationally and concretely. When — and ONLY when — you propose a concrete change
to the game, append the COMPLETE updated manifest as exactly one fenced block:
```json
(the full manifest object)
```
Always the FULL manifest (never a fragment or diff); no other fenced json blocks; if you are only
discussing, output no json block at all.
"""

AGENT_PE_SYSTEM = AGENT_CHAT_COMMON + """
## Your role: 程序（engine-side programmer）
You own manifest STRUCTURE: entities, components, capabilities wiring. The capability catalog below is
the single source of truth for vocabulary — never invent components/fields; unknown ids are rejected on load.

## Capability catalog
{CAPABILITY_CATALOG}

## Current manifest
{CURRENT_MANIFEST}
"""

AGENT_GD_SYSTEM = AGENT_CHAT_COMMON + """
## Your role: 策划（game designer）
You own gameplay feel: tuning existing numeric fields, content/text, pacing, win/lose balance.
Prefer changing VALUES of existing fields over adding new components; structural additions belong to the
程序 tab, art direction belongs to the 美术 tab — suggest switching when the ask is theirs.

## Art ledger digest (this game · for context only — art changes go to the 美术 tab)
{ART_DIGEST}

## Current manifest
{CURRENT_MANIFEST}
"""

# 美术角色（owner 2026-07-11 改三入口：策划/美术/程序·spec §八修订）——台账为核心上下文。
AGENT_ART_SYSTEM = AGENT_CHAT_COMMON + """
## Your role: 美术（art director）
You own the game's LOOK: style direction, the art ledger, and skin slots. Reference ledger rows by their
number (e.g. art-03) so the UI can deep-link the art platform; suggest style-anchor wording (style pack /
stylePrompt) when asked about looks. Manifest changes you may propose: Sprite/skin-slot fields, colors,
sizes — gameplay numbers belong to 策划, structure to 程序. Generation itself runs on the art platform
(旧工作台 🎨) — you direct it via ledger row numbers, you do not fabricate image data.

## Art ledger digest (this game)
{ART_DIGEST}

## Current manifest
{CURRENT_MANIFEST}
"""

_AGENT_ROLES = ('gd', 'pe', 'art')

def _agent_art_digest(slug: str, cap: int = 40) -> str:
    """gd 角色的美术台账摘要：编号/状态/查询词/皮肤槽 + 风格锚。缺台账=明说（不是空串）。"""
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return '(no art ledger yet — it is derived automatically when the manifest is saved)'
    try:
        led = json.loads(f.read_text('utf-8'))
    except Exception:
        return '(art ledger unreadable)'
    lines = []
    style = led.get('artStyle') or {}
    if style.get('stylePrompt') or style.get('packId'):
        lines.append(f"style anchor: pack={style.get('packId') or '-'} · prompt={style.get('stylePrompt') or '-'}")
    for r in (led.get('rows') or [])[:cap]:
        skin = f" skin={r.get('skinKey')}" if r.get('skinKey') else ''
        lines.append(f"{r.get('no')} [{r.get('status')}] {r.get('query', '')}{skin}")
    return '\n'.join(lines) or '(empty ledger)'

def _split_reply_manifest(text: str):
    """回复文本 → (对白部分, manifest JSON 串或 None)。只认 ```json 围栏且顶层含 entities 的对象。"""
    if '```json' not in (text or ''):
        return (text or '').strip(), None
    pre, rest = text.split('```json', 1)
    block, _, post = rest.partition('```')
    block = block.strip()
    try:
        cand = json.loads(block)
        if isinstance(cand, dict) and isinstance(cand.get('entities'), dict):
            return (pre + post).strip(), block
    except Exception:
        pass
    return (text or '').strip(), None

def handle_agent_chat(body: dict) -> dict:
    """POST /api/agent/chat {slug, role: 'gd'|'pe', messages:[{role,content}…], provider?, model?, catalog?}。"""
    slug = str(body.get('slug', '')).strip()
    role = str(body.get('role', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if role not in _AGENT_ROLES:
        return {'success': False, 'error': f"role 必须是 {'/'.join(_AGENT_ROLES)}（策划=gd·程序=pe·美术=art）"}
    raw_msgs = body.get('messages')
    if not isinstance(raw_msgs, list) or not raw_msgs:
        return {'success': False, 'error': 'messages 必填（非空数组）'}
    if len(raw_msgs) > 40:
        return {'success': False, 'error': '对话过长（≤40 条·新起话题或摘要后继续）'}
    messages = []
    for m in raw_msgs:
        r = m.get('role') if isinstance(m, dict) else None
        content = m.get('content') if isinstance(m, dict) else None
        if r not in ('user', 'assistant') or not isinstance(content, str):
            return {'success': False, 'error': 'messages 每条须为 {role: user|assistant, content: 字符串}'}
        if len(content) > 8000:
            return {'success': False, 'error': '单条消息过长（≤8000 字）'}
        messages.append({'role': r, 'content': content})
    if messages[-1]['role'] != 'user':
        return {'success': False, 'error': '最后一条须是用户消息'}
    # 当前 manifest（library 优先·内置数据游戏回退 public）——对话上下文的唯一真相
    mf_path = LIBRARY_DIR / slug / 'manifest.json'
    if not mf_path.is_file():
        mf_path = ROOT / 'public' / 'games' / slug / 'manifest.json'
    if not mf_path.is_file():
        return {'success': False, 'error': f'游戏不存在（library 与 public 均无 manifest）: {slug}'}
    try:
        current = json.loads(mf_path.read_text('utf-8'))
    except Exception as e:
        return {'success': False, 'error': f'manifest 解析失败: {e}'}
    try:
        game_name = json.loads((LIBRARY_DIR / slug / 'meta.json').read_text('utf-8')).get('name') or slug
    except Exception:
        game_name = slug

    provider = body.get('provider') or _load_config().get('default') or 'claude-code'
    if provider != 'mock' and provider not in LLM_PROVIDERS:
        return {'success': False, 'error': f'Unknown provider: {provider}'}
    api_key = get_api_key(provider)
    if not api_key:
        env_key = LLM_PROVIDERS.get(provider, {}).get('env_key', '?')
        return {'success': False, 'error': f'{provider} 无可用凭据（配置 {env_key} 或在设置里填）'}
    models = LLM_PROVIDERS.get(provider, {}).get('models') or ['mock']
    model = body.get('model') or _config_model(provider) or models[0]
    if body.get('model') and provider != 'mock' and body['model'] not in models:
        return {'success': False, 'error': f'{provider} 不认识型号 {body["model"]}（可选: {", ".join(models)}）'}
    effort = body.get('effort') or 'high'  # 思考档（owner 07-11「默认 high·可调」·仅订阅通道生效）
    if effort not in _CLAUDE_EFFORTS:
        return {'success': False, 'error': f'effort 必须是 {"/".join(_CLAUDE_EFFORTS)}'}

    # mock 短路（APOLLO_MOCK_LLM=1·冒烟/e2e 全链）：确定性染色微调 + 过真校验门
    if provider == 'mock':
        revised = _mock_revise(current)
        ok, msg = _run_manifest_check(revised)
        out = {'success': True, 'reply': '（mock）已按要求做一处演示微调：把首个可见实体染红。点「应用改动」落盘。',
               'attempts': 1, 'provider': provider, 'model': model, 'role': role}
        if ok:
            out['manifest'] = revised
        else:
            out['manifestError'] = msg
        if role in ('gd', 'art'):
            out['artHints'] = []
        return out

    tpl = {'gd': AGENT_GD_SYSTEM, 'pe': AGENT_PE_SYSTEM, 'art': AGENT_ART_SYSTEM}[role]
    system = (tpl.replace('{GAME_NAME}', str(game_name)).replace('{GAME_SLUG}', slug)
              .replace('{CURRENT_MANIFEST}', json.dumps(current, ensure_ascii=False))
              .replace('{CAPABILITY_CATALOG}', str(body.get('catalog') or _FALLBACK_CATALOG))
              .replace('{ART_DIGEST}', _agent_art_digest(slug) if role in ('gd', 'art') else ''))

    attempts = 0
    reply_text, manifest_out, manifest_err = '', None, None
    cur_messages = messages
    while attempts < 2:  # 首轮 + 至多一轮校验错误回喂
        attempts += 1
        r = _provider_request(provider, api_key, model, system, cur_messages, max_tokens=16000, effort=effort)
        _llm_log(provider=provider, model=model, mode=f'agent-{role}' if attempts == 1 else f'agent-{role}-fix',
                 req=r, validation=None if r.get('success') else 'error',
                 errors=[] if r.get('success') else [r.get('error')], prompt_full=system)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', 'LLM 请求失败'), 'attempts': attempts}
        text = r['text']
        reply_text, block = _split_reply_manifest(text)
        if block is None:
            manifest_out, manifest_err = None, None
            break  # 纯对白轮：合法结果
        candidate = json.loads(block)  # _split_reply_manifest 已保证可解析
        ok, msg = _run_manifest_check(candidate)
        if ok:
            manifest_out, manifest_err = candidate, None
            break
        manifest_err = msg
        instr, _unknown = _llm_ify_error(msg, candidate)
        cur_messages = messages + [{'role': 'assistant', 'content': text},
                                   {'role': 'user', 'content': instr + ' 修好后重发完整回复（对白 + 一个完整 manifest 的 ```json 块）。'}]
    out = {'success': True, 'reply': reply_text, 'attempts': attempts, 'provider': provider, 'model': model, 'role': role}
    if manifest_out is not None:
        out['manifest'] = manifest_out
    elif manifest_err:
        out['manifestError'] = manifest_err
    if role in ('gd', 'art'):
        out['artHints'] = sorted(set(re.findall(r'\bart-\d{2,3}\b', reply_text)))
    return out

# ── 设置端点（BYO key 面板 · M3）────────────────────────────────────────
# 面板 provider 顺序：千问第一，anthropic/deepseek/openai 兼容随后，ollama（本地·免 key）末位；
# mock 仅 env 开启时追加。GET 打码回显（绝不回传原文），PUT 写 .apollo-config.json（gitignore）。
SETTINGS_PROVIDER_ORDER = ['claude-code', 'qwen', 'anthropic', 'deepseek', 'openai', 'local']

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
    gk = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
    gen_keys = []
    for name in GEN_KEY_NAMES:
        cfg_v = gk.get(name) if isinstance(gk.get(name), str) and str(gk.get(name)).strip() else None
        gen_keys.append({
            'envKey': name,
            'apiKeyMasked': _mask_key(cfg_v) if cfg_v else '',
            'hasConfigKey': cfg_v is not None,
            'keyAvailable': bool(os.environ.get(name) or cfg_v or (name == 'DASHSCOPE_API_KEY' and _config_api_key('qwen'))),
        })
    return {'providers': providers, 'default': cfg.get('default'), 'genKeys': gen_keys}

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
    gen_in = body.get('genKeys')
    if isinstance(gen_in, dict):  # 生成 key（美术 API·R1 ②c）：送了才改；空串=清除
        cur = cfg.get('genKeys') if isinstance(cfg.get('genKeys'), dict) else {}
        cur = dict(cur)
        for name in GEN_KEY_NAMES:
            if name in gen_in:
                v = gen_in.get(name)
                if isinstance(v, str) and v.strip():
                    cur[name] = v.strip()
                else:
                    cur.pop(name, None)
        cfg['genKeys'] = cur
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

# ══ 低模模板库（REQ-STUDIO 低模 ①）══════════════════════════════════════════════
# 内置「能跑模板 manifest」库（按题材键）——弱模型不再从零作曲，而是从最近的可运行基线做增量修改。
# **每个模板都过 manifest-check 全绿**（守护：scripts/studio-lowmodel-smoke.py 逐个校验）。
# 收编自现有 PRESET（platform-jump/pong）+ 系统词最小样例（bounce）+ 新增题材（collect/dice/cards）。
_TEXT = {'fontSize': 16, 'fontFamily': 'sans-serif', 'anchor': 'center', 'lineSpacing': 1.2}

TEMPLATE_LIBRARY = {
    'bounce': {
        'key': 'bounce', 'name': '弹跳小球', 'description': '一个小球在重力下下落，撞到地面就反弹',
        'capabilities': ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
                         'l5-camera', 'b3-mass', 'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply',
                         't2-collision-resolve', 't2-bounds-clamp'],
        'entities': {
            'camera': _CAM,
            'ball': {'Transform': {'x': 320, 'y': 60, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Velocity': {'vx': 2, 'vy': 0, 'angular': 0}, 'Acceleration': {'ax': 0, 'ay': 0.5},
                     'Shape': {'kind': 'circle', 'radius': 12}, 'Color': {'tint': 0x4ae0d0, 'alpha': 1},
                     'Mass': {'value': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'ground': {'Transform': {'x': 320, 'y': 380, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Shape': {'kind': 'box', 'width': 640, 'height': 40}, 'Color': {'tint': 0x36363e, 'alpha': 1},
                       'Mass': {'value': 0}},
        },
    },
    'platform-jump': {
        'key': 'platform-jump', 'name': '平台跳跃', 'description': '带重力的横版平台跳跃：玩家在若干平台间移动',
        'capabilities': list(PRESET_BLUEPRINTS['platformer']['capabilities']),
        'entities': json.loads(json.dumps(PRESET_BLUEPRINTS['platformer']['entities'])),
    },
    'pong': {
        'key': 'pong', 'name': '弹球对战', 'description': '两名玩家用球拍接弹球（Pong）',
        'capabilities': list(PRESET_BLUEPRINTS['pong']['capabilities']),
        'entities': json.loads(json.dumps(PRESET_BLUEPRINTS['pong']['entities'])),
    },
    'collect': {
        'key': 'collect', 'name': '收集金币', 'description': '俯视角玩家在场地里移动，碰到金币把它收集掉',
        'capabilities': ['a1-transform', 'b1-velocity', 'c1-shape', 'l2-color', 'l5-camera', 'g1-tag',
                         'd1-overlap-detect', 't2-trigger-zone', 't2-bounds-clamp', 't1-motion-apply',
                         'k2-destroy', 'f1-resource'],
        'entities': {
            'camera': _CAM,
            'player': {'Transform': {'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 22, 'height': 22},
                       'Color': {'tint': 0x38bdf8, 'alpha': 1}, 'Controllable': {'playerId': 'p1', 'speed': 3},
                       'Tag': {'flags': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'score': {'Resource': {'id': 'score', 'current': 0, 'min': 0, 'max': 999}},
            'coin1': {'Transform': {'x': 120, 'y': 100, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
            'coin2': {'Transform': {'x': 500, 'y': 140, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
            'coin3': {'Transform': {'x': 300, 'y': 320, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
        },
    },
    'dice': {
        'key': 'dice', 'name': '掷骰子', 'description': '掷两颗骰子，按点数比大小/结算——按空格重掷',
        'capabilities': ['a1-transform', 'c1-shape', 'l2-color', 'l5-camera', 'l6-text',
                         'w1-random', 't2-dice-roll', 't2-keybind'],
        'entities': {
            'camera': _CAM,
            'world': {'RandomSeed': {'seed': 12345, 'sequence': 0}},
            'roller': {
                'KeyBinding': {'key': ' ', 'signal': 'roll', 'phase': 'down'},
                'DicePool': {'dice': [{'faces': [{'value': v, 'element': 0} for v in range(1, 7)]},
                                      {'faces': [{'value': v, 'element': 0} for v in range(1, 7)]}],
                             'rollOnSignal': 'roll', 'locked': []},
            },
            'die1': {'Transform': {'x': 250, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 56, 'height': 56}, 'Color': {'tint': 0xf1f5f9, 'alpha': 1},
                     'Text': {'content': '?', **_TEXT}},
            'die2': {'Transform': {'x': 390, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 56, 'height': 56}, 'Color': {'tint': 0xf1f5f9, 'alpha': 1},
                     'Text': {'content': '?', **_TEXT}},
        },
    },
    'cards': {
        'key': 'cards', 'name': '卡牌桌', 'description': '一张扑克牌桌：一手牌 + 出牌评分（Balatro 式底座）',
        'capabilities': ['a1-transform', 'c1-shape', 'l2-color', 'l5-camera', 'l6-text',
                         't2-card-pile', 't2-card-play', 't3-poker-hand', 'f2-flag'],
        'entities': {
            'camera': _CAM,
            'table': {
                'CardPile': {'owner': 'p1', 'deck': list(range(0, 52)), 'hand': [], 'handSize': 5},
                'PlayedHand': {'cards': []},
                'Flag': {'id': 'p1', 'active': False},
            },
            'card1': {'Transform': {'x': 190, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'A', **_TEXT}},
            'card2': {'Transform': {'x': 260, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'K', **_TEXT}},
            'card3': {'Transform': {'x': 330, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'Q', **_TEXT}},
        },
    },
}

def _template_manifest(tpl: dict) -> dict:
    """模板条目 → 完整 manifest（name/description/capabilities/entities·深拷贝防污染）。"""
    return {'name': tpl['name'], 'description': tpl['description'],
            'capabilities': list(tpl['capabilities']),
            'entities': json.loads(json.dumps(tpl['entities']))}

# 基础原子（任何题材都注入的最小词表底座）+ 题材能力族（纯数据·命中关键词时整族注入·校验漏词也补它）。
_BASE_ATOM_IDS = ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'b3-mass', 'l2-color',
                  'l5-camera', 'l6-text', 't1-motion-apply', 't1-accel-apply',
                  'd1-overlap-detect', 't2-collision-resolve', 't2-bounds-clamp']
CAPABILITY_FAMILIES = {
    'platform': ['t2-ground-sense', 't2-jump', 't2-friction', 'i1-input-capture', 'i2-action-map', 'g1-tag'],
    'collect':  ['g1-tag', 't2-trigger-zone', 'f1-resource', 'k2-destroy', 't2-clickable', 't2-text-binding'],
    'dice':     ['w1-random', 't2-dice-roll', 't2-keybind', 't2-event-when', 't2-effect-apply', 'f1-resource', 'f2-flag', 't2-text-binding'],
    'cards':    ['t2-card-pile', 't2-card-play', 't3-poker-hand', 't3-card-scoring', 't2-clickable', 'f1-resource', 'f2-flag', 't2-text-binding'],
    'combat':   ['t2-hitbox', 't2-mortal', 'f1-resource', 'g1-tag', 'k1-spawn', 'k2-destroy', 't2-steering', 'g2-relation'],
    'ui':       ['l6-text', 't2-text-binding', 't2-gauge', 't2-clickable'],
}
# 关键词 → (模板 key, 题材族)。首个命中胜；默认物理弹跳。中英文皆可（英文小写匹配）。
TEMPLATE_KEYWORDS = [
    ('dice',          ['dice', 'ui'],    ['骰', '掷', '色子', '点数', '比大小', 'dice', 'roll']),
    ('cards',         ['cards', 'ui'],   ['卡牌', '扑克', '抽牌', '手牌', '出牌', 'card', 'poker', 'deck', 'balatro']),
    ('pong',          ['platform'],      ['乒乓', '球拍', '弹球', '接球', 'pong', 'paddle']),
    ('platform-jump', ['platform'],      ['平台', '横版', '马里奥', '闯关', '跳跃', 'platform', 'jump', 'mario']),
    ('collect',       ['collect', 'ui'], ['收集', '金币', '吃', '迷宫', '采集', 'collect', 'coin', 'gather', 'maze', 'pac']),
    ('bounce',        ['platform'],      ['弹', '球', '重力', '物理', '掉落', 'bounce', 'ball', 'gravity', 'physics', 'fall']),
]

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

# ── AI 文本生成资产（tripo·meshy 文本→3D · qwen 文本→2D）──────────────────────────
# 生成"大脑"在 PA 车道的 scripts/ai-gen.mjs（它落文件 + upsert index.json）；本端点只是薄胶水：
# 校验入参 → shell 调脚本（--mock --json）→ 回机读结果给库刷新。真调 API 走脚本内的 env key + 放宽网络。
# 适配器闭集与脚本 ADAPTERS 对齐（新增 provider 两处同改：脚本注册 + 此白名单）。

GEN_ADAPTERS = ('tripo', 'meshy', 'qwen')

def handle_asset_generate(body: dict) -> dict:
    """POST /api/assets/generate。body = { adapter:'tripo'|'meshy'|'qwen', prompt:str, game?:str }。
    mock 仅在显式 body.mock=true 时传（R1 ②a·去无条件 --mock）；无 key 时脚本自行探针+mock 兜底，绝不静默顶替。
    人审门（M2.5·宪法）：产物**落待审区**（pending.json，不进 index.json）·返回预览 URL；人经
    /api/assets/review approve 才登记入库。生成**绝不**自动入库。"""
    adapter = str(body.get('adapter', '')).strip()
    prompt = str(body.get('prompt', '')).strip()
    game = body.get('game')
    if adapter not in GEN_ADAPTERS:
        return {'success': False, 'error': f'未知适配器: {adapter or "(空)"}（支持 {"/".join(GEN_ADAPTERS)}）'}
    if not prompt:
        return {'success': False, 'error': 'prompt 不能为空'}
    if len(prompt) > 500:
        return {'success': False, 'error': 'prompt 过长（≤500 字）'}
    cmd = ['node', 'scripts/ai-gen.mjs', adapter, prompt, '--json'] + (['--mock'] if body.get('mock') else [])
    if game:
        g = str(game)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', g):  # 白名单：防注入/路径穿越
            return {'success': False, 'error': f'非法 game 名: {g}'}
        cmd += ['--game', g]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=180, env=_gen_env())
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
    print(c("  [AI-GEN]", 'g'), f"{adapter} → {res.get('id')} → 待审区 ({res.get('scope')}{' ·mock' if res.get('mock') else ''})")
    return {'success': True, **res}


def handle_asset_generate_providers() -> dict:
    """GET /api/assets/generate/providers。列出各生成 provider 的 envKey / 是否已配 key（脚本打码·绝不回明文）。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/ai-gen.mjs', 'providers']), cwd=ROOT, capture_output=True, timeout=30, env=_gen_env())
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

_CATALOG_CACHE = None

def handle_catalog() -> dict:
    """GET /api/catalog。引擎全量能力目录（buildCapabilityCatalog 服务端 parity·进程内缓存）——
    Workshop 壳无 vite 侧 import，生成/程序对话的词汇表从这取（REQ-WORKSHOP A）。"""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is None:
        try:
            proc = subprocess.run(**_spawn(['npx', 'vite-node', 'scripts/dump-capability-catalog.mjs']),
                                  cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=120)
            _CATALOG_CACHE = proc.stdout if proc.returncode == 0 and (proc.stdout or '').strip() else ''
        except Exception:
            _CATALOG_CACHE = ''
    return {'success': bool(_CATALOG_CACHE), 'catalog': _CATALOG_CACHE or None}

_WORKSHOP_CHATS_DIR = ROOT / '.apollo' / 'workshop-chats'

def handle_agent_chats_get(slug: str) -> dict:
    """GET /api/agent/chats?slug=<slug>。工坊对话历史（每卡带每角色·owner 07-11「session 持久性」）。
    存 .apollo/workshop-chats/<slug>.json（gitignored·不进卡带版本史——聊天是工作台状态不是游戏数据）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    empty = {r: [] for r in _AGENT_ROLES}
    f = _WORKSHOP_CHATS_DIR / f'{slug}.json'
    if not f.is_file():
        return {'success': True, 'chats': empty}
    try:
        data = json.loads(f.read_text('utf-8'))
        chats = data.get('chats') if isinstance(data, dict) else None
        out = {r: (chats.get(r) if isinstance(chats, dict) and isinstance(chats.get(r), list) else []) for r in _AGENT_ROLES}
        return {'success': True, 'chats': out}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_agent_chats_put(body: dict) -> dict:
    """PUT /api/agent/chats {slug, chats:{gd|pe|art: [{role,content}…]}}。整份覆盖写（壳每轮回复后自动存）。
    守门：角色白名单·每条 {user|assistant, str≤8000}·每角色只留末 80 条（防无限膨胀）。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    chats_in = body.get('chats')
    if not isinstance(chats_in, dict):
        return {'success': False, 'error': 'chats 必填（对象 {gd|pe|art: 消息数组}）'}
    out = {}
    for r in _AGENT_ROLES:
        msgs = chats_in.get(r)
        clean = []
        for m in (msgs if isinstance(msgs, list) else [])[-80:]:
            role = m.get('role') if isinstance(m, dict) else None
            content = m.get('content') if isinstance(m, dict) else None
            if role in ('user', 'assistant') and isinstance(content, str) and len(content) <= 8000:
                clean.append({'role': role, 'content': content})
        out[r] = clean
    _WORKSHOP_CHATS_DIR.mkdir(parents=True, exist_ok=True)
    (_WORKSHOP_CHATS_DIR / f'{slug}.json').write_text(
        json.dumps({'version': 1, 'slug': slug, 'chats': out}, ensure_ascii=False, indent=1), 'utf-8')
    return {'success': True, 'counts': {r: len(out[r]) for r in _AGENT_ROLES}}


def handle_llm_logs(n: int = 50) -> dict:
    """GET /api/llm-logs[?n=50]。今天的 LLM 交互日志尾部（新在前·壳设置页「调试日志」块消费）。
    全文 prompt/response 不出端点（文件里才有·APOLLO_LOG_VERBOSE=1 时落）——端点只回度量行。"""
    n = max(1, min(int(n or 50), 200))
    f = LLM_LOGS_DIR / (time.strftime('%Y-%m-%d') + '.jsonl')
    lines = []
    if f.is_file():
        try:
            for raw in f.read_text('utf-8').splitlines()[-n:]:
                try:
                    rec = json.loads(raw)
                except Exception:
                    continue
                rec.pop('prompt', None); rec.pop('response', None)  # 全文只留文件·不出线
                lines.append(rec)
        except Exception as e:
            return {'success': False, 'error': str(e), 'file': str(f)}
    lines.reverse()
    return {'success': True, 'file': str(f), 'verbose': _log_verbose(), 'lines': lines}


def handle_version() -> dict:
    """GET /api/version。发布版本单一真相：优先最近 git tag（发布态）→ 无 tag 回退 package.json version。
    工作台账号卡/页脚显示的版本走此端点，随发布自动更新（不写死）。"""
    version, tag = None, None
    try:
        r = subprocess.run(['git', 'describe', '--tags', '--abbrev=0'],
                           cwd=ROOT, capture_output=True, text=True, timeout=3)
        if r.returncode == 0 and r.stdout.strip():
            tag = r.stdout.strip()
            version = tag.lstrip('vV')
    except Exception:
        pass
    if not version:
        try:
            version = json.loads((ROOT / 'package.json').read_text())['version']
        except Exception:
            version = '0.1.0'
    return {'version': version, 'tag': tag}


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

# ── AI 生成人审门（M2.5·REQ-ART）：待审区列表 + 审核（approve/reject）────────────────────
# 「大脑」在 scripts/ai-gen.mjs（writePending/reviewPending·登记契约单一真相·PA 会审）；
# 列表=纯数据聚合（读 pending.json）；审核=薄胶水 shell 调脚本（唯一改 index 的门=approve）。

def handle_asset_pending() -> dict:
    """GET /api/assets/pending。聚合共享货架 + 各游戏本地的待审区清单（读各 pending.json·不碰 index）。"""
    out = []
    shared = ROOT / 'assets' / 'ai' / 'pending.json'
    if shared.is_file():
        try:
            out += list(json.loads(shared.read_text('utf-8')).get('pending', []))
        except Exception:
            pass  # 清单损坏不炸端点
    gdir = ROOT / 'public' / 'games'
    if gdir.is_dir():
        for d in sorted(gdir.iterdir()):
            if d.is_dir() and GAME_RE.fullmatch(d.name):
                pj = d / 'art' / 'ai' / 'pending.json'
                if pj.is_file():
                    try:
                        out += list(json.loads(pj.read_text('utf-8')).get('pending', []))
                    except Exception:
                        pass
    return {'pending': out, 'count': len(out)}


def handle_asset_review(body: dict) -> dict:
    """POST /api/assets/review。body = { id:str, action:'approve'|'reject', game?:str }。
    approve=provenance 硬校验过 → 移出待审 + 登记 index；reject=删待审文件 + 清项。经 ai-gen.mjs review 施行。"""
    asset_id = str(body.get('id', '')).strip()
    action = str(body.get('action', '')).strip()
    game = body.get('game')
    if not asset_id or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*', asset_id) or '..' in asset_id:
        return {'success': False, 'error': f'非法 id: {asset_id or "(空)"}'}
    if action not in ('approve', 'reject'):
        return {'success': False, 'error': f'非法 action: {action or "(空)"}（approve|reject）'}
    cmd = ['node', 'scripts/ai-gen.mjs', 'review', asset_id, action, '--json']
    if game:
        g = str(game)
        if not GAME_RE.fullmatch(g):  # 白名单：防注入/路径穿越
            return {'success': False, 'error': f'非法 game: {g}'}
        cmd += ['--game', g]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '审核超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''  # 末行 JSON（reviewPending 失败也打 JSON·退出码 1）
    try:
        res = json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'审核失败: {err[:400]}'}
    if not res.get('ok'):
        return {'success': False, **res}  # 如 provenance 缺字段拒登记
    print(c("  [AI-GEN]", 'g'), f"review {action} → {asset_id}")
    return {'success': True, **res}

# ── 美术替换工作流（REQ-DEMO-T1·工作流档 docs/design/art-replacement-workflow.md）───────
# 大脑在 scripts/art-replace.mjs（derive/batch/replace）+ style-packs.mjs·src/assembly 引擎不动。
# 本端点薄胶水 shell 调：derive=扫 manifest 推台账；batch=按风格包批量生成（默认 mock·断点续跑·凭证探针）；
# replace=按编号重钉 manifest 引用，**落盘前过 parseManifest 零 error 铁律**（复用 library_put_manifest）。

def _art_replace_cli(args: list) -> dict:
    """shell scripts/art-replace.mjs → 解析末行 JSON（前面可能有 warn）。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/art-replace.mjs', *args]), cwd=ROOT, capture_output=True, timeout=300, env=_gen_env())
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': '美术工作流超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''
    try:
        return json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'ok': False, 'error': f'解析失败: {err[:400]}'}

def handle_art_packs() -> dict:
    """GET /api/art/style-packs。列风格包（packId/名称/palette/provider/post）。"""
    return _art_replace_cli(['packs'])

def handle_art_derive(body: dict) -> dict:
    """POST /api/art/derive {slug}。扫 library/<slug>/manifest.json 美术槽位 → 台账 art-ledger.json。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _art_replace_cli(['derive', slug])
    if res.get('ok'):
        print(c("  [ART]", 'g'), f"derive {slug} → {res.get('rows')} 槽位")
    return {'success': bool(res.get('ok')), **res}

def handle_art_ledger(slug: str) -> dict:
    """GET /api/art/ledger?slug=<slug>。读该游戏台账（=替换列表·同一份文件两视角）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账（先 /api/art/derive）'}
    try:
        return {'success': True, **json.loads(f.read_text('utf-8'))}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_art_batch(body: dict) -> dict:
    """POST /api/art/batch {slug, packId, mock?}。按风格包整批生成（默认 mock·断点续跑·无 key 行探针+mock）。"""
    slug = str(body.get('slug', '')).strip()
    pack = str(body.get('packId', '')).strip()
    mock = bool(body.get('mock', False))  # 显式才 mock（R1 ②）；无 key 时脚本探针+mock 兜底
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):  # 白名单：防注入
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    args = ['batch', slug, pack] + (['--mock'] if mock else [])
    prov = str(body.get('provider', '')).strip()
    if prov and GEN_PROVIDER_RE.fullmatch(prov):
        args += ['--provider', prov]
    res = _art_replace_cli(args)
    if res.get('ok'):
        s = res.get('summary', {})
        print(c("  [ART]", 'g'), f"batch {slug}·{pack} → 生成 {s.get('generated')} 缓存 {s.get('cached')} mock {s.get('mock')}")
    return {'success': bool(res.get('ok')), **res}

def handle_art_replace(body: dict) -> dict:
    """POST /api/art/replace {slug}。按编号重钉 manifest 引用 → **过 parseManifest 零 error** → 落盘 + 版本化。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _art_replace_cli(['replace', slug])
    if not res.get('ok'):
        return {'success': False, **res}
    manifest = res.get('manifest')
    if not isinstance(manifest, dict):
        return {'success': False, 'error': '替换未产出 manifest'}
    data = _put_manifest_anywhere(slug, manifest, '美术批量替换（art-replace）')  # 零 error 铁律（library 版本化/内置直写）
    if data.get('success'):
        print(c("  [ART]", 'g'), f"replace {slug} → 重钉 {res.get('replaced')} 引用·跳过 mock {res.get('skippedMock', 0)}·已落盘")
    return {'success': bool(data.get('success')), 'replaced': res.get('replaced'), 'skippedMock': res.get('skippedMock', 0), **data}

# ── T2 点名替换（三式）+ 换皮（REQ-DEMO-T2）───────────────────────────────────────
# 单槽重解析地基：regenerate=重新生成(可改prompt)·swap=从共享库选换·upload=上传替换；三式都过
# parseManifest 零 error 落盘（复用 library_put_manifest）。reskin=同玩法换风格包 → 存新卡带(reskinOf)。

_ART_NO_RE = re.compile(r'art-\d+')
_ASSET_ID_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*')

def _put_manifest_anywhere(slug: str, manifest: dict, note: str) -> dict:
    """统一落盘门：library 卡带走 library_put_manifest（校验+版本化）；内置纯数据游戏
    （public/games/<slug>/manifest.json·tracked·owner 2026-07-10）同过 parseManifest 零 error 门后直写。"""
    if (LIBRARY_DIR / slug).is_dir():
        status, data = library_put_manifest(slug, {'manifest': manifest, 'note': note})
        return data
    pub = ROOT / 'public' / 'games' / slug / 'manifest.json'
    if not pub.is_file():
        return {'success': False, 'error': f'游戏不存在（library 与 public 均无 manifest）: {slug}'}
    ok, msg = _run_manifest_check(manifest)
    if not ok:
        return {'success': False, 'error': msg}
    _write_json(pub, manifest)
    try:  # 内置数据游戏同享「落盘即台账刷新」（REQ-WORKSHOP C1·library 线在 library_put_manifest 已加）
        _art_replace_cli(['derive', slug])
    except Exception:
        pass
    return {'success': True, 'builtin': True}

def _art_save_manifest(slug: str, res: dict, note: str, extra: dict) -> dict:
    """CLI 产出 manifest → 过 parseManifest 零 error 落盘（library 版本化 / 内置直写）。"""
    if not res.get('ok'):
        return {'success': False, **res}
    manifest = res.get('manifest')
    if not isinstance(manifest, dict):
        return {'success': False, 'error': '未产出 manifest'}
    data = _put_manifest_anywhere(slug, manifest, note)
    return {'success': bool(data.get('success')), **extra, **data}

def handle_art_style(body: dict) -> dict:
    """POST /api/art/style {slug, stylePrompt?, packId?}。设该游戏的整体美术风格锚（台账头 artStyle·
    owner 07-09 review ②「整体美术风格提示词没地方设置」）。空串=清除。批量/单槽生成自动拼进每行 prompt。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账（先初始化该游戏的美术库）'}
    try:
        ledger = json.loads(f.read_text('utf-8'))
    except Exception as e:
        return {'success': False, 'error': f'台账读取失败: {e}'}
    style = ledger.get('artStyle') if isinstance(ledger.get('artStyle'), dict) else {}
    if 'stylePrompt' in body:
        sp = body.get('stylePrompt')
        if isinstance(sp, str) and sp.strip():
            if len(sp) > 500:
                return {'success': False, 'error': 'stylePrompt 过长（≤500 字）'}
            style['stylePrompt'] = sp.strip()
        else:
            style.pop('stylePrompt', None)
    if 'packId' in body:
        pk = body.get('packId')
        if isinstance(pk, str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', pk):
            style['packId'] = pk
        else:
            style.pop('packId', None)
    ledger['artStyle'] = style
    f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ART]", 'g'), f"style {slug} → 锚更新")
    return {'success': True, 'artStyle': style}

GEN_PROVIDER_RE = re.compile(r'qwen|tripo|meshy')

def handle_art_approve(body: dict) -> dict:
    """POST /api/art/approve {slug, no|'all'}。人审复核（double verify 第二道门·owner 2026-07-10）：
    replaced/filled 行 → approved。只许已写回的行复核；'all'=批量过全部可复核行。"""
    slug = str(body.get('slug', '')).strip()
    no = str(body.get('no', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账'}
    ledger = json.loads(f.read_text('utf-8'))
    hit = 0
    for r in ledger.get('rows', []):
        if no != 'all' and r.get('no') != no:
            continue
        if r.get('status') in ('replaced', 'filled'):
            if (r.get('gen') or {}).get('mock'):
                if no != 'all':
                    return {'success': False, 'error': f'{no} 是 mock 占位——mock 产物不可复核（真图生成后再过人门）'}
                continue
            r['status'] = 'approved'
            r.setdefault('history', []).append({'action': 'approve'})
            hit += 1
        elif no != 'all':
            return {'success': False, 'error': f"{no} 状态={r.get('status')}——只有已写回（replaced/filled）的行可复核"}
    f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ART]", 'g'), f"approve {slug} {no} → {hit} 行复核通过")
    return {'success': True, 'approved': hit}

def handle_art_regenerate(body: dict) -> dict:
    """POST /api/art/regenerate {slug, no, packId, query?, mock?}。点名单槽重新生成（可改 prompt）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip()
    pack = str(body.get('packId', '')).strip(); query = body.get('query'); mock = bool(body.get('mock', False))
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    # 平台双数据源（R1 ①）：library 卡带走 regen（重钉 manifest）；编译期游戏（无 manifest·有台账）走 fill
    # （写回=skinKey 别名登记本地 index·蓝图零改动）。同一端点同一 UI，差异收在这里。
    has_manifest = (LIBRARY_DIR / slug / 'manifest.json').is_file() or \
        (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file()  # 内置数据游戏也走 manifest 线
    is_game = (not has_manifest) and (ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json').is_file()
    cmdname = 'fill' if is_game else 'regen'
    args = [cmdname, slug, no, pack]
    if isinstance(query, str) and query.strip():
        args += ['--query', query.strip()]
    prov = str(body.get('provider', '')).strip()
    if prov and GEN_PROVIDER_RE.fullmatch(prov):
        args += ['--provider', prov]
    if mock:
        args.append('--mock')
    res = _art_replace_cli(args)
    if is_game:
        if res.get('ok'):
            print(c("  [ART]", 'g'), f"fill {slug} {no}·{pack}")
        return {'success': bool(res.get('ok')), 'no': no, 'row': res.get('row'), 'summary': res.get('summary'),
                **({} if res.get('ok') else {'error': res.get('error', 'fill 失败')})}
    return _art_save_manifest(slug, res, f'美术点名重生成 {no}', {'no': no, 'row': res.get('row'), 'summary': res.get('summary')})

def handle_art_swap(body: dict) -> dict:
    """POST /api/art/swap {slug, no, assetId}。从共享库/已有资产选换某槽（不重生成）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip(); asset_id = str(body.get('assetId', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if not asset_id or not _ASSET_ID_RE.fullmatch(asset_id) or '..' in asset_id:
        return {'success': False, 'error': f'非法 assetId: {asset_id or "(空)"}'}
    res = _art_replace_cli(['swap', slug, no, asset_id])
    return _art_save_manifest(slug, res, f'美术换库 {no}→{asset_id}', {'no': no, 'row': res.get('row')})

def handle_art_upload(body: dict) -> dict:
    """POST /api/art/upload {slug, no, dataBase64, ext}。上传一张图/模型替换某槽（写盘+登记本地 index+钉引用）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip(); ext = str(body.get('ext', 'png')).strip().lower()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if ext not in ('png', 'webp', 'jpg', 'jpeg', 'glb'):
        return {'success': False, 'error': f'非法扩展名: {ext}（png/webp/jpg/glb）'}
    try:
        raw = base64.b64decode(str(body.get('dataBase64', '')))
    except Exception:
        return {'success': False, 'error': 'dataBase64 解码失败'}
    if not raw:
        return {'success': False, 'error': '上传内容为空'}
    # 内容嗅探（R1 ④·非仅扩展名）：magic bytes 与扩展名不符即拒。
    magic_ok = {
        'png': raw.startswith(b'\x89PNG\r\n\x1a\n'),
        'webp': raw.startswith(b'RIFF') and raw[8:12] == b'WEBP',
        'jpg': raw.startswith(b'\xff\xd8\xff'),
        'jpeg': raw.startswith(b'\xff\xd8\xff'),
        'glb': raw.startswith(b'glTF'),
    }.get(ext, False)
    if not magic_ok:
        return {'success': False, 'error': f'文件内容与扩展名 .{ext} 不符（magic bytes 校验失败）'}
    rel = f'gen/{no}-up.{ext}'
    abs_path = ROOT / 'public' / 'games' / slug / 'art' / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(raw)
    # 登记本地 index（上传物 = filled·provenance 记 user-upload）
    idx_f = ROOT / 'public' / 'games' / slug / 'art' / 'index.json'
    idx = json.loads(idx_f.read_text('utf-8')) if idx_f.is_file() else {'version': 1, 'assets': []}
    if not isinstance(idx.get('assets'), list):
        idx['assets'] = []
    local_id = f'gen/{no}-up'
    idx['assets'] = [a for a in idx['assets'] if a.get('id') != local_id] + [{
        'id': local_id, 'type': 'mesh' if ext == 'glb' else 'texture', 'description': f'上传替换 {no}',
        'status': 'filled', 'path': f'/games/{slug}/art/{rel}', 'category': 'ai-gen', 'tags': ['upload', no],
        'license': '用户上传', 'source': 'upload',
        'provenance': {'generator': 'upload', 'prompt': '', 'model': 'user-upload', 'mock': False, 'generatedAt': ''},
    }]
    # 编译期游戏（无 manifest·有台账）：写回=skinKey 别名登记 + 台账行直更（无 manifest 可钉）。
    is_game = not (LIBRARY_DIR / slug / 'manifest.json').is_file()
    led_f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if is_game:
        if not led_f.is_file():
            return {'success': False, 'error': '无台账（编译期游戏需先产 art-ledger.json）'}
        ledger = json.loads(led_f.read_text('utf-8'))
        row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
        if row is None:
            return {'success': False, 'error': f'台账无 {no}'}
        skin = row.get('skinKey')
        if skin:  # 别名=游戏消费的皮肤 key → 贴图即上画面
            idx['assets'] = [a for a in idx['assets'] if a.get('id') != skin] + [{
                'id': skin, 'type': 'mesh' if ext == 'glb' else 'texture', 'description': f'上传替换 {no}（皮肤槽 {skin}）',
                'status': 'filled', 'path': f'/games/{slug}/art/{rel}', 'category': 'ai-gen', 'tags': ['upload', no, 'skin'],
                'license': '用户上传', 'source': 'upload',
                'provenance': {'generator': 'upload', 'prompt': '', 'model': 'user-upload', 'mock': False, 'generatedAt': ''},
            }]
        idx['assets'].sort(key=lambda a: a.get('id', ''))
        _write_json(idx_f, idx)
        row.setdefault('history', []).append({'action': 'upload', 'assetId': local_id})
        row['status'] = 'replaced'
        row['gen'] = {'source': 'upload', 'localId': local_id, 'servedPath': f'/games/{slug}/art/{rel}'}
        row['provenance'] = {'model': 'user-upload', 'prompt': row.get('query', ''), 'date': '', 'license': '用户上传'}
        led_f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return {'success': True, 'no': no, 'localId': local_id, 'row': row}
    idx['assets'].sort(key=lambda a: a.get('id', ''))
    _write_json(idx_f, idx)
    res = _art_replace_cli(['swap', slug, no, local_id, '--upload'])
    return _art_save_manifest(slug, res, f'美术上传替换 {no}', {'no': no, 'localId': local_id, 'row': res.get('row')})

def handle_art_reskin(body: dict) -> dict:
    """POST /api/art/reskin {slug, packId, newSlug?, mock?}。同玩法换风格包 → 存新卡带（meta.reskinOf 谱系）。"""
    slug = str(body.get('slug', '')).strip(); pack = str(body.get('packId', '')).strip()
    new_slug = str(body.get('newSlug', '')).strip(); mock = bool(body.get('mock', False))
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    src = _game_dir(slug)
    if not src.is_dir():
        if (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file():
            return {'success': False, 'error': '内置数据游戏暂不支持一键换皮（先在创作台另存为卡带）'}
        return {'success': False, 'error': f'源卡带不存在: {slug}'}
    new_slug = _dedup_slug(new_slug if _valid_slug(new_slug) else f'{slug}-{pack}')
    dst = LIBRARY_DIR / new_slug
    try:
        shutil.copytree(src, dst)  # 复制玩法 manifest + meta（玩法一字不改）
    except Exception as e:
        return {'success': False, 'error': f'复制卡带失败: {e}'}
    try:
        meta = json.loads((dst / 'meta.json').read_text('utf-8')) if (dst / 'meta.json').is_file() else {}
    except Exception:
        meta = {}
    meta['reskinOf'] = slug
    _write_json(dst / 'meta.json', meta)
    # 确保源有台账（提供 slot 定义），复制给新卡带
    src_led = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not src_led.is_file():
        _art_replace_cli(['derive', slug])
    if src_led.is_file():
        dst_led = ROOT / 'public' / 'games' / new_slug / 'art' / 'art-ledger.json'
        dst_led.parent.mkdir(parents=True, exist_ok=True)
        dst_led.write_bytes(src_led.read_bytes())
    args = ['reskin', new_slug, pack] + (['--mock'] if mock else [])
    res = _art_replace_cli(args)
    out = _art_save_manifest(new_slug, res, f'换皮 {pack}（reskinOf {slug}）', {'newSlug': new_slug, 'summary': res.get('summary')})
    if out.get('success'):
        print(c("  [ART]", 'g'), f"reskin {slug}·{pack} → {new_slug}")
        try:  # 换皮谱系立项卡（REQ-WORKSHOP C1）：新皮卡带 S1 开箱绿·谱系可读
            src_pf = ROOT / 'public' / 'games' / slug / 'pipeline.json'
            src_pitch = ''
            if src_pf.is_file():
                src_pitch = str((json.loads(src_pf.read_text('utf-8')).get('concept') or {}).get('pitch') or '')
            pitch = (f'{src_pitch}（换皮·{pack}·源 {slug}）' if src_pitch else f'换皮自 {slug}（{pack}）')[:300]
            _pipeline_cli(['concept', new_slug, '--name', str(meta.get('name') or new_slug), '--pitch', pitch])
        except Exception:
            pass  # 谱系立项卡失败不回滚换皮
    else:
        shutil.rmtree(dst, ignore_errors=True)  # 失败回滚新卡带
    return out

# ── 生产流程板（owner 2026-07-10「N 步拆分·每步 review·不能只靠手册」）────────────
# 大脑在 scripts/game-pipeline.mjs（八阶段·机器门证据带内容指纹·人门 signoff 落账）；
# 本端点薄胶水 shell 调。gate 会真跑 vitest/tsc/build（S8 最重）→ 单独长超时。

_PIPE_STAGE_RE = re.compile(r'S[1-8]')

def _pipeline_cli(args: list, timeout: int = 120) -> dict:
    """shell scripts/game-pipeline.mjs → 解析末行 JSON。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/game-pipeline.mjs', *args]), cwd=ROOT, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': '生产流程板执行超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''
    try:
        return json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'ok': False, 'error': f'解析失败: {err[:400]}'}

def handle_pipeline_board(slug: str) -> dict:
    """GET /api/pipeline?slug=<slug>。八阶段看板（纯推导·不跑重活）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _pipeline_cli(['board', slug, '--json'])
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_gate(body: dict) -> dict:
    """POST /api/pipeline/gate {slug, stage}。真跑该阶段机器门→记证据（S8=tsc+vitest+build·最长 15 分钟）。"""
    slug = str(body.get('slug', '')).strip(); stage = str(body.get('stage', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _PIPE_STAGE_RE.fullmatch(stage):
        return {'success': False, 'error': f'非法阶段: {stage or "(空)"}'}
    res = _pipeline_cli(['gate', slug, stage], timeout=900)
    if res.get('ok'):
        print(c("  [PIPE]", 'g'), f"gate {slug} {stage} → {res.get('summary', '')[:80]}")
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_concept(body: dict) -> dict:
    """POST /api/pipeline/concept {slug, name?, pitch?, refs?, style?, planWaiver?}。写/改立项卡
    （≥1 个字段·REQ-WORKSHOP C1：S1 从此有 UI 通道·CLI 同语义）。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    fields = [('name', '--name', 80), ('pitch', '--pitch', 300), ('refs', '--refs', 300),
              ('style', '--style', 300), ('planWaiver', '--plan-waiver', 300)]
    args = ['concept', slug]
    for key, flag, cap in fields:
        if key not in body:
            continue
        val = str(body.get(key) or '').strip()
        if len(val) > cap:
            return {'success': False, 'error': f'{key} 过长（≤{cap} 字）'}
        args += [flag, val]
    if len(args) == 2:
        return {'success': False, 'error': '至少提供一个立项卡字段（name/pitch/refs/style/planWaiver）'}
    res = _pipeline_cli(args)
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_signoff(body: dict) -> dict:
    """POST /api/pipeline/signoff {slug, stage, note, by?}。人门落账（note 必填=review 内容）。"""
    slug = str(body.get('slug', '')).strip(); stage = str(body.get('stage', '')).strip()
    note = str(body.get('note', '')).strip(); by = str(body.get('by', '')).strip() or 'owner'
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _PIPE_STAGE_RE.fullmatch(stage):
        return {'success': False, 'error': f'非法阶段: {stage or "(空)"}'}
    if not note:
        return {'success': False, 'error': '人门必须带 note（review 内容落账·不许空签）'}
    if len(note) > 500 or len(by) > 40:
        return {'success': False, 'error': 'note ≤500 字 · by ≤40 字'}
    res = _pipeline_cli(['signoff', slug, stage, '--note', note, '--by', by])
    return {'success': bool(res.get('ok')), **res}

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
        'description': '',  # 一句话玩法（REQ-WORKSHOP C1：立项卡 pitch 的持久位·前端 library-model 已消费）
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

# match3/dressup 已升级为内置数据游戏（public/games/game-j|game-m/manifest.json·owner 2026-07-10）
# ——装示例位留给未来精选好游戏。

def _preset_manifest(preset: dict) -> dict:
    """PRESET_BLUEPRINTS 条目 → 纯规范 manifest（只留 capabilities + entities，name/描述归 meta）。"""
    return {'capabilities': list(preset.get('capabilities', [])), 'entities': preset.get('entities', {})}

def _scaffold(slug: str, name: str, manifest: dict, provider: str, meta_overrides: dict | None,
              commit_msg: str, pitch: str = '') -> tuple:
    """新建游戏目录：写 manifest + meta，落首个版本。返回 (game_dir, meta, versioned)。"""
    game_dir = _game_dir(slug)
    game_dir.mkdir(parents=True, exist_ok=False)
    _write_json(game_dir / 'manifest.json', manifest)
    meta = _write_meta(game_dir, name, provider, meta_overrides)
    versioned = _version_save(game_dir, manifest, commit_msg)
    try:  # 落库即台账（owner 2026-07-10「为什么老虎机没有美术需求表」→ 机器化：新卡带自动 derive）
        _art_replace_cli(['derive', slug])
    except Exception:
        pass  # 台账推导失败不阻塞建库（打开美术平台仍会自动初始化兜底）
    if pitch:  # 建库即立项卡（REQ-WORKSHOP C1：S1 机器门开箱绿·生产板/Workshop 免手填）
        try:
            _pipeline_cli(['concept', slug, '--name', name, '--pitch', pitch])
        except Exception:
            pass  # 立项卡失败不阻塞建库（生产板 S1 侧栏仍可手填兜底）
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
    # 一句话玩法（REQ-WORKSHOP C1）：一处来源两处受益——meta.description（卡带架副标题）+ concept.pitch（S1 立项卡）。
    desc = str(body.get('description') or '').strip()[:300]
    meta_over = dict(body.get('meta') or {})
    if desc:
        meta_over['description'] = desc
    _, meta, versioned = _scaffold(slug, name, manifest, str(body.get('provider') or 'user'),
                                   meta_over, 'create', pitch=desc)
    return (200, {'success': True, 'slug': slug, 'meta': meta, 'versioned': versioned})

def library_install_sample(body: dict) -> tuple:
    """装官方示例卡带。preset='all'（或缺省）=全套幂等安装（已存在的跳过）；指定单个 preset 也幂等。
    slug 取 preset 首选名（match3→game-j·dressup→game-m），无首选名回退 sample-<preset>。"""
    preset_name = str(body.get('preset') or 'all')
    names = list(PRESET_BLUEPRINTS) if preset_name == 'all' else [preset_name]
    if any(n not in PRESET_BLUEPRINTS for n in names):
        return (400, {'success': False, 'error': f'未知 preset: {preset_name}（可选: all, {", ".join(PRESET_BLUEPRINTS)}）'})
    installed, skipped = [], []
    for n in names:
        preset = PRESET_BLUEPRINTS[n]
        slug = preset.get('slug') or _slugify(f'sample-{n}')
        if _game_dir(slug).is_dir():  # 幂等：已装过不重装不重号
            skipped.append(slug)
            continue
        _scaffold(slug, preset.get('name', n), _preset_manifest(preset), 'sample',
                  {'description': str(preset.get('description') or '')}, f'install sample {n}',
                  pitch=str(preset.get('description') or ''))
        installed.append(slug)
    return (200, {'success': True, 'installed': installed, 'skipped': skipped, 'slug': (installed + skipped)[0] if (installed or skipped) else None})

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
    try:  # PUT 即台账刷新（REQ-WORKSHOP C1：manifest 变了美术需求跟着变·mergeLedger append-only 保号不伤已钉行）
        _art_replace_cli(['derive', slug])
    except Exception:
        pass  # 刷新失败不阻塞落盘（美术平台打开时客户端 derive 兜底仍在）
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

# ── 设计草稿（创作中间态持久化：讨论/相变/刷新/换页永不丢）──────────────────
# 病根：DesignStudio 的 messages/phase/files 全在 React useState，无落盘 → 任何相变/刷新=蒸发。
# 存法：未定名草稿 → .apollo/design-drafts/<id>.json（gitignore）；卡带定名后随卡带 →
#   library/<slug>/design/draft.json（library/ 已整目录 gitignore）。内容白名单见 _DRAFT_KEYS。
# 路径防护（照 library 端点先例）：id 走严格白名单 [A-Za-z0-9] 起 + [A-Za-z0-9_-]（堵 ../ 与斜杠花招）
#   + 归一化后仍在 DRAFTS_DIR 内的纵深断言；named 走 _game_dir 的 slug 校验/越界防护。
APOLLO_DIR = ROOT / '.apollo'
DRAFTS_DIR = APOLLO_DIR / 'design-drafts'
_DRAFT_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')
_DRAFT_KEYS = ('id', 'slug', 'name', 'provider', 'phase', 'ready', 'messages', 'files', 'manifest', 'updatedAt')

def _valid_draft_id(did) -> bool:
    return isinstance(did, str) and _DRAFT_ID_RE.match(did) is not None

def _draft_unnamed_path(did: str) -> Path:
    """.apollo/design-drafts/<id>.json（id 须已过 _valid_draft_id）；断言归一化后仍在 DRAFTS_DIR 内。"""
    base = DRAFTS_DIR.resolve()
    p = (DRAFTS_DIR / f'{did}.json').resolve()
    if p.parent != base:
        raise ValueError(f'草稿路径越界: {did!r}')
    return DRAFTS_DIR / f'{did}.json'

def _draft_named_path(slug: str) -> Path:
    """library/<slug>/design/draft.json（_game_dir 校验 slug/越界）。"""
    return _game_dir(slug) / 'design' / 'draft.json'

def _sanitize_draft(did: str, body: dict) -> dict:
    """按白名单取字段落一份规范草稿记录（服务端盖 id/updatedAt·形状兜底）。"""
    rec: dict = {}
    if isinstance(body, dict):
        for k in _DRAFT_KEYS:
            if k in body:
                rec[k] = body[k]
    rec['id'] = did
    rec['updatedAt'] = _now_iso()
    if not isinstance(rec.get('messages'), list):
        rec['messages'] = []
    if not isinstance(rec.get('files'), dict):
        rec['files'] = {}
    slug = rec.get('slug')
    rec['slug'] = slug if (isinstance(slug, str) and _valid_slug(slug)) else None
    return rec

def _draft_summary(rec: dict) -> dict:
    """列表摘要（不回传全量 messages/files·省带宽）。"""
    msgs = rec.get('messages') if isinstance(rec.get('messages'), list) else []
    return {
        'id': rec.get('id'),
        'slug': rec.get('slug'),
        'name': rec.get('name') or '',
        'phase': rec.get('phase') or 'chat',
        'updatedAt': rec.get('updatedAt') or '',
        'turns': sum(1 for m in msgs if isinstance(m, dict) and m.get('role') == 'user'),
        'messageCount': len(msgs),
    }

def _iter_draft_files():
    """产 (path, rec) 遍历所有草稿文件（未定名 + 各卡带 named）。坏 JSON 跳过。"""
    out = []
    if DRAFTS_DIR.is_dir():
        for p in DRAFTS_DIR.glob('*.json'):
            try:
                out.append((p, json.loads(p.read_text(encoding='utf-8'))))
            except Exception:
                pass
    if LIBRARY_DIR.is_dir():
        for d in sorted(LIBRARY_DIR.iterdir()):
            if not d.is_dir() or not _valid_slug(d.name):
                continue
            p = d / 'design' / 'draft.json'
            if p.is_file():
                try:
                    rec = json.loads(p.read_text(encoding='utf-8'))
                    if isinstance(rec, dict):
                        rec.setdefault('slug', d.name)
                    out.append((p, rec))
                except Exception:
                    pass
    return out

def _find_draft(did: str):
    """按 id 定位草稿文件（扫未定名 + named）。返回 (path, rec) 或 (None, None)。"""
    for p, rec in _iter_draft_files():
        if isinstance(rec, dict) and rec.get('id') == did:
            return p, rec
    return None, None

def design_draft_list() -> tuple:
    """GET /api/design-drafts → {drafts:[摘要...]}（updatedAt 时间倒序）。"""
    recs = [rec for _, rec in _iter_draft_files() if isinstance(rec, dict) and rec.get('id')]
    recs.sort(key=lambda r: str(r.get('updatedAt') or ''), reverse=True)
    return (200, {'drafts': [_draft_summary(r) for r in recs]})

def design_draft_get(did: str) -> tuple:
    """GET /api/design-drafts/<id> → {success, draft}（全量·供一键恢复）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    _, rec = _find_draft(did)
    if rec is None:
        return (404, {'success': False, 'error': f'草稿不存在: {did}'})
    return (200, {'success': True, 'draft': rec})

def design_draft_put(did: str, body: dict) -> tuple:
    """PUT /api/design-drafts/<id> → upsert。slug 有效且卡带已存在 → 随卡带落 + 清旧未定名文件（迁移）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    rec = _sanitize_draft(did, body)
    slug = rec.get('slug')
    if slug:
        game_dir = _game_dir(slug)  # 校验 slug / 防越界（非法 → ValueError → 400）
        if game_dir.is_dir():
            target = _draft_named_path(slug)
            target.parent.mkdir(parents=True, exist_ok=True)
            _write_json(target, rec)
            old = _draft_unnamed_path(did)
            if old.exists():
                try:
                    old.unlink()
                except OSError:
                    pass
            return (200, {'success': True, 'id': did, 'slug': slug, 'location': 'named', 'updatedAt': rec['updatedAt']})
        rec['slug'] = None  # slug 无对应卡带（异常）→ 退回未定名，绝不丢
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(_draft_unnamed_path(did), rec)
    return (200, {'success': True, 'id': did, 'slug': None, 'location': 'unnamed', 'updatedAt': rec['updatedAt']})

def design_draft_delete(did: str) -> tuple:
    """DELETE /api/design-drafts/<id> → 弃置（删草稿文件·named 只删 draft.json 不动卡带）。"""
    if not _valid_draft_id(did):
        return (400, {'success': False, 'error': f'非法草稿 id: {did!r}'})
    p, _ = _find_draft(did)
    if p is None:
        return (404, {'success': False, 'error': f'草稿不存在: {did}'})
    try:
        p.unlink()
    except OSError as e:
        return (500, {'success': False, 'error': f'删除失败: {e}'})
    return (200, {'success': True, 'id': did})

def _draft_id_from_path(path: str):
    """'/api/design-drafts/<id>' → id（urldecode）或 None。"""
    segs = [s for s in path.split('/') if s]  # ['api','design-drafts',<id>]
    if len(segs) >= 3 and segs[0] == 'api' and segs[1] == 'design-drafts':
        return urllib.parse.unquote(segs[2])
    return None

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

    def _send_file(self, abs_path, content_type: str) -> None:
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(abs_path.read_bytes())

    def _serve_workshop(self, path: str) -> None:
        """GET /workshop[/...] → 端出原版工作台（workshop/·同源→前端 fetch /api/* 免跨域）。
        原版 .dc.html + support.js 原样伺服（运行时自 boot）；路径穿越防护。"""
        if path == '/workshop':
            self.send_response(301); self.send_header('Location', '/workshop/'); self.end_headers(); return
        rel = 'index.dc.html' if path == '/workshop/' else path[len('/workshop/'):]
        base = (ROOT / 'workshop').resolve()
        target = (base / rel).resolve()
        try:
            target.relative_to(base)
        except ValueError:
            self.send_response(403); self.end_headers(); return
        if not target.is_file():
            self.send_response(404); self.end_headers(); return
        ctype = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
                 '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
                 '.png': 'image/png', '.svg': 'image/svg+xml'}.get(target.suffix.lower(), 'application/octet-stream')
        self._send_file(target, ctype)

    def _serve_public_games(self, path: str) -> None:
        """GET /games/<slug>/... → 只读伺服 public/games/**（REQ-WORKSHOP A：壳的素材缩略图/台账
        servedPath 同源可显）。路径穿越防护同 _serve_workshop。"""
        base = (ROOT / 'public' / 'games').resolve()
        target = (base / path[len('/games/'):]).resolve()
        try:
            target.relative_to(base)
        except ValueError:
            self.send_response(403); self.end_headers(); return
        if not target.is_file():
            self.send_response(404); self.end_headers(); return
        ctype = {'.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
                 '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
                 '.glb': 'model/gltf-binary'}.get(target.suffix.lower(), 'application/octet-stream')
        self._send_file(target, ctype)

    def _serve_export(self, slug: str) -> None:
        """GET /api/library/<slug>/export → 下载包 zip（owner 2026-07-11「发布=一个下载包」）。
        内容：卡带本体（manifest/meta/design）+ 游戏资产侧（public/games/<slug>·**排除 gen/mock 预览物**
        与 pipeline.json 台账）。内存 zip·不落盘。"""
        if not _valid_slug(slug):
            self._send_json(400, {'success': False, 'error': f'非法 slug: {slug}'}); return
        lib = LIBRARY_DIR / slug
        pub = ROOT / 'public' / 'games' / slug
        if not (lib / 'manifest.json').is_file() and not (pub / 'manifest.json').is_file():
            self._send_json(404, {'success': False, 'error': f'游戏不存在: {slug}'}); return
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            def _add_tree(root_dir, arc_prefix):
                if not root_dir.is_dir():
                    return
                for p in sorted(root_dir.rglob('*')):
                    if not p.is_file():
                        continue
                    rel = p.relative_to(root_dir)
                    parts = rel.parts
                    if '.git' in parts or 'snapshots' in parts or 'mock' in parts:  # 版本库/快照/mock 预览物不进包
                        continue
                    z.write(p, f'{slug}/{arc_prefix}{rel.as_posix()}')
            _add_tree(lib, '')
            _add_tree(pub, 'assets/' if lib.is_dir() else '')
        data = buf.getvalue()
        self.send_response(200)
        self.send_header('Content-Type', 'application/zip')
        self.send_header('Content-Disposition', f'attachment; filename="{slug}.zip"')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split('?')[0]

        # 原版工作台静态伺服（owner 2026-07-11：对外展示台用原版设计代码 + 嵌我们的接口）。
        if path == '/workshop' or path.startswith('/workshop/'):
            self._serve_workshop(path)
            return

        # 游戏资产只读伺服（壳的缩略图/manifest 同源可取·REQ-WORKSHOP A）。
        if path.startswith('/games/'):
            self._serve_public_games(path)
            return

        # 下载包导出（发布屏=下载包·binary 出，先于 library JSON 分派）。
        m_export = re.fullmatch(r'/api/library/([a-z0-9][a-z0-9-]*)/export', path)
        if m_export:
            self._serve_export(m_export.group(1))
            return

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

        # 设计草稿端点（列表 / 按 id 取全量·可变状态码 400/404）。
        if path == '/api/design-drafts' or path.startswith('/api/design-drafts/'):
            if path == '/api/design-drafts':
                self._send_json(*_lib_dispatch(design_draft_list))
            else:
                did = _draft_id_from_path(path)
                self._send_json(*_lib_dispatch(lambda: design_draft_get(did)))
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
        elif path == '/api/assets/pending':
            data = handle_asset_pending()
        elif path == '/api/art/style-packs':
            data = handle_art_packs()
        elif path == '/api/art/ledger':
            qs = urllib.parse.parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            data = handle_art_ledger((qs.get('slug') or [''])[0])
        elif path == '/api/pipeline':
            qs = urllib.parse.parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            data = handle_pipeline_board((qs.get('slug') or [''])[0])
        elif path == '/api/games':
            data = handle_games_list()
        elif path == '/api/version':
            data = handle_version()
        elif path == '/api/catalog':
            data = handle_catalog()
        elif path == '/api/llm-logs':
            qs = urllib.parse.parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            try:
                nn = int(qs.get('n', ['50'])[0])
            except ValueError:
                nn = 50
            data = handle_llm_logs(nn)
        elif path == '/api/agent/chats':
            qs = urllib.parse.parse_qs(self.path.split('?', 1)[1]) if '?' in self.path else {}
            data = handle_agent_chats_get((qs.get('slug') or [''])[0])
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
        elif path == '/api/assets/review':
            try:
                data = handle_asset_review(body)
            except Exception as e:  # 防御：单次审核失败不拖死 API 进程
                data = {'success': False, 'error': f'审核异常: {e}'}
        elif path == '/api/art/derive':
            try:
                data = handle_art_derive(body)
            except Exception as e:
                data = {'success': False, 'error': f'derive 异常: {e}'}
        elif path == '/api/art/batch':
            try:
                data = handle_art_batch(body)
            except Exception as e:
                data = {'success': False, 'error': f'batch 异常: {e}'}
        elif path == '/api/art/replace':
            try:
                data = handle_art_replace(body)
            except Exception as e:
                data = {'success': False, 'error': f'replace 异常: {e}'}
        elif path == '/api/art/style':
            try:
                data = handle_art_style(body)
            except Exception as e:
                data = {'success': False, 'error': f'style 异常: {e}'}
        elif path == '/api/art/approve':
            try:
                data = handle_art_approve(body)
            except Exception as e:
                data = {'success': False, 'error': f'approve 异常: {e}'}
        elif path == '/api/art/regenerate':
            try:
                data = handle_art_regenerate(body)
            except Exception as e:
                data = {'success': False, 'error': f'regenerate 异常: {e}'}
        elif path == '/api/art/swap':
            try:
                data = handle_art_swap(body)
            except Exception as e:
                data = {'success': False, 'error': f'swap 异常: {e}'}
        elif path == '/api/art/upload':
            try:
                data = handle_art_upload(body)
            except Exception as e:
                data = {'success': False, 'error': f'upload 异常: {e}'}
        elif path == '/api/art/reskin':
            try:
                data = handle_art_reskin(body)
            except Exception as e:
                data = {'success': False, 'error': f'reskin 异常: {e}'}
        elif path == '/api/pipeline/gate':
            try:
                data = handle_pipeline_gate(body)
            except Exception as e:
                data = {'success': False, 'error': f'pipeline gate 异常: {e}'}
        elif path == '/api/pipeline/signoff':
            try:
                data = handle_pipeline_signoff(body)
            except Exception as e:
                data = {'success': False, 'error': f'pipeline signoff 异常: {e}'}
        elif path == '/api/pipeline/concept':
            try:
                data = handle_pipeline_concept(body)
            except Exception as e:
                data = {'success': False, 'error': f'pipeline concept 异常: {e}'}
        elif path == '/api/agent/chat':
            try:
                data = handle_agent_chat(body)
            except Exception as e:
                data = {'success': False, 'error': f'agent chat 异常: {e}'}
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
        if path == '/api/agent/chats':
            self._send_json(200, handle_agent_chats_put(body))
            return
        # 设计草稿 upsert（未定名/定名自动分流·可变状态码）——先于 design/manifest 分派。
        if path.startswith('/api/design-drafts/'):
            did = _draft_id_from_path(path)
            self._send_json(*_lib_dispatch(lambda: design_draft_put(did, body)))
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

    def do_DELETE(self):
        path = self.path.split('?')[0]
        # 设计草稿弃置（显式删·可变状态码 400/404）。
        if path.startswith('/api/design-drafts/'):
            did = _draft_id_from_path(path)
            self._send_json(*_lib_dispatch(lambda: design_draft_delete(did)))
            return
        self._send_json(404, {'error': 'Unknown DELETE endpoint'})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

def cmd_workshop():
    """对外展示工作台一键入口：python apollo.py workshop。
    只起 API 服务器（:4000）+ 开浏览器到原版工作台 /workshop/——**不弹老 launcher/electron**。
    （owner 2026-07-11：原版设计对外展示台·VS Code「Apollo 工作台」启动项走这条。）"""
    url = f"http://localhost:{API_PORT}/workshop/"
    # API 端口已占（如完整 launcher 已在跑）→ 不重复起服务，直接开工作台页。
    if is_port_in_use(API_PORT):
        print(c("  [INFO]", 'y'), f"API 已在运行 → 直接打开 {c(url, 'c')}")
        webbrowser.open(url)
        return
    start_api_server()
    threading.Thread(
        target=_open_browser_when_ready,
        args=(url, f"http://127.0.0.1:{API_PORT}"),
        daemon=True,
    ).start()
    print(c("  [INFO]", 'dim'), "工作台服务启动中，就绪即自动开页…（Ctrl+C 停止）")
    try:
        threading.Event().wait()  # 无 vite 进程可 wait，阻塞主线程直到 Ctrl+C
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
    print(f"    {c('workshop', 'c').ljust(30)} 对外展示工作台（原版设计·:4000/workshop/·不弹老界面）")
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
        'launcher': cmd_launcher, 'player': cmd_player, 'workshop': cmd_workshop, 'test': cmd_test,
        'typecheck': cmd_typecheck, 'build': cmd_build, 'bench': cmd_bench, 'status': cmd_status,
        'help': cmd_help, '-h': cmd_help,
    }
    cmd = args[0]
    if cmd in dispatch:
        dispatch[cmd]()
    else:
        print(c(f"  Unknown: {cmd}", 'r'))
        cmd_help()

if __name__ == '__main__':
    main()
