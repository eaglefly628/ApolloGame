"""TS 例外卡带（logic.ts 装载门 + 旗标）+ 全库装载体检。"""
import subprocess
import time
import json
import re

from .config import _features
from .library import _git_commit_all, _touch_meta
from .paths import LIBRARY_DIR, _now_iso, _valid_slug, _write_json
from .sysutil import ROOT, _spawn, c

# ── TS 例外卡带（owner 07-11 拍板「展示游戏打勾允许生产 TS 逻辑」·features.tsCarts 默认关）────
# 形态=最小伤害：TS 绝不进 manifest（工件仍纯数据），住在 library/<slug>/logic.ts，
# 契约=export cartCapability（defineCapability·id 固定 cart-<slug>），落盘过 cart-logic-check
# 独立装载门（模块装载+契约+与 manifest 合体真引擎 2 tick）。记债：该卡带退出回放/换皮/bench 保证，
# 列表带 allowTs/hasLogic 旗供 UI 明示。发布=dev 线（vite 管线装载）；静态包不执行 logic。
_TS_BLOCK_RE = re.compile(r'```ts[ \t]*\n(.*?)```', re.S)

def _split_reply_ts(text: str):
    """回复文本 → (剩余文本, logic.ts 全文|None)。只认第一个 ```ts 围栏且内含 cartCapability 导出。"""
    m = _TS_BLOCK_RE.search(text or '')
    if not m:
        return (text or '').strip(), None
    content = m.group(1).strip() + '\n'
    rest = (text[:m.start()] + text[m.end():]).strip()
    if 'export const cartCapability' not in content:
        return rest, None  # 不合契约：当没提议
    return rest, content

def _ts_cart_enabled(slug: str) -> bool:
    """全局 features.tsCarts 开 且 该卡带 meta.allowTs 打了勾。"""
    if not _features().get('tsCarts'):
        return False
    try:
        meta = json.loads((LIBRARY_DIR / slug / 'meta.json').read_text('utf-8'))
        return bool(meta.get('allowTs'))
    except Exception:
        return False

def _run_cart_logic_check(slug: str, content: str) -> tuple:
    """logic.ts 候选 → 写 pending → cart-logic-check 装载门。返回 (ok, message)。pending 用后即清。"""
    pending = LIBRARY_DIR / slug / 'logic.pending.ts'
    try:
        pending.write_text(content, encoding='utf-8')
        proc = subprocess.run(
            **_spawn(['npx', 'vite-node', 'scripts/cart-logic-check.mjs', slug, 'logic.pending.ts']),
            cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=180,
        )
        if proc.returncode == 0:
            return True, (proc.stdout or '').strip()
        return False, (proc.stderr or proc.stdout or 'logic 校验失败（无输出）').strip()
    finally:
        try:
            pending.unlink(missing_ok=True)
        except Exception:
            pass

def library_put_logic(slug: str, body: dict) -> tuple:
    """PUT /api/library/<slug>/logic {content, note?}。content 空串=撤除 logic.ts（退出例外）。"""
    if not _features().get('tsCarts'):
        return (403, {'success': False, 'error': 'TS 例外功能未开启（features.tsCarts）'})
    game_dir = LIBRARY_DIR / slug
    if not _valid_slug(slug) or not game_dir.is_dir():
        return (404, {'success': False, 'error': f'卡带不存在: {slug}'})
    content = body.get('content')
    if not isinstance(content, str):
        return (400, {'success': False, 'error': 'content 必须是字符串（logic.ts 全文；空串=撤除）'})
    logic = game_dir / 'logic.ts'
    if content.strip() == '':
        logic.unlink(missing_ok=True)
        _touch_meta(game_dir)
        _git_commit_all(game_dir, 'logic: removed')
        return (200, {'success': True, 'slug': slug, 'removed': True})
    if not _ts_cart_enabled(slug):
        return (403, {'success': False, 'error': '该卡带未开 TS 例外勾（meta.allowTs）'})
    if len(content) > 65536:
        return (400, {'success': False, 'error': 'logic.ts 过大（≤64k）'})
    ok, msg = _run_cart_logic_check(slug, content)  # 先装载门
    if not ok:
        return (400, {'success': False, 'error': msg})
    logic.write_text(content if content.endswith('\n') else content + '\n', encoding='utf-8')
    _touch_meta(game_dir)
    _git_commit_all(game_dir, str(body.get('note') or 'logic: update'))
    return (200, {'success': True, 'slug': slug, 'gate': msg})

_DOCTOR_CACHE = {'key': None, 'data': None}

def _doctor_cache_key():
    """体检结果缓存键 = 两库里 manifest/logic/meta 文件的 (路径,mtime) 指纹。
    07-15 启动提速（诊断根因#2）：doctor 每次全价冷起 vite-node 1.7s+·工坊开屏就调——库没动就直接回缓存。
    诚实边界：键只盯卡带文件，引擎源码变了不失效（装载语义变化极少·重启进程即清）。"""
    sig = []
    for root in (ROOT / 'library', ROOT / 'public' / 'games'):
        if not root.exists():
            continue
        for p in root.rglob('*'):
            if p.name in ('manifest.json', 'logic.ts', 'logic.pending.ts', 'meta.json'):
                try:
                    sig.append((str(p.relative_to(ROOT)), int(p.stat().st_mtime)))
                except OSError:
                    pass
    return tuple(sorted(sig))

def handle_library_doctor() -> dict:
    """GET /api/library/doctor —— 全库装载体检（owner 07-11「把加载失败的错误都 log 出来」）。
    跑 scripts/library-doctor.mjs：每盘卡带/内置数据游戏走与运行器同一套 JSON→parse→引擎 load+2tick
    （含 TS 例外 logic 合体）；逐盘结果回 JSON，坏盘打 [DOCTOR] 控制台日志。只读不写。
    07-15：结果按库文件指纹缓存（命中回 cached:true）——库没动的重复体检不再重花 vite-node 冷启动。"""
    key = _doctor_cache_key()
    if _DOCTOR_CACHE['data'] is not None and _DOCTOR_CACHE['key'] == key:
        cached = dict(_DOCTOR_CACHE['data'])
        cached['cached'] = True
        return cached
    t0 = time.time()
    try:
        proc = subprocess.run(
            **_spawn(['npx', 'vite-node', 'scripts/library-doctor.mjs']),
            cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=300,
        )
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '体检超时（300s）'}
    if proc.returncode != 0:
        return {'success': False, 'error': (proc.stderr or proc.stdout or '体检脚本失败').strip()[:2000]}
    try:
        data = json.loads((proc.stdout or '').strip().splitlines()[-1])
    except Exception as e:
        return {'success': False, 'error': f'体检输出解析失败: {e}'}
    for r in data.get('results', []):
        if not r.get('ok'):
            print(c('  [DOCTOR]', 'r'), f"✗ [{r.get('where')}] {r.get('slug')} · {r.get('stage')} · {str(r.get('error'))[:200]}")
    print(c('  [DOCTOR]', 'g' if data.get('ok') else 'y'),
          f"体检完 {data.get('total')} 盘 · {(data.get('total') or 0) - (data.get('bad') or 0)} 好 · {data.get('bad')} 坏 · {time.time() - t0:.1f}s")
    data['success'] = True
    data['elapsedMs'] = int((time.time() - t0) * 1000)
    _DOCTOR_CACHE['key'] = key
    _DOCTOR_CACHE['data'] = dict(data)  # 只缓存成功结果；失败/超时不缓存（下次重试）
    return data

def library_set_flags(slug: str, body: dict) -> tuple:
    """POST /api/library/<slug>/flags {allowTs: bool}。仅 features.tsCarts 开时可用。"""
    if not _features().get('tsCarts'):
        return (403, {'success': False, 'error': 'TS 例外功能未开启（features.tsCarts）'})
    game_dir = LIBRARY_DIR / slug
    if not _valid_slug(slug) or not game_dir.is_dir():
        return (404, {'success': False, 'error': f'卡带不存在: {slug}'})
    if not isinstance(body.get('allowTs'), bool):
        return (400, {'success': False, 'error': 'allowTs 必须是布尔'})
    p = game_dir / 'meta.json'
    try:
        meta = json.loads(p.read_text('utf-8'))
    except Exception:
        return (500, {'success': False, 'error': 'meta.json 不可读'})
    meta['allowTs'] = body['allowTs']
    meta['updatedAt'] = _now_iso()
    _write_json(p, meta)
    return (200, {'success': True, 'slug': slug, 'allowTs': meta['allowTs']})
