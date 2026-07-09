#!/usr/bin/env python3
"""美术替换工作流全链冒烟（REQ-DEMO-T1·工作流档 §六 ①②④）。

起 API（进程内·随机空闲端口）→ 造 library 游戏（art: manifest=placeholder 版）→
  ① 全链：derive(台账·行数=美术槽数·spec 非空) → batch(mock 整批·全 generated) →
     replace(按编号重钉引用·过 parseManifest 零 error 落盘·art: 全换 gen/ 本地 id)
  ② 断点续跑：再 batch → 全缓存命中·0 重生成（不重扣费）
  ④ 编号稳定：台账编号 art-01… 全生命周期不漂移
任一断言失败 exit 1。造的 library/<slug> + public/games/<slug> 结束清理（零仓库污染）。
§六③（真 key 端到端）本环境 GitHub-only 无 key → 不在此冒烟（走真浏览器 + 放宽网络 session）。

用法：python3 scripts/art-replace-smoke.py
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


SLUG = 'art-replace-smoke'
LIBDIR = ROOT / 'library' / SLUG
PUBDIR = ROOT / 'public' / 'games' / SLUG
CLEAN = []  # reskin 产出的新卡带 (lib, pub) 对·结束清理

MANIFEST = {
    'name': 'Art Replace Smoke',
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
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=300)
    c.request(method, path, json.dumps(body) if body is not None else None, {'Content-Type': 'application/json'})
    r = c.getresponse(); txt = r.read().decode(); c.close()
    return r.status, json.loads(txt)


try:
    # 造 placeholder 版游戏（直接落 library/<slug>·免走 LLM 建库）
    shutil.rmtree(LIBDIR, ignore_errors=True); shutil.rmtree(PUBDIR, ignore_errors=True)
    LIBDIR.mkdir(parents=True, exist_ok=True)
    (LIBDIR / 'manifest.json').write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding='utf-8')
    (LIBDIR / 'meta.json').write_text(json.dumps({'name': 'Art Replace Smoke'}, ensure_ascii=False), encoding='utf-8')

    print('① 列表推导（derive）')
    st, d = req('POST', '/api/art/derive', {'slug': SLUG})
    check(st == 200 and d.get('success'), 'derive 成功')
    rows = (d.get('ledger') or {}).get('rows', [])
    check(len(rows) == 3, f'行数=美术槽数（3 个 art: Sprite）· 实得 {len(rows)}')
    check(all(r.get('spec') for r in rows), '每行 spec 非空')
    check(all(r.get('status') == 'placeholder' for r in rows), '初始 status=placeholder')
    nos0 = [r['no'] for r in rows]
    check(nos0 == ['art-01', 'art-02', 'art-03'], f'确定性编号 art-01… · 实得 {nos0}')
    bg = next((r for r in rows if r['slot']['entity'] == 'background'), None)
    check(bg and bg['kind'] == 'bg', 'background 推为 kind=bg')

    print('② 台账可读（ledger·=替换列表同一份）')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    check(st == 200 and lg.get('success') and len(lg.get('rows', [])) == 3, 'ledger 读回 3 行')

    print('③ 批量生成（batch·mock 整批）')
    st, b = req('POST', '/api/art/batch', {'slug': SLUG, 'packId': 'pixel-retro', 'mock': True})
    check(st == 200 and b.get('success'), 'batch 成功')
    summ = b.get('summary', {})
    check(summ.get('generated') == 3 and summ.get('failed') == 0, f'整批生成 3·0 失败 · {summ}')
    check(summ.get('mock') == 3, 'mock 占位 3（本环境无 key）')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    gen_rows = lg.get('rows', [])
    check(all(r['status'] == 'generated' for r in gen_rows), '全行 status=generated')
    check(all(r.get('provenance') and r['provenance'].get('model') and r['provenance'].get('prompt') and r['provenance'].get('date') and r['provenance'].get('license') for r in gen_rows), 'provenance 四硬字段齐（M2.5 口径）')
    check((PUBDIR / 'art' / 'gen' / 'art-01.png').is_file(), '生成物落 public/games/<slug>/art/gen/')

    print('④ 对位替换（replace·过 parseManifest 零 error 落盘）')
    st, rp = req('POST', '/api/art/replace', {'slug': SLUG})
    check(st == 200 and rp.get('success'), f'replace 成功（parseManifest 零 error 铁律通过）· {rp.get("error", "")[:80]}')
    check(rp.get('replaced') == 3, f'重钉 3 引用 · 实得 {rp.get("replaced")}')
    mf = json.loads((LIBDIR / 'manifest.json').read_text(encoding='utf-8'))
    slots = [mf['entities'][e]['Sprite']['textureKey'] for e in ('hero', 'enemy', 'background')]
    check(all(s.startswith('gen/') for s in slots), f'art: 全换成 gen/ 本地 id · {slots}')
    check(not any('art:' in s for s in slots), 'manifest 里无残留 art: 占位')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    check(all(r['status'] == 'replaced' for r in lg.get('rows', [])), '台账全行 status=replaced')

    print('⑤ 断点续跑（再 batch → 全缓存·不重扣费）')
    # 把已 replaced 行状态维持——再跑 batch 应全命中缓存（cacheKey+文件在）
    st, b2 = req('POST', '/api/art/batch', {'slug': SLUG, 'packId': 'pixel-retro', 'mock': True})
    s2 = b2.get('summary', {})
    check(s2.get('cached') == 3 and s2.get('generated') == 0, f'全缓存命中·0 重生成 · {s2}')

    print('⑥ 编号稳定（全生命周期 art-01… 不漂移）')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    check([r['no'] for r in lg.get('rows', [])] == nos0, '编号与初次 derive 一致')

    print('⑦ T2 点名重生成单槽（改 prompt·其余不动）')
    st, rg = req('POST', '/api/art/regenerate', {'slug': SLUG, 'no': 'art-01', 'packId': 'pixel-retro', 'query': 'dark forest night', 'mock': True})
    check(st == 200 and rg.get('success'), f'regenerate art-01 成功 · {rg.get("error", "")[:80]}')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    rows = {r['no']: r for r in lg.get('rows', [])}
    check(rows['art-01']['query'] == 'dark forest night', 'art-01 query 已改')
    check(any(h.get('action') == 'regen' for h in rows['art-01'].get('history', [])), 'art-01 台账留 regen 历史')
    check([r['no'] for r in lg.get('rows', [])] == nos0, '§六④ 其余行编号不动')
    check(rows['art-02']['status'] == 'replaced' and rows['art-03']['status'] == 'replaced', '其余行仍 replaced（未受影响）')

    print('⑧ T2 从共享库选换单槽（不重生成·直接钉资产 id）')
    st, sw = req('POST', '/api/art/swap', {'slug': SLUG, 'no': 'art-02', 'assetId': 'dungeon/monsters/orc'})
    check(st == 200 and sw.get('success'), f'swap art-02 成功 · {sw.get("error", "")[:80]}')
    mf = json.loads((LIBDIR / 'manifest.json').read_text(encoding='utf-8'))
    check(mf['entities']['enemy']['Sprite']['textureKey'] == 'dungeon/monsters/orc', 'art-02 槽位已钉到库资产 id')
    st, lg = req('GET', f'/api/art/ledger?slug={SLUG}')
    r2 = next(r for r in lg['rows'] if r['no'] == 'art-02')
    check(r2['gen'].get('source') == 'library' and any(h.get('action') == 'swap-library' for h in r2.get('history', [])), 'swap 台账留 source=library + 历史')

    print('⑨ T2 换皮（同玩法换风格包 → 新卡带·reskinOf 谱系）')
    st, rk = req('POST', '/api/art/reskin', {'slug': SLUG, 'packId': 'neon-synthwave', 'mock': True})
    check(st == 200 and rk.get('success'), f'reskin 成功 · {rk.get("error", "")[:80]}')
    NEW = rk.get('newSlug'); NEW_LIB = ROOT / 'library' / (NEW or '_none'); NEW_PUB = ROOT / 'public' / 'games' / (NEW or '_none')
    CLEAN.append((NEW_LIB, NEW_PUB))
    check(bool(NEW) and (NEW_LIB / 'manifest.json').is_file(), f'新卡带落盘 library/{NEW}')
    new_meta = json.loads((NEW_LIB / 'meta.json').read_text(encoding='utf-8'))
    check(new_meta.get('reskinOf') == SLUG, 'meta.reskinOf 记谱系')
    new_mf = json.loads((NEW_LIB / 'manifest.json').read_text(encoding='utf-8'))
    # 玩法数据 diff 空：非美术字段（Shape/Transform 等）与源一致
    check(new_mf['entities']['hero']['Shape'] == mf['entities']['hero']['Shape'], '换皮后玩法数据 diff=空（Shape 不变）')
    check(new_mf['entities']['hero']['Sprite']['textureKey'].startswith('gen/'), '换皮后美术引用全换新（gen/ 本地 id）')

except Exception as e:
    FAIL += 1
    print(f"  \033[31m✗ 冒烟异常\033[0m: {e}")
finally:
    shutil.rmtree(LIBDIR, ignore_errors=True)
    shutil.rmtree(PUBDIR, ignore_errors=True)
    for lib, pub in CLEAN:
        shutil.rmtree(lib, ignore_errors=True)
        shutil.rmtree(pub, ignore_errors=True)

print(f"\n{'=' * 48}\n美术替换工作流冒烟：{PASS} 过 / {FAIL} 失败")
sys.exit(1 if FAIL else 0)
