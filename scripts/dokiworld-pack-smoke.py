#!/usr/bin/env python3
"""DokiWorld App 出包线冒烟（发布屏「DokiWorld App 包」·owner 2026-08-13「出包的地方要完全支持」）。

对象 = main_entry/packaging.py 的 dokiworld 平台（dokiworld/<slug>/ App 工程线·手册
docs/playbooks/dokiworld-pack.md·首件 game108 = 912e03c0）。腿：
  ① 平台注册 + 可用性端点（handle_dokiworld_apps 含 game108）
  ② 拒绝腿：未接入游戏（真游戏无 dokiworld/ 工程）拒绝且错误信息给到手册指引；非法 slug 拒绝
  ③ zip 层产物卫生断言（临时目录自证）：.env / node_modules / 疑似密钥 → 硬抛；干净树放行
  ④ 真 build 一遍（同 steam/art-sync 冒烟「不采信自陈」口径·约 1 分钟，app npm ci 首跑另计）：
     起 job 返 jobId → 轮询终态 → 产物 zip 存在、zip 根含 manifest.json + index.html、
     manifest.id=game108、zip 内零 .env / 零 node_modules
任一步失败 exit 1（同 scripts/*-smoke.py 约定）。

用法：python3 scripts/dokiworld-pack-smoke.py
"""
import hashlib
import json
import sys
import tempfile
import time
import zipfile
from types import SimpleNamespace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry.packaging import (  # noqa: E402
    _DOKI_GUIDE, _PKG_PLATFORMS, _assert_doki_dist_hygiene, handle_dokiworld_apps,
    _doki_deps_stale, _proc_tail, _DOKI_STAMP,
    handle_package_job_get, handle_package_job_start, list_dokiworld_apps,
)

PASS, FAIL = 0, 0


def check(label, cond, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ok   {label}')
    else:
        FAIL += 1
        print(f'  FAIL {label}  {detail}')


def hygiene_raises(dist: Path):
    files = sorted(p for p in dist.rglob('*') if p.is_file())
    try:
        _assert_doki_dist_hygiene(dist, files)
        return None
    except RuntimeError as e:
        return str(e)


print('[smoke] DokiWorld App 出包线（发布屏 dokiworld 平台）')

# ① 平台注册 + 可用性端点
check('dokiworld 平台已注册（_PKG_PLATFORMS）', 'dokiworld' in _PKG_PLATFORMS,
      f'{sorted(_PKG_PLATFORMS)}')
apps = handle_dokiworld_apps()
check('GET dokiworld-apps success + 含 game108（首件）',
      apps.get('success') is True and 'game108' in (apps.get('apps') or []), f'{apps}')
check('list_dokiworld_apps 判据=目录含 package.json', apps.get('apps') == list_dokiworld_apps())

# ② 拒绝腿：未接入的真游戏 → 明确拒 + 手册指引；非法 slug → 拒
r = handle_package_job_start({'slug': 'game-g', 'platform': 'dokiworld'})
check('未接入游戏（game-g）→ 拒绝', r.get('success') is False, f'{r}')
check('拒绝文案给到手册指引（dokiworld-pack.md）', 'dokiworld-pack.md' in (r.get('error') or ''),
      f'{r.get("error")}')
check('拒绝文案与前置判据同源（_DOKI_GUIDE）', _DOKI_GUIDE in (r.get('error') or ''))
r2 = handle_package_job_start({'slug': '../etc', 'platform': 'dokiworld'})
check('非法 slug → 拒绝', r2.get('success') is False, f'{r2}')

# ③ zip 层产物卫生断言（临时目录自证·撤触发物验绿）
with tempfile.TemporaryDirectory(prefix='doki-hyg-') as td:
    dist = Path(td)
    (dist / 'index.html').write_text('<!doctype html><title>ok</title>', encoding='utf-8')
    (dist / 'manifest.json').write_text('{"id":"x"}', encoding='utf-8')
    (dist / 'assets').mkdir()
    (dist / 'assets' / 'app.js').write_text('console.log(1)', encoding='utf-8')
    check('卫生断言：干净 dist → 放行', hygiene_raises(dist) is None, f'{hygiene_raises(dist)}')
    (dist / '.env').write_text('API_KEY=x', encoding='utf-8')
    err = hygiene_raises(dist)
    check('卫生断言：.env → 硬抛', err is not None and '.env' in err, f'{err}')
    (dist / '.env').unlink()
    nm = dist / 'node_modules' / 'x'
    nm.mkdir(parents=True)
    (nm / 'i.js').write_text('x', encoding='utf-8')
    err = hygiene_raises(dist)
    check('卫生断言：node_modules → 硬抛', err is not None and 'node_modules' in err, f'{err}')
    (nm / 'i.js').unlink(); nm.rmdir(); (dist / 'node_modules').rmdir()
    (dist / 'assets' / 'app.js').write_text('const k="sk-ant-oat01-abcdefgh12345678"', encoding='utf-8')
    err = hygiene_raises(dist)
    check('卫生断言：文本内疑似密钥 → 硬抛', err is not None and '密钥' in err, f'{err}')
    (dist / 'assets' / 'app.js').write_text('console.log(1)', encoding='utf-8')
    check('卫生断言：撤掉触发物 → 复绿', hygiene_raises(dist) is None)

# ③ᵇ 依赖脱节判定（2026-08-19 事故回归·临时目录自证）
#
# 事故形状：旧判据是 `if not node_modules.is_dir()` —— 只问"装过没有"，不问"装的是不是这一版"。
# 于是 SDK ^2.1.0→^3.0.0 之后，**任何装过一次的机器都不再重装**，拿旧依赖去 build，
# 报 `ERR_PACKAGE_PATH_NOT_EXPORTED`（新代码 import 的子路径旧包里没有），
# 而报错里一个字都不提"依赖是旧的"。owner 那台机器实测中招。
with tempfile.TemporaryDirectory(prefix='doki-dep-') as td:
    app = Path(td)
    (app / 'package.json').write_text('{"name":"x","version":"1.0.0"}', encoding='utf-8')
    check('依赖脱节：没有 node_modules → 判要装', (_doki_deps_stale(app) or '').startswith('缺 node_modules'),
          f'{_doki_deps_stale(app)}')
    nm = app / 'node_modules'; nm.mkdir()
    (app / 'package-lock.json').write_text('{"lockfileVersion":3,"packages":{}}', encoding='utf-8')
    # 这一格就是事故本身：装过、但**没有戳**（升级之前装的）⇒ 必须判要装
    err = _doki_deps_stale(app)
    check('依赖脱节：装过但没安装戳 → 判要装（事故本体）', err is not None and '安装戳' in err, f'{err}')
    stamp = nm / _DOKI_STAMP
    stamp.write_text(hashlib.sha256((app / 'package-lock.json').read_bytes()).hexdigest(), encoding='utf-8')
    check('依赖脱节：戳与 lockfile 对得上 → 不重装（否则每次出包都重装·慢）', _doki_deps_stale(app) is None,
          f'{_doki_deps_stale(app)}')
    # 升依赖 = lockfile 变 ⇒ 戳对不上 ⇒ 必须重装
    (app / 'package-lock.json').write_text('{"lockfileVersion":3,"packages":{"":{"v":2}}}', encoding='utf-8')
    err = _doki_deps_stale(app)
    check('依赖脱节：lockfile 变过（升了依赖）→ 判要装', err is not None and 'lockfile' in err.lower() or 'lock' in (err or ''),
          f'{err}')
    # 没有 lockfile 的仓不瞎判（"无从判断" ≠ "要重装"）
    (app / 'package-lock.json').unlink()
    check('依赖脱节：无 lockfile → 不瞎判（交给 npm）', _doki_deps_stale(app) is None, f'{_doki_deps_stale(app)}')

# ③ᶜ 报错要说得出**原因**，不是甩一串栈帧
#
# 同一次事故的第二层：`_proc_tail` 旧版只取最后 6 行，而 Node 的报错是"先一行原因、再十来行栈帧"
# ⇒ 唯一有用的那句被挤掉，owner 拿到的是 `at ModuleJob._link (...)`。判据用**真实原文**当夹具。
_REAL_STDERR = """node:internal/modules/esm/resolve:314
  return new ERR_PACKAGE_PATH_NOT_EXPORTED(
         ^

Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './runtime-extensions' is not defined by "exports" in /x/node_modules/@dokiworld/app-sdk/package.json imported from /x/scripts/generate-manifest.mjs
    at exportsNotFound (node:internal/modules/esm/resolve:314:10)
    at packageExportsResolve (node:internal/modules/esm/resolve:661:9)
    at packageResolve (node:internal/modules/esm/resolve:774:12)
    at moduleResolve (node:internal/modules/esm/resolve:855:18)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at ModuleJob._link (node:internal/modules/esm/module_job:182:49) {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
}"""
_tail = _proc_tail(SimpleNamespace(stderr=_REAL_STDERR, stdout=''))
check('报错含**原因原文**（不是只有栈帧）', 'is not defined by' in _tail, _tail[:160])
check('报错把原因放在最前（人一眼看到的就是它）', _tail.startswith('Error [ERR_PACKAGE_PATH_NOT_EXPORTED]'), _tail[:80])
check('空输出不炸', _proc_tail(SimpleNamespace(stderr='', stdout='')) == '(无输出)')

# ④ 真 build 一遍（game108·npm ci 缺才装 → npm run build → zip）——不采信自陈，验最终产物
t0 = time.time()
start = handle_package_job_start({'slug': 'game108', 'platform': 'dokiworld'})
check('game108 起 job → success + jobId', start.get('success') is True and bool(start.get('id')),
      f'{start}')
job = None
if start.get('success'):
    jid = start['id']
    deadline = time.time() + 900  # 真 build ~1 分钟；app 首跑 npm ci 另计余量
    while time.time() < deadline:
        got = handle_package_job_get(jid)
        job = got.get('job') if got.get('success') else None
        if job and job.get('done'):
            break
        time.sleep(2)
elapsed = int(time.time() - t0)
check(f'job 终态 done 且无错（{elapsed}s）', bool(job) and job.get('done') and not job.get('error'),
      f'{job}')
if job and job.get('done') and not job.get('error'):
    check('产物名 = game108-dokiworld.zip', job.get('artifactName') == 'game108-dokiworld.zip',
          f'{job.get("artifactName")}')
    out = ROOT / 'release' / 'game108' / 'game108-dokiworld.zip'
    check('产物 zip 落盘 release/game108/', out.is_file(), str(out))
    if out.is_file():
        with zipfile.ZipFile(out) as z:
            names = z.namelist()
            check('zip 根含 manifest.json + index.html',
                  'manifest.json' in names and 'index.html' in names, f'{names[:8]}')
            check('zip 内零 .env', not any(Path(n).name.startswith('.env') for n in names))
            check('zip 内零 node_modules', not any('node_modules' in Path(n).parts for n in names))
            check('zip 根=dist 内容（无 <slug>/ 顶层目录壳）',
                  not any(n.startswith('game108/') for n in names), f'{names[:5]}')
            mf = json.loads(z.read('manifest.json'))
            check('manifest.id = game108 · entry 在包内', mf.get('id') == 'game108'
                  and mf.get('entry') in names, f'id={mf.get("id")} entry={mf.get("entry")}')
            # ── 规范满配二期（cover + SHA256SUMS·owner 2026-08-13「文档里的东西都做到」）────
            check('manifest.cover 声明且真图在包内', bool(mf.get('cover')) and mf.get('cover') in names,
                  f'cover={mf.get("cover")}')
            if mf.get('cover') in names:
                cover = z.read(mf['cover'])
                check('cover 是真 WebP 且非占位（RIFF/WEBP 魔数 + >4KB）',
                      cover[:4] == b'RIFF' and cover[8:12] == b'WEBP' and len(cover) > 4096,
                      f'head={cover[:4]!r} size={len(cover)}')
            check('zip 含 SHA256SUMS.txt（完整性清单·match3 同款）', 'SHA256SUMS.txt' in names)
            if 'SHA256SUMS.txt' in names:
                import hashlib
                sums = dict(line.split('  ', 1)[::-1] for line in
                            z.read('SHA256SUMS.txt').decode('utf-8').strip().splitlines())
                covered = [n for n in names if n != 'SHA256SUMS.txt']
                check('SHA256SUMS 覆盖包内全部文件（除清单自身）', set(sums) == set(covered),
                      f'缺={sorted(set(covered) - set(sums))[:3]} 多={sorted(set(sums) - set(covered))[:3]}')
                mf_hash = hashlib.sha256(z.read('manifest.json')).hexdigest().upper()
                check('SHA256SUMS 里 manifest.json 的哈希与实物一致（清单不是装饰）',
                      sums.get('manifest.json') == mf_hash, f'{sums.get("manifest.json")} vs {mf_hash}')

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
