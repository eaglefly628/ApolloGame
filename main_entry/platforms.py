"""外部平台拉起（三平台合并 P0·docs/design/platform-merge-2026-10-30.md）。

创作平台只负责「按本机配置拉起」动画平台 / 3D 资产平台并把地址交给前端开新窗；
不改、不代理、不读这些平台的代码与数据——它们保持独立进程、独立端口、独立安全校验。

配置 `.zerocraft/platforms.json`（Git 外·含本机绝对路径）：
  {"platforms": {
     "motion":  {"label": "动画平台", "command": ["node", "tools/motion-workbench/server.mjs", "--lib", "...", ...]},
     "asset3d": {"label": "3D 资产平台", "url": "http://127.0.0.1:5199/"}
  }}
每条二选一：`command`（参数数组·不经 shell·cwd 缺省仓库根·启动后从 stdout 抓第一条本机 URL）
或 `url`（已在跑的平台·直接给地址）。只能拉起配置里写死的条目，请求体不携带任何命令。
"""
import json
import re
import subprocess
import threading
import time
from pathlib import Path

from .sysutil import IS_WINDOWS, ROOT, ZEROCRAFT_DIR, _processes, _spawn

PLATFORMS_FILE = ZEROCRAFT_DIR / 'platforms.json'
# 内置两个槽位：未配置也在列（前端置灰并提示怎么配）。额外条目照配置原样追加。
KNOWN = {'motion': '动画平台', 'asset3d': '3D 资产平台'}
LAUNCH_TIMEOUT = 90.0  # 动画工作台启动时要读目录 + esbuild 打包，冷启动可到数十秒
_URL_RE = re.compile(r'https?://(?:127\.0\.0\.1|localhost)(?::\d+)?(?:/\S*)?')
_ID_RE = re.compile(r'[a-z0-9][a-z0-9-]{0,31}')

_LOCK = threading.Lock()
_RUNNING: dict[str, dict] = {}  # id → {'proc': Popen, 'url': str|None}


def _log(level: str, msg: str) -> None:
    print(f'[platforms] {level}: {msg}', flush=True)


def _load_config(path: Path | None = None) -> dict:
    path = path or PLATFORMS_FILE
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        _log('reject', f'{path} 不是合法 JSON：{e}')
        return {}
    entries = data.get('platforms') if isinstance(data, dict) else None
    if not isinstance(entries, dict):
        _log('reject', f'{path} 缺 platforms 对象')
        return {}
    out = {}
    for pid, spec in entries.items():
        if not isinstance(pid, str) or not _ID_RE.fullmatch(pid) or not isinstance(spec, dict):
            _log('reject', f'忽略非法条目 {pid!r}')
            continue
        cmd, url = spec.get('command'), spec.get('url')
        if cmd is not None and not (isinstance(cmd, list) and cmd and all(isinstance(a, str) and a for a in cmd)):
            _log('reject', f'{pid}.command 须为非空字符串数组')
            continue
        if url is not None and not (isinstance(url, str) and _URL_RE.fullmatch(url)):
            _log('reject', f'{pid}.url 须为本机 http 地址')
            continue
        if (cmd is None) == (url is None):
            _log('reject', f'{pid} 须且只须给 command 或 url 之一')
            continue
        label = spec.get('label') if isinstance(spec.get('label'), str) else KNOWN.get(pid, pid)
        out[pid] = {'label': label, 'command': cmd, 'url': url, 'cwd': spec.get('cwd')}
    return out


def _alive(pid: str) -> dict | None:
    run = _RUNNING.get(pid)
    if run and run['proc'].poll() is None:
        return run
    if run:
        _RUNNING.pop(pid, None)
        _log('transition', f'{pid} 已退出（code={run["proc"].returncode}）')
    return None


def handle_platforms_list(config_path: Path | None = None) -> dict:
    cfg = _load_config(config_path)
    items = []
    with _LOCK:
        for pid in list(KNOWN) + [p for p in cfg if p not in KNOWN]:
            spec = cfg.get(pid)
            run = _alive(pid)
            items.append({
                'id': pid,
                'label': spec['label'] if spec else KNOWN[pid],
                'configured': spec is not None,
                'mode': None if not spec else ('command' if spec['command'] else 'url'),
                'running': bool(run and run['url']),
                'url': (run['url'] if run else None) or (spec['url'] if spec else None),
            })
    return {'success': True, 'platforms': items, 'configFile': str(PLATFORMS_FILE.relative_to(ROOT)) if PLATFORMS_FILE.is_relative_to(ROOT) else str(PLATFORMS_FILE)}


def _read_url(proc: subprocess.Popen, found: dict, ready: threading.Event) -> None:
    """吃掉子进程 stdout：抓到第一条本机 URL 就 set；其余行原样转打到本终端。"""
    for line in proc.stdout:
        line = line.rstrip()
        if line:
            print(f'  [{found["id"]}] {line}', flush=True)
        if not found.get('url'):
            m = _URL_RE.search(line)
            if m:
                found['url'] = m.group(0)
                ready.set()
    proc.stdout.close()
    ready.set()  # EOF：进程退出了，别让等待方空等到超时


def handle_platform_launch(pid: str, config_path: Path | None = None, timeout: float = LAUNCH_TIMEOUT) -> dict:
    if not isinstance(pid, str) or not _ID_RE.fullmatch(pid):
        _log('reject', f'非法平台 id {pid!r}')
        return {'success': False, 'error': '非法平台 id'}
    spec = _load_config(config_path).get(pid)
    if not spec:
        _log('reject', f'{pid} 未配置（{PLATFORMS_FILE}）')
        return {'success': False, 'error': f'未配置：在 {PLATFORMS_FILE} 写 platforms.{pid}', 'configured': False}
    if spec['url']:
        _log('decision', f'{pid} 用配置地址 {spec["url"]}')
        return {'success': True, 'url': spec['url'], 'started': False}
    with _LOCK:
        run = _alive(pid)
        if run and run['url']:
            _log('decision', f'{pid} 已在跑，复用 {run["url"]}')
            return {'success': True, 'url': run['url'], 'started': False}
        if run:  # 进程在但还没吐地址（上一次拉起仍在启动中）
            _log('reject', f'{pid} 正在启动中')
            return {'success': False, 'error': '正在启动中，稍后再点'}
        cwd = Path(spec['cwd']) if spec.get('cwd') else ROOT
        try:
            proc = subprocess.Popen(**_spawn(spec['command']), cwd=cwd, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, encoding='utf-8', errors='replace',
                                    **({} if IS_WINDOWS else {'start_new_session': True}))
        except OSError as e:
            _log('reject', f'{pid} 启动失败：{e}')
            return {'success': False, 'error': f'启动失败：{e}'}
        _processes.append(proc)  # 跟随创作平台退出一起收掉（sysutil._cleanup）
        run = {'proc': proc, 'url': None}
        _RUNNING[pid] = run
    found, ready = {'id': pid}, threading.Event()
    threading.Thread(target=_read_url, args=(proc, found, ready), daemon=True).start()
    deadline = time.monotonic() + timeout
    while not ready.wait(0.2):
        if time.monotonic() > deadline:
            break
    with _LOCK:
        if found.get('url'):
            run['url'] = found['url']
            _log('transition', f'{pid} 已拉起 {run["url"]}')
            return {'success': True, 'url': run['url'], 'started': True}
        code = proc.poll()
        if code is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
        _RUNNING.pop(pid, None)
    reason = f'进程退出（code={code}），详见终端输出' if code is not None else f'{timeout:g}s 内未打印本机地址，已停止'
    _log('reject', f'{pid} {reason}')
    return {'success': False, 'error': reason}
