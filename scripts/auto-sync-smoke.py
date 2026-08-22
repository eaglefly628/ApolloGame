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

**落点腿**（⑩–⑬·主程复查 F1 补·2026-08-18）：`detect_form` / `_engine_pathspecs` /
`handle_artifacts_status` 此前全库零覆盖——复查方一刀**砍掉 `docs/design` 整类落点，上面 25 腿照绿**
（自动存档只管「把 specs 里的东西存住」，specs 少一类它照样绿着把台本漏在工作区，症状与 owner
实撞的白跑一模一样）。故这四腿钉的是**「哪些目录算产物」本身**，不是存档动作：
  ⑩ 形态判据与 `scripts/game-pipeline.mjs::detectForm` 同序（cart > builtin > compiled > None）
  ⑪ 三形态各自的引擎仓落点全集——**`docs/design/<slug>` 每一档都必须在列**（F1 那刀的守卫）
  ⑫ 状态端点：逐处未提交数分摊正确·`canSync` 跟随·卡带行报自己那个仓
  ⑬ 端点拒绝路径：非法 slug / 查无此游戏（给的是能往下查的 hint，不是空回执）

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
_orig_lib = artifacts.LIBRARY_DIR
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

    # 把 auto_sync 钉到临时仓上（形态推导由下面 ⑩–⑬ 落点腿单独测，这里固定 specs 以隔离存档动作）
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

    # ═══ 落点腿 ⑩–⑬（主程复查 F1 补）：钉「哪些目录算产物」本身 ═════════════════════
    # 上面九腿全部把 _engine_pathspecs 换成了固定桩，故 specs 少一类它们全无感——F1 那刀
    # （砍掉 docs/design 整类）正是从这个缝里过去的。这里换回真函数，在另搭的形态夹具上测。
    artifacts._engine_pathspecs = _orig[3]      # 还原真身
    stage = TMP / 'stage'
    for p in ('library/cart-x', 'public/games/built-x', 'games/comp-x', 'games/both-x',
              'public/games/comp-x', 'docs/design/cart-x', 'docs/design/built-x', 'docs/design/comp-x'):
        (stage / p).mkdir(parents=True, exist_ok=True)
    (stage / 'library/cart-x/manifest.json').write_text('{}')
    (stage / 'public/games/built-x/manifest.json').write_text('{}')
    # 同名同时存在于 library 与 public/games → 必须判 cart（与 game-pipeline.mjs::detectForm 同序）
    (stage / 'library/both-x').mkdir(parents=True, exist_ok=True)
    (stage / 'library/both-x/manifest.json').write_text('{}')
    (stage / 'public/games/both-x').mkdir(parents=True, exist_ok=True)
    (stage / 'public/games/both-x/manifest.json').write_text('{}')
    artifacts.ROOT, artifacts.LIBRARY_DIR = stage, stage / 'library'

    # ⑩ 形态判据同序
    check(artifacts.detect_form('cart-x') == 'cart', '⑩ library 有 manifest → cart')
    check(artifacts.detect_form('built-x') == 'builtin', '⑩ public/games 有 manifest → builtin')
    check(artifacts.detect_form('comp-x') == 'compiled', '⑩ 只有 games/<slug> 目录 → compiled')
    check(artifacts.detect_form('both-x') == 'cart', '⑩ 两处都有 → cart 优先（与 detectForm 同序·不是 builtin）',
          artifacts.detect_form('both-x'))
    check(artifacts.detect_form('nobody-x') is None, '⑩ 三处都无 → None')

    # ⑪ 三形态的引擎仓落点全集——docs/design 每一档都必须在列（F1 那刀的守卫）
    specs_of = lambda s: artifacts._engine_pathspecs(s, artifacts.detect_form(s))
    check(specs_of('built-x') == ['public/games/built-x', 'docs/design/built-x'], '⑪ builtin 落点', specs_of('built-x'))
    check(specs_of('comp-x') == ['games/comp-x', 'public/games/comp-x', 'docs/design/comp-x'],
          '⑪ compiled 落点（游戏目录 + public 侧美术 + 策划案）', specs_of('comp-x'))
    check(specs_of('cart-x') == ['docs/design/cart-x'], '⑪ cart 只带 docs/design（本体在自有仓·不入引擎仓）', specs_of('cart-x'))
    for s in ('cart-x', 'built-x', 'comp-x'):
        check(f'docs/design/{s}' in specs_of(s), f'⑪ {s}：docs/design 在列（台本/策划案不许漏在工作区）')
    check(specs_of('nobody-x') == [], '⑪ 查无此游戏 → 空落点（不瞎猜路径）')
    # 目录不存在就不列（别提交一个不存在的 pathspec 让 git 报错）
    (stage / 'docs/design/built-x').rmdir()
    check(specs_of('built-x') == ['public/games/built-x'], '⑪ 没有 docs/design 目录 → 不列该档', specs_of('built-x'))
    (stage / 'docs/design/built-x').mkdir()

    # ⑫ 状态端点：逐处未提交数分摊 + canSync 跟随 + 卡带行报自己那个仓
    git(stage, 'init', '-q', '-b', 'main')
    (stage / 'games/comp-x/rules.ts').write_text('export const a = 1;\n')
    (stage / 'docs/design/comp-x/gdd.md').write_text('# 策划案\n')
    (stage / 'public/games/comp-x/art').mkdir(parents=True, exist_ok=True)
    (stage / 'public/games/comp-x/art/index.json').write_text('{}')
    st = artifacts.handle_artifacts_status('comp-x')
    by = {L['path']: L for L in st['locations']}
    check(st['success'] and st['form'] == 'compiled', '⑫ 状态端点：形态正确', st.get('form'))
    check(st['dirtyTotal'] == 3 and st['canSync'], '⑫ 未提交总数 = 3 · canSync 跟随', (st['dirtyTotal'], st['canSync']))
    check(by['games/comp-x/']['dirtyCount'] == 1 and by['docs/design/comp-x/']['dirtyCount'] == 1
          and by['public/games/comp-x/']['dirtyCount'] == 1, '⑫ 逐处分摊到各自落点（不是都记在头一个上）',
          {k: v['dirtyCount'] for k, v in by.items()})
    check(all(L['repo'] == 'engine' for L in st['locations']), '⑫ compiled 三处都归引擎仓')
    git(stage, 'add', '-A'); git(stage, 'commit', '-q', '-m', 'x')
    st2 = artifacts.handle_artifacts_status('comp-x')
    check(st2['dirtyTotal'] == 0 and not st2['canSync'], '⑫ 提交后 → 0 处未提交·canSync 灭', st2['dirtyTotal'])
    # 卡带行：本体不入引擎仓，但要报它自己那个仓存住没
    git(stage / 'library/cart-x', 'init', '-q', '-b', 'main')
    (stage / 'library/cart-x/meta.json').write_text('{}')
    git(stage / 'library/cart-x', 'add', '-A'); git(stage / 'library/cart-x', 'commit', '-q', '-m', '卡带保存')
    stc = artifacts.handle_artifacts_status('cart-x')
    cart_row = next((L for L in stc['locations'] if L['repo'] == 'cartridge'), None)
    check(cart_row and cart_row['path'] == 'library/cart-x/', '⑫ 卡带本体单列一行', cart_row)
    check(cart_row and cart_row.get('versioned') == 'git' and '卡带保存' in (cart_row.get('lastCommit') or ''),
          '⑫ 卡带行报自有仓最近一次提交（回答「存住没」）', cart_row)
    check(all(L['repo'] == 'engine' for L in stc['locations'][1:]), '⑫ 卡带的 docs/design 仍归引擎仓')

    # ⑬ 拒绝路径
    bad = artifacts.handle_artifacts_status('../etc')
    check(not bad['success'] and '非法' in bad['error'], '⑬ 非法 slug → 拒', bad)
    none = artifacts.handle_artifacts_status('nobody-x')
    check(none['success'] and none['form'] is None and none['locations'] == [], '⑬ 查无此游戏 → 空落点不报错', none)
    check('orchestrator-runs.json' in (none.get('hint') or ''), '⑬ 给的是能往下查的 hint（不是空回执）', none.get('hint'))
    # 纯卡带（连 docs/design 都还没有）→ 引擎仓里一处落点都没有：明说本体在哪，不假装同步
    (stage / 'library/pure-x').mkdir(parents=True)
    (stage / 'library/pure-x/manifest.json').write_text('{}')
    check(artifacts._engine_pathspecs('pure-x', 'cart') == [], '⑬ 纯卡带 → 引擎仓零落点')
    bs = artifacts.handle_artifacts_sync({'slug': 'pure-x'})
    check(not bs['success'] and '自己的仓' in (bs.get('error') or ''), '⑬ 零落点时明说本体在哪·不假装同步', bs)
    check(artifacts.auto_sync('pure-x', reason='纯卡带腿').get('skipped'), '⑬ 自动存档对纯卡带 → 跳过（不空转 git）')
finally:
    artifacts.ROOT, artifacts._gate_cmd, artifacts._features, artifacts._engine_pathspecs = _orig
    artifacts.LIBRARY_DIR = _orig_lib
    subprocess.run(['rm', '-rf', str(TMP)], timeout=60)

print(f"\n自动存档冒烟：\033[32m{PASS} 通过\033[0m，" + (f"\033[31m{FAIL} 失败\033[0m" if FAIL else "0 失败"))
sys.exit(1 if FAIL else 0)
