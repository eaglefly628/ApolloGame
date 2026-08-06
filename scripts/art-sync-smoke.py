#!/usr/bin/env python3
"""内置游戏美术一键提交推送冒烟（owner 2026-08-06「替换老是冲突」·方案A）。

核心 sync_paths 在**临时 git 仓 + 裸远端**上自证（绝不碰引擎仓工作树）：
  ① 干净范围 → clean=True 不产提交
  ② 有改动（含未跟踪新文件）→ 本地提交 + 推送成功；提交只含范围内文件
  ③ 范围外脏文件/他人已暂存内容 → 不被带进提交·内容原样保留（2026-08-03 误提交事故律）
  ④ 远端分叉（不同文件）→ fetch+rebase 自动合 → 推送成功·两边提交都在
  ⑤ 远端分叉（同文件同行冲突）→ rebase 自动 abort·无半截 rebase 现场·改动保留为本地提交
  ⑥ 无远端 → 本地提交成功 + note 明说未推送
端点校验腿（直调 handler·只走拒绝路径，绝不对真仓 add/commit）：
  ⑦ 非法 slug / 不存在游戏 / library 卡带 → 拒绝且错误信息可读

用法：python3 scripts/art-sync-smoke.py
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry.art_sync import handle_art_sync, handle_art_sync_status, status_paths, sync_paths  # noqa: E402

PASS, FAIL = 0, 0


def check(cond, label, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}  {detail}")


def git(repo, *args):
    r = subprocess.run(['git', '-c', 'user.name=smoke', '-c', 'user.email=smoke@local', *args],
                       cwd=str(repo), capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f'git {args} 失败: {r.stderr or r.stdout}')
    return r.stdout


TMP = Path(tempfile.mkdtemp(prefix='art-sync-smoke-'))
SCOPE = ['public/games/game-x']
try:
    # ── 搭台：裸远端 + 两个工作克隆（work2 扮演 mainbranch 上推挤的其他 session）──
    bare = TMP / 'remote.git'
    bare.mkdir()
    git(bare, 'init', '--bare', '-q', '-b', 'main')
    work = TMP / 'work'
    work.mkdir()
    git(work, 'init', '-q', '-b', 'main')
    git(work, 'remote', 'add', 'origin', str(bare))
    art = work / 'public' / 'games' / 'game-x' / 'art'
    art.mkdir(parents=True)
    (art / 'index.json').write_text('{"version":1,"assets":[]}\n')
    (work / 'README.md').write_text('engine\n')
    git(work, 'add', '-A')
    git(work, 'commit', '-q', '-m', 'init')
    git(work, 'push', '-q', 'origin', 'main')
    work2 = TMP / 'work2'
    git(TMP, 'clone', '-q', str(bare), str(work2))

    # ① 干净范围 → clean
    r = sync_paths(work, SCOPE, 'noop')
    check(r.get('ok') and r.get('clean') and not r.get('committed'), '① 干净范围 clean=True 不产提交', str(r))

    # ②+③ 范围内改动（改 index + 新增未跟踪 png）+ 范围外脏 README + 他人暂存的域外文件 → 只提交范围
    (art / 'index.json').write_text('{"version":1,"assets":[{"id":"a"}]}\n')
    (art / 'gen').mkdir()
    (art / 'gen' / 'art-01.png').write_bytes(b'\x89PNG fake')
    (work / 'README.md').write_text('engine + 别人的在途改动\n')
    (work / 'other.txt').write_text('他人已暂存内容\n')
    git(work, 'add', 'other.txt')
    r = sync_paths(work, SCOPE, 'art(game-x): smoke sync')
    check(r.get('ok') and r.get('pushed') and r.get('committed'), '② 有改动 → 本地提交 + 推送成功', str(r))
    shown = git(work, 'show', '--name-only', '--format=%s', 'HEAD')
    check('art(game-x): smoke sync' in shown and 'index.json' in shown and 'art-01.png' in shown
          and 'README.md' not in shown and 'other.txt' not in shown,
          '②③ 提交只含范围内文件（README/他人暂存不带）', shown)
    check((work / 'README.md').read_text().endswith('别人的在途改动\n') and (work / 'other.txt').is_file(),
          '③ 范围外在途/暂存内容原样保留', '')
    st = status_paths(work, ['.'])
    check(any('README.md' in f for f in st['files']) and any('other.txt' in f for f in st['files']),
          '③ 范围外文件仍是未提交态（没被顺走）', str(st))

    # ④ 远端分叉（不同文件）→ rebase 自动合 + 推送
    git(work2, 'pull', '-q', '--rebase', 'origin', 'main')  # 先追平 ② 的推送，再造新分叉
    (work2 / 'public' / 'games' / 'game-x' / 'art' / 'other-art.json').write_text('{"v":2}\n')
    git(work2, 'add', '-A')
    git(work2, 'commit', '-q', '-m', 'mainbranch 推挤')
    git(work2, 'push', '-q', 'origin', 'main')
    (art / 'index.json').write_text('{"version":1,"assets":[{"id":"a"},{"id":"b"}]}\n')
    r = sync_paths(work, SCOPE, 'art(game-x): 分叉后同步')
    check(r.get('ok') and r.get('pushed'), '④ 远端分叉（不同文件）→ 自动 rebase + 推送成功', str(r))
    log = git(work, 'log', '--oneline', '-5')
    check('mainbranch 推挤' in log and '分叉后同步' in log, '④ 两边提交都在（rebase 非覆盖）', log)

    # ⑤ 同文件同行冲突 → abort·无半截现场·改动保留为本地提交
    git(work2, 'pull', '-q', '--rebase', 'origin', 'main')
    (work2 / 'public' / 'games' / 'game-x' / 'art' / 'index.json').write_text('{"version":1,"assets":[{"id":"remote-win"}]}\n')
    git(work2, 'add', '-A')
    git(work2, 'commit', '-q', '-m', 'remote 改同一行')
    git(work2, 'push', '-q', 'origin', 'main')
    (art / 'index.json').write_text('{"version":1,"assets":[{"id":"local-win"}]}\n')
    r = sync_paths(work, SCOPE, 'art(game-x): 冲突同步')
    check((not r.get('ok')) and r.get('committed') and not r.get('pushed') and '冲突' in str(r.get('error')),
          '⑤ 同行冲突 → 拒推·错误可读·已保留本地提交', str(r))
    check(not (work / '.git' / 'rebase-merge').exists() and not (work / '.git' / 'rebase-apply').exists(),
          '⑤ 无半截 rebase 现场（已自动 abort）', '')
    check('冲突同步' in git(work, 'log', '--oneline', '-3'), '⑤ 本地提交还在分支上（改动没丢）', '')

    # ⑥ 无远端 → 本地提交 + note
    solo = TMP / 'solo'
    solo.mkdir()
    git(solo, 'init', '-q', '-b', 'main')
    sa = solo / 'public' / 'games' / 'game-x' / 'art'
    sa.mkdir(parents=True)
    (sa / 'index.json').write_text('{}\n')
    git(solo, 'add', '-A')
    git(solo, 'commit', '-q', '-m', 'init')
    (sa / 'index.json').write_text('{"v":1}\n')
    r = sync_paths(solo, SCOPE, 'art(game-x): 无远端')
    check(r.get('ok') and r.get('committed') and not r.get('pushed') and '无远端' in str(r.get('note')),
          '⑥ 无远端 → 本地提交成功 + note 明说未推送', str(r))

    # ⑦ 端点校验腿（拒绝路径·不碰真仓）
    check(not handle_art_sync({'slug': '../evil'}).get('success'), '⑦ 非法 slug 拒绝', '')
    check('不存在' in str(handle_art_sync({'slug': 'no-such-game-xyz'}).get('error')), '⑦ 不存在游戏拒绝', '')
    check('不存在' in str(handle_art_sync_status('no-such-game-xyz').get('error')), '⑦ status 同口径拒绝', '')
    lib_probe = ROOT / 'library' / 'art-sync-smoke-lib'
    lib_probe.mkdir(parents=True, exist_ok=True)
    try:
        check('卡带' in str(handle_art_sync({'slug': 'art-sync-smoke-lib'}).get('error')), '⑦ library 卡带拒绝（自带版本化）', '')
    finally:
        shutil.rmtree(lib_probe, ignore_errors=True)
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print(f"\nart-sync smoke: {PASS} ok / {FAIL} fail")
sys.exit(1 if FAIL else 0)
