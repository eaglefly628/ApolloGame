"""统一任务托盘的聚合读口（REQ-ARTPAR 第四步·owner 2026-08-10「右上角一个能点开看的后台任务窗口」）。

owner 诉求原话：「进度条可以看到我现在几个在排队、几个在进行、几个已完成；点它们可以迅速跳转回去」。

**不造第四个注册表**——后台任务已有三家各自的进程内注册表，各自也都在用：
  · `art_jobs._ART_JOBS`      美术批量（REQ-ARTPAR 第一步）
  · `jobs._GEN_JOBS`          LLM 产游戏（工作台「生成进度」看板在用）
  · `packaging._PKG_JOBS`     打包/发行
本模块只做**只读归一**：把三家现读现拼成一份同构清单 + 计数。零新状态、零新真相——
谁家的任务谁家仍是唯一权威，托盘坏了也绝不影响任务本身跑。

归一后的一条：{id, kind, title, slug, state, startedAt, elapsedSec, detail, progress?, jumpTo}
  · state 闭集 = queued | running | done | failed（三家各自的 done/error 标准化到此）
  · jumpTo = 前端跳转意图（{screen, slug}）——**只给意图不给路由**，路由归前端。
"""
import time

from . import art_jobs, jobs, packaging
from .paths import art_root

# 状态闭集：托盘的计数/配色都按它分档，别在别处再造一套词。
STATES = ('queued', 'running', 'done', 'failed')


def _elapsed(started) -> int:
    try:
        return max(0, int(time.time() - float(started or 0)))
    except Exception:
        return 0


def _art_progress(slug: str):
    """美术批量的行级进度：现读该游戏台账（逐行落账后它就是实时进度·REQ-ARTPAR 第二步）。
    读不到/无行 → None（托盘只显状态点，不假装有进度条）。"""
    try:
        import json
        f = art_root(slug) / 'art-ledger.json'
        if not f.is_file():
            return None
        rows = [r for r in (json.loads(f.read_text('utf-8')).get('rows') or []) if r.get('status') != 'retired']
        if not rows:
            return None
        done = sum(1 for r in rows if r.get('status') in ('generated', 'replaced', 'filled', 'approved'))
        return {'done': done, 'total': len(rows)}
    except Exception:
        return None  # 进度是锦上添花——读失败绝不能拖垮托盘


def _from_art() -> list:
    out = []
    with art_jobs._ART_JOBS_LOCK:
        raw = list(art_jobs._ART_JOBS.values())
    for j in raw:
        state = j.get('state') if j.get('state') in STATES else 'running'
        if j.get('queued') and state == 'running':
            state = 'queued'   # 被单游戏串行锁挡住的那种「排队中」——owner 要看的正是这个数
        slug = j.get('slug') or ''
        out.append({
            'id': j['id'], 'kind': 'art', 'title': f"美术批量 · {slug}", 'slug': slug, 'state': state,
            'startedAt': j.get('startedAt'), 'elapsedSec': _elapsed(j.get('startedAt')),
            'detail': j.get('error') or (f"生成 {(j.get('summary') or {}).get('generated', 0)}"
                                         f"·缓存 {(j.get('summary') or {}).get('cached', 0)}" if j.get('summary') else j.get('packId') or ''),
            'progress': _art_progress(slug) if state in ('running', 'queued') else None,
            'jumpTo': {'screen': 'assets', 'slug': slug},
        })
    return out


def _from_generate() -> list:
    out = []
    with jobs._GEN_JOBS_LOCK:
        raw = list(jobs._GEN_JOBS.values())
    for j in raw:
        state = 'failed' if j.get('error') else ('done' if j.get('done') else 'running')
        out.append({
            'id': j['id'], 'kind': 'generate', 'title': f"产游戏 · {j.get('name') or j.get('slug') or ''}",
            'slug': j.get('slug') or '', 'state': state,
            'startedAt': j.get('startedAt'), 'elapsedSec': _elapsed(j.get('startedAt')),
            'detail': j.get('error') or jobs._GEN_JOB_STEPS[min(3, j.get('step') or 0)],
            'progress': {'done': min(4, (j.get('step') or 0) + (1 if j.get('done') else 0)), 'total': 4},
            'jumpTo': {'screen': 'library', 'slug': j.get('slug') or ''},
        })
    return out


def _from_package() -> list:
    out = []
    with packaging._PKG_JOBS_LOCK:
        raw = list(packaging._PKG_JOBS.values())
    for j in raw:
        state = 'failed' if j.get('error') else ('done' if j.get('done') else 'running')
        out.append({
            'id': j['id'], 'kind': 'package', 'title': f"打包 · {j.get('slug') or ''}（{j.get('platform') or ''}）",
            'slug': j.get('slug') or '', 'state': state,
            'startedAt': j.get('startedAt'), 'elapsedSec': _elapsed(j.get('startedAt')),
            'detail': j.get('error') or (j.get('artifactName') or ''),
            'progress': None,
            'jumpTo': {'screen': 'library', 'slug': j.get('slug') or ''},
        })
    return out


def handle_job_board(limit: int = 30) -> dict:
    """GET /api/jobs[?n=]。全部后台任务归一清单 + 计数（托盘用）。

    排序：**在跑的永远在最前**（排队/进行），然后按开始时间新→旧——托盘一打开先看见「还没完的」。
    任一来源抛错都不拖垮整体（分别 try）：托盘是观察窗，不该因为某家注册表抽风而整个瞎掉。"""
    rows = []
    for src in (_from_art, _from_generate, _from_package):
        try:
            rows += src()
        except Exception:
            continue
    order = {'queued': 0, 'running': 0, 'failed': 1, 'done': 2}
    rows.sort(key=lambda r: (order.get(r['state'], 3), -(r.get('startedAt') or 0)))
    counts = {s: sum(1 for r in rows if r['state'] == s) for s in STATES}
    counts['active'] = counts['queued'] + counts['running']   # 托盘角标只显这个数
    try:
        n = max(1, min(100, int(limit)))
    except Exception:
        n = 30
    return {'success': True, 'counts': counts, 'jobs': rows[:n]}
