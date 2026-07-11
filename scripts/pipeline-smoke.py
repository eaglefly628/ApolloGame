#!/usr/bin/env python3
"""生产流程板数据桥全链冒烟（REQ-WORKSHOP C1/C2·spec=docs/design/workshop-spec-2026-07-10.md §五）。

起 API（进程内·随机空闲端口）→
  ① 建库即立项卡：create 带 description → meta.description + concept 落盘 + board S1 机器绿
  ② PUT 即台账：PUT manifest（3 个 art: 槽）→ 免手动 derive 台账即在；再 PUT 编号不漂移
  ③ 立项卡端点：/api/pipeline/concept 合法改写生效；非法（坏 slug/零字段/超长）全拒
  ④ 换皮谱系：reskin(mock) → 新卡带 concept 带「换皮·包·源」
  ⑤ 装示例：install-sample 幂等 + 自带立项卡
  ⑥ cart-S8 轻量终检：mock 债 → gate 红且点名 MOCK；清债 → 绿（manifest-check+bench）且证据绑 gameHash
任一断言失败 exit 1。造的 library/* + public/games/* 结束清理（零仓库污染）。

用法：python3 scripts/pipeline-smoke.py
"""
import sys
import json
import socket
import shutil
import http.client
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0


def check(cond, label):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}")


SAMPLE = 'sample-platformer'
CLEAN = []  # (lib, pub) 对·结束清理


def _dirs(slug):
    return ROOT / 'library' / slug, ROOT / 'public' / 'games' / slug


MANIFEST = {
    'name': 'Pipeline Smoke',
    'capabilities': ['a1-transform', 'c1-shape', 'l2-color', 'l1-sprite'],
    'entities': {
        'camera': {'Camera': {'zoom': 1, 'offsetX': 320, 'offsetY': 200, 'rotation': 0, 'viewportW': 640, 'viewportH': 400}},
        'hero': {'Transform': {'x': 100, 'y': 200, 'rotation': 0, 'scaleX': 2, 'scaleY': 2}, 'Shape': {'kind': 'box', 'width': 48, 'height': 64}, 'Sprite': {'textureKey': 'art:brave knight hero'}},
        'enemy': {'Transform': {'x': 400, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1}, 'Shape': {'kind': 'circle', 'radius': 20}, 'Sprite': {'textureKey': 'art:green slime enemy'}},
        'background': {'Transform': {'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1}, 'Sprite': {'textureKey': 'art:forest scenery'}},
    },
}


def _free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def req(method, path, body=None):
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=600)
    c.request(method, path, json.dumps(body) if body is not None else None, {'Content-Type': 'application/json'})
    r = c.getresponse(); txt = r.read().decode(); c.close()
    return r.status, json.loads(txt)


def board(slug):
    _, b = req('GET', f'/api/pipeline?slug={slug}')
    return b


def stage(b, sid):
    return next(s for s in b.get('stages', []) if s['id'] == sid)


try:
    for lib, pub in [_dirs(SAMPLE)]:
        shutil.rmtree(lib, ignore_errors=True); shutil.rmtree(pub, ignore_errors=True)
    CLEAN.append(_dirs(SAMPLE))

    print('① 建库即立项卡（create 带 description）')
    st, cr = req('POST', '/api/library/create', {'name': 'Pipeline Smoke', 'description': '横版跳跳乐·吃金币过关'})
    SLUG = cr.get('slug')
    CLEAN.append(_dirs(SLUG or '_none'))
    check(st == 200 and cr.get('success') and bool(SLUG), f'create 成功 · slug={SLUG}')
    meta = json.loads((ROOT / 'library' / SLUG / 'meta.json').read_text('utf-8'))
    check(meta.get('description') == '横版跳跳乐·吃金币过关', 'meta.description 落盘（卡带架副标题可用）')
    pf = json.loads((ROOT / 'public' / 'games' / SLUG / 'pipeline.json').read_text('utf-8'))
    check(pf.get('concept', {}).get('name') == 'Pipeline Smoke' and pf['concept'].get('pitch') == '横版跳跳乐·吃金币过关', 'concept 立项卡自动落盘（name+pitch）')
    b = board(SLUG)
    check(b.get('success') and stage(b, 'S1')['machine']['state'] == 'ok', 'board S1 机器门开箱绿')
    check(b.get('concept', {}).get('pitch') == '横版跳跳乐·吃金币过关', 'board 返回体带 concept（S1 编辑预填）')

    print('② PUT 即台账（免手动 derive·编号不漂移）')
    st, pu = req('PUT', f'/api/library/{SLUG}/manifest', {'manifest': MANIFEST, 'note': '初版'})
    check(st == 200 and pu.get('success'), 'PUT manifest 过校验落盘')
    ledf = ROOT / 'public' / 'games' / SLUG / 'art' / 'art-ledger.json'
    check(ledf.is_file(), '台账自动重 derive（未调 /api/art/derive）')
    rows0 = json.loads(ledf.read_text('utf-8')).get('rows', [])
    check(len(rows0) == 3, f'台账 3 行（=art: 槽数）· 实得 {len(rows0)}')
    nos0 = [r['no'] for r in rows0]
    tweaked = json.loads(json.dumps(MANIFEST)); tweaked['entities']['hero']['Transform']['x'] = 120
    st, pu2 = req('PUT', f'/api/library/{SLUG}/manifest', {'manifest': tweaked, 'note': '微调'})
    rows1 = json.loads(ledf.read_text('utf-8')).get('rows', [])
    check(pu2.get('success') and [r['no'] for r in rows1] == nos0, '再 PUT 编号不漂移（mergeLedger append-only）')

    print('③ 立项卡端点（/api/pipeline/concept）')
    st, cc = req('POST', '/api/pipeline/concept', {'slug': SLUG, 'pitch': '改口：竖版跳跳乐'})
    check(st == 200 and cc.get('success'), 'concept 改写成功')
    b = board(SLUG)
    check(b.get('concept', {}).get('pitch') == '改口：竖版跳跳乐' and b['concept'].get('name') == 'Pipeline Smoke', '改 pitch 不抹 name（字段级合并）')
    _, e1 = req('POST', '/api/pipeline/concept', {'slug': '../etc', 'pitch': 'x'})
    check(e1.get('success') is False, '坏 slug 拒')
    _, e2 = req('POST', '/api/pipeline/concept', {'slug': SLUG})
    check(e2.get('success') is False, '零字段拒')
    _, e3 = req('POST', '/api/pipeline/concept', {'slug': SLUG, 'pitch': 'x' * 301})
    check(e3.get('success') is False, '超长拒（pitch ≤300）')

    print('④ 换皮谱系（reskin mock → 新卡带 S1 带谱系）')
    st, rk = req('POST', '/api/art/reskin', {'slug': SLUG, 'packId': 'pixel-retro', 'mock': True})
    NEW = rk.get('newSlug')
    CLEAN.append(_dirs(NEW or '_none'))
    check(st == 200 and rk.get('success') and bool(NEW), f'reskin 成功 · {NEW}')
    npf = json.loads((ROOT / 'public' / 'games' / NEW / 'pipeline.json').read_text('utf-8'))
    npitch = npf.get('concept', {}).get('pitch') or ''
    check('换皮' in npitch and SLUG in npitch, f'新卡带谱系立项卡 · {npitch[:60]}')

    print('⑤ 装示例（幂等+自带立项卡）')
    st, i1 = req('POST', '/api/library/install-sample', {'preset': 'platformer'})
    check(st == 200 and i1.get('success') and SAMPLE in (i1.get('installed') or []), '首装 installed')
    spf = json.loads((ROOT / 'public' / 'games' / SAMPLE / 'pipeline.json').read_text('utf-8'))
    check(bool(spf.get('concept', {}).get('pitch')), '示例卡带自带立项卡（pitch=preset.description）')
    smeta = json.loads((ROOT / 'library' / SAMPLE / 'meta.json').read_text('utf-8'))
    check(bool(smeta.get('description')), '示例 meta.description 同步落盘')
    st, i2 = req('POST', '/api/library/install-sample', {'preset': 'platformer'})
    check(i2.get('success') and SAMPLE in (i2.get('skipped') or []), '再装 skipped（幂等）')

    print('⑥ cart-S8 轻量终检（mock 债红 → 清债绿·证据绑 gameHash）')
    sled = ROOT / 'public' / 'games' / SAMPLE / 'art' / 'art-ledger.json'
    sled.parent.mkdir(parents=True, exist_ok=True)
    sled.write_text(json.dumps({'version': 1, 'rows': [
        {'no': 'art-01', 'kind': 'sprite', 'slot': {'entity': 'x', 'component': 'Sprite', 'field': 'textureKey'},
         'query': 'q', 'status': 'generated', 'gen': {'mock': True}},
    ]}, ensure_ascii=False), encoding='utf-8')
    st, g1 = req('POST', '/api/pipeline/gate', {'slug': SAMPLE, 'stage': 'S8'})
    check(g1.get('success') is False and 'MOCK' in (g1.get('summary') or ''), f'mock 债 → S8 红且点名 · {g1.get("summary", "")[:60]}')
    sled.unlink()
    st, g2 = req('POST', '/api/pipeline/gate', {'slug': SAMPLE, 'stage': 'S8'})
    check(g2.get('success') is True, f'清债 → S8 绿（manifest-check+bench）· {g2.get("summary", "")[:80]}')
    spf2 = json.loads((ROOT / 'public' / 'games' / SAMPLE / 'pipeline.json').read_text('utf-8'))
    ev = spf2.get('evidence', {}).get('S8', {})
    check(bool(ev.get('gameHash')) and 'head' not in ev, 'cart S8 证据绑 gameHash（非 git HEAD）')
    b = board(SAMPLE)
    check(stage(b, 'S8')['machine']['state'] == 'ok', 'board S8 机器门绿（证据新鲜）')

except Exception as e:
    FAIL += 1
    print(f"  \033[31m✗ 冒烟异常\033[0m: {e}")
finally:
    for lib, pub in CLEAN:
        shutil.rmtree(lib, ignore_errors=True)
        shutil.rmtree(pub, ignore_errors=True)

print(f"\n{'=' * 48}\n生产流程板数据桥冒烟：{PASS} 过 / {FAIL} 失败")
sys.exit(1 if FAIL else 0)
