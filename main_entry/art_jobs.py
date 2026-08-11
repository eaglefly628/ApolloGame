"""美术批量生成的后台任务化（REQ-ARTPAR 第一步·owner 2026-08-10 令「怎么并行铺开」）。

痛点（`docs/design/art-pipeline-review-2026-08-10.md` P0）：`/api/art/batch` 是**同步阻塞**调用，
而 `_art_replace_cli` 的子进程上限 **300 秒**。批量在真 key 下按 10~30s/张算，game-g 110 行需
18~55 分钟 → **必然超时被 SIGKILL**，且当时台账是最后才写的 ⇒ 图在磁盘、台账空白 = 批量产黑户。

本模块**不造新东西**，照搬 `jobs.py` 已经跑了一个月的线程 job 形态（`_GEN_JOBS` + 锁 + 轮询视图）：
批量搬进后台线程 → HTTP 立刻返回 jobId → 前端轮询。三个后果一次解决：
  · **不再阻塞**：点完就能去干别的（owner 的「并行铺开」诉求本体）；
  · **没有 300s 天花板**：线程不受 HTTP 请求生命周期约束（子进程超时另给 2 小时）；
  · **进度免费**：REQ-ARTPAR 第二步已让 CLI **逐行落账** → 前端照旧轮 `/api/art/ledger`
    就是实时进度，**不必新发明进度协议**（台账本就是唯一真相）。

**单游戏串行锁**（REQ-ARTPAR 第三步的配套）：同一游戏同时只许一个批量在跑。没有这把锁，
两个批量会各自「读整份台账→内存改→整份写回」，后写的把先写的**整份覆盖**、先者结果静默丢失
（review P2）。锁按 slug 分，不同游戏之间照样并行。
"""
import threading
import time
import uuid

from .library import _art_replace_cli
from .paths import _valid_slug
from .sysutil import c

_ART_JOBS: dict = {}
_ART_JOBS_LOCK = threading.Lock()
_ART_SLUG_LOCKS: dict = {}          # slug → threading.Lock（单游戏串行）
_ART_SLUG_LOCKS_GUARD = threading.Lock()
_MAX_KEPT = 20                      # 只留最近 N 条（同 jobs.py 口径·进程内注册表·重启即清）


def _slug_lock(slug: str) -> threading.Lock:
    with _ART_SLUG_LOCKS_GUARD:
        if slug not in _ART_SLUG_LOCKS:
            _ART_SLUG_LOCKS[slug] = threading.Lock()
        return _ART_SLUG_LOCKS[slug]


def _update(jid: str, **kw) -> None:
    with _ART_JOBS_LOCK:
        if jid in _ART_JOBS:
            _ART_JOBS[jid].update(kw)


def _view(j: dict) -> dict:
    """对外视图（不泄漏内部字段）。running/done/failed 三态 + 摘要。"""
    return {k: j.get(k) for k in
            ('id', 'slug', 'packId', 'state', 'startedAt', 'finishedAt', 'summary', 'error', 'queued')}


def is_running(slug: str) -> bool:
    with _ART_JOBS_LOCK:
        return any(j['slug'] == slug and j['state'] == 'running' for j in _ART_JOBS.values())


def _run(jid: str, slug: str, args: list) -> None:
    """后台线程：拿单游戏锁 → 跑 CLI（子进程超时放到 2 小时）→ 落终态。"""
    lock = _slug_lock(slug)
    if not lock.acquire(blocking=False):
        _update(jid, queued=True)
        print(c("  [ART]", 'y'), f"job {jid[:8]} 等待 {slug} 的前一个批量跑完…")
        lock.acquire()  # 排队：同游戏严格串行（防两个批量互相整份覆盖台账）
        _update(jid, queued=False)
    try:
        res = _art_replace_cli(args, timeout=7200)  # 2 小时：批量本就该跑很久，不该由 HTTP 超时决定
        if res.get('ok'):
            _update(jid, state='done', summary=res.get('summary'), finishedAt=time.time())
            s = res.get('summary') or {}
            print(c("  [ART]", 'g'), f"job {jid[:8]} {slug} 完成 → 生成 {s.get('generated')} 缓存 {s.get('cached')} mock {s.get('mock')}")
        else:
            _update(jid, state='failed', error=str(res.get('error') or '批量失败'), finishedAt=time.time())
    except Exception as e:  # 后台线程绝不能把异常吞成「永远 running」
        _update(jid, state='failed', error=f'批量异常: {e}', finishedAt=time.time())
    finally:
        lock.release()


def start_batch(slug: str, args: list, pack_id: str = '') -> dict:
    """起一个后台批量任务，立刻返回 jobId（不等它跑完）。"""
    jid = uuid.uuid4().hex
    with _ART_JOBS_LOCK:
        for old in sorted(_ART_JOBS.values(), key=lambda x: x['startedAt'])[:-(_MAX_KEPT - 1)]:
            if old['state'] != 'running':
                _ART_JOBS.pop(old['id'], None)
        _ART_JOBS[jid] = {'id': jid, 'slug': slug, 'packId': pack_id, 'state': 'running',
                          'startedAt': time.time(), 'finishedAt': None, 'summary': None,
                          'error': None, 'queued': False}
    threading.Thread(target=_run, args=(jid, slug, args), daemon=True).start()
    print(c("  [ART]", 'g'), f"job {jid[:8]} 起 → {slug}·{pack_id}（后台跑·轮 /api/art/job）")
    return {'success': True, 'jobId': jid, 'job': _view(_ART_JOBS[jid])}


def handle_art_job_get(jid: str) -> dict:
    """GET /api/art/job?id=<jobId>。任务状态（进度请轮 /api/art/ledger——逐行落账即实时进度）。"""
    with _ART_JOBS_LOCK:
        j = _ART_JOBS.get(str(jid or '').strip())
        return {'success': True, 'job': _view(j)} if j else {'success': False, 'error': f'任务不存在: {jid}'}


def handle_art_jobs_list(slug: str = '') -> dict:
    """GET /api/art/jobs[?slug=]。最近任务（新在前·刷新/切屏后恢复「生成中」看板）。"""
    slug = str(slug or '').strip()
    if slug and not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug}'}
    with _ART_JOBS_LOCK:
        js = sorted((j for j in _ART_JOBS.values() if not slug or j['slug'] == slug),
                    key=lambda x: -x['startedAt'])[:_MAX_KEPT]
        return {'success': True, 'jobs': [_view(j) for j in js]}
