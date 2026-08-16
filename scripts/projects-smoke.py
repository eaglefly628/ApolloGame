#!/usr/bin/env python3
"""「存为项目」端点冒烟（REQ-S18PANEL ①·照 art-sync-smoke 风格）。

直调 handle_project_save 自证（对真仓只用一次性冒烟 slug·finally 全清理；
单槽草稿 _design-draft.json 先备份后还原，绝不动 owner 的真实创作现场）：
  ① 合法落盘：brief+gdd+gaps → docs/design/<slug>/ 三件齐·gaps 归一为裸数组（机读契约）
  ② 非法 slug 拒（穿越/大写/空/超长）·且不落任何盘
  ③ brief 缺失/空 / gdd 非字符串 → 拒
  ④ gaps 形状校验拒坏体（非数组/缺 id/route 出闭集/blocks 出 S1–S8/priority 出 P0–P3/
     state 坏 token/id 重复）·**先验证后落盘**：拒时连 brief.md 都不写（无半截现场）
  ⑤ 幂等：重复 POST 更新不炸·gdd/gaps 没带或 gdd 空串 → 已有文件原样不动
  ⑥ 对话认领：草稿 msgs → chats.gd（整份覆盖不追加·resume 台账保留·更长 gd 历史不被
     短草稿覆盖·别的项目的草稿不搬）；sessions 走 _ws_sessions_save 落绑定·坏体拒

用法：python3 scripts/projects-smoke.py
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry.projects import handle_project_save  # noqa: E402
from main_entry.workshop_state import _WS_DRAFT_FILE  # noqa: E402
from main_entry.workshop_store import _WORKSHOP_CHATS_DIR  # noqa: E402

PASS, FAIL = 0, 0


def check(cond, label, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}  {detail}")


SLUG = 'projsmoke-s18'
SLUG_BAD = 'projsmoke-s18-bad'
DESIGN = ROOT / 'docs' / 'design'
GOOD_GAPS = [
    {'id': 'GAP-01', 'title': '3D 液面件', 'priority': 'p1', 'route': 'engine',
     'state': 'Open', 'ticket': 'REQ-UIFX', 'blocks': ['s3', 'S6', 'S3']},
    {'id': 'GAP-02', 'title': '粒子拖尾', 'priority': 'P2', 'route': 'pui',
     'state': 'delivered', 'blocks': []},
]

_draft_backup = _WS_DRAFT_FILE.read_bytes() if _WS_DRAFT_FILE.is_file() else None
_chat_file = _WORKSHOP_CHATS_DIR / f'{SLUG}.json'


def write_draft(obj) -> None:
    _WS_DRAFT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _WS_DRAFT_FILE.write_text(json.dumps(obj, ensure_ascii=False), 'utf-8')


try:
    # 台面干净起步（上次中断残留不影响判定）
    shutil.rmtree(DESIGN / SLUG, ignore_errors=True)
    shutil.rmtree(DESIGN / SLUG_BAD, ignore_errors=True)
    _chat_file.unlink(missing_ok=True)
    _WS_DRAFT_FILE.unlink(missing_ok=True)

    # ① 合法落盘
    r = handle_project_save({'slug': SLUG, 'brief': '# 叠叠乐 · 立项卡\n一句话玩法。',
                             'gdd': '## 玩法\n叠上去。', 'gaps': GOOD_GAPS})
    check(r.get('success') and r.get('dir') == f'docs/design/{SLUG}'
          and set(r.get('wrote', [])) == {'brief.md', 'gdd.md', 'capability-gaps.json'},
          '① 合法落盘 → success + wrote 三件', str(r))
    d = DESIGN / SLUG
    check((d / 'brief.md').is_file() and '立项卡' in (d / 'brief.md').read_text('utf-8'),
          '① brief.md 落盘且内容在', '')
    check((d / 'gdd.md').read_text('utf-8').startswith('## 玩法'), '① gdd.md 落盘', '')
    gaps_disk = json.loads((d / 'capability-gaps.json').read_text('utf-8'))
    check(isinstance(gaps_disk, list) and len(gaps_disk) == 2, '① gaps 是裸数组（主程半件机读契约）', str(gaps_disk)[:120])
    g0 = gaps_disk[0]
    check(g0['priority'] == 'P1' and g0['state'] == 'open' and g0['blocks'] == ['S3', 'S6'],
          '① gaps 归一（priority 大写·state 小写·blocks 去重归 S 大写）', str(g0))
    check(set(g0.keys()) == {'id', 'title', 'priority', 'route', 'state', 'ticket', 'blocks'},
          '① gaps 只留工单表 7 键（多余键不夹带）', str(sorted(g0.keys())))

    # ② 非法 slug 拒 · 不落盘
    for bad in ('../evil', 'UPPER', '', 'a' * 65, 'has space'):
        check(not handle_project_save({'slug': bad, 'brief': 'x'}).get('success'),
              f'② 非法 slug 拒: {bad[:20]!r}', '')
    check(not (DESIGN / '..evil').exists() and not (DESIGN / 'UPPER').exists(), '② 非法 slug 未落任何盘', '')

    # ③ brief / gdd 类型校验
    check('brief' in str(handle_project_save({'slug': SLUG_BAD}).get('error')), '③ brief 缺失拒', '')
    check(not handle_project_save({'slug': SLUG_BAD, 'brief': '   '}).get('success'), '③ brief 全空白拒', '')
    check(not handle_project_save({'slug': SLUG_BAD, 'brief': 'x', 'gdd': 42}).get('success'), '③ gdd 非字符串拒', '')

    # ④ gaps 形状校验拒坏体（每例都带合法 brief——证明拒的是 gaps）+ 先验证后落盘
    bad_gaps = [
        ('非数组', {'not': 'a list'}),
        ('缺 id', [{'title': 't', 'priority': 'P1', 'route': 'engine', 'state': 'open', 'blocks': []}]),
        ('route 出闭集', [{'id': 'G1', 'title': 't', 'priority': 'P1', 'route': 'threed', 'state': 'open', 'blocks': []}]),
        ('blocks 出 S1–S8', [{'id': 'G1', 'title': 't', 'priority': 'P1', 'route': 'engine', 'state': 'open', 'blocks': ['S9']}]),
        ('priority 出 P0–P3', [{'id': 'G1', 'title': 't', 'priority': 'P9', 'route': 'engine', 'state': 'open', 'blocks': []}]),
        ('state 坏 token', [{'id': 'G1', 'title': 't', 'priority': 'P1', 'route': 'engine', 'state': 'Open!', 'blocks': []}]),
        ('id 重复', [{'id': 'G1', 'title': 't', 'priority': 'P1', 'route': 'engine', 'state': 'open', 'blocks': []},
                     {'id': 'G1', 'title': 't2', 'priority': 'P2', 'route': 'pui', 'state': 'open', 'blocks': []}]),
    ]
    for label, g in bad_gaps:
        rr = handle_project_save({'slug': SLUG_BAD, 'brief': '# ok', 'gaps': g})
        check(not rr.get('success'), f'④ gaps 拒坏体：{label}', str(rr))
    check(not (DESIGN / SLUG_BAD).exists(), '④ **先验证后落盘**：拒坏体时连 brief.md 都没写（无半截现场）', '')

    # ⑤ 幂等：gdd/gaps 没带 → 已有文件原样不动；brief 更新；gdd 空串同样不覆盖
    r = handle_project_save({'slug': SLUG, 'brief': '# 叠叠乐 · 立项卡 v2'})
    check(r.get('success') and 'gdd.md' in r.get('skipped', []) and 'capability-gaps.json' in r.get('skipped', []),
          '⑤ 重复 POST 更新不炸 · 没带的标 skipped', str(r))
    check('v2' in (d / 'brief.md').read_text('utf-8'), '⑤ brief.md 已更新', '')
    check((d / 'gdd.md').read_text('utf-8').startswith('## 玩法'), '⑤ gdd 没带 → gdd.md 原样', '')
    check(len(json.loads((d / 'capability-gaps.json').read_text('utf-8'))) == 2, '⑤ gaps 没带 → gaps 原样', '')
    r = handle_project_save({'slug': SLUG, 'brief': '# v3', 'gdd': '   '})
    check(r.get('success') and (d / 'gdd.md').read_text('utf-8').startswith('## 玩法'),
          '⑤ **gdd 空串不覆盖已有 gdd**（工单幂等④点名）', (d / 'gdd.md').read_text('utf-8')[:40])

    # ⑥ 对话认领
    msgs = [{'role': 'user', 'content': '想做一个叠叠乐'}, {'role': 'assistant', 'content': '好，聊聊核心循环', 'meta': '⏱ 1.0s'}]
    write_draft({'version': 1, 'phase': 'docs', 'name': '叠叠乐', 'slug': SLUG, 'ready': True, 'msgs': msgs})
    _chat_file.write_text(json.dumps({'version': 1, 'slug': SLUG, 'sessions': {'pe': 'cc-keep-me'},
                                      'chats': {'art': [{'role': 'user', 'content': '美术历史'}]}}, ensure_ascii=False), 'utf-8')
    r = handle_project_save({'slug': SLUG, 'brief': '# v4'})
    saved = json.loads(_chat_file.read_text('utf-8'))
    check(r.get('success') and r['claimed']['msgs'] == 2 and saved['chats']['gd'] == msgs,
          '⑥ 草稿对话认领进 chats.gd（关浏览器再开不丢）', str(r.get('claimed')))
    check(saved.get('sessions', {}).get('pe') == 'cc-keep-me' and saved['chats'].get('art'),
          '⑥ 认领不抹 resume 台账/其他角色历史', str(saved)[:160])
    r = handle_project_save({'slug': SLUG, 'brief': '# v5'})
    saved = json.loads(_chat_file.read_text('utf-8'))
    check(r['claimed']['msgs'] == 2 and len(saved['chats']['gd']) == 2, '⑥ 重复认领整份覆盖不追加（不重复）', '')
    longer = msgs + [{'role': 'user', 'content': '工坊里又聊了一句'}]
    saved['chats']['gd'] = longer
    _chat_file.write_text(json.dumps(saved, ensure_ascii=False), 'utf-8')
    r = handle_project_save({'slug': SLUG, 'brief': '# v6'})
    check(r['claimed']['msgs'] == 0 and len(json.loads(_chat_file.read_text('utf-8'))['chats']['gd']) == 3,
          '⑥ 更长的 gd 历史不被短草稿覆盖', str(r.get('claimed')))
    write_draft({'version': 1, 'phase': 'docs', 'name': '别的', 'slug': 'other-project', 'ready': False, 'msgs': msgs})
    r = handle_project_save({'slug': SLUG, 'brief': '# v7'})
    check(r['claimed']['msgs'] == 0, '⑥ 别的项目的草稿不搬（跨项目不认领）', str(r.get('claimed')))
    _WS_DRAFT_FILE.unlink(missing_ok=True)
    r = handle_project_save({'slug': SLUG, 'brief': '# v8', 'sessions': {'gd': 'cc-sess-abc'}})
    saved = json.loads(_chat_file.read_text('utf-8'))
    check(r.get('success') and 'gd' in r['claimed']['sessions'] and saved['sessions']['gd'] == 'cc-sess-abc',
          '⑥ sessions 经 _ws_sessions_save 落绑定（pe 原绑定保留）', str(saved.get('sessions')))
    check(saved['sessions'].get('pe') == 'cc-keep-me', '⑥ 其他角色绑定未被动', '')
    check(not handle_project_save({'slug': SLUG, 'brief': 'x', 'sessions': {'boss': 's1'}}).get('success'),
          '⑥ sessions 坏角色拒', '')
    check(not handle_project_save({'slug': SLUG, 'brief': 'x', 'sessions': {'gd': ''}}).get('success'),
          '⑥ sessions 空 sid 拒', '')
    check(handle_project_save({'slug': SLUG, 'brief': '# v9'})['claimed']['msgs'] == 0,
          '⑥ 无草稿文件 → 认领 0 条不炸', '')
finally:
    shutil.rmtree(DESIGN / SLUG, ignore_errors=True)
    shutil.rmtree(DESIGN / SLUG_BAD, ignore_errors=True)
    _chat_file.unlink(missing_ok=True)
    if _draft_backup is None:
        _WS_DRAFT_FILE.unlink(missing_ok=True)
    else:
        _WS_DRAFT_FILE.parent.mkdir(parents=True, exist_ok=True)
        _WS_DRAFT_FILE.write_bytes(_draft_backup)

print(f"\nprojects smoke: {PASS} ok / {FAIL} fail")
sys.exit(1 if FAIL else 0)
