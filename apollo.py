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
        subprocess.call(['npm', 'install'], cwd=ROOT)

# ── 项目信息收集 ──

def get_project_status() -> dict:
    branch = subprocess.getoutput('git branch --show-current')
    last_commit = subprocess.getoutput('git log --oneline -1')
    test_count = subprocess.getoutput("find src -name '*.test.ts' 2>/dev/null | wc -l").strip()

    atom_dir = ROOT / 'src' / 'atom-skills'
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
        'testFiles': int(test_count) if test_count.isdigit() else 0,
        'themes': themes,
        'skillModules': skill_count,
        'games': games,
    }

def run_command(cmd: list[str], timeout: int = 120) -> dict:
    try:
        result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
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
        else:
            data = {'error': 'Unknown endpoint', 'endpoints': [
                '/api/status', '/api/test', '/api/typecheck',
                '/api/build', '/api/git-log', '/api/git-status', '/api/git-pull',
            ]}

        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # 静默日志

def start_api_server():
    server = HTTPServer(('127.0.0.1', API_PORT), APIHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(c("  [API]", 'g'), f"Dev tools API on http://localhost:{API_PORT}")
    return server

# ── Vite 服务器 ──

def start_vite():
    proc = subprocess.Popen(
        ['npx', 'vite', '--port', str(VITE_PORT)],
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
    sys.exit(subprocess.call(['npx', 'vitest', 'run'], cwd=ROOT))

def cmd_typecheck():
    check_env()
    sys.exit(subprocess.call(['npx', 'tsc', '--noEmit'], cwd=ROOT))

def cmd_build():
    check_env()
    sys.exit(subprocess.call(['npx', 'vite', 'build'], cwd=ROOT))

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
