"""内置游戏美术改动一键提交+推送（owner 2026-08-06「内置游戏美术替换老是冲突」·方案A止痛）。

痛点：内置游戏替换直写 tracked 的 public/games/<slug>/**，改动躺工作区不提交，
被 claude/mainbranch 高频推送挤成分叉，owner 每次 pull 都撞冲突。
本模块把「改完即提交+推送」做成创作台一键动作：add(限本游戏目录) → commit(带路径·
不碰他人暂存内容) → fetch → rebase --autostash → push，push 被拒自动重试；rebase
冲突自动 abort——改动保留为本地提交，绝不留半截 rebase 现场。

范围铁律：只 add/commit `public/games/<slug>` 一个 pathspec——共享工作树里别人的
在途/已暂存改动一律不带（2026-08-03 误提交事故律）。library 卡带不入引擎仓
（自带每卡带 git 版本化，见 library.py），不适用本端点。
"""
import subprocess
from pathlib import Path

from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, c

# 提交署名走本地 -c（同 library.py 先例：不依赖机器有无全局 git 身份）。
_GIT_AUTHOR = ['-c', 'user.name=ZeroCraft Preview', '-c', 'user.email=studio@zerocraft.local']


def _git(repo: Path, args: list, timeout: int = 60):
    return subprocess.run(['git', *args], cwd=str(repo), capture_output=True, text=True, timeout=timeout)


def _err_text(r) -> str:
    return (r.stderr or r.stdout or '').strip()


def status_paths(repo: Path, pathspecs: list) -> dict:
    """pathspec 范围内的未提交改动（含未跟踪新文件·gitignore 命中的 mock 产物天然不列）。"""
    r = _git(repo, ['status', '--porcelain', '--', *pathspecs], timeout=30)
    if r.returncode != 0:
        return {'ok': False, 'error': _err_text(r) or 'git status 失败'}
    files = [ln[3:] for ln in r.stdout.splitlines() if len(ln) > 3]
    br = _git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], timeout=15)
    return {'ok': True, 'files': files, 'branch': br.stdout.strip() if br.returncode == 0 else ''}


def sync_paths(repo: Path, pathspecs: list, message: str, remote: str = 'origin', max_attempts: int = 3) -> dict:
    """核心（可测：repo 参数化·冒烟用临时仓）：范围内改动 → 本地提交 → rebase+push 自动重试。
    返回 {ok, clean?, committed?, pushed?, files, branch, attempts?, error?, note?}。
    失败语义：committed 有值 + ok=False = 改动已安全落为本地提交，只是没推出去。"""
    st = status_paths(repo, pathspecs)
    if not st['ok']:
        return st
    branch = st['branch']
    if not branch or branch == 'HEAD':
        return {'ok': False, 'error': 'HEAD 游离（detached）——先切回分支再同步'}
    if not st['files']:
        return {'ok': True, 'clean': True, 'files': [], 'branch': branch}
    r = _git(repo, ['add', '-A', '--', *pathspecs])
    if r.returncode != 0:
        return {'ok': False, 'error': f'git add 失败: {_err_text(r)}'}
    # commit 带 pathspec：只提交本范围（他人已暂存的域外内容留在暂存区不动·事故律）。
    r = _git(repo, [*_GIT_AUTHOR, 'commit', '-q', '-m', message, '--', *pathspecs])
    if r.returncode != 0:
        return {'ok': False, 'error': f'git commit 失败: {_err_text(r)}'}
    commit = _git(repo, ['rev-parse', '--short', 'HEAD'], timeout=15).stdout.strip()
    base = {'committed': commit, 'files': st['files'], 'branch': branch}
    if _git(repo, ['remote', 'get-url', remote], timeout=15).returncode != 0:
        return {'ok': True, 'pushed': False, 'note': f'无远端 {remote}——已保存为本地提交', **base}
    last_err = ''
    for attempt in range(1, max_attempts + 1):
        f = _git(repo, ['fetch', remote, branch], timeout=120)
        if f.returncode != 0:
            last_err = f'fetch 失败: {_err_text(f)}'
        elif _git(repo, ['rev-parse', '--verify', '-q', f'{remote}/{branch}'], timeout=15).returncode == 0:
            # --autostash：域外未提交改动（owner 自己的在途编辑）由 git 原生暂存并在 rebase 后原样放回。
            rb = _git(repo, ['rebase', '--autostash', f'{remote}/{branch}'], timeout=120)
            if rb.returncode != 0:
                _git(repo, ['rebase', '--abort'], timeout=60)
                return {'ok': False, 'pushed': False, 'attempts': attempt,
                        'error': '自动 rebase 冲突——改动已保存为本地提交，请手动 git pull --rebase 解决冲突后 git push',
                        'detail': _err_text(rb)[:500], **base}
        p = _git(repo, ['push', remote, branch], timeout=120)
        if p.returncode == 0:
            return {'ok': True, 'pushed': True, 'attempts': attempt, **base}
        last_err = _err_text(p)
    return {'ok': False, 'pushed': False, 'attempts': max_attempts,
            'error': f'推送失败（已重试 {max_attempts} 次）：{last_err[:300]}——改动已保存为本地提交', **base}


def _builtin_scope(slug: str):
    """校验 slug 是内置游戏（tracked 的 public/games/<slug>）→ (pathspec 列表, None)；否则 (None, 错误)。"""
    if not _valid_slug(slug):
        return None, f'非法 slug: {slug or "(空)"}'
    if (LIBRARY_DIR / slug).is_dir():
        return None, 'library 卡带不入引擎仓（自带每卡带版本化）——无需提交推送'
    if not (ROOT / 'public' / 'games' / slug).is_dir():
        return None, f'内置游戏不存在: {slug}'
    return [f'public/games/{slug}'], None


def handle_art_sync_status(slug: str) -> dict:
    """GET /api/art/sync/status?slug=<slug>。该内置游戏在引擎仓的待同步改动（按钮角标/禁用态用）。"""
    scope, err = _builtin_scope(str(slug or '').strip())
    if err:
        return {'success': False, 'error': err}
    st = status_paths(ROOT, scope)
    if not st['ok']:
        return {'success': False, 'error': st.get('error', 'git status 失败')}
    return {'success': True, 'count': len(st['files']), 'files': st['files'], 'branch': st['branch']}


def handle_art_sync(body: dict) -> dict:
    """POST /api/art/sync {slug}。一键提交+推送该内置游戏的美术改动（fetch→rebase→push 自动重试）。"""
    slug = str(body.get('slug', '')).strip()
    scope, err = _builtin_scope(slug)
    if err:
        return {'success': False, 'error': err}
    res = sync_paths(ROOT, scope, f'art({slug}): 创作台美术替换同步')
    out = {'success': bool(res.pop('ok', False)), **res}
    if out['success'] and not out.get('clean'):
        state = '已推送' if out.get('pushed') else '已本地提交'
        print(c("  [ART]", 'g'), f"sync {slug} → {len(out.get('files') or [])} 文件 {state}（{out.get('committed', '')}）")
    return out
