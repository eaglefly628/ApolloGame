#!/usr/bin/env python3
"""scripts/design-ingest-zip-check.py —— design_ingest 整包(zip)收稿安全性检查（REQ-DESIGNLINE 二期④·
owner 2026-08-08 追加：Claude Design 导出物是 zip 不是单 html）。

直调 `main_entry.design_ingest.handle_design_ingest_zip`（纯函数级·零 HTTP）——四例：
  zip-slip 拒收 / 超限拒收（防炸弹·解压后总量）/ 白名单外文件单条跳过（非致命）/ 台账登记完整性。
造的 docs/design/<slug> 结束清理（零仓库污染，同 art-replace-smoke.py 先例）。

用法：python3 scripts/design-ingest-zip-check.py [case...]（缺省=全跑）
  case ∈ {zip-slip, oversize, skip-non-whitelist, ledger-integrity}
任一断言失败 exit 1。由 scripts/design-ingest-zip.test.mjs 逐 case spawn 校验退出码（vitest 门内）。
"""
import base64
import hashlib
import io
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from main_entry import design_ingest as di  # noqa: E402

PASS, FAIL = 0, 0


def check(cond, label):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        FAIL += 1
        print(f"  \033[31m✗\033[0m {label}")


def make_zip(entries: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in entries.items():
            z.writestr(name, data)
    return buf.getvalue()


def ingest(slug, fname, raw):
    return di.handle_design_ingest_zip({'slug': slug, 'filename': fname, 'dataBase64': base64.b64encode(raw).decode('ascii')})


def cleanup(slug):
    shutil.rmtree(ROOT / 'docs' / 'design' / slug, ignore_errors=True)


def case_zip_slip():
    slug = 'zzcheck-zip-slip'
    cleanup(slug)
    try:
        raw = make_zip({
            '../../evil.html': b'<html></html>',
            'index.html': b'<html><body data-action="x"></body></html>',
        })
        res = ingest(slug, 'a.zip', raw)
        check(res.get('success') is False, 'zip-slip 条目（../../evil.html）→ 整包拒收')
        err = res.get('error') or ''
        check('越界' in err or '非法' in err, f'拒收理由指向路径越界/非法（实际: {err!r}）')
        check(not (ROOT / 'docs' / 'design' / slug / 'ui-refs').exists(), '拒收后未落任何盘（无半包残留）')
    finally:
        cleanup(slug)


def case_oversize():
    slug = 'zzcheck-oversize'
    cleanup(slug)
    try:
        big = b'x' * (51 * 1024 * 1024)  # 高度可压缩 → zip 包体很小，但解压后单条 51MB 超 50MB 总量上限
        raw = make_zip({'index.html': b'<html></html>', 'big.png': big})
        check(len(raw) < 40 * 1024 * 1024, '前置条件：zip 包体本身远小于 50MB（测的是解压后总量防炸弹，非原始体积）')
        res = ingest(slug, 'a.zip', raw)
        check(res.get('success') is False, '解压后总大小超 50MB 上限 → 拒收')
        check('50MB' in (res.get('error') or ''), '拒收理由提到 50MB 上限')
        check(not (ROOT / 'docs' / 'design' / slug / 'ui-refs').exists(), '拒收后未落任何盘')
    finally:
        cleanup(slug)


def case_skip_non_whitelist():
    slug = 'zzcheck-skip-whitelist'
    cleanup(slug)
    try:
        raw = make_zip({
            'index.html': b'<html><body data-action="go"></body></html>',
            'notes.txt': b'not a design asset',
            '.DS_Store': b'\x00\x01',
        })
        res = ingest(slug, 'a.zip', raw)
        check(res.get('success') is True, '白名单外文件不致命——整包仍收（非整体拒收）')
        entry = res.get('entry') or {}
        skipped = entry.get('skippedFiles') or []
        check('notes.txt' in skipped and '.DS_Store' in skipped, '白名单外文件记入 skippedFiles')
        files = [f['path'] for f in entry.get('files') or []]
        check('notes.txt' not in files and '.DS_Store' not in files, '白名单外文件未进台账 files 清单')
        pack_dir = ROOT / 'docs' / 'design' / slug / 'ui-refs' / res['filename']
        check((pack_dir / 'index.html').is_file(), '白名单内的 index.html 正常落盘')
        check(not (pack_dir / 'notes.txt').exists() and not (pack_dir / '.DS_Store').exists(),
              '白名单外文件确实没落盘（不是"记了跳过却仍写了文件"）')
    finally:
        cleanup(slug)


def case_ledger_integrity():
    slug = 'zzcheck-ledger-integrity'
    cleanup(slug)
    try:
        html = b'<html><body><button data-action="menu.start"></button></body></html>'
        png = b'\x89PNG\r\n\x1a\nfakepngbytes'
        raw = make_zip({'index.html': html, 'img/bg.png': png, 'style.css': b'body{}'})
        res = ingest(slug, 'my-screen.zip', raw)
        check(res.get('success') is True, '合法 zip 整包收稿成功')
        check(res.get('entryHtml') == 'index.html', '入口 html 判定正确（唯一 index.html）')
        entry = res.get('entry') or {}
        check(entry.get('kind') == 'pack', "台账条目 kind == 'pack'")
        check(entry.get('status') == 'draft', "台账条目 status == 'draft'（人门未签前）")
        files = {f['path']: f for f in entry.get('files') or []}
        check(set(files.keys()) == {'index.html', 'img/bg.png', 'style.css'},
              f'台账 files 清单=真落盘的 3 个文件·保留相对路径（实际: {sorted(files.keys())}）')
        check(files.get('index.html', {}).get('sha256') == hashlib.sha256(html).hexdigest(), 'index.html sha256 与内容一致')
        check(files.get('img/bg.png', {}).get('sha256') == hashlib.sha256(png).hexdigest(), 'img/bg.png sha256 与内容一致')
        pack_dir = ROOT / 'docs' / 'design' / slug / 'ui-refs' / res['filename']
        check((pack_dir / 'index.html').is_file() and (pack_dir / 'img' / 'bg.png').is_file() and (pack_dir / 'style.css').is_file(),
              '磁盘上保留包内相对路径结构（img/bg.png 没被拍平成 bg.png）')
        ledger_path = ROOT / 'docs' / 'design' / slug / 'design-ledger.json'
        check(ledger_path.is_file(), 'design-ledger.json 落盘')
        ledger = json.loads(ledger_path.read_text('utf-8'))
        entries = ledger.get('entries') or []
        check(len(entries) == 1 and entries[0].get('filename') == res.get('filename'), '台账条目=本次登记的那一条（无重复/无遗漏）')
    finally:
        cleanup(slug)


CASES = {
    'zip-slip': case_zip_slip,
    'oversize': case_oversize,
    'skip-non-whitelist': case_skip_non_whitelist,
    'ledger-integrity': case_ledger_integrity,
}


def main():
    names = sys.argv[1:] or list(CASES.keys())
    for n in names:
        if n not in CASES:
            print(f"未知 case: {n}（可选: {', '.join(CASES)}）")
            sys.exit(2)
        print(f"── {n} ──")
        CASES[n]()
    print(f"\n{PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
