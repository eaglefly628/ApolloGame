"""端口/Vite 服务器 + 命令 + main()。"""
import os
import subprocess
import sys
import time
import webbrowser
import threading
import socket
from pathlib import Path

from .server import start_api_server
from .sysutil import ROOT, VITE_PORT, _cleanup, _processes, _spawn, banner, c, check_env, env, get_project_status, is_port_in_use
from . import server

# ── Vite 服务器 ──

def start_vite():
    # 启动提速（07-15 诊断根因#3）：npx 壳税 0.4s(Linux 热)~2s(Windows)——bin 在则直连，不在才回退 npx。
    vite_bin = ROOT / 'node_modules' / '.bin' / ('vite.cmd' if os.name == 'nt' else 'vite')
    cmd = ([str(vite_bin)] if vite_bin.exists() else ['npx', 'vite']) + ['--port', str(VITE_PORT)]
    proc = subprocess.Popen(
        **_spawn(cmd),
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
        print(c("  [READY]", 'g'), f"ZeroCraft Launcher: {c(open_url, 'c')}")
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
        print(c("  [INFO]", 'y'), f"ZeroCraft 已在运行 → 直接打开 {c(url, 'c')}")
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
    # 创作台玩家模式一键入口：python zerocraft.py player
    cmd_launcher(player=True)

def cmd_workshop():
    """对外展示工作台一键入口：python zerocraft.py workshop。
    起 API 服务器（:4000）+ **一并拉起页面服务（vite :5173·owner 07-11 高优先级：▶ 运行永远直达，
    不再要求开第二个终端）** + 开浏览器到 /workshop/——不弹老 launcher/electron。"""
    url = f"http://localhost:{server.API_PORT}/workshop/"
    # 页面服务（旧工作台/运行器载体）：没在跑才拉起——已有 vite（重复跑本命令/npm run dev 在跑）不重复起。
    if not is_port_in_use(VITE_PORT):  # 只认 :5173——3000 可能被无关服务占着（07-11 实证·勿误判已就绪）
        check_env()
        start_vite()
    else:
        print(c("  [INFO]", 'dim'), "页面服务已在运行（▶ 运行走 /bench 自动定位）")
    # API 端口已占（如完整 launcher 已在跑）→ 不重复起服务，直接开工作台页。
    if is_port_in_use(server.API_PORT):
        print(c("  [INFO]", 'y'), f"API 已在运行 → 直接打开 {c(url, 'c')}")
        webbrowser.open(url)
        return
    start_api_server()
    threading.Thread(
        target=_open_browser_when_ready,
        args=(url, f"http://127.0.0.1:{server.API_PORT}"),
        daemon=True,
    ).start()
    print(c("  [INFO]", 'dim'), "工作台服务启动中，就绪即自动开页…（Ctrl+C 停止）")
    try:
        threading.Event().wait()  # 阻塞主线程直到 Ctrl+C（vite 子进程随 _cleanup 一并收掉）
    except KeyboardInterrupt:
        _cleanup()

def cmd_platform():
    """平台离线打包运行入口：python3 zerocraft.py platform（platform-packaging-spec.md D2-D4）。
    只起 API 服务器——它现在**同时伺服已构建的静态前端**（main_entry/server.py `_serve_static`
    读 STATIC_DIST_DIR/ZEROCRAFT_STATIC_DIR）+ 全部 /api/*，一个端口担两职，供 electron loadURL
    直连。不叫 check_env()（打包产物是纯 python 后端 + 预构建静态站，客户机器不装 node，
    check_env 那套 npm/node 探测在这条路径上既无必要也会误报）、不拉 start_vite()（studio
    前端已经是构建产物，不需要 dev server）、不开浏览器（electron 自己 loadURL；Linux/CI
    冒烟走 curl，开浏览器在无头环境里只会噪音报错）。
    健康检查口径：electron/CI 探测 `GET /` 200 即代表就绪（见 electron/platform-launch.cjs
    waitForHealth · scripts/platform-launch-smoke.mjs）。"""
    port = server.API_PORT
    print(c("  [PLATFORM]", 'g'), f"启动平台后端（同端口伺服前端静态 + /api/*）→ http://127.0.0.1:{port}/")
    static_dir = env('ZEROCRAFT_STATIC_DIR') or str(ROOT / 'dist')
    print(c("  [PLATFORM]", 'dim'), f"静态前端目录：{static_dir}" + ('（不存在——先 vite build）' if not Path(static_dir).is_dir() else ''))
    start_api_server()
    try:
        threading.Event().wait()  # 阻塞主线程直到 Ctrl+C / 父进程（electron）杀掉本进程
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
    # ZeroCraftBench：执行落地体检（借鉴 OpenGame-Bench）。把每个游戏蓝图喂进真实引擎跑分。
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
    print(f"    {c('platform', 'c').ljust(30)} 离线打包运行入口（同端口伺服已构建前端+/api/*·不拉 vite/不开浏览器·供 electron/CI 用）")
    print(f"    {c('test', 'c').ljust(30)} Run all tests")
    print(f"    {c('typecheck', 'c').ljust(30)} TypeScript type check")
    print(f"    {c('build', 'c').ljust(30)} Production build")
    print(f"    {c('bench', 'c').ljust(30)} ZeroCraftBench 执行落地体检 (每个游戏跑分)")
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
        'launcher': cmd_launcher, 'player': cmd_player, 'workshop': cmd_workshop, 'platform': cmd_platform,
        'test': cmd_test, 'typecheck': cmd_typecheck, 'build': cmd_build, 'bench': cmd_bench, 'status': cmd_status,
        'help': cmd_help, '-h': cmd_help,
    }
    cmd = args[0]
    if cmd in dispatch:
        dispatch[cmd]()
    else:
        print(c(f"  Unknown: {cmd}", 'r'))
        cmd_help()
