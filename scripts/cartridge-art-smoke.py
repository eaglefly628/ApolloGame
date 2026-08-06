#!/usr/bin/env python3
"""卡带美术存储归位全链冒烟（REQ-CARTART·owner 2026-08-06 令方案 b）。

造一个临时卡带（library/<slug>/ + manifest + 台账）+ 一个临时内置游戏（public/games/<slug>/），
起 API（进程内·随机空闲端口）验：
  ① 解析器：卡带 → library/<slug>/art；内置 → public/games/<slug>/art
  ② **Python/JS 双实现一致**（split-brain 防线：main_entry/paths.py::art_root 与 scripts/art-paths.mjs::artRoot
     必须对同一 slug 给同一答案——两边分头改跑偏，就是"上传写 A·生成写 B"）
  ③ 伺服：`/games/<卡带>/art/x.png` 从 library 出（URL 契约不变·引擎零改动的关键）
     + 内置游戏同 URL 仍从 public 出（回归）+ 穿越 403 / 缺文件 404
  ④ 上传替换：字节落 library/<slug>/art/gen/**，**public/games/<slug>/art 不生成任何文件**
  ⑤ **引擎仓 git status 保持干净**（本单的目的：卡带换图不再脏引擎仓、不再撞冲突）
  ⑥ 台账/索引读写走卡带屋（ledger 端点读得到 library 侧台账）
  ⑦ 迁移脚本：默认 dry-run 不动文件；--apply 真搬且幂等（再跑=无事可做）
  ⑧ 守卫 discoverGames 能发现卡带（否则卡带台账全成"不存在"漏审）
任一断言失败 exit 1。造的 library/<slug> + public/games/<slug> 结束清理（零仓库污染）。

用法：python3 scripts/cartridge-art-smoke.py
"""
import json
import shutil
import socket
import subprocess
import sys
import http.client
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402
from main_entry.paths import art_root  # noqa: E402

PASS, FAIL = 0, 0


def check(cond, label, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}  {detail}")


CART = 'cartart-smoke-cart'      # 卡带（library 侧）
BUILTIN = 'cartart-smoke-builtin'  # 内置游戏（public 侧·回归对照）
LIB = ROOT / 'library' / CART
PUB_CART = ROOT / 'public' / 'games' / CART
PUB_BUILTIN = ROOT / 'public' / 'games' / BUILTIN

PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000a49444154789c6300010000050001'
                    '0d0a2db40000000049454e44ae426082')


def _free_port() -> int:
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def req(method: str, raw_path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=120)
    conn.request(method, raw_path, body=json.dumps(body) if body is not None else None,
                 headers={'Content-Type': 'application/json'})
    r = conn.getresponse(); raw = r.read(); conn.close()
    return r.status, raw


def req_json(method, path, body=None):
    st, raw = req(method, path, body)
    try:
        return st, json.loads(raw.decode() or '{}')
    except Exception:
        return st, {'_raw': raw[:200]}


def git_status_clean() -> bool:
    r = subprocess.run(['git', 'status', '--porcelain'], cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    dirty = [ln for ln in r.stdout.splitlines() if CART in ln]  # 只看**卡带**（内置夹具本就该在 public·别的在途改动不关本单事）
    return not dirty, dirty


MANIFEST = {
    'name': 'CartArt Smoke', 'capabilities': ['a1-transform', 'c1-shape', 'l1-sprite'],
    'entities': {
        'hero': {'Transform': {'x': 100, 'y': 100, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                 'Shape': {'kind': 'box', 'width': 32, 'height': 32},
                 'Sprite': {'textureKey': 'art:brave knight hero'}},
    },
}
LEDGER = {'game': CART, 'mode': 'requirements', 'rows': [
    {'no': 'art-01', 'kind': 'sprite', 'query': 'brave knight hero', 'skinKey': f'{CART}/hero',
     'slot': {'entity': 'hero', 'component': 'Sprite', 'field': 'textureKey'},
     'status': 'needs-art', 'gen': None, 'provenance': None},
]}

PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()

try:
    # ── 造场：卡带（library 有目录=卡带判据）+ 内置游戏（只有 public） ──
    LIB.mkdir(parents=True, exist_ok=True)
    (LIB / 'manifest.json').write_text(json.dumps(MANIFEST), 'utf-8')
    (LIB / 'meta.json').write_text(json.dumps({'name': 'CartArt Smoke'}), 'utf-8')
    (LIB / 'art').mkdir(parents=True, exist_ok=True)
    (LIB / 'art' / 'art-ledger.json').write_text(json.dumps(LEDGER, ensure_ascii=False), 'utf-8')
    (PUB_BUILTIN / 'art').mkdir(parents=True, exist_ok=True)
    (PUB_BUILTIN / 'art' / 'index.json').write_text('{"version":1,"assets":[]}', 'utf-8')
    (PUB_BUILTIN / 'art' / 'shot.png').write_bytes(PNG)

    # ① 解析器分流
    check(art_root(CART) == LIB / 'art', '① 卡带 → library/<slug>/art', str(art_root(CART)))
    check(art_root(BUILTIN) == PUB_BUILTIN / 'art', '① 内置 → public/games/<slug>/art', str(art_root(BUILTIN)))

    # ② Python / JS 双实现一致（split-brain 防线）
    js = subprocess.run(
        ['node', '-e',
         "import('./scripts/art-paths.mjs').then(m=>console.log(JSON.stringify("
         f"[m.artRoot(process.cwd(),'{CART}'),m.artRoot(process.cwd(),'{BUILTIN}')])))"],
        cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    js_roots = json.loads(js.stdout.strip() or '[]')
    check(js_roots and Path(js_roots[0]) == art_root(CART), '② JS artRoot 与 Python art_root 一致（卡带）', js.stdout.strip() + js.stderr[:200])
    check(len(js_roots) > 1 and Path(js_roots[1]) == art_root(BUILTIN), '② JS/Python 一致（内置·回归）', js.stdout.strip())

    # ③ 伺服：URL 契约不变，卡带从 library 出
    (LIB / 'art' / 'gen').mkdir(parents=True, exist_ok=True)
    (LIB / 'art' / 'gen' / 'art-01.png').write_bytes(PNG)
    st, raw = req('GET', f'/games/{CART}/art/gen/art-01.png')
    check(st == 200 and raw == PNG, '③ /games/<卡带>/art/** 从 library 出（URL 契约不变）', f'status={st} len={len(raw)}')
    st, raw = req('GET', f'/games/{BUILTIN}/art/shot.png')
    check(st == 200 and raw == PNG, '③ 内置游戏同 URL 仍从 public 出（回归）', f'status={st}')
    st, _ = req('GET', f'/games/{CART}/art/../../../etc/passwd')
    check(st in (403, 404), '③ 卡带根穿越被挡', f'status={st}')
    st, _ = req('GET', f'/games/{CART}/art/nope.png')
    check(st == 404, '③ 卡带缺文件 404（不误落 public）', f'status={st}')

    # ④+⑤ 上传替换 → 落卡带屋·public 侧零文件·引擎仓不脏
    import base64
    st, j = req_json('POST', '/api/art/upload', {
        'slug': CART, 'no': 'art-01', 'ext': 'png', 'dataBase64': base64.b64encode(PNG).decode()})
    check(j.get('success'), '④ 卡带上传替换成功', str(j)[:200])
    check((LIB / 'art' / 'gen' / 'art-01-up.png').is_file(), '④ 字节落 library/<slug>/art/gen/**', '')
    check(not PUB_CART.exists() or not any(PUB_CART.rglob('*.png')),
          '④ public/games/<卡带>/art 零生成文件（不再脏引擎仓）', str(list(PUB_CART.rglob("*")) if PUB_CART.exists() else []))
    check((LIB / 'art' / 'index.json').is_file(), '④ 本地索引也落卡带屋', '')
    clean, dirty = git_status_clean()
    check(clean, '⑤ 引擎仓 git status 对本卡带保持干净（本单目的）', str(dirty))

    # ⑥ 台账端点读卡带屋
    st, j = req_json('GET', f'/api/art/ledger?slug={CART}')
    check(j.get('success') and any(r.get('no') == 'art-01' for r in j.get('rows', [])),
          '⑥ ledger 端点读得到 library 侧台账', str(j)[:160])

    # ⑦ 迁移脚本：dry-run 不动文件 + apply 幂等
    (PUB_CART / 'art').mkdir(parents=True, exist_ok=True)
    (PUB_CART / 'art' / 'legacy.png').write_bytes(PNG)  # 造一份"存量还在 public"的旧图
    r = subprocess.run([sys.executable, 'scripts/cartridge-art-migrate.py', CART],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    check(r.returncode == 0 and (PUB_CART / 'art' / 'legacy.png').is_file(),
          '⑦ 迁移默认 dry-run：报告但不动文件', r.stdout[-200:])
    r = subprocess.run([sys.executable, 'scripts/cartridge-art-migrate.py', '--apply', CART],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    check(r.returncode == 0 and (LIB / 'art' / 'legacy.png').is_file() and not (PUB_CART / 'art' / 'legacy.png').exists(),
          '⑦ --apply 真搬到卡带屋', r.stdout[-200:])
    r2 = subprocess.run([sys.executable, 'scripts/cartridge-art-migrate.py', '--apply', CART],
                        cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    check(r2.returncode == 0 and '无待迁移' in r2.stdout, '⑦ 再跑幂等（无事可做）', r2.stdout[-160:])

    # ⑧ 守卫发现卡带
    g = subprocess.run(['node', 'scripts/art-ledger-guard.mjs', '--json'],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    try:
        games = [x.get('game') for x in (json.loads(g.stdout or '{}').get('games') or [])]
    except Exception:
        games = []
    check(CART in games, '⑧ 守卫 discoverGames 发现卡带（否则台账漏审）', str(games)[:200])
finally:
    shutil.rmtree(LIB, ignore_errors=True)
    shutil.rmtree(PUB_CART, ignore_errors=True)
    shutil.rmtree(PUB_BUILTIN, ignore_errors=True)

print(f"\ncartridge-art smoke: {PASS} ok / {FAIL} fail")
sys.exit(1 if FAIL else 0)
