#!/usr/bin/env python3
"""
Apollo Engine Launcher
=====================
Python 入口，管理所有 Web 服务和工具命令。
用法：python3 apollo.py [命令]

后续扩展：
- 接入 pywebview 做原生窗口
- 接入 tkinter/Qt 做编辑器 GUI
- 接入 Claude API 做一句话生成游戏
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
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

# ── 颜色输出 ──

def c(text, color):
    colors = {'r': '31', 'g': '32', 'y': '33', 'b': '34', 'm': '35', 'c': '36', 'w': '37', 'dim': '90'}
    return f"\033[{colors.get(color, '0')}m{text}\033[0m"

def banner():
    print()
    print(c("  ╔══════════════════════════════════════╗", 'c'))
    print(c("  ║", 'c') + c("     APOLLO ENGINE LAUNCHER v0.1     ", 'w') + c("║", 'c'))
    print(c("  ║", 'c') + c("     ECS Game Engine · 26 Atoms      ", 'dim') + c("║", 'c'))
    print(c("  ╚══════════════════════════════════════╝", 'c'))
    print()

# ── 进程管理 ──

_processes: list[subprocess.Popen] = []

def _cleanup(sig=None, frame=None):
    for p in _processes:
        try:
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            p.kill()
    sys.exit(0)

signal.signal(signal.SIGINT, _cleanup)
signal.signal(signal.SIGTERM, _cleanup)

def run_bg(cmd: list[str], label: str) -> subprocess.Popen:
    print(c(f"  [{label}]", 'y'), f"Starting: {' '.join(cmd)}")
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    _processes.append(proc)
    return proc

def run_fg(cmd: list[str], label: str) -> int:
    print(c(f"  [{label}]", 'y'), f"Running: {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)

def wait_for_server(url: str, timeout: int = 15):
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False

# ── 环境检查 ──

def check_env():
    npm = shutil.which('npm')
    node = shutil.which('node')
    if not npm or not node:
        print(c("  [ERROR]", 'r'), "npm/node not found. Install Node.js first.")
        sys.exit(1)

    if not (ROOT / 'node_modules').exists():
        print(c("  [SETUP]", 'y'), "Installing dependencies...")
        run_fg(['npm', 'install'], 'npm')

def get_vite_port() -> int:
    """Read port from vite.config if set, otherwise default 5173."""
    return 5173

# ── 命令实现 ──

def cmd_launcher():
    """启动 Game Library Launcher（默认）"""
    check_env()
    port = get_vite_port()
    print(c("  [LAUNCHER]", 'g'), f"Starting Apollo Game Library...")
    proc = run_bg(['npx', 'vite', '--port', str(port)], 'vite')

    # 读 vite 输出等 ready
    url = f"http://localhost:{port}"
    if wait_for_server(url):
        print(c("  [READY]", 'g'), f"Game Library running at {c(url, 'c')}")
        webbrowser.open(url)
    else:
        print(c("  [WARN]", 'y'), "Server may still be starting, opening anyway...")
        webbrowser.open(url)

    print(c("  [INFO]", 'dim'), "Press Ctrl+C to stop")
    try:
        proc.wait()
    except KeyboardInterrupt:
        _cleanup()

def cmd_game(game_id: str):
    """直接启动某个游戏（跳过 Launcher UI）"""
    check_env()
    port = get_vite_port()
    print(c(f"  [GAME]", 'g'), f"Launching game: {game_id}")
    proc = run_bg(['npx', 'vite', '--port', str(port)], 'vite')
    url = f"http://localhost:{port}?game={game_id}"
    if wait_for_server(f"http://localhost:{port}"):
        webbrowser.open(url)
    print(c("  [INFO]", 'dim'), "Press Ctrl+C to stop")
    try:
        proc.wait()
    except KeyboardInterrupt:
        _cleanup()

def cmd_test():
    """运行所有测试"""
    check_env()
    print(c("  [TEST]", 'g'), "Running vitest...")
    sys.exit(run_fg(['npx', 'vitest', 'run'], 'vitest'))

def cmd_typecheck():
    """TypeScript 类型检查"""
    check_env()
    print(c("  [TSC]", 'g'), "Type checking...")
    sys.exit(run_fg(['npx', 'tsc', '--noEmit'], 'tsc'))

def cmd_build():
    """生产构建"""
    check_env()
    print(c("  [BUILD]", 'g'), "Building for production...")
    sys.exit(run_fg(['npx', 'vite', 'build'], 'vite'))

def cmd_status():
    """显示项目状态"""
    print(c("  Project:", 'w'), str(ROOT))
    print(c("  Branch:", 'w'), subprocess.getoutput('git branch --show-current'))
    print()

    # 统计
    atom_dir = ROOT / 'src' / 'atom-skills'
    atoms = len([d for d in atom_dir.iterdir() if d.is_dir() and (d / 'index.ts').exists()]) if atom_dir.exists() else 0

    test_count = subprocess.getoutput("find src -name '*.test.ts' | wc -l").strip()
    game_designs = list((ROOT / 'docs' / 'game-design').glob('*.md')) if (ROOT / 'docs' / 'game-design').exists() else []
    themes = [d.name for d in (ROOT / 'src' / 'ui' / 'themes').iterdir() if d.is_dir() and (d / 'spec.md').exists()] if (ROOT / 'src' / 'ui' / 'themes').exists() else []
    skill_mods = list((ROOT / 'wiki' / 'skills').glob('*.md')) if (ROOT / 'wiki' / 'skills').exists() else []

    print(c("  Atoms:", 'c'), f"{atoms}/26")
    print(c("  Test files:", 'c'), test_count)
    print(c("  Skill modules:", 'c'), f"{len(skill_mods)}")
    print(c("  UI themes:", 'c'), f"{len(themes)} ({', '.join(themes)})")
    print(c("  Game designs:", 'c'), f"{len(game_designs)}")
    for gd in game_designs:
        print(c("    -", 'dim'), gd.stem)
    print()

def cmd_help():
    """显示帮助"""
    banner()
    print(c("  Commands:", 'w'))
    print()
    cmds = [
        ("launcher", "Start Game Library (default)", cmd_launcher),
        ("game <id>", "Launch a specific game directly", None),
        ("test", "Run all tests (vitest)", cmd_test),
        ("typecheck", "TypeScript type check (tsc --noEmit)", cmd_typecheck),
        ("build", "Production build (vite build)", cmd_build),
        ("status", "Show project status", cmd_status),
        ("help", "Show this help", cmd_help),
    ]
    for name, desc, _ in cmds:
        print(f"    {c(name.ljust(16), 'c')} {desc}")
    print()
    print(c("  Game IDs:", 'w'))
    print(f"    {c('platformer', 'c')}      Platformer Demo (playable)")
    print(f"    {c('game-a', 'c')}          Co-op Adventure (WIP)")
    print(f"    {c('game-b', 'c')}          Otome VN (WIP)")
    print()
    print(c("  Examples:", 'dim'))
    print(c("    python3 apollo.py", 'dim'), "           # Open game library")
    print(c("    python3 apollo.py game platformer", 'dim'), " # Launch platformer directly")
    print(c("    python3 apollo.py test", 'dim'), "            # Run tests")
    print()

# ── 主入口 ──

def main():
    args = sys.argv[1:]

    if not args:
        banner()
        cmd_launcher()
        return

    command = args[0]

    dispatch = {
        'launcher': cmd_launcher,
        'test': cmd_test,
        'typecheck': cmd_typecheck,
        'build': cmd_build,
        'status': cmd_status,
        'help': cmd_help,
        '-h': cmd_help,
        '--help': cmd_help,
    }

    if command == 'game' and len(args) > 1:
        banner()
        cmd_game(args[1])
    elif command in dispatch:
        banner()
        dispatch[command]()
    else:
        print(c(f"  Unknown command: {command}", 'r'))
        cmd_help()

if __name__ == '__main__':
    main()
