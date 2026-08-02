#!/usr/bin/env python3
"""Steam 发行管线 —— steam-publisher/serve.py 编排契约冒烟测试（无真账号·480）。

不需要 steamcmd / electron-builder / 真 Steam 账号：只验**编排契约的确定性部分**——
VDF 生成格式（SteamPipe 标准）、build/publish 命令构造、错误守卫、以及 plan_pipeline
（build→VDF→模拟上传）整条 dry-run。副作用（out/*.vdf、steam_appid.txt、config.json）
全部重定向到临时目录，绝不脏化仓库。任一步失败 exit 1（同 scripts/*-smoke.py 约定）。

用法：python3 scripts/steam-publish-smoke.py
"""
import sys
import os
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'steam-publisher'))
import serve  # noqa: E402  (steam-publisher/serve.py)

PASS, FAIL = 0, 0


def check(label, cond, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ok   {label}')
    else:
        FAIL += 1
        print(f'  FAIL {label}  {detail}')


def raises_value_error(fn):
    try:
        fn()
        return False
    except ValueError:
        return True
    except Exception:
        return False


# ── 把所有写副作用重定向到临时目录（隔离·不脏化仓库 steam_appid.txt / config.json）──
TMP = Path(tempfile.mkdtemp(prefix='steam-publish-smoke-'))
serve.OUT = str(TMP / 'out'); os.makedirs(serve.OUT, exist_ok=True)
serve.REPO = str(TMP / 'repo'); os.makedirs(serve.REPO, exist_ok=True)
serve.CONFIG_PATH = str(TMP / 'config.json')
serve.LOG = str(TMP / 'run.log')

print(f'[smoke] steam-publisher 编排契约  tmp={TMP}')

# 基础有效配置：appId=480(演练位) + 一个填了 depotId 的 win depot + builder。
CFG = {
    'appId': '480',
    'description': 'Smoke build v1',
    'setLive': '',
    'steamcmd': 'steamcmd',
    'builder': 'smoke_builder',
    'game': 'game-g',
    'depots': [
        {'plat': 'win',   'depotId': '4801', 'content': 'release/game-g/bin/win-unpacked'},
        {'plat': 'mac',   'depotId': '',     'content': ''},   # 未填 depotId → 不发布
        {'plat': 'linux', 'depotId': '',     'content': ''},
    ],
}

# 1) 配置读写往返
saved = serve.save_config(dict(CFG))
loaded = serve.load_config()
check('config 存/读往返保真', loaded['appId'] == '480' and loaded['builder'] == 'smoke_builder'
      and loaded['game'] == 'game-g', f'{loaded}')

# 2) VDF 生成 + 格式（SteamPipe 标准）+ steam_appid.txt
files = serve.gen_vdf(dict(CFG))
depot_path = Path(serve.OUT) / 'depot_4801.vdf'
app_path = Path(serve.OUT) / 'app_build.vdf'
check('gen_vdf 写出 depot_4801.vdf + app_build.vdf',
      depot_path.exists() and app_path.exists() and set(files) == {'depot_4801.vdf', 'app_build.vdf'},
      f'{list(files)}')
depot_txt = depot_path.read_text(encoding='utf-8')
check('depot VDF 含 DepotID/contentroot/FileMapping(recursive)',
      '"DepotID" "4801"' in depot_txt and '"contentroot" "release/game-g/bin/win-unpacked"' in depot_txt
      and '"recursive" "1"' in depot_txt, depot_txt[:120])
app_txt = app_path.read_text(encoding='utf-8')
check('app_build VDF 含 appid + depot 映射',
      '"appid" "480"' in app_txt and '"4801" "depot_4801.vdf"' in app_txt and '"buildoutput"' in app_txt,
      app_txt[:160])
appid_file = Path(serve.REPO) / 'steam_appid.txt'
check('gen_vdf 写 steam_appid.txt = 真 AppID', appid_file.exists() and appid_file.read_text().strip() == '480',
      appid_file.read_text() if appid_file.exists() else '(缺)')

# 3) VDF 错误守卫（缺 appId / 无 depot / depot 无 content → ValueError）
check('gen_vdf 空 appId → 报错', raises_value_error(lambda: serve.gen_vdf({**CFG, 'appId': ''})))
no_depot = {**CFG, 'depots': [{'plat': 'win', 'depotId': '', 'content': ''}]}
check('gen_vdf 无任何 depotId → 报错', raises_value_error(lambda: serve.gen_vdf(no_depot)))
no_content = {**CFG, 'depots': [{'plat': 'win', 'depotId': '4801', 'content': ''}]}
check('gen_vdf depot 无 content → 报错', raises_value_error(lambda: serve.gen_vdf(no_content)))

# 4) build 命令构造（electron-builder --dir + 平台 flag + 每游戏名/appId 覆盖）
bargv = serve.build_argv(dict(CFG))
check('build_argv: electron-builder --win --dir + game-g 元数据',
      'electron-builder' in bargv and '--win' in bargv and '--dir' in bargv
      and any('FateflipPoker' in a for a in bargv) and any('com.apollo.gameg' in a for a in bargv),
      f'{bargv}')

# 5) publish 命令构造 + 错误守卫
pargv = serve.publish_argv(dict(CFG))
check('publish_argv: steamcmd +login <builder> +run_app_build … +quit',
      '+login' in pargv and 'smoke_builder' in pargv and '+run_app_build' in pargv and pargv[-1] == '+quit',
      f'{pargv}')
check('publish_argv 未填 builder → 报错', raises_value_error(lambda: serve.publish_argv({**CFG, 'builder': ''})))
# 删掉 app_build.vdf → publish 应报「还没生成」
app_path.unlink()
check('publish_argv 无 app_build.vdf → 报错', raises_value_error(lambda: serve.publish_argv(dict(CFG))))

# 6) 三段稳定契约 + plan_pipeline —— 整条 dry-run（package→genVDF→upload），无真账号跑通编排
check('契约: 三段命名 = package/genvdf/upload', serve.PUBLISH_STAGES == ('package', 'genvdf', 'upload'),
      f'{serve.PUBLISH_STAGES}')
steps = serve.plan_pipeline(dict(CFG))
by = {s['stage']: s for s in steps}
check('plan: 三段齐 package/genvdf/upload 且全 status=ok',
      [s['stage'] for s in steps] == ['package', 'genvdf', 'upload']
      and all(s['status'] == serve.ST_OK for s in steps), f'{steps}')
check('plan.package 带 argv(--dir)', 'argv' in by.get('package', {}) and '--dir' in by['package']['argv'])
check('plan.genvdf 真出 VDF 文件', sorted(by.get('genvdf', {}).get('files', [])) == ['app_build.vdf', 'depot_4801.vdf'])
check('plan.upload 带 steamcmd argv', '+run_app_build' in by.get('upload', {}).get('argv', []))

# 7) 判词收口：缺前置（未填 builder）→ upload 段 status=blocked + reason，不抛
steps2 = serve.plan_pipeline({**CFG, 'builder': ''})
up2 = next((s for s in steps2 if s['stage'] == 'upload'), {})
check('plan 未填 builder → upload 段 blocked+reason（不抛·预览友好）',
      up2.get('status') == serve.ST_BLOCKED and 'builder' in up2.get('reason', ''), f'{up2}')

# 7b) 单段契约可独立调（stage_* 稳定命名·zerocraft.py 代理按需转发）
check('stage_genvdf 有效 cfg → status=ok', serve.stage_genvdf(dict(CFG))['status'] == serve.ST_OK)
check('stage_upload 缺 builder → status=blocked', serve.stage_upload({**CFG, 'builder': ''})['status'] == serve.ST_BLOCKED)

# 7c) 进度判词收口：无任务 → job idle（真跑的 running/done/error 需子进程·此处只验空态口径）
check('job_status 无任务 → idle', serve.job_status()['status'] == serve.JOB_IDLE, f'{serve.job_status()}')

# 8) steamcmd 探测器 sanity（不填 / 假命令 / PATH 上真命令）
check('detect_steamcmd 空 → found False', serve.detect_steamcmd('')['found'] is False)
check('detect_steamcmd 假命令 → found False', serve.detect_steamcmd('definitely-not-real-xyz')['found'] is False)
check('detect_steamcmd PATH 上真命令(python3) → found True', serve.detect_steamcmd('python3')['found'] is True)

# ── 清理临时目录 ──
try:
    shutil.rmtree(TMP)
except Exception as e:
    print(f'  warn cleanup {TMP}: {e}')

print(f'\n[smoke] PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
