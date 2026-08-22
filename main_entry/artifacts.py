"""一次「开工」到底产出了什么、在哪、有没有存住（owner 2026-08-10 实撞）。

owner 原话：「跑完了以后我也不知道在哪里，基础的代码也不知道哪里，也没有上传，那就等于白跑了」。

**诊断**：产物本身没丢，是**散在 2~4 处且引擎仓那部分全躺在工作区没提交**——
换台机器、或 clone 一份新的，就真的没了。落点按游戏形态推导（与 `game-pipeline.mjs::detectForm`
同一套规则·不造第二真相）：

    形态 cart      → `library/<slug>/`        **不入引擎仓**（gitignored·但有**自己的 git 仓**·每次保存自动提交）
    形态 builtin   → `public/games/<slug>/`   入引擎仓（tracked）
    形态 compiled  → `games/<slug>/`          入引擎仓（tracked）
    三种形态都可能有 → `docs/design/<slug>/`  入引擎仓（策划案/GDD/能力缺口台账）

于是「在哪」和「存住没」是两个问题，本模块两个端点各答一个：
  · `GET  /api/pipeline/artifacts?slug=`  —— 逐处列：路径 / 存在否 / 归哪个仓 / 几处未提交 / 人话说明
  · `POST /api/pipeline/artifacts/sync`   —— 把**引擎仓那部分**一键提交+推送（复用 art_sync.sync_paths：
    只 add 该 slug 的 pathspec、不碰他人在途改动、fetch→rebase→push 自动重试、冲突自动 abort 保本地提交）。
    卡带屋（library/）不在此列——它有自己的仓、也本就不该进引擎仓，端点会明说它存在哪儿。
"""
import subprocess
import threading

from .art_sync import _git, push_branch, sync_paths
from .config import _features
from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, c


def detect_form(slug: str):
    """游戏形态（与 scripts/game-pipeline.mjs::detectForm 同判据·同顺序）。"""
    if (LIBRARY_DIR / slug / 'manifest.json').is_file():
        return 'cart'
    if (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file():
        return 'builtin'
    if (ROOT / 'games' / slug).is_dir():
        return 'compiled'
    return None


def _engine_pathspecs(slug: str, form) -> list:
    """该 slug 落在**引擎仓**里的目录（可提交推送的那些）。卡带屋不在内（见模块头）。"""
    specs = []
    if form == 'builtin':
        specs.append(f'public/games/{slug}')
    elif form == 'compiled':
        specs.append(f'games/{slug}')
        if (ROOT / 'public' / 'games' / slug).is_dir():
            specs.append(f'public/games/{slug}')   # 编译期游戏的美术/台账仍在 public 侧
    elif form == 'cart' and (ROOT / 'public' / 'games' / slug).is_dir():
        specs.append(f'public/games/{slug}')       # 卡带的 pipeline.json 等仍落这里（REQ-CARTART 留尾）
    if (ROOT / 'docs' / 'design' / slug).is_dir():
        specs.append(f'docs/design/{slug}')
    return specs


def _dirty(pathspecs: list) -> list:
    """pathspec 范围内的未提交文件。git 失败 → **空列表 + 留痕**（F2·主程复查 2026-08-18）：
    空列表在上游读作「无产物·跳过」，与「真的干净」同形——不喊一声就成了一次静默的白跑，
    正是 owner 实撞那个病的形状（凡「什么都没发生」的分支必须记·日志基准守则）。"""
    if not pathspecs:
        return []
    r = _git(ROOT, ['status', '--porcelain', '--', *pathspecs], timeout=30)
    if r.returncode != 0:
        print(c("  [AUTO]", 'y'), f"git status 失败（{(r.stderr or '').strip()[:120] or '无输出'}）"
                                  f"→ 当作「无未提交产物」跳过：{', '.join(pathspecs)}")
        return []
    return [ln[3:] for ln in (r.stdout or '').splitlines() if len(ln) > 3]


def _cart_repo_state(slug: str) -> dict:
    """卡带自己那个仓的状态——回答「它到底存住没」。有 git 就报最近一次提交；没有就报快照降级。"""
    d = LIBRARY_DIR / slug
    if not d.is_dir():
        return {}
    if (d / '.git').exists():
        r = subprocess.run(['git', 'log', '-1', '--format=%h %cr %s'], cwd=str(d),
                           capture_output=True, text=True, timeout=15)
        if r.returncode == 0 and r.stdout.strip():
            return {'versioned': 'git', 'lastCommit': r.stdout.strip()[:120]}
        return {'versioned': 'git', 'lastCommit': '（仓已建·暂无提交）'}
    snaps = sorted((d / 'snapshots').glob('*.json')) if (d / 'snapshots').is_dir() else []
    return {'versioned': 'snapshot', 'lastCommit': f'快照 {len(snaps)} 份（本机无 git·降级）'} if snaps else {'versioned': 'none'}


def handle_artifacts_status(slug: str) -> dict:
    """GET /api/pipeline/artifacts?slug=<slug>。这个游戏的产物都在哪、存住没。"""
    slug = str(slug or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    form = detect_form(slug)
    specs = _engine_pathspecs(slug, form)
    dirty = _dirty(specs)
    by_spec = {s: [f for f in dirty if f.startswith(s)] for s in specs}
    locations = []
    if form == 'cart':
        locations.append({
            'path': f'library/{slug}/', 'kind': 'cart', 'exists': True, 'repo': 'cartridge',
            'dirtyCount': 0,
            'note': '卡带本体（玩法 manifest + 美术）——不入引擎仓，但有自己的 git 仓、每次保存自动提交，'
                    '换机器要靠导出包带走：' + f'GET /api/library/{slug}/export',
            **_cart_repo_state(slug),
        })
    for s in specs:
        locations.append({
            'path': s + '/', 'kind': 'design' if s.startswith('docs/') else 'game',
            'exists': (ROOT / s).is_dir(), 'repo': 'engine', 'dirtyCount': len(by_spec.get(s) or []),
            'note': '在引擎仓里——未提交就等于没存住（换机器/重新 clone 即丢）' if by_spec.get(s) else '在引擎仓里·当前无未提交改动',
        })
    if form is None and not specs:
        return {'success': True, 'slug': slug, 'form': None, 'locations': [], 'dirtyTotal': 0,
                'hint': f'查无此游戏——`library/{slug}/`、`public/games/{slug}/`、`games/{slug}/` 都不存在。'
                        '开工若从没跑成，产物自然也不会有；先看 `.zerocraft/orchestrator-runs.json` 的 reason。'}
    return {'success': True, 'slug': slug, 'form': form, 'locations': locations,
            'dirtyTotal': len(dirty), 'files': dirty[:50],
            'canSync': bool(dirty), 'autoPush': bool(_features().get('autoPush', True)),
            'lastAutoSync': last_auto_sync(slug),
            'hint': ('有 %d 处改动还没提交——点「提交推送」存住，否则换机器就没了' % len(dirty)) if dirty
                    else '引擎仓这边没有未提交改动（已存住或本次没产出）'}


def handle_artifacts_sync(body: dict) -> dict:
    """POST /api/pipeline/artifacts/sync {slug}。把该游戏落在引擎仓的产物一键提交+推送。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    form = detect_form(slug)
    specs = _engine_pathspecs(slug, form)
    if not specs:
        return {'success': False, 'error': f'{slug} 在引擎仓里没有可提交的产物目录'
                                           + ('（卡带本体在 library/，有自己的仓，不入引擎仓）' if form == 'cart' else '')}
    res = sync_paths(ROOT, specs, f'{slug}: 开工产物同步（docs/design + 游戏目录）')
    out = {'success': bool(res.pop('ok', False)), 'slug': slug, 'paths': specs, **res}
    if out['success'] and not out.get('clean'):
        print(c("  [ART]", 'g'), f"artifacts sync {slug} → {len(out.get('files') or [])} 文件"
                                 f"{'已推送' if out.get('pushed') else '已本地提交'}")
    return out


# ── 自动上传（owner 2026-08-10 令：「希望它主动去上传·跟我在窗口里做事的感受一致」）──────────
# **顺序是刻意的**：先本地提交 → 再跑门禁 → 绿了才推。
#   · 先提交：owner 这次实撞「跑完结果就没了」——**任何产出必须先落成提交，丢不了**，这是第一位的；
#   · 后门禁：CLAUDE.md 铁律「门禁全绿才推」不可破。红了就停在本地提交，如实报红，绝不把红的推上去。
# scoped-gate 自己按改动面缩范围（纯文档→文档守卫·单游戏→该游戏 vitest+tsc+build），故这里不猜范围。
_AUTOSYNC_LOCK = threading.Lock()   # 串行：两个任务同时收工不该同时动 git
_AUTOSYNC_LAST: dict = {}           # slug → 最近一次结果（托盘/状态端点读它，回答「刚才自动存了没」）
_AUTOSYNC_LAST_LOCK = threading.Lock()


def _gate_cmd() -> list:
    return ['node', 'scripts/scoped-gate.mjs', '--run']


def auto_sync(slug: str, reason: str = '', run_gate: bool = True) -> dict:
    """一个任务收工后自动存住该 slug 的产物。返回 {ok, committed?, gate, pushed, error?}。

    **永不抛**——它是收尾动作，失败绝不能反过来污染那个已经跑完的任务。"""
    res = _auto_sync_inner(slug, reason, run_gate)
    with _AUTOSYNC_LAST_LOCK:
        _AUTOSYNC_LAST[slug] = {'reason': reason, **res}
    return res


def _auto_sync_inner(slug: str, reason: str, run_gate: bool) -> dict:
    try:
        if not _features().get('autoPush', True):
            return {'skipped': True, 'reason': 'features.autoPush 已关——请用手动「提交推送」按钮'}
        if not _valid_slug(slug):
            return {'skipped': True, 'error': f'非法 slug: {slug}'}
        specs = _engine_pathspecs(slug, detect_form(slug))
        if not specs or not _dirty(specs):
            return {'skipped': True, 'reason': '无未提交产物'}
        with _AUTOSYNC_LOCK:
            if not _dirty(specs):   # 拿到锁时前一个任务可能已顺手把它提交了
                return {'skipped': True, 'reason': '无未提交产物（已被上一次自动存档带走）'}
            # ① 先落本地提交（**不推**）——保命动作，先于任何可能失败的步骤。
            #    owner 这次实撞「跑完结果就没了」，所以「丢不了」优先级高于「推不推得出去」。
            msg = f'{slug}: 自动存档（{reason or "任务收工"}）'
            r = sync_paths(ROOT, specs, msg, remote='__none__')  # 无此远端 → commit 后即返回，不推
            committed = r.get('committed')
            if not committed:
                return {'ok': False, 'error': r.get('error') or '本地提交失败'}
            print(c("  [AUTO]", 'g'), f"{slug} 产物已本地提交 {committed}（{len(r.get('files') or [])} 文件）")
            done = {'committed': committed, 'files': r.get('files') or [], 'branch': r.get('branch')}
            if not run_gate:
                return {'ok': True, 'gate': 'skipped', 'pushed': False, **done}
            # ② 门禁（scoped-gate 自己按改动面缩范围）——**退出码直核·绝不经管道**（CLAUDE.md 铁律）
            try:
                g = subprocess.run(_gate_cmd(), cwd=str(ROOT), capture_output=True, text=True, timeout=3600)
                rc, tail = g.returncode, ((g.stdout or '') + (g.stderr or ''))[-600:]
            except Exception as e:
                rc, tail = 1, f'门禁进程异常: {e}'
            if rc != 0:
                print(c("  [AUTO]", 'y'), f"{slug} 门禁红 → 停在本地提交（不推）")
                return {'ok': False, 'gate': 'red', 'pushed': False, 'detail': tail, **done,
                        'error': '门禁未过——产物已本地提交（丢不了），按「全绿才推」未推送'}
            # ③ 绿了才推。**不能再调 sync_paths**：此刻工作区已干净会被 clean 短路而不推，
            #    故直接调抽出来的推送段（fetch → rebase --autostash → push·被拒自动重试）。
            p = push_branch(ROOT, base=done)
            if p.get('pushed'):
                print(c("  [AUTO]", 'g'), f"{slug} 门禁绿 → 已推送")
            return {'ok': bool(p.get('ok')), 'gate': 'green', 'pushed': bool(p.get('pushed')),
                    **{k: v for k, v in p.items() if k != 'ok'}}
    except Exception as e:
        return {'ok': False, 'error': f'自动存档异常: {e}'}


def auto_sync_bg(slug: str, reason: str = '') -> None:
    """后台起一条自动存档（门禁要跑几分钟·绝不占着调用方的线程）。永不抛。"""
    try:
        threading.Thread(target=auto_sync, args=(slug, reason), daemon=True).start()
    except Exception as e:
        print(c("  [AUTO]", 'y'), f"{slug} 自动存档起不来: {e}")


def last_auto_sync(slug: str) -> dict:
    with _AUTOSYNC_LAST_LOCK:
        return dict(_AUTOSYNC_LAST.get(slug) or {})
