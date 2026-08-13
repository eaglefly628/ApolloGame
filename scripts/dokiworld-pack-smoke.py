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
import json
import sys
import tempfile
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry.packaging import (  # noqa: E402
    _DOKI_GUIDE, _PKG_PLATFORMS, _assert_doki_dist_hygiene, handle_dokiworld_apps,
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

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
