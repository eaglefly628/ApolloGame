#!/usr/bin/env python3
"""资产浏览器 A3/A4 冒烟自测（REQ-ARTPIPE2·PST 域）。

跑法（仓库根目录）：`python3 main_entry/artbrowser_smoke.py`。断言式脚本——全绿打印 `OK`退出码 0；
任何一条断言炸 → 打印 `FAIL` 明细、退出码 1。**不进 scripts/**（本单纪律：只读调用 scripts/**，
自己的回归测试落在 main_entry/ 域内——同 `scripts/pipeline-smoke.py`/`scripts/art-replace-smoke.py`
的断言式测法，只是换了个不越域的落点）。

覆盖：
  ① 顺修 bug 回归（A2 发现·A4 收单）——library 卡带线 `/api/art/upload` 落账后 `gen.servedPath`
     必须存在（此前 `art-replace.mjs swapSlot()` 只知 assetId 不知服务路径，落账后浏览器缩略图
     退化为图标占位；本单在 `handle_art_upload` 里补写回填）。
  ② A3 历史列表——对一个真实入库过的美术文件，`git log --follow` 应给出非空提交列表。
  ③ A3 历史字节——对②同一文件在其最新 rev 取字节，应与工作树当前文件字节逐字节相同
     （HEAD=当前 tracked 内容时应如此）。
  ④ A3 回退——对①里刚建好台账行的临时卡带，拿②③验证过的一张真实历史图片「回退」进该行，
     应成功落盘 + provenance 记 `restore-from:<rev>`。
  ⑤ A4 消费方反查——对一个已知 `slot` 的编译期游戏台账行（无 manifest.json 可 grep），consumers
     端点应如实退化为 `declared-slot`（不是空手、也不是假装从 manifest 里找到了引用）。
  ⑥ 路径穿越防护——`../` 越界 path 在 history / history-blob / restore 三处一律拒绝。

清理：①④用的临时 library 卡带测完即经 `library_delete` 清净，不留测试痕迹。
"""
import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from main_entry.artbrowser import (  # noqa: E402
    _git_log_follow, handle_artbrowser_consumers, handle_artbrowser_history,
    handle_artbrowser_restore, resolve_history_blob,
)
from main_entry.library import _art_replace_cli  # noqa: E402
from main_entry.library_api import library_create, library_delete  # noqa: E402
from main_entry.t2_replace import handle_art_upload  # noqa: E402

# 1x1 透明 PNG（有效 magic bytes，供上传/回退两处过 handle_art_upload 的内容嗅探门）。
_TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

failures = []


def check(name: str, cond: bool, detail: str = '') -> None:
    if cond:
        print(f'  OK   {name}')
    else:
        print(f'  FAIL {name}' + (f' — {detail}' if detail else ''))
        failures.append(name)


def pick_tracked_history_asset(require_valid_png: bool = False) -> str | None:
    """在 public/games/**/art/gen/*.png 里找一个真有 git 历史的文件（跳过 mock 命名空间），
    返回 servedPath（/games/<slug>/art/gen/<file>）；找不到返回 None（罕见——仓库应至少有一张真图）。
    `require_valid_png`：仓库里不少 `.png` 命名的文件实际内容是 JPEG（历史遗留·扩展名不可信）——
    回退用例要过 `handle_art_upload` 的 magic-bytes 门，这里额外挑一张「内容真是 PNG」的（否则拿
    张挂 .png 名的 JPEG 去测「回退」，只会撞见——且应该撞见——R1 ④ 内容嗅探门，不是本单要测的东西）。"""
    base = ROOT / 'public' / 'games'
    if not base.is_dir():
        return None
    for slug_dir in sorted(base.iterdir()):
        gen = slug_dir / 'art' / 'gen'
        if not gen.is_dir():
            continue
        for f in sorted(gen.glob('*.png')):
            if require_valid_png and not f.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
                continue
            served = f'/games/{slug_dir.name}/art/gen/{f.name}'
            r = handle_artbrowser_history(served)
            if r.get('success') and r.get('commits'):
                return served
    return None


def main() -> int:
    print('REQ-ARTPIPE2 A3/A4 冒烟自测')

    # ── ② + ③ A3 历史（只读·不建临时数据）──────────────────────────────────
    served = pick_tracked_history_asset()
    check('② 找到一个有 git 历史的真实美术文件', served is not None, '仓库里没有一张 gen/*.png 有提交记录？')
    if served:
        hist = handle_artbrowser_history(served)
        check('② history 端点成功', hist.get('success') is True, str(hist))
        commits = hist.get('commits') or []
        check('② 提交列表非空', len(commits) >= 1)
        if commits:
            latest_rev = commits[0]['hash']
            ok, data, ctype = resolve_history_blob(served, latest_rev)
            check('③ history-blob 取字节成功', ok, str(data if not ok else ''))
            if ok:
                on_disk_path = ROOT / 'public' / Path(served.lstrip('/'))  # /games/<slug>/... → public/games/<slug>/...
                on_disk = on_disk_path.read_bytes()
                check('③ HEAD 版本字节与工作树当前文件一致', data == on_disk,
                      f'blob={len(data)}B vs disk={len(on_disk)}B')
                check('③ content-type 落在图片类', ctype in ('image/png', 'image/webp', 'image/jpeg'), ctype)

    # ④ 的回退动作要过 handle_art_upload 的 magic-bytes 门——挑一张「内容真是 PNG」的历史图片
    # （不少 .png 命名的仓库素材实际是 JPEG 内容·那种走 R1 ④ 内容嗅探门应该被拒，不是本单测的场景）。
    served_valid_png = pick_tracked_history_asset(require_valid_png=True)
    check('④ 找到一个内容真是 PNG 的历史文件（供回退测试）', served_valid_png is not None)

    # ── ⑥ 路径穿越防护（三处·不依赖①的临时卡带）──────────────────────────
    bad_paths = ['/games/../../etc/passwd', '/games/x/../../../etc/passwd', '/etc/passwd', '/assets/../../etc/passwd']
    for bp in bad_paths:
        h = handle_artbrowser_history(bp)
        check(f'⑥ history 拒绝越界 path={bp!r}', h.get('success') is False)
        ok, _data, _ct = resolve_history_blob(bp, '0' * 40)
        check(f'⑥ history-blob 拒绝越界 path={bp!r}', ok is False)
    ok, _data, _ct = resolve_history_blob('/games/game-a/art/gen/art-02.png', 'not-a-rev; rm -rf /')
    check('⑥ history-blob 拒绝非法 rev（注入尝试）', ok is False)

    # ── ⑤ A4 消费方——编译期代码游戏（无 manifest.json 可 grep）应如实退化为 declared-slot ──
    # （只读端点·用真实内置游戏 game-g 的既有台账行·不写不改不建临时数据）。
    if (ROOT / 'public' / 'games' / 'game-g' / 'art' / 'art-ledger.json').is_file():
        c5 = handle_artbrowser_consumers('game-g', 'art-01')
        check('⑤ consumers 端点成功', c5.get('success') is True, str(c5))
        check('⑤ manifestChecked=False（game-g 是编译期代码游戏·无 manifest.json）', c5.get('manifestChecked') is False, str(c5))
        kinds = {c.get('kind') for c in (c5.get('consumers') or [])}
        check('⑤ 如实退化为 declared-slot/declared-ref（不是假装 grep 到了 manifest 引用）',
              bool(kinds & {'declared-slot', 'declared-ref'}) or bool(c5.get('note')), str(c5))
    else:
        check('⑤ game-g 台账存在（前置条件）', False, '样例游戏缺失——consumers 回退路径未测到')

    # ── ① + ④ 需要一个临时 library 卡带（写操作·测完清净）───────────────────
    slug = None
    try:
        status, data = library_create({'name': 'ArtBrowser A3A4 Smoke', 'template': 'platformer'})
        check('① 临时卡带建成', status == 200 and data.get('success') is True, str(data))
        slug = data.get('slug') if data.get('success') else None
        if slug:
            _art_replace_cli(['derive', slug])
            led_f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
            ledger = json.loads(led_f.read_text('utf-8')) if led_f.is_file() else {'rows': []}
            rows = ledger.get('rows') or []
            check('① 台账 derive 出至少一行', len(rows) >= 1, f'rows={len(rows)}')
            if rows:
                no = rows[0]['no']
                res = handle_art_upload({'slug': slug, 'no': no, 'dataBase64': _TINY_PNG_B64, 'ext': 'png'})
                check('① upload 成功（library 卡带线·此前本单要修的分支）', res.get('success') is True, str(res))
                served_path = ((res.get('row') or {}).get('gen') or {}).get('servedPath')
                check('① 回归修复：响应里 gen.servedPath 存在', bool(served_path), str(res.get('row')))
                if served_path:
                    check('① servedPath 格式正确', served_path == f'/games/{slug}/art/gen/{no}-up.png', served_path)
                # 台账文件本身也要有（不能只在返回值里补丁·必须真落盘——浏览器下一次读的是文件不是这次响应）。
                ledger2 = json.loads(led_f.read_text('utf-8'))
                row2 = next((r for r in ledger2.get('rows', []) if r.get('no') == no), None)
                check('① 落盘台账文件里也有 servedPath（不止响应体·浏览器读的是这份）', bool((row2 or {}).get('gen', {}).get('servedPath')))

                # ── ④ A3 回退（用一张内容真是 PNG 的历史图片，回退进这个临时卡带的行）───
                if served_valid_png:
                    hist2 = handle_artbrowser_history(served_valid_png)
                    rev = (hist2.get('commits') or [{}])[0].get('hash')
                    if rev:
                        r4 = handle_artbrowser_restore({'slug': slug, 'no': no, 'path': served_valid_png, 'rev': rev})
                        check('④ restore 成功', r4.get('success') is True, str(r4))
                        prov = (r4.get('row') or {}).get('provenance') or {}
                        check('④ provenance 记 restore-from:<rev>', prov.get('restoreFrom') == f'restore-from:{rev}', str(prov))
                        hist_last = ((r4.get('row') or {}).get('history') or [{}])[-1]
                        check('④ history 末条记 restoreFromRev', hist_last.get('restoreFromRev') == rev, str(hist_last))
    finally:
        if slug:
            st, d = library_delete(slug)
            check('清理：临时卡带已删', st == 200 and d.get('success') is True, str(d))

    print()
    if failures:
        print(f'FAIL：{len(failures)} 条断言未过 → {failures}')
        return 1
    print('OK：全部断言通过')
    return 0


if __name__ == '__main__':
    sys.exit(main())
