#!/usr/bin/env python3
"""创作台 · 低模生成四件（REQ-STUDIO）后端冒烟（无需 API key·mock provider·进程内起 API）。

诊断=让弱模型在 81 项词表里从零作曲；四件把它变成「从能跑模板做增量修改 + 题材子集词表 +
校验错误指令化 + token/缓存卫生」。本冒烟逐件自证：
  ① 模板库：TEMPLATE_LIBRARY 每个模板 manifest-check **全绿**（能跑基线）；关键词→模板映射对。
  ② 词汇裁剪：_slice_catalog 选出「基础原子+模板族+题材族」子集（远小于全量·字节稳定·排除无关能力）。
  ③ 校验错误 LLM 化：unknown-cap / 组件类型错误 → 指名 entity/字段 + 合法值示例的可执行指令。
  ④ token 卫生 + 交互日志：每轮落一行 JSONL（schema 齐·**无 API key**·verbose 才落全文）；promptChars 记录。
  ⑤ 弱模基准自证：APOLLO_MOCK_BAD_MANIFEST_N=1 → 首轮产未知能力的 manifest → 断言错误指令化回喂 +
     词汇族按需扩 + 轮次裁剪（回喂只带上轮 manifest + 本轮错误·不累积历史失败）。
任一断言失败 exit 1。真 deepseek 重测留给 owner/Lead（无 key 环境诚实标注）。
用法：python3 scripts/studio-lowmodel-smoke.py
"""
import sys
import os
import json
import socket
import shutil
import subprocess
import http.client
from pathlib import Path

os.environ.setdefault('APOLLO_MOCK_LLM', '1')

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import apollo  # noqa: E402

PASS, FAIL = 0, 0


def check(label: str, cond: bool, detail='') -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ok   {label}')
    else:
        FAIL += 1
        print(f'  FAIL {label}  {detail}')


def _free_port() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


# 真全量 catalog（前端送 apollo.py 的那份的 parity；用 vite-node 派生一次）。
CATALOG = subprocess.run(
    ['npx', 'vite-node', 'scripts/dump-capability-catalog.mjs'],
    cwd=ROOT, capture_output=True, encoding='utf-8', timeout=180,
).stdout

PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def req(method: str, path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=180)
    conn.request(method, path, body=json.dumps(body) if body is not None else None,
                 headers={'Content-Type': 'application/json'})
    resp = conn.getresponse()
    txt = resp.read().decode()
    conn.close()
    return resp.status, (json.loads(txt) if txt else {})


print(f'[smoke] low-model 四件 on :{PORT}  (catalog {len(CATALOG)} 字符)')

# 干净日志起点（本冒烟会真写 .apollo/llm-logs/·finally 清）。
shutil.rmtree(apollo.LLM_LOGS_DIR, ignore_errors=True)
CREATED_SLUGS = []

try:
    # ── ① 模板库：每个模板 manifest-check 全绿 ────────────────────────────────
    print('① 模板库全绿 + 关键词映射')
    all_green = True
    for key, tpl in apollo.TEMPLATE_LIBRARY.items():
        ok, msg = apollo._run_manifest_check(apollo._template_manifest(tpl))
        if not ok:
            all_green = False
            print(f'      ✗ 模板 {key} 未过校验: {msg[:200]}')
        check(f'模板「{key}」manifest-check 通过', ok, msg[:120])
    check('模板库覆盖 ≥5 题材', len(apollo.TEMPLATE_LIBRARY) >= 5, list(apollo.TEMPLATE_LIBRARY))

    for prompt, exp in [('两人投骰子比大小', 'dice'), ('抽卡扑克 Balatro', 'cards'),
                        ('马里奥横版跳跃闯关', 'platform-jump'), ('俯视收集金币迷宫', 'collect'),
                        ('乒乓球拍接球对战', 'pong'), ('小球弹跳有重力', 'bounce'),
                        ('随便做个什么', 'bounce')]:
        tpl, _fams = apollo._pick_template(prompt)
        check(f'关键词「{prompt}」→ 模板 {exp}', tpl['key'] == exp, f'got {tpl["key"]}')

    # ── ② 词汇按题材裁剪：子集远小于全量·字节稳定·排除无关能力 ──────────────────
    print('② 词汇按题材裁剪')
    tpl, fams = apollo._pick_template('掷骰子')
    keep = apollo._template_family_ids(tpl, fams)
    subset = apollo._slice_catalog(CATALOG, keep)
    check('子集显著小于全量（≥50% 裁剪）', len(subset) < len(CATALOG) * 0.5,
          f'subset={len(subset)} full={len(CATALOG)}')
    check('子集含题材能力（t2-dice-roll / w1-random）',
          '- t2-dice-roll ' in subset and '- w1-random ' in subset)
    check('子集含基础原子（a1-transform）', '- a1-transform ' in subset)
    check('子集排除无关能力（t3-match3-board / d-collision-resolve-3d）',
          '- t3-match3-board ' not in subset and '- d-collision-resolve-3d ' not in subset)
    check('相同 keep → 切片字节稳定（缓存友好·可重放）',
          apollo._slice_catalog(CATALOG, keep) == subset)
    check('子集块数 = keep 命中数（无重复/无漏）',
          subset.count('\n- ') + 1 == len([k for k in keep if f'- {k} ' in CATALOG]),
          f'blocks={subset.count(chr(10)+"- ")+1}')

    # 家族按需扩：bounce 子集本无 dice 族 → 错误点名真实能力 t2-dice-roll → 补它整族
    tpl_b, fams_b = apollo._pick_template('小球弹跳')
    keep_b = apollo._template_family_ids(tpl_b, fams_b)
    known = apollo._catalog_block_ids(CATALOG)
    check('bounce 子集起初不含 t2-dice-roll', 't2-dice-roll' not in keep_b)

    def _rebuild(unknown_ids, keep=keep_b):  # 复刻 _handle_template_edit 内 _rebuild 语义
        added = False
        for cid in unknown_ids:
            if cid in known and cid not in keep:
                keep.append(cid)
                added = True
                for _f, ids in apollo.CAPABILITY_FAMILIES.items():
                    if cid in ids:
                        for x in ids:
                            if x in known and x not in keep:
                                keep.append(x)
        return added
    check('错误点名真实能力 → 触发扩词', _rebuild({'t2-dice-roll'}))
    check('扩词补入该族全量（w1-random / t2-keybind 一并进来）',
          't2-dice-roll' in keep_b and 'w1-random' in keep_b and 't2-keybind' in keep_b)
    check('未知伪能力不触发扩词（zz-not-real）', not _rebuild({'zz-not-real'}))

    # ── ③ 校验错误 LLM 化 ────────────────────────────────────────────────────
    print('③ 校验错误 LLM 化')
    instr_u, unk = apollo._llm_ify_error(
        'manifest: 未知 capability id: zz-bogus, t2-dice-roll（不在能力注册表内）', {})
    check('unknown-cap 抽出能力集', unk == {'zz-bogus', 't2-dice-roll'}, unk)
    check('unknown-cap 指令点名能力 + 给可执行动作',
          '`zz-bogus`' in instr_u and ('删掉' in instr_u or '替换' in instr_u), instr_u[:120])
    instr_t, _ = apollo._llm_ify_error(
        'manifest: 组件数据类型错误（1 处）—— ball.Velocity.vx —— Velocity.vx 应为 number，实为 string', {})
    check('组件类型错误指令点名 entity+字段+合法值示例',
          '`ball`' in instr_t and '`vx`' in instr_t and 'number' in instr_t and '纯数字' in instr_t,
          instr_t[:160])

    # ── ④ + ⑤ template-edit 全链 + 交互日志 + 弱模基准（bad-manifest 回路）────────
    print('④⑤ template-edit 全链 + 交互日志 + 弱模基准自证')
    # happy path
    st, d = req('POST', '/api/generate',
                {'mode': 'template-edit', 'provider': 'mock', 'prompt': '两人投骰子比大小',
                 'catalog': CATALOG, 'autofix': True})
    check('template-edit 成功 + 返回模板 key', st == 200 and d.get('success') and d.get('template') == 'dice',
          f'{st} {str(d)[:120]}')
    m = d.get('manifest') or d.get('blueprint')
    ok, msg = apollo._run_manifest_check(m)
    check('返回的（改后）manifest 过 manifest-check', ok, msg[:120])
    check('template-edit 首轮即成（attempts=1·mock 改基线一次过）', d.get('attempts') == 1, f'attempts={d.get("attempts")}')

    # 弱模基准：首轮 mock 产未知能力的 manifest → 应错误指令化回喂 + 第 2 轮过。
    apollo._MOCK_BAD_MANIFEST_REMAINING = 1
    st, d2 = req('POST', '/api/generate',
                 {'mode': 'template-edit', 'provider': 'mock', 'prompt': '掷骰子',
                  'catalog': CATALOG, 'autofix': True})
    check('坏 manifest 一轮后修复通过（attempts=2）', d2.get('success') and d2.get('attempts') == 2,
          f'{str(d2)[:120]}')
    check('fixed_errors 保留原始校验错误（供「查看原始校验错误」）',
          bool(d2.get('fixed_errors')) and '未知 capability id' in d2['fixed_errors'][0], d2.get('fixed_errors'))
    fi = d2.get('fix_instructions') or []
    check('fix_instructions = 指令化回喂（点名坏能力 zz-mock-bogus-cap）',
          bool(fi) and 'zz-mock-bogus-cap' in fi[0], fi)

    # 交互日志 schema
    logf = sorted(apollo.LLM_LOGS_DIR.glob('*.jsonl'))
    check('生成往返落了 JSONL 日志', bool(logf), str(apollo.LLM_LOGS_DIR))
    lines = logf[0].read_text(encoding='utf-8').strip().split('\n') if logf else []
    recs = [json.loads(x) for x in lines]
    req_keys = {'ts', 'provider', 'model', 'mode', 'promptChars', 'responseChars', 'validation', 'errors', 'elapsedMs'}
    check('每行含 schema 必填键', all(req_keys <= set(r) for r in recs), req_keys)
    check('日志绝不落 API key', all(not any(k in r for k in ('apiKey', 'api_key', 'key')) for r in recs))
    check('默认不落 prompt/response 全文（只落长度）',
          all('prompt' not in r and 'response' not in r for r in recs))
    modes = [r['mode'] for r in recs]
    check('mode 闭集含 template-edit + autofix-k',
          'template-edit' in modes and any(m.startswith('autofix-') for m in modes), modes)
    vals = [r['validation'] for r in recs]
    check('validation 记录 pass/fail 事实', 'pass' in vals and 'fail' in vals, vals)
    check('每轮记录 promptChars（token 卫生可对比）', all(isinstance(r['promptChars'], int) and r['promptChars'] > 0 for r in recs))

    # 轮次裁剪：坏 manifest 那单第 2 轮（autofix-2）的 promptChars 不应爆炸（只加一轮回喂·不累积历史）。
    te = [r for r in recs if r['mode'] in ('template-edit', 'autofix-2')]
    # 找同一次生成的两轮：最后两条属 bad-manifest 那单
    if len(recs) >= 2:
        r1, r2 = recs[-2], recs[-1]
        check('轮次裁剪：重试轮 promptChars 增量 < 首轮总量（未累积历史失败）',
              (r2['promptChars'] - r1['promptChars']) < r1['promptChars'], f'{r1["promptChars"]}→{r2["promptChars"]}')

    # verbose 落全文（仍无 key）
    print('④ verbose 全文档（APOLLO_LOG_VERBOSE=1）')
    shutil.rmtree(apollo.LLM_LOGS_DIR, ignore_errors=True)
    os.environ['APOLLO_LOG_VERBOSE'] = '1'
    req('POST', '/api/generate',
        {'mode': 'template-edit', 'provider': 'mock', 'prompt': '掷骰子', 'catalog': CATALOG, 'autofix': True})
    os.environ.pop('APOLLO_LOG_VERBOSE', None)
    vlog = sorted(apollo.LLM_LOGS_DIR.glob('*.jsonl'))
    vrec = json.loads(vlog[0].read_text(encoding='utf-8').strip().split('\n')[-1]) if vlog else {}
    check('verbose=1 落 prompt/response 全文', 'prompt' in vrec and 'response' in vrec and len(vrec.get('prompt', '')) > 500)
    check('verbose 全文仍无 API key（key 只在 HTTP 头）', 'x-api-key' not in vrec.get('prompt', '') and 'Bearer' not in vrec.get('prompt', ''))

    # 全链落库：template-edit 结果可保存入库（PUT manifest 过校验）。
    print('⑥ 全链落库（改后 manifest 可入库）')
    st, cr = req('POST', '/api/library/create', {'name': 'LowModel Smoke Dice'})
    slug = cr.get('slug')
    if slug:
        CREATED_SLUGS.append(slug)
    st, pd = req('PUT', f'/api/library/{slug}/manifest', {'manifest': m, 'note': '低模模板改'})
    check('改后 manifest PUT 入库成功（服务端 manifest-check 过）', st == 200 and pd.get('success'), f'{st} {pd}')

finally:
    shutil.rmtree(apollo.LLM_LOGS_DIR, ignore_errors=True)
    for s in CREATED_SLUGS:
        shutil.rmtree(ROOT / 'library' / s, ignore_errors=True)

print(f'\n[smoke] 低模四件：PASS={PASS}  FAIL={FAIL}')
sys.exit(1 if FAIL else 0)
