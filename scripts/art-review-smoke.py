#!/usr/bin/env python3
"""AI 生成人审门（M2.5·REQ-ART）—— zerocraft.py 全链冒烟。

宪法「无自动入库」的门禁自证：起 API 服务（进程内·随机空闲端口）→
  ① generate → 落**待审区**（pending·**不**进 index）+ 返回预览 URL
  ② GET /api/assets/pending 见到它
  ③ review approve → **移进 index**（provenance 全）+ 待审清空
  ④ generate 二 → review reject → 待审清空 + **从未进 index**
  ⑤ provenance 硬校验：手造缺 model 的待审项 → approve **被拒**、仍在待审、不误登记
  ⑥ 路径/入参防护：非法 action、`..` 穿越 id → 4xx/ok:false
任一断言失败 exit 1。全程快照 assets/index.json 与 assets/ai/ 并在 finally 原样恢复（零仓库污染）。

用法：python3 scripts/art-review-smoke.py
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


def check(cond: bool, label: str) -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}")


def _free_port() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


PORT = _free_port()
apollo.API_PORT = PORT
apollo.start_api_server()


def req(method: str, raw_path: str, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=180)
    data = json.dumps(body) if body is not None else None
    conn.request(method, raw_path, body=data, headers={'Content-Type': 'application/json'})
    resp = conn.getresponse()
    txt = resp.read().decode()
    conn.close()
    try:
        return resp.status, json.loads(txt)
    except Exception:
        return resp.status, {'_raw': txt}


ASSETS = ROOT / 'assets'
INDEX = ASSETS / 'index.json'
AI_DIR = ASSETS / 'ai'

# ── 快照，finally 恢复（生成/审核会真写 assets/index.json 与 assets/ai/·冒烟后必须还原）──
INDEX_SNAPSHOT = INDEX.read_bytes() if INDEX.exists() else None
AI_EXISTED = AI_DIR.exists()


def index_ids():
    return {a['id'] for a in json.loads(INDEX.read_text('utf-8')).get('assets', [])} if INDEX.exists() else set()


def pending_ids():
    _, j = req('GET', '/api/assets/pending')
    return {e['id'] for e in j.get('pending', [])}


try:
    # 清一个干净的起点（若上次冒烟残留）
    shutil.rmtree(AI_DIR / 'pending', ignore_errors=True)
    (AI_DIR / 'pending.json').unlink(missing_ok=True)

    print('① generate → 待审区（不进 index）')
    st, gen = req('POST', '/api/assets/generate', {'adapter': 'qwen', 'prompt': 'smoke m25 approve me'})
    gid = gen.get('id')
    check(st == 200 and gen.get('success') and gen.get('pending') is True, 'generate 返回 success + pending:true')
    check(bool(gen.get('previewPath')) and '/pending/' in (gen.get('previewPath') or ''), '返回待审预览 URL（/pending/ 路径）')
    check(gid not in index_ids(), '生成物**不在** index.json（无自动入库）')

    print('② GET /api/assets/pending 见到它')
    check(gid in pending_ids(), '待审区列出该生成物')

    print('③ approve → 进 index（provenance 全）+ 待审清空')
    st, appr = req('POST', '/api/assets/review', {'id': gid, 'action': 'approve'})
    check(st == 200 and appr.get('success') and appr.get('action') == 'approve', 'approve 返回 success')
    check(gid in index_ids(), 'approve 后**已在** index.json')
    ent = next((a for a in json.loads(INDEX.read_text('utf-8'))['assets'] if a['id'] == gid), {})
    prov = ent.get('provenance', {})
    check(bool(prov.get('model')) and bool(prov.get('prompt')) and bool(prov.get('generatedAt')) and bool(ent.get('license')),
          'index 条目 provenance 四硬字段齐（model/prompt/date/license）')
    check('previewPath' not in ent and 'pendingFile' not in ent, 'index 条目无审门机制字段泄漏')
    check(gid not in pending_ids(), 'approve 后待审区已清该项')

    print('④ generate 二 → reject → 从未进 index')
    st, gen2 = req('POST', '/api/assets/generate', {'adapter': 'qwen', 'prompt': 'smoke m25 reject me'})
    gid2 = gen2.get('id')
    st, rej = req('POST', '/api/assets/review', {'id': gid2, 'action': 'reject'})
    check(st == 200 and rej.get('success') and rej.get('action') == 'reject', 'reject 返回 success')
    check(gid2 not in index_ids(), 'reject 物**从未进** index.json')
    check(gid2 not in pending_ids(), 'reject 后待审区已清该项')

    print('⑤ provenance 硬校验：缺 model 的待审项 approve 被拒')
    # 手造一个 provenance 缺 model 的待审项（模拟脏数据）+ 一个真待审文件
    bad_id = 'ai/qwen/smoke-m25-badprov'
    bad_base = 'qwen-smoke-m25-badprov.png'
    (AI_DIR / 'pending').mkdir(parents=True, exist_ok=True)
    (AI_DIR / 'pending' / bad_base).write_bytes(b'\x89PNG\r\n\x1a\n')  # 占位字节
    man = json.loads((AI_DIR / 'pending.json').read_text('utf-8')) if (AI_DIR / 'pending.json').exists() else {'version': 1, 'pending': []}
    man['pending'].append({
        'id': bad_id, 'type': 'texture', 'license': 'Qwen/DashScope',
        'path': 'ai/qwen/smoke-m25-badprov.png', 'previewPath': '/assets/ai/pending/' + bad_base,
        'pendingFile': bad_base, 'finalRel': 'ai/qwen/smoke-m25-badprov.png', 'scope': 'shelf',
        'provenance': {'generator': 'qwen', 'prompt': 'x', 'model': '', 'mock': True, 'generatedAt': '2026-07-06T00:00:00Z'},
    })
    (AI_DIR / 'pending.json').write_text(json.dumps(man, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    st, bad = req('POST', '/api/assets/review', {'id': bad_id, 'action': 'approve'})
    check(bad.get('success') is False and 'provenance' in (bad.get('error') or ''), 'approve 缺 model → 被拒（provenance 硬校验）')
    check(bad_id not in index_ids(), '被拒项**未误登记**进 index')
    check(bad_id in pending_ids(), '被拒项仍留在待审区（可弃置/修）')
    req('POST', '/api/assets/review', {'id': bad_id, 'action': 'reject'})  # 清掉脏项

    print('⑥ 入参/路径防护')
    st, e1 = req('POST', '/api/assets/review', {'id': gid, 'action': 'delete'})
    check(e1.get('success') is False, '非法 action=delete → ok:false')
    st, e2 = req('POST', '/api/assets/review', {'id': '../etc/passwd', 'action': 'approve'})
    check(e2.get('success') is False, '`..` 穿越 id → ok:false')

finally:
    # 原样恢复仓库（快照回写 + 清掉本冒烟产生的文件/目录·即便中途断言崩溃也执行）
    shutil.rmtree(AI_DIR / 'pending', ignore_errors=True)
    (AI_DIR / 'pending.json').unlink(missing_ok=True)
    (AI_DIR / 'qwen' / 'smoke-m25-approve-me.png').unlink(missing_ok=True)  # approve 落盘的最终文件
    if INDEX_SNAPSHOT is not None:
        INDEX.write_bytes(INDEX_SNAPSHOT)  # 恢复 index（approve 曾写入测试条目）
    if not AI_EXISTED:
        shutil.rmtree(AI_DIR, ignore_errors=True)

print(f"\n{'='*48}\n人审门冒烟：{PASS} 过 / {FAIL} 失败")
sys.exit(1 if FAIL else 0)
