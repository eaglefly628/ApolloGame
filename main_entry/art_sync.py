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
import os
import re
import shutil
import subprocess
from pathlib import Path

from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, c

# 提交署名走本地 -c（同 library.py 先例：不依赖机器有无全局 git 身份）。
_GIT_AUTHOR = ['-c', 'user.name=ZeroCraft Preview', '-c', 'user.email=studio@zerocraft.local']
# 非交互硬化（owner 2026-08-06 复查补洞）：凭证缺失/失效时必须**立刻失败**，绝不在跑创作台的
# 那个终端弹「Username:」等人输入——否则创作台的 HTTP 请求就挂在那儿直到超时，UI 卡死一分半。
# credential.interactive=false 关 Git Credential Manager（Win/macOS 常见）的交互弹窗。
_GIT_NONINTERACTIVE = ['-c', 'credential.interactive=false']

# 凭证类失败特征（git/ssh 原样文案）：命中即**不重试**——凭证不会因为多试两次就长出来。
_AUTH_FAIL_RE = re.compile(
    r'terminal prompts disabled|could not read (Username|Password)|Authentication failed|'
    r'Permission denied \(publickey|Host key verification failed|'
    r'Support for password authentication was removed', re.I)


def _noninteractive_env() -> dict:
    """子进程环境：堵死一切「等人输入」的口子（终端提示 / 图形 askpass / ssh 口令）。"""
    env = dict(os.environ)
    env['GIT_TERMINAL_PROMPT'] = '0'  # HTTPS 凭证终端提示 → 直接失败
    env['GIT_ASKPASS'] = ''           # 不唤起图形 askpass 弹窗
    env['SSH_ASKPASS'] = ''
    # SSH remote 同理：key 带口令且 agent 里没有时 ssh 会等输入，BatchMode 让它失败。
    # 保留用户既有 GIT_SSH_COMMAND（可能指定了专用 key），只追加不覆盖。
    ssh = (env.get('GIT_SSH_COMMAND') or '').strip()
    env['GIT_SSH_COMMAND'] = f'{ssh} -o BatchMode=yes' if ssh else 'ssh -o BatchMode=yes'
    return env


def _git(repo: Path, args: list, timeout: int = 60):
    """跑一条 git。stdin=DEVNULL + 非交互环境 = 永不阻塞等输入；超时折成普通失败（非异常），
    让调用方按「已本地提交·未推送」的正常语义收尾，而不是把 500 抛给创作台。"""
    try:
        return subprocess.run(['git', *_GIT_NONINTERACTIVE, *args], cwd=str(repo), capture_output=True,
                              text=True, timeout=timeout, stdin=subprocess.DEVNULL, env=_noninteractive_env())
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 1, '', f'git {args[0]} 超时（{timeout}s）——网络不通或远端无响应')


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
    auth_note = ('推送失败：本机 git 凭证未配置或已失效——改动已保存为本地提交，'
                 '配好凭证（SSH key / gh auth login / 凭据管理器）后 git push 即可')
    for attempt in range(1, max_attempts + 1):
        f = _git(repo, ['fetch', remote, branch], timeout=120)
        if f.returncode != 0:
            last_err = f'fetch 失败: {_err_text(f)}'
            if _AUTH_FAIL_RE.search(last_err):  # 凭证问题：秒退，不做无谓重试（原会干等三轮）
                return {'ok': False, 'pushed': False, 'attempts': attempt, 'authFailed': True,
                        'error': auth_note, 'detail': last_err[:300], **base}
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
        if _AUTH_FAIL_RE.search(last_err):  # 同上：凭证不会因多试两次长出来
            return {'ok': False, 'pushed': False, 'attempts': attempt, 'authFailed': True,
                    'error': auth_note, 'detail': last_err[:300], **base}
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


# ── mock 预览物清理（owner 2026-08-06「生成的这些黑户怎么删除·没有删除按钮」）──────────────
# mock 产物按设计是**孤儿**：落独立命名空间 art/gen/mock/（gitignored·永不写回台账/索引），
# 故守卫必然把它们报成「黑户」。它们既不该登记、也没有回收口 → 只能靠人手动删。
# 本端点只清 `gen/mock/` 这一棵子树（**闭集·不接受任意路径**），删不到真图，安全可重复。
def handle_art_cleanup_mock(body: dict) -> dict:
    """POST /api/art/cleanup-mock {slug}。清空该游戏的 mock 预览图（art/gen/mock/**）。
    只删这一棵子树；真图 gen/art-NN 与其它一律不碰。返回删除的文件数。"""
    from .paths import art_root  # 局部导入：避免与本模块既有导入顺序纠缠
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    root = art_root(slug)
    if not root.is_dir():
        return {'success': False, 'error': f'该游戏无美术目录: {slug}'}
    mock_dir = root / 'gen' / 'mock'
    if not mock_dir.is_dir():
        return {'success': True, 'removed': 0, 'note': '无 mock 预览图（已是干净的）'}
    # 纵深断言：解析后必须仍在该游戏美术根内（防 slug 侧的意外穿越）
    try:
        mock_dir.resolve().relative_to(root.resolve())
    except ValueError:
        return {'success': False, 'error': '路径越界'}
    files = [p for p in mock_dir.rglob('*') if p.is_file()]
    for p in files:
        try:
            p.unlink()
        except Exception:
            pass  # 单个删不掉不阻断其余（只读/占用）
    shutil.rmtree(mock_dir, ignore_errors=True)
    print(c("  [ART]", 'g'), f"cleanup-mock {slug} → 清 {len(files)} 张 mock 预览图")
    return {'success': True, 'removed': len(files)}
