#!/usr/bin/env python3
"""任务收工自动存档冒烟（owner 2026-08-10 令「希望它主动去上传·跟我在窗口里做事的感受一致」）。

被测：`main_entry/artifacts.py::auto_sync` 的**三步顺序**——先本地提交 → 跑门禁 → 绿了才推。
这个顺序是刻意的，两条相互拉扯的铁律各占一头，冒烟就是钉死它们不许互相吃掉：
  · owner 实撞「跑完结果就没了」 ⇒ **任何产出必须先落成提交**，门禁红也不能丢（②③⑤）
  · CLAUDE.md「门禁全绿才推」 ⇒ **红了绝不推**（③⑤ 验远端一字未动）

全部在**临时 git 仓 + 裸远端**上自证（绝不碰引擎仓工作树）：monkeypatch `artifacts.ROOT`
（`_dirty`/`sync_paths`/`push_branch` 都读这个模块全局）+ `_gate_cmd`（换成秒退的 true/false）
+ `_features`（开关腿）。门禁本体不在此测——它自己有门禁。

  ① features.autoPush=false → 跳过·一个提交都不产
  ② 有产物 + 门禁绿 → 本地提交 + 推送成功·远端拿到
  ③ 有产物 + 门禁红 → **已本地提交**（丢不了）但**未推送**·远端一字未动·错误文案说人话
  ④ 无未提交产物 → 跳过·不产空提交
  ⑤ 门禁进程起不来（异常）→ 按红处理：提交在·未推
  ⑥ 远端已分叉 + 门禁绿 → **rebase 后推成功**（这条是抽出 push_branch 的理由：第三步时工作区
     已干净，若退化成裸 push 必 non-fast-forward 失败；本腿即该退化的守卫）
  ⑦ 只提交范围内文件：域外脏文件不被带走（2026-08-03 误提交事故律）
  ⑧ last_auto_sync 留痕（状态端点/托盘读它回答「刚才自动存了没」）

用法：python3 scripts/auto-sync-smoke.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry import artifacts  # noqa: E402

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


def count(repo, ref='HEAD'):
    return int(git(repo, 'rev-list', '--count', ref).strip())


SPEC = ['docs/design/game-x']
GREEN = ['sh', '-c', 'exit 0']
RED = ['sh', '-c', 'echo "vitest 3 failed" >&2; exit 1']

TMP = Path(tempfile.mkdtemp(prefix='auto-sync-smoke-'))
_orig = (artifacts.ROOT, artifacts._gate_cmd, artifacts._features, artifacts._engine_pathspecs)
try:
    bare = TMP / 'remote.git'
    bare.mkdir()
    git(bare, 'init', '--bare', '-q', '-b', 'main')
    work = TMP / 'work'
    work.mkdir()
    git(work, 'init', '-q', '-b', 'main')
    git(work, 'remote', 'add', 'origin', str(bare))
    (work / 'README.md').write_text('engine\n')
    d = work / 'docs' / 'design' / 'game-x'
    d.mkdir(parents=True)
    (d / 'concept.md').write_text('# 初稿\n')
    git(work, 'add', '-A')
    git(work, 'commit', '-q', '-m', 'init')
    git(work, 'push', '-q', 'origin', 'main')

    # 把 auto_sync 钉到临时仓上（形态推导不参与本冒烟——它由 artifacts 的落点腿另测）
    artifacts.ROOT = work
    artifacts._engine_pathspecs = lambda slug, form: list(SPEC)
    artifacts._features = lambda: {'autoPush': True}
    artifacts._gate_cmd = lambda: list(GREEN)

    def dirty_up(text):
        (d / 'concept.md').write_text(text)

    # ① 开关关掉 → 一步都不走
    artifacts._features = lambda: {'autoPush': False}
    dirty_up('# 关了开关不该动\n')
    before = count(work)
    r = artifacts.auto_sync('game-x', reason='开关腿')
    check(r.get('skipped') and 'autoPush' in (r.get('reason') or ''), '① autoPush=false → 跳过', r)
    check(count(work) == before, '① 关掉开关不产提交')
    artifacts._features = lambda: {'autoPush': True}

    # ② 门禁绿 → 提交 + 推送
    before = count(work)
    r = artifacts.auto_sync('game-x', reason='绿腿')
    check(r.get('ok') and r.get('committed'), '② 门禁绿 → 已提交', r)
    check(r.get('gate') == 'green' and r.get('pushed'), '② 门禁绿 → 已推送', r)
    check(count(work) == before + 1, '② 恰好一个新提交')
    check(count(bare, 'main') == count(work), '② 远端拿到了（真推出去·不是只报个 pushed）')

    # ③ 门禁红 → 提交在·不推（两条铁律各占一头的那一腿）
    artifacts._gate_cmd = lambda: list(RED)
    remote_before = count(bare, 'main')
    dirty_up('# 红门禁下的产物·必须先存住\n')
    r = artifacts.auto_sync('game-x', reason='红腿')
    check(r.get('committed'), '③ 门禁红 → **仍已本地提交**（owner 实撞的「白跑」由此杜绝）', r)
    check(r.get('gate') == 'red' and not r.get('pushed') and not r.get('ok'), '③ 门禁红 → 未推送·ok=False', r)
    check(count(bare, 'main') == remote_before, '③ 远端一字未动')
    check('门禁' in (r.get('error') or '') and '本地提交' in (r.get('error') or ''), '③ 错误文案说人话', r.get('error'))
    check('vitest 3 failed' in (r.get('detail') or ''), '③ 带回门禁尾巴（人能据此定位）', r.get('detail'))
    check((work / 'docs/design/game-x/concept.md').read_text().startswith('# 红门禁'), '③ 产物内容原样在盘上')

    # ④ 干净 → 跳过·不产空提交
    before = count(work)
    r = artifacts.auto_sync('game-x', reason='干净腿')
    check(r.get('skipped') and '无未提交产物' in (r.get('reason') or ''), '④ 无产物 → 跳过', r)
    check(count(work) == before, '④ 不产空提交')

    # ⑤ 门禁进程本身炸了 → 按红处理（绝不因为"没测出红"就把没验过的东西推上去）
    artifacts._gate_cmd = lambda: ['definitely-not-a-real-binary-zzz']
    remote_before = count(bare, 'main')
    dirty_up('# 门禁起不来\n')
    r = artifacts.auto_sync('game-x', reason='门禁炸腿')
    check(r.get('committed') and r.get('gate') == 'red' and not r.get('pushed'), '⑤ 门禁起不来 → 按红：提交在·未推', r)
    check(count(bare, 'main') == remote_before, '⑤ 远端一字未动')

    # ⑥ 远端分叉 + 门禁绿 → 必须 rebase 后推成功（防第三步退化成裸 push）
    artifacts._gate_cmd = lambda: list(GREEN)
    other = TMP / 'work2'
    git(TMP, 'clone', '-q', str(bare), str(other))
    (other / 'OTHER.md').write_text('别人的提交\n')
    git(other, 'add', '-A')
    git(other, 'commit', '-q', '-m', 'other session')
    git(other, 'push', '-q', 'origin', 'main')
    dirty_up('# 分叉后的产物\n')
    r = artifacts.auto_sync('game-x', reason='分叉腿')
    check(r.get('ok') and r.get('pushed'), '⑥ 远端分叉 → rebase 后推成功（裸 push 必失败·此腿即守卫）', r)
    check('OTHER.md' in git(work, 'ls-files'), '⑥ 别人的提交被 rebase 进来了（真走了 fetch+rebase）')
    check('分叉后的产物' in git(bare, 'show', 'main:docs/design/game-x/concept.md'), '⑥ 远端拿到本次产物')

    # ⑦ 只带范围内文件（事故律）
    (work / 'STRAY.md').write_text('域外·别人的在途改动\n')
    dirty_up('# 只带范围内\n')
    r = artifacts.auto_sync('game-x', reason='范围腿')
    files = git(work, 'show', '--name-only', '--format=', 'HEAD').split()
    check(r.get('ok'), '⑦ 范围腿提交成功', r)
    check(files == ['docs/design/game-x/concept.md'], '⑦ 提交只含范围内文件', files)
    check((work / 'STRAY.md').is_file() and 'STRAY.md' not in git(work, 'ls-files'),
          '⑦ 域外脏文件原样留在工作区·未被带走')
    (work / 'STRAY.md').unlink()

    # ⑧ 留痕（端点/托盘据此回答「刚才自动存了没」）
    last = artifacts.last_auto_sync('game-x')
    check(last.get('reason') == '范围腿' and last.get('committed'), '⑧ last_auto_sync 留痕', last)
    check(artifacts.last_auto_sync('game-nobody') == {}, '⑧ 没跑过的 slug → 空')

    # ⑨ 非法 slug → 跳过（不误伤·不抛）
    r = artifacts.auto_sync('../etc', reason='非法腿')
    check(r.get('skipped') and '非法' in (r.get('error') or ''), '⑨ 非法 slug → 跳过', r)
finally:
    artifacts.ROOT, artifacts._gate_cmd, artifacts._features, artifacts._engine_pathspecs = _orig
    subprocess.run(['rm', '-rf', str(TMP)], timeout=60)

print(f"\n自动存档冒烟：\033[32m{PASS} 通过\033[0m，" + (f"\033[31m{FAIL} 失败\033[0m" if FAIL else "0 失败"))
sys.exit(1 if FAIL else 0)
