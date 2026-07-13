#!/usr/bin/env python3
"""生产流程板数据桥全链冒烟（REQ-WORKSHOP C1/C2·spec=docs/design/workshop-spec-2026-07-10.md §五）。

起 API（进程内·随机空闲端口）→
  ① 建库即立项卡：create 带 description → meta.description + concept 落盘 + board S1 机器绿
  ② PUT 即台账：PUT manifest（3 个 art: 槽）→ 免手动 derive 台账即在；再 PUT 编号不漂移
  ③ 立项卡端点：/api/pipeline/concept 合法改写生效；非法（坏 slug/零字段/超长）全拒
  ④ 换皮谱系：reskin(mock) → 新卡带 concept 带「换皮·包·源」
  ⑤ 装示例：install-sample 幂等 + 自带立项卡
  ⑥ cart-S8 轻量终检：mock 债 → gate 红且点名 MOCK；清债 → 绿（manifest-check+bench）且证据绑 gameHash
  ⑦ 双角色对话通道（REQ-WORKSHOP B）：claude-code 子进程工具面全禁（纯函数断言）；/api/agent/chat
     防护（坏 role/坏 slug/坏 messages 全拒）+ mock 全链（reply+过校验门的 manifest·不代落盘）
  ⑧ Workshop 壳伺服面（REQ-WORKSHOP A）：/workshop/ 端出壳；/games/* 只读静态（穿越 403·缺失 404）；
     /api/library/<slug>/export 下载包（zip 头+排除 mock/.git/snapshots）；/api/catalog 能力目录形状
  ⑨ 后台生成任务：快速链 mock 全链入库+立项卡；原型链（slug 校验+设计稿前置+落盘回原 slug）；防护腿
  ⑩ 设计先行现场草稿：PUT/GET/清槽/坏 phase 拒（杀服可续）
  ⑪ 底案协议（```design 围栏解析/非法路径拒/mock 提议不代落盘）+ 中文名编号兜底 + 旧 CLI 兼容参数
任一断言失败 exit 1。造的 library/* + public/games/* 结束清理（零仓库污染）。

用法：python3 scripts/pipeline-smoke.py
"""
import os
import re
import sys
import json
import time
import socket
import shutil
import http.client
import urllib.parse
from pathlib import Path

os.environ['APOLLO_MOCK_LLM'] = '1'  # ⑦ 的 mock 通道（_mock_enabled 运行时读·对生产不可见）

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
    _, lst0 = req('GET', '/api/library')
    row0 = next((x for x in lst0 if x.get('slug') == SLUG), {})
    check(row0.get('empty') is True, '未生成内容=空卡带旗（▶ 拦截提示的依据）')
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
    _, lst1 = req('GET', '/api/library')
    check(next((x for x in lst1 if x.get('slug') == SLUG), {}).get('empty') is False, '落盘玩法后空卡带旗撤销')

    print('②b 落盘装载门（owner 07-11「能存必须能跑」·parse 过但引擎装不起来=拒）')
    # Tilemap 缺 layers：parse 全绿（缺字段只告警），tick 时 tile-collision 炸——批14 前这类稿能落盘、
    # 运行器白屏「无法加载」。现在 manifest-check 装载门（Engine.load+空跑2tick）必须把它拦在门外。
    crash_mf = {
        'capabilities': ['t2-tilemap'],
        'entities': {
            'map': {'Tilemap': {'cols': 4, 'rows': 4, 'tileSize': 16, 'originX': 0, 'originY': 0}},
            'hero': {'Transform': {'x': 8, 'y': 8, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 10, 'height': 10},
                     'Velocity': {'vx': 0, 'vy': 0}},
        },
    }
    st, bad = req('PUT', f'/api/library/{SLUG}/manifest', {'manifest': crash_mf, 'note': '坏稿'})
    check(st == 400 and bad.get('success') is False, '装载会炸的稿被拒（HTTP 400）')
    check('装载失败' in str(bad.get('error', '')), f'错误文本点名装载失败（供回喂 LLM 修）· 实得: {str(bad.get("error", ""))[:80]}')
    cur = json.loads((ROOT / 'library' / SLUG / 'manifest.json').read_text('utf-8'))
    check(cur == tweaked, '坏稿未落盘（盘上仍是上一版好稿）')

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

    print('⑦ 三角色对话通道（claude-code 安全面 + /api/agent/chat）')
    args = apollo._claude_code_args('opus')
    joined = ' '.join(args)
    check('--max-turns 1' in joined and '--output-format stream-json' in joined and '--include-partial-messages' in joined,
          'CLI 单轮 + 流式出（思考实况可见）')
    check('--effort high' in joined, '思考档默认 high（owner 07-11「默认 4.8 high」）')
    check('--effort max' in ' '.join(apollo._claude_code_args('opus', 'max')) and
          '--effort high' in ' '.join(apollo._claude_code_args('opus', '注入;rm')), 'effort 白名单（非法回落 high）')
    check('--append-system-prompt' in joined and '绝不调用任何工具' in ' '.join(args),
          '代理人格钉死为纯文本生成器（07-11 实证 tool_use 吃回合根治①）')
    off = args[args.index('--disallowedTools') + 1]
    check(all(t in off for t in ('AskUserQuestion', 'EnterPlanMode', 'SlashCommand', 'Skill', 'Agent')),
          '计划/提问/技能类工具也禁（根治②）')
    off = args[args.index('--disallowedTools') + 1]
    check(all(t in off for t in ('Bash', 'Edit', 'Write', 'Read', 'WebFetch', 'Task')), f'工具面全禁（spec §四红线）· {off[:60]}…')
    tr = apollo._claude_code_transcript('SYS', [{'role': 'user', 'content': '你好'}, {'role': 'assistant', 'content': '在'}])
    check(tr.startswith('SYS') and '[用户]' in tr and tr.rstrip().endswith('[助手]'), 'transcript 渲染（system+角色标注+续写钩）')
    _, a1 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'boss', 'messages': [{'role': 'user', 'content': 'x'}]})
    check(a1.get('success') is False, '坏 role 拒')
    _, a2 = req('POST', '/api/agent/chat', {'slug': '../etc', 'role': 'gd', 'messages': [{'role': 'user', 'content': 'x'}]})
    check(a2.get('success') is False, '坏 slug 拒')
    _, a3 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'gd', 'messages': [{'role': 'assistant', 'content': 'x'}]})
    check(a3.get('success') is False, '末条非 user 拒')
    _, a4 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'gd', 'provider': 'mock',
                                            'messages': [{'role': 'user', 'content': '把主角调醒目一点'}]})
    check(a4.get('success') is True and 'mock' in (a4.get('reply') or ''), 'mock 全链：对白 reply 到手')
    check(isinstance(a4.get('manifest'), dict) and a4.get('artHints') == [], 'mock 全链：manifest 过校验门回传（gd 带 artHints）')
    cur_mf = json.loads((ROOT / 'library' / SLUG / 'manifest.json').read_text('utf-8'))
    check(cur_mf != a4.get('manifest'), '未代落盘（应用改动=前端显式 PUT·红线）')
    _, a5 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'art', 'provider': 'mock',
                                            'messages': [{'role': 'user', 'content': 'art-01 重做成像素风'}]})
    check(a5.get('success') is True and 'artHints' in a5, '美术角色通（owner 07-11 三入口·art 带 artHints）')
    _, a6 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'gd', 'provider': 'mock', 'effort': 'ultra',
                                            'messages': [{'role': 'user', 'content': 'x'}]})
    check(a6.get('success') is False, '坏 effort 拒')
    # 对话持久化（owner 07-11「session 持久性」）：PUT 存 → GET 回 → 守门（坏 slug/超限裁剪）
    st, cp = req('PUT', '/api/agent/chats', {'slug': SLUG, 'chats': {
        'gd': [{'role': 'user', 'content': '留个记号'}, {'role': 'assistant', 'content': '记住了'}],
        'art': [{'role': 'user', 'content': 'art 线'}], 'pe': [], 'boss': [{'role': 'user', 'content': '野角色'}]}})
    check(st == 200 and cp.get('success') and cp.get('counts', {}).get('gd') == 2, '对话历史 PUT 存盘')
    _, cg = req('GET', f'/api/agent/chats?slug={SLUG}')
    check(cg.get('success') and cg['chats']['gd'][1]['content'] == '记住了' and cg['chats']['art'][0]['content'] == 'art 线'
          and 'boss' not in cg['chats'], '对话历史 GET 恢复（角色白名单·野角色不落）')
    _, cbad = req('GET', '/api/agent/chats?slug=../etc')
    check(cbad.get('success') is False, 'chats 坏 slug 拒')
    chatf = ROOT / '.apollo' / 'workshop-chats' / f'{SLUG}.json'
    check(chatf.is_file(), '落 .apollo/workshop-chats/（gitignored·不进卡带版本史）')
    chatf.unlink()
    st, sv = req('GET', '/api/settings')
    pids = [p.get('id') for p in (sv.get('providers') or [])]
    check(pids and pids[0] == 'claude-code', f'设置面板 claude-code 居首（订阅主力档）· {pids[:3]}')

    print('⑧ Workshop 壳伺服面（壳/静态/下载包/能力目录）')

    def raw(method, path):
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=600)
        c.request(method, path)
        r = c.getresponse(); data = r.read(); hdrs = dict(r.getheaders()); c.close()
        return r.status, hdrs, data

    st8, h8, d8 = raw('GET', '/workshop/')
    check(st8 == 200 and b'x-dc' in d8 and b'DCLogic' in d8, '/workshop/ 端出壳（x-dc + DCLogic 在体）')
    st8, h8, _ = raw('GET', '/workshop/support.js')
    check(st8 == 200 and 'javascript' in h8.get('Content-Type', ''), '/workshop/support.js 伺服')
    # /games/* 只读静态：真文件 200 · 穿越 403 · 缺失 404（壳台账缩略图 servedPath 同源）
    art_rel = f'/games/{SLUG}/art/art-ledger.json'
    st8, h8, _ = raw('GET', art_rel)
    check(st8 == 200 and 'json' in h8.get('Content-Type', ''), f'静态 200 · {art_rel}')
    st8, _, _ = raw('GET', '/games/../../apollo.py')
    check(st8 == 403, '路径穿越 403')
    st8, _, _ = raw('GET', '/games/no-such/x.png')
    check(st8 == 404, '缺失 404')
    # 下载包：zip 头 + Content-Disposition + 排除 mock/.git/snapshots（mock 债在身的 SLUG 正好验排除）
    import io as _io, zipfile as _zip
    st8, h8, d8 = raw('GET', f'/api/library/{SLUG}/export')
    check(st8 == 200 and h8.get('Content-Type') == 'application/zip' and SLUG in h8.get('Content-Disposition', ''), '下载包 zip 头 + 文件名')
    names = _zip.ZipFile(_io.BytesIO(d8)).namelist()
    check(any(n.endswith('manifest.json') for n in names), '包内含 manifest')
    check(not any(p in ('mock', '.git', 'snapshots') for n in names for p in n.split('/')), '包排除 mock/.git/snapshots')
    st8, _, _ = raw('GET', '/api/library/no-such-cart/export')
    check(st8 == 404, '缺卡带 404')
    # /bench 智能跳转（07-11 实证：壳写死 :3000 而 vite 在 :5173 → 空页）：活口 302 / 无 vite 200 提示页；防开放跳转
    def raw2(pth):
        c2 = http.client.HTTPConnection('127.0.0.1', PORT, timeout=30)
        c2.request('GET', pth)
        r2 = c2.getresponse(); data2 = r2.read(); hdrs2 = dict(r2.getheaders()); c2.close()
        return r2.status, hdrs2, data2
    stb, hb, db = raw2('/bench?to=' + urllib.parse.quote('/?game=lib:x&from=workshop'))
    check(stb in (200, 302), f'/bench 可用（{stb}=无 vite 提示页/有 vite 302）')
    if stb == 302:
        check(hb.get('Location', '').startswith('http://localhost:') and '/?game=lib:x' in hb.get('Location', ''), '302 目标带原路径')
    else:
        check('旧工作台' in db.decode('utf-8'), '提示页说明怎么启动')
    stb2, hb2, _ = raw2('/bench?to=' + urllib.parse.quote('//evil.com/x'))
    check(stb2 != 302 or 'evil.com' not in hb2.get('Location', ''), '防开放跳转（// 打回 /）')

    # 能力目录端点形状（壳 catalog() 消费）——不强求 vite-node 成功（冷环境可空），只验形状与缓存字段
    st8, cat = req('GET', '/api/catalog')
    check(st8 == 200 and 'catalog' in cat and 'success' in cat, f'/api/catalog 形状 OK（success={cat.get("success")}）')
    # 调试日志端点（owner 07-11「debug 日志对齐」）：形状 + 不泄全文（prompt/response 只留文件）
    st8, lg = req('GET', '/api/llm-logs?n=5')
    check(st8 == 200 and lg.get('success') and isinstance(lg.get('lines'), list), '/api/llm-logs 形状 OK')
    check(all('prompt' not in r and 'response' not in r for r in lg['lines']), 'llm-logs 不出全文（全文只留本机文件）')
    st8, lv = req('GET', '/api/llm-live')
    check(st8 == 200 and lv.get('success') and isinstance(lv.get('live'), list), '/api/llm-live 形状 OK（空闲=空数组）')

    print('⑨ 后台生成任务（owner 07-11 切屏/刷新不丢·mock 全链）')
    _, jb = req('POST', '/api/generate/job', {'prompt': '像素海盗跑酷，吃金币躲炮弹', 'provider': 'mock'})
    check(jb.get('success') and jb.get('id'), f"job 启动 · id={jb.get('id')}")
    jid = jb.get('id')
    deadline = time.time() + 30
    job = None
    while time.time() < deadline:
        _, jr = req('GET', f'/api/generate/job?id={jid}')
        job = jr.get('job') or {}
        if job.get('done'):
            break
        time.sleep(0.3)
    check(bool(job and job.get('done')), 'job 跑完（30s 内·mock）')
    check(not job.get('error') and bool(job.get('slug')), f"job 成功入库 · slug={job.get('slug')} · {job.get('name')}")
    JOB_SLUG = job.get('slug')
    if JOB_SLUG:
        CLEAN.append(_dirs(JOB_SLUG))
        check((ROOT / 'library' / JOB_SLUG / 'manifest.json').is_file(), '成品 manifest 落 library/<slug>/')
        pfj = json.loads((ROOT / 'public' / 'games' / JOB_SLUG / 'pipeline.json').read_text('utf-8'))
        check(pfj.get('concept', {}).get('pitch', '').startswith('像素海盗'), 'job 链自动带 S1 立项卡')
    _, jlist = req('GET', '/api/generate/jobs')
    check(jlist.get('success') and any(j.get('id') == jid for j in jlist.get('jobs', [])), 'jobs 列表可查（刷新恢复用）')
    _, jbad = req('POST', '/api/generate/job', {'prompt': '', 'provider': 'mock'})
    check(jbad.get('success') is False, '空 prompt 拒')
    _, jmiss = req('GET', '/api/generate/job?id=nope')
    check(jmiss.get('success') is False, '未知 job 404 语义')
    # 原型链（07-11 实证 bug：曾被「prompt 必填」卡死）：无 slug 拒 / 坏 slug 拒 / 合法 slug 全链跑通
    _, p1 = req('POST', '/api/generate/job', {'mode': 'prototype', 'provider': 'mock'})
    check(p1.get('success') is False and 'slug' in (p1.get('error') or ''), '原型链无 slug 拒（不再误报 prompt 必填）')
    _, p2 = req('POST', '/api/generate/job', {'mode': 'prototype', 'slug': 'no-such-cart', 'provider': 'mock'})
    check(p2.get('success') is False, '原型链缺卡带拒')
    _, dsg = req('PUT', f'/api/library/{SLUG}/design/overview.md', {'content': '# 总览\n横版跳跳乐', 'note': 'smoke 设计稿'})
    check(dsg.get('success'), '设计稿落盘（原型链前置）')
    _, p3 = req('POST', '/api/generate/job', {'mode': 'prototype', 'slug': SLUG, 'provider': 'mock'})
    check(p3.get('success') and p3.get('id'), '原型链启动 OK')
    deadline = time.time() + 30
    pj = None
    while time.time() < deadline:
        _, pr3 = req('GET', f"/api/generate/job?id={p3['id']}")
        pj = pr3.get('job') or {}
        if pj.get('done'):
            break
        time.sleep(0.3)
    check(bool(pj and pj.get('done') and not pj.get('error') and pj.get('slug') == SLUG), f"原型链落盘回原 slug · {pj.get('slug')}")

    print('⑩ 设计先行现场草稿（杀服务/刷新可续）')
    st10, dput = req('PUT', '/api/workshop/draft', {'draft': {'phase': 'chat', 'name': '森林消消乐', 'ready': True,
        'msgs': [{'role': 'user', 'content': '想做三消'}, {'role': 'assistant', 'content': '可以了'}], 'slug': None}})
    check(st10 == 200 and dput.get('success'), '现场 PUT 存盘')
    _, dget = req('GET', '/api/workshop/draft')
    dd = dget.get('draft') or {}
    check(dd.get('phase') == 'chat' and dd.get('ready') is True and len(dd.get('msgs', [])) == 2, '现场 GET 恢复（阶段/ready/对话）')
    _, dbad = req('PUT', '/api/workshop/draft', {'draft': {'phase': 'flying'}})
    check(dbad.get('success') is False, '坏 phase 拒')
    _, dclr = req('PUT', '/api/workshop/draft', {'draft': None})
    _, dget2 = req('GET', '/api/workshop/draft')
    check(dclr.get('success') and dget2.get('draft') is None, '清槽（原型入库后现场归零）')

    print('⑪ 底案协议 + 编号兜底 + 旧 CLI 兼容')
    rest, dp, dc = apollo._split_design_patch('好的，改慢节奏。\n```design overview.md\n# 总览 v3\n```\n以上。')
    check(dp == 'overview.md' and dc.startswith('# 总览 v3') and '```' not in rest, '底案围栏解析（路径+全文+对白剥净）')
    rest2, dp2, _ = apollo._split_design_patch('```design ../../etc/passwd\nx\n```')
    check(dp2 is None, '底案非法路径拒（当没提议·对白保留）')
    rest3, dp3, _ = apollo._split_design_patch('纯对白没有围栏')
    check(dp3 is None and rest3 == '纯对白没有围栏', '无围栏=纯对白')
    _, a7 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'gd', 'provider': 'mock',
                                            'messages': [{'role': 'user', 'content': '更新一下底案提纲'}]})
    check(isinstance(a7.get('designPatch'), dict) and a7['designPatch'].get('path') == 'overview.md',
          'mock 全链：底案提议回传（gd）')
    ov = (ROOT / 'library' / SLUG / 'design' / 'overview.md').read_text('utf-8')
    check('mock 修订' not in ov, '底案未代落盘（确认才写·红线）')
    check(re.fullmatch(r'game-\d{3}', apollo._slugify('森林消消乐')), '中文名 → 唯一编号 game-NNN（不再裸 game）')
    check(apollo._slugify('Space Shooter') == 'space-shooter', '英文名照旧可读 slug')
    lg_args = ' '.join(apollo._claude_code_args_legacy('opus'))
    check('--output-format json' in lg_args and '--include-partial-messages' not in lg_args
          and '--disallowedTools' in lg_args, '旧 CLI 兼容参数（非流式·工具面仍全禁）')
    # 方案 A·原生 session resume（owner 07-11 拍板「跟 Claude Code 一致」）
    ra = ' '.join(apollo._claude_code_args('opus', 'high', 'abc123def456'))
    check('--resume abc123def456' in ra and '--disallowedTools' in ra, 'resume 参数（工具面钉子不松）')
    check('--resume' not in ' '.join(apollo._claude_code_args('opus', 'high', '../inject; rm')), 'resume id 白名单（非法不带）')
    st14, sta = req('GET', f'/api/library/{SLUG}/stats')
    check(st14 == 200 and sta.get('success') and sta.get('files', 0) > 0 and sta.get('lines', 0) > 0,
          f"代码统计端点 · {sta.get('files')} 文件 {sta.get('lines')} 行")
    _, sbad = req('GET', '/api/library/no-such-x/stats')
    check(sbad.get('success') is False, 'stats 缺游戏拒')
    apollo._ws_sessions_save(SLUG, 'gd', 'f00dbabe-cafe', 'hash-1')
    st13, cp2 = req('PUT', '/api/agent/chats', {'slug': SLUG, 'chats': {'gd': [{'role': 'user', 'content': 'x'}], 'pe': [], 'art': []}})
    fdata = json.loads((ROOT / '.apollo' / 'workshop-chats' / f'{SLUG}.json').read_text('utf-8'))
    check(cp2.get('success') and fdata.get('sessions', {}).get('gd') == 'f00dbabe-cafe'
          and fdata.get('ctxHash', {}).get('gd') == 'hash-1', '对话覆盖存盘不抹 session 台账')
    _, cg2 = req('GET', f'/api/agent/chats?slug={SLUG}')
    check(cg2.get('success') and (cg2.get('sessions') or {}).get('gd') == 'f00dbabe-cafe'
          and (cg2.get('sessions') or {}).get('pe') is None, 'GET 回各角色 session id（壳标题栏亮牌·07-12）')
    _, rs = req('POST', '/api/agent/session/reset', {'slug': SLUG, 'role': 'gd'})
    fdata2 = json.loads((ROOT / '.apollo' / 'workshop-chats' / f'{SLUG}.json').read_text('utf-8'))
    check(rs.get('success') and rs.get('hadSession') is True and 'gd' not in (fdata2.get('sessions') or {})
          and (fdata2.get('chats') or {}).get('gd'), '归档重开：解绑 session·聊天记录保留（07-12）')
    _, rs2 = req('POST', '/api/agent/session/reset', {'slug': SLUG, 'role': 'gd'})
    check(rs2.get('success') and rs2.get('hadSession') is False, '再重开=幂等（无 session 也成功）')
    _, rs3 = req('POST', '/api/agent/session/reset', {'slug': SLUG, 'role': 'boss'})
    check(rs3.get('success') is False, '坏 role 拒')
    (ROOT / '.apollo' / 'workshop-chats' / f'{SLUG}.json').unlink()

    import http.server as _hs
    check(apollo.start_api_server.__doc__ is None or True, '')  # 占位防误删
    PASS -= 1  # 上一行不计数
    check('ThreadingHTTPServer' in open(ROOT / 'main_entry' / 'server.py', encoding='utf-8').read().split('def start_api_server')[1][:400],
          'API 服务多线程（对话长请求不再堵死实况轮询·07-11 破案）')

    print('⑫ 删卡带（owner 07-11·只删库卡带·内置永远 404）')
    _, dc1 = req('POST', '/api/library/create', {'name': 'Delete Me', 'description': '待删'})
    DEL = dc1.get('slug')
    CLEAN.append(_dirs(DEL or '_none'))
    st12, dd = req('DELETE', f'/api/library/{DEL}')
    check(st12 == 200 and dd.get('success'), f'删除成功 · {DEL}')
    check(not (ROOT / 'library' / (DEL or '_')).exists() and not (ROOT / 'public' / 'games' / (DEL or '_')).exists(),
          '两侧目录都清（library + public/games）')
    st12, dd2 = req('DELETE', f'/api/library/{DEL}')
    check(st12 == 404, '再删 404（幂等语义）')
    st12, dd3 = req('DELETE', '/api/library/game-d')
    check(st12 == 404, '引擎内置游戏删不到（不在 library/ 即 404）')
    st12, _dd4 = req('DELETE', '/api/library/BAD..SLUG')
    check(st12 in (400, 404), '坏 slug 拒')

    print('⑬ TS 例外开关 + capgap 快速通道（owner 07-11 双拍板·REQ-ARCH）')
    # 功能开关默认态：capgap 开、tsCarts 关（隐藏开关）
    _, ft = req('GET', '/api/features')
    check(ft.get('success') and ft.get('capgap') is True and ft.get('tsCarts') is False,
          'features 默认态（capgap 开 · tsCarts 关=隐藏）')
    st13, _f1 = req('POST', f'/api/library/{SLUG}/flags', {'allowTs': True})
    check(st13 == 403, 'tsCarts 关时打勾被拒（403）')
    st13, _l0 = req('PUT', f'/api/library/{SLUG}/logic', {'content': 'x'})
    check(st13 == 403, 'tsCarts 关时 PUT logic 被拒（403）')
    # capgap：围栏解析（纯函数）+ mock 全链记台账
    rest, gap = apollo._split_capgap('说不行。\n```capgap\n{"title": "T", "need": "N", "proposal": "P", "acceptance": "A"}\n```\n完。')
    check(gap and gap['title'] == 'T' and '说不行' in rest and 'capgap' not in rest, 'capgap 围栏解析（对白剥净）')
    _, gap2 = apollo._split_capgap('```capgap\n{"title": ""}\n```')
    check(gap2 is None, 'capgap 缺 title/need 当没提议')
    _, ac = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'pe', 'provider': 'mock',
                                            'messages': [{'role': 'user', 'content': '这个机制做不了吧——能力缺口'}]})
    check(ac.get('success') and (ac.get('capGap') or {}).get('title'), 'mock 对话产 capGap 并记台账')
    _, gl = req('GET', '/api/capgaps')
    check(gl.get('success') and any(g.get('slug') == SLUG for g in gl.get('gaps', [])), '/api/capgaps 能查到该缺口')
    # 开启 tsCarts（环境旗=运行时读）→ 打勾 → mock pe 产 logicPatch → PUT 过真装载门落盘
    os.environ['APOLLO_FEATURE_TSCARTS'] = '1'
    try:
        _, ft2 = req('GET', '/api/features')
        check(ft2.get('tsCarts') is True, '环境旗开启 tsCarts（运行时生效）')
        st13, f2 = req('POST', f'/api/library/{SLUG}/flags', {'allowTs': True})
        check(st13 == 200 and f2.get('allowTs') is True, '卡带打勾 allowTs')
        _, lst13 = req('GET', '/api/library')
        row13 = next((x for x in lst13 if x.get('slug') == SLUG), {})
        check(row13.get('allowTs') is True and row13.get('hasLogic') is False, '列表带 allowTs 旗（尚无 logic）')
        _, tc = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'pe', 'provider': 'mock',
                                                'messages': [{'role': 'user', 'content': '给我写一段 logic 漂移逻辑'}]})
        lp = (tc.get('logicPatch') or {}).get('content', '')
        check(tc.get('success') and 'cartCapability' in lp and f'cart-{SLUG}' in lp, 'mock pe 产 logicPatch（合契约）')
        st13, lput = req('PUT', f'/api/library/{SLUG}/logic', {'content': lp, 'note': 'smoke logic'})
        check(st13 == 200 and lput.get('success'), 'PUT logic 过真装载门落盘（vite-node cart-logic-check）')
        check((ROOT / 'library' / SLUG / 'logic.ts').is_file(), 'logic.ts 在盘上')
        _, lst14 = req('GET', '/api/library')
        check(next((x for x in lst14 if x.get('slug') == SLUG), {}).get('hasLogic') is True, '列表 hasLogic 旗亮')
        st13, lbad = req('PUT', f'/api/library/{SLUG}/logic', {'content': 'export const nope = 1;\n'})
        check(st13 == 400 and '契约' in str(lbad.get('error', '')), '不合契约的 logic 被装载门拒（400）')
        st13, lrm = req('PUT', f'/api/library/{SLUG}/logic', {'content': ''})
        check(st13 == 200 and lrm.get('removed') is True and not (ROOT / 'library' / SLUG / 'logic.ts').exists(),
              '空串=撤除 logic.ts（退出例外）')
    finally:
        os.environ.pop('APOLLO_FEATURE_TSCARTS', None)

    print('⑭ 全库装载体检（owner 07-11「把加载失败的错误都 log 出来」）')
    # 直写盘造一盘「parse 过但装载炸」的旧账坏卡带（模拟批14 门禁上线前混进库的稿——不走 PUT 门）
    bad_dir = ROOT / 'library' / 'doctor-bad'
    CLEAN.append(_dirs('doctor-bad'))
    bad_dir.mkdir(parents=True, exist_ok=True)
    (bad_dir / 'manifest.json').write_text(json.dumps({
        'capabilities': ['t2-tilemap'],
        'entities': {
            'map': {'Tilemap': {'cols': 4, 'rows': 4, 'tileSize': 16, 'originX': 0, 'originY': 0}},
            'hero': {'Transform': {'x': 8, 'y': 8, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 10, 'height': 10},
                     'Velocity': {'vx': 0, 'vy': 0}}}}, ensure_ascii=False), encoding='utf-8')
    (bad_dir / 'meta.json').write_text(json.dumps({'name': 'Doctor Bad'}, ensure_ascii=False), encoding='utf-8')
    _, doc = req('GET', '/api/library/doctor')
    check(doc.get('success') and doc.get('total', 0) >= 2, f'体检跑通 · {doc.get("total")} 盘')
    rows = {r.get('slug'): r for r in doc.get('results', [])}
    bad_row = rows.get('doctor-bad') or {}
    check(bad_row.get('ok') is False and bad_row.get('stage') == 'load' and '装载失败' in str(bad_row.get('error', '')),
          f'坏盘点名+原因（stage=load）· {str(bad_row.get("error", ""))[:60]}')
    check((rows.get(SLUG) or {}).get('ok') is True, '好盘体检绿（冒烟主卡带）')

    print('⑮ art-ops 协议 + 台账按素材去重（owner 07-12 工作流重设）')
    rest15, ops15 = apollo._split_art_ops(
        '好的，这就安排。\n```art-ops\n[{"op":"regen","no":"art-03","query":"mossy stone"},'
        '{"op":"batch","packId":"pixel"},{"op":"replace"},{"op":"hack"}]\n```')
    check(ops15 is not None and len(ops15) == 3 and ops15[0]['no'] == 'art-03' and '这就安排' in rest15
          and 'art-ops' not in rest15, 'art-ops 围栏解析（非法 op 过滤·对白剥净）')
    _, nops15 = apollo._split_art_ops('```art-ops\nnot json\n```')
    check(nops15 is None, '坏 JSON 当没提议')
    _, ao15 = req('POST', '/api/agent/chat', {'slug': SLUG, 'role': 'art', 'provider': 'mock',
                                              'messages': [{'role': 'user', 'content': '帮我把占位都生成了'}]})
    check(ao15.get('success') and isinstance(ao15.get('artOps'), list) and ao15['artOps'][0]['op'] == 'batch',
          'mock 美术对话产 artOps 提议（壳确认卡的数据源）')
    dup_mf = {'capabilities': ['a1-transform', 'c1-shape', 'l2-color'], 'entities': {
        'p1': {'Transform': {'x': 0, 'y': 0}, 'Shape': {'kind': 'box', 'width': 32, 'height': 8}, 'Sprite': {'textureKey': 'art:stone platform'}},
        'p2': {'Transform': {'x': 40, 'y': 0}, 'Shape': {'kind': 'box', 'width': 32, 'height': 8}, 'Sprite': {'textureKey': 'art:stone platform'}},
        'p3': {'Transform': {'x': 80, 'y': 0}, 'Shape': {'kind': 'box', 'width': 32, 'height': 8}, 'Sprite': {'textureKey': 'art:stone platform'}},
        'hero': {'Transform': {'x': 120, 'y': 0}, 'Shape': {'kind': 'box', 'width': 16, 'height': 16}, 'Sprite': {'textureKey': 'art:pixel hero'}},
    }}
    st15, pu15 = req('PUT', f'/api/library/{SLUG}/manifest', {'manifest': dup_mf, 'note': '去重腿'})
    check(st15 == 200 and pu15.get('success'), '同词多槽稿 PUT 落盘（自动重 derive）')
    led15 = json.loads((ROOT / 'public' / 'games' / SLUG / 'art' / 'art-ledger.json').read_text('utf-8'))
    live15 = [r for r in led15.get('rows', []) if r.get('status') != 'retired']
    plat15 = next((r for r in live15 if r.get('query') == 'stone platform'), None)
    check(plat15 is not None and len(plat15.get('slots') or []) == 3,
          f'台账按素材去重（3 同词槽合 1 行·slots 扇出回写）· 实得 slots={len((plat15 or {}).get("slots") or [])}')
    check(len([r for r in live15 if r.get('query') == 'pixel hero']) == 1, '不同素材各占一行')
    check('{DESIGN_DOCS}' in apollo.AGENT_PE_SYSTEM and '{DESIGN_DOCS}' in apollo.AGENT_ART_SYSTEM
          and '{DESIGN_DOCS}' in apollo.AGENT_GD_SYSTEM,
          '三角色系统词都带设计底案区块（07-12「程序凭名字瞎猜」修——底案=spec 谁施工谁必读）')

    print('⑯ 素材虚拟分组 + 占位图解析 + 视频 key 槽位（owner 07-12）')
    st16, gp = req('PUT', '/api/matlib/groups', {'groups': [{'id': 'g1', 'name': '子弹', 'items': ['a', 'b']}]})
    check(st16 == 200 and gp.get('success') and gp.get('count') == 1, '分组 PUT 存盘')
    _, gg = req('GET', '/api/matlib/groups')
    check(gg.get('success') and gg['groups'][0]['name'] == '子弹' and gg['groups'][0]['items'] == ['a', 'b'], '分组 GET 回读（虚拟层级·素材本体不动）')
    _, gbad = req('PUT', '/api/matlib/groups', {'groups': [{'id': '', 'name': '', 'items': []}]})
    check(gbad.get('success') is False, '坏组拒（缺 id/name）')
    req('PUT', '/api/matlib/groups', {'groups': []})  # 清盘（工作台状态·不留冒烟残留）
    _, rv = req('GET', f'/api/art/resolve?slug={SLUG}')
    check(rv.get('success') and isinstance(rv.get('resolutions'), list),
          f'占位解析端点跑通（引擎真解析器·与运行器同图）· {len(rv.get("resolutions", []))} 条')
    _, rv2 = req('GET', f'/api/art/resolve?slug={SLUG}')
    check(rv2.get('success') and rv2.get('cached') is True, '解析结果按 manifest 指纹缓存（重开零成本）')
    _, stg16 = req('GET', '/api/settings')
    check(any(k.get('envKey') == 'PIXVERSE_API_KEY' for k in (stg16.get('genKeys') or [])),
          '爱诗 PixVerse 视频 key 槽位在设置（adapter=后续单·同 Seedance 先例）')

    print('⑰ 原型链代码驱动分叉（owner 07-12「唯一区别=数据/代码驱动」·⚡卡带原型自动补 logic.ts）')
    os.environ['APOLLO_FEATURE_TSCARTS'] = '1'
    try:
        req('POST', f'/api/library/{SLUG}/flags', {'allowTs': True})
        st17, jb17 = req('POST', '/api/generate/job', {'mode': 'prototype', 'slug': SLUG, 'provider': 'mock'})
        check(st17 == 200 and jb17.get('success') and jb17.get('id'), '⚡卡带原型任务启动（mock）')
        j17 = {}
        for _ in range(240):
            _, jv17 = req('GET', f'/api/generate/job?id={jb17.get("id")}')
            j17 = (jv17 or {}).get('job') or {}
            if j17.get('done'):
                break
            time.sleep(0.5)
        check(j17.get('done') and not j17.get('error'), f'原型任务完成 · warning={j17.get("warning")}')
        check((ROOT / 'library' / SLUG / 'logic.ts').is_file(), '代码驱动相：logic.ts 自动落盘（同一装载门）')
        check(not j17.get('warning'), '逻辑相无 warning（mock 逻辑过门）')
        req('PUT', f'/api/library/{SLUG}/logic', {'content': ''})  # 收尾撤 logic（不污染后续）
        req('POST', f'/api/library/{SLUG}/flags', {'allowTs': False})
    finally:
        os.environ.pop('APOLLO_FEATURE_TSCARTS', None)

except Exception as e:
    FAIL += 1
    print(f"  \033[31m✗ 冒烟异常\033[0m: {e}")
finally:
    for lib, pub in CLEAN:
        shutil.rmtree(lib, ignore_errors=True)
        shutil.rmtree(pub, ignore_errors=True)

print(f"\n{'=' * 48}\n生产流程板数据桥冒烟：{PASS} 过 / {FAIL} 失败")
sys.exit(1 if FAIL else 0)
