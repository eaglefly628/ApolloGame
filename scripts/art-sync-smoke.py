#!/usr/bin/env python3
"""内置游戏美术一键提交推送冒烟（owner 2026-08-06「替换老是冲突」·方案A）。

核心 sync_paths 在**临时 git 仓 + 裸远端**上自证（绝不碰引擎仓工作树）：
  ① 干净范围 → clean=True 不产提交
  ② 有改动（含未跟踪新文件）→ 本地提交 + 推送成功；提交只含范围内文件
  ③ 范围外脏文件/他人已暂存内容 → 不被带进提交·内容原样保留（2026-08-03 误提交事故律）
  ④ 远端分叉（不同文件）→ fetch+rebase 自动合 → 推送成功·两边提交都在
  ⑤ 远端分叉（同文件同行冲突）→ rebase 自动 abort·无半截 rebase 现场·改动保留为本地提交
  ⑥ 无远端 → 本地提交成功 + note 明说未推送
  ⑧ 非交互硬化（owner 2026-08-06 复查补洞·防「终端弹 Username 把请求挂到超时」）：
     ⑧a 子进程环境堵死终端提示/askpass/ssh 口令，且不覆盖用户既有 GIT_SSH_COMMAND
     ⑧b 凭证类错误分类器认得 git/ssh 原样文案（不重试的判据）
     ⑧c 远端不可达 → 秒级返回·不挂起·本地提交保住（超时/挂起类回归的守卫）
端点校验腿（直调 handler·只走拒绝路径，绝不对真仓 add/commit）：
  ⑦ 非法 slug / 不存在游戏 / library 卡带 → 拒绝且错误信息可读

⑧ 的「真 401」腿不在此跑（门禁环境无外网·不拿网络当测试依赖）：凭证失败的**判据**由 ⑧b
按 git/ssh verbatim 文案自证，**不挂起**由 ⑧c 用连接立即被拒的远端自证。

用法：python3 scripts/art-sync-smoke.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry.art_sync import (  # noqa: E402
    _AUTH_FAIL_RE, _noninteractive_env, handle_art_sync, handle_art_sync_status, status_paths, sync_paths,
)

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

    # ⑧a 非交互环境：堵死三个「等人输入」的口子 + 不覆盖用户既有 GIT_SSH_COMMAND
    e = _noninteractive_env()
    check(e['GIT_TERMINAL_PROMPT'] == '0' and e['GIT_ASKPASS'] == '' and e['SSH_ASKPASS'] == '',
          '⑧a 终端提示/askpass 全关（HTTPS 凭证缺失→立即失败而非等输入）', str({k: e.get(k) for k in ('GIT_TERMINAL_PROMPT', 'GIT_ASKPASS')}))
    check('BatchMode=yes' in e['GIT_SSH_COMMAND'], '⑧a ssh BatchMode（key 带口令且无 agent→失败不等输入）', e['GIT_SSH_COMMAND'])
    _saved = os.environ.get('GIT_SSH_COMMAND')
    os.environ['GIT_SSH_COMMAND'] = 'ssh -i /custom/key'
    try:
        e2 = _noninteractive_env()
        check(e2['GIT_SSH_COMMAND'] == 'ssh -i /custom/key -o BatchMode=yes',
              '⑧a 用户既有 GIT_SSH_COMMAND 保留（只追加不覆盖·专用 key 不被顶掉）', e2['GIT_SSH_COMMAND'])
    finally:
        os.environ.pop('GIT_SSH_COMMAND', None)
        if _saved is not None:
            os.environ['GIT_SSH_COMMAND'] = _saved

    # ⑧b 凭证类错误分类器（git/ssh verbatim 文案 → 不重试的判据）
    for msg in ["fatal: could not read Username for 'https://github.com': terminal prompts disabled",
                'remote: Support for password authentication was removed on August 13, 2021.',
                'fatal: Authentication failed for https://github.com/x/y.git/',
                'git@github.com: Permission denied (publickey).',
                'Host key verification failed.']:
        check(bool(_AUTH_FAIL_RE.search(msg)), f'⑧b 认得凭证类失败：{msg[:46]}…')
    for msg in ['fatal: unable to access: Could not resolve host: github.com',
                'CONFLICT (content): Merge conflict in public/games/game-x/art/index.json',
                '! [rejected] main -> main (fetch first)']:
        check(not _AUTH_FAIL_RE.search(msg), f'⑧b 不误判非凭证失败：{msg[:46]}…')

    # ⑧c 远端不可达 → 秒级返回·不挂起（本 bug 的核心回归：绝不 120s 干等）·本地提交保住
    (sa / 'index.json').write_text('{"v":2}\n')
    git(solo, 'remote', 'add', 'origin', 'https://127.0.0.1:1/nope.git')  # 连接立即被拒·无外网依赖
    t0 = time.monotonic()
    r = sync_paths(solo, SCOPE, 'art(game-x): 远端不可达', max_attempts=2)
    dt = time.monotonic() - t0
    check(not r.get('ok') and r.get('committed') and not r.get('pushed'),
          '⑧c 远端不可达 → 拒推·改动已落本地提交（没丢）', str(r))
    check(dt < 30, f'⑧c 秒级返回不挂起（实测 {dt:.1f}s·旧行为会干等到 120s 超时）', f'{dt:.1f}s')
    check('本地提交' in str(r.get('error')), '⑧c 错误文案告诉 owner 改动在哪', str(r.get('error')))

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
    # ⑨ cleanup-mock（owner 2026-08-06「生成的这些黑户怎么删除」）：只清 gen/mock 一棵子树·真图不动
    from main_entry.art_sync import handle_art_cleanup_mock  # noqa: E402
    CM = 'cleanmock-smoke'
    cd = ROOT / 'public' / 'games' / CM / 'art'
    try:
        (cd / 'gen' / 'mock').mkdir(parents=True, exist_ok=True)
        (cd / 'gen' / 'mock' / 'art-01.png').write_bytes(b'm1')
        (cd / 'gen' / 'mock' / 'art-02.png').write_bytes(b'm2')
        (cd / 'gen' / 'art-01.png').write_bytes(b'REAL')
        (cd / 'index.json').write_text('{"version":1,"assets":[]}')
        r = handle_art_cleanup_mock({'slug': CM})
        check(r.get('success') and r.get('removed') == 2, '⑨ 清 mock 预览图 2 张', str(r))
        check(not (cd / 'gen' / 'mock').exists(), '⑨ mock 目录已移除', '')
        check((cd / 'gen' / 'art-01.png').read_bytes() == b'REAL', '⑨ **真图 gen/art-NN 原样保留**（只清 mock 子树）', '')
        check((cd / 'index.json').is_file(), '⑨ 索引未被碰', '')
        check(handle_art_cleanup_mock({'slug': CM}).get('removed') == 0, '⑨ 幂等：再清 0 张', '')
        check(not handle_art_cleanup_mock({'slug': '../evil'}).get('success'), '⑨ 非法 slug 拒绝', '')
        check('无美术目录' in str(handle_art_cleanup_mock({'slug': 'no-such-game-zz'}).get('error')), '⑨ 不存在游戏拒绝', '')
    finally:
        shutil.rmtree(ROOT / 'public' / 'games' / CM, ignore_errors=True)
    # ⑩ 后台批量任务（REQ-ARTPAR 第一步）：async 起 job 立刻返回 + 单游戏串行锁 + 无 300s 上限
    import time as _t
    from main_entry import art_jobs  # noqa: E402
    from main_entry.art_replace import handle_art_batch  # noqa: E402
    JOBSLUG = 'artjob-smoke'
    jd = ROOT / 'public' / 'games' / JOBSLUG / 'art'
    try:
        jd.mkdir(parents=True, exist_ok=True)
        (jd / 'art-ledger.json').write_text('{"game":"' + JOBSLUG + '","mode":"requirements","rows":[]}', 'utf-8')
        (jd / 'index.json').write_text('{"version":1,"assets":[]}', 'utf-8')
        t0 = _t.monotonic()
        r = handle_art_batch({'slug': JOBSLUG, 'packId': 'pixel-retro', 'mock': True, 'async': True})
        dt = _t.monotonic() - t0
        check(r.get('success') and r.get('jobId'), '⑩ async 批量起 job 并返回 jobId', str(r)[:160])
        check(dt < 3, f'⑩ **立刻返回不阻塞**（实测 {dt:.2f}s·同步老路要等跑完）', f'{dt:.2f}s')
        jid = r.get('jobId')
        for _ in range(60):
            st = art_jobs.handle_art_job_get(jid).get('job') or {}
            if st.get('state') != 'running':
                break
            _t.sleep(0.5)
        st = art_jobs.handle_art_job_get(jid).get('job') or {}
        check(st.get('state') == 'done', f'⑩ 任务跑到终态 done（实得 {st.get("state")}）', str(st)[:200])
        check(art_jobs.handle_art_job_get('nope-not-a-job').get('success') is False, '⑩ 未知 jobId 拒绝', '')
        lst = art_jobs.handle_art_jobs_list(JOBSLUG)
        check(lst.get('success') and any(j['id'] == jid for j in lst.get('jobs', [])), '⑩ 任务列表可按 slug 查（刷新后恢复看板）', '')
        # 串行锁：手工占住该 slug 的锁 → 同游戏再起必须被拒（防两个批量互相整份覆盖台账）
        lk = art_jobs._slug_lock(JOBSLUG); lk.acquire()
        try:
            art_jobs._ART_JOBS[jid]['state'] = 'running'   # 伪装成在跑（is_running 判据）
            r2 = handle_art_batch({'slug': JOBSLUG, 'packId': 'pixel-retro', 'mock': True, 'async': True})
            check(not r2.get('success') and '已有批量在跑' in str(r2.get('error')),
                  '⑩ **单游戏串行**：同游戏并发批量被拒（防台账整份互覆盖）', str(r2)[:160])
        finally:
            art_jobs._ART_JOBS[jid]['state'] = 'done'; lk.release()
    finally:
        shutil.rmtree(ROOT / 'public' / 'games' / JOBSLUG, ignore_errors=True)
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print(f"\nart-sync smoke: {PASS} ok / {FAIL} fail")
sys.exit(1 if FAIL else 0)
