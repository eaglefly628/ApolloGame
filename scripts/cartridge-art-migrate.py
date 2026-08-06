#!/usr/bin/env python3
"""卡带美术存量迁移（REQ-CARTART·owner 2026-08-06 令方案 b）。

把创作台卡带的美术从引擎仓跟踪区 `public/games/<slug>/art/` 挪进卡带自己那一屋
`library/<slug>/art/`——玩法与美术从此同处一室、同一个卡带私有 git 仓版本化，不再被
mainbranch 推挤出冲突。URL 契约 `/games/<slug>/art/**` 不变（伺服层回退已就位），
台账/索引里的 servedPath **一字不用改**。

**默认只体检不动手**（dry-run）；`--apply` 才真搬。幂等：搬过的再跑=无事可做。
只认「`library/<slug>/` 存在」的 slug = 卡带；内置游戏一律不碰。

搬完若发现这些文件曾被引擎仓跟踪，**不替你提交**——只 `git rm -r --cached` 取消跟踪并
留在暂存区 + 打印提示，由你自己看过 `git status` 再决定怎么提交（共享工作树纪律：
绝不代人提交·2026-08-03 误提交事故律）。

用法：
  python3 scripts/cartridge-art-migrate.py            # 体检：列出待迁移的卡带与文件数
  python3 scripts/cartridge-art-migrate.py --apply    # 真搬
  python3 scripts/cartridge-art-migrate.py --apply <slug> [<slug>…]   # 只搬指定卡带
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY_DIR = ROOT / 'library'
PUBLIC_GAMES = ROOT / 'public' / 'games'


def _tracked(rel_paths: list) -> list:
    """这些仓库相对路径里，哪些是引擎仓当前跟踪的（未跟踪的搬走即可·跟踪的要取消跟踪）。"""
    if not rel_paths:
        return []
    try:
        r = subprocess.run(['git', 'ls-files', '--', *rel_paths], cwd=str(ROOT),
                           capture_output=True, text=True, timeout=60)
    except Exception:
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()]


def cartridges(only: list) -> list:
    """有待迁移美术的卡带：library/<slug>/ 存在 且 public/games/<slug>/art/ 还有文件。"""
    if not LIBRARY_DIR.is_dir():
        return []
    out = []
    for d in sorted(LIBRARY_DIR.iterdir()):
        if not d.is_dir() or (only and d.name not in only):
            continue
        src = PUBLIC_GAMES / d.name / 'art'
        if src.is_dir() and any(p.is_file() for p in src.rglob('*')):
            out.append(d.name)
    return out


def migrate(slug: str, apply: bool) -> dict:
    src = PUBLIC_GAMES / slug / 'art'
    dst = LIBRARY_DIR / slug / 'art'
    files = sorted(p for p in src.rglob('*') if p.is_file())
    rels = [p.relative_to(ROOT).as_posix() for p in files]
    tracked = _tracked(rels)
    moved, skipped = [], []
    if apply:
        for p in files:
            rel = p.relative_to(src)
            target = dst / rel
            if target.exists():  # 目的地已有同名（上次搬了一半/手动放过）→ 不覆盖·留给人判断
                skipped.append(rel.as_posix())
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(target))
            moved.append(rel.as_posix())
        if tracked:  # 取消跟踪（**不提交**·留暂存区给 owner 自己过目）
            subprocess.run(['git', 'rm', '-r', '--cached', '-q', '--ignore-unmatch', *tracked],
                           cwd=str(ROOT), capture_output=True, text=True, timeout=60)
        for d in sorted((p for p in src.rglob('*') if p.is_dir()), reverse=True):
            try:
                d.rmdir()  # 只删空目录（非空说明还有没搬的·留着）
            except OSError:
                pass
        try:
            src.rmdir()
        except OSError:
            pass
    return {'slug': slug, 'files': len(files), 'tracked': len(tracked), 'moved': moved, 'skipped': skipped}


def main() -> int:
    args = [a for a in sys.argv[1:]]
    apply = '--apply' in args
    only = [a for a in args if not a.startswith('--')]
    targets = cartridges(only)
    if not targets:
        print('卡带美术迁移：无待迁移项（library/ 下没有卡带，或其美术已在卡带屋内）——幂等空跑。')
        return 0
    print(f"{'【真搬】' if apply else '【体检·加 --apply 才真搬】'} 待迁移卡带 {len(targets)} 个：")
    total_tracked = 0
    for slug in targets:
        r = migrate(slug, apply)
        total_tracked += r['tracked']
        note = f"  · {slug}: {r['files']} 个文件"
        if r['tracked']:
            note += f"（其中 {r['tracked']} 个当前被引擎仓跟踪）"
        if apply:
            note += f" → 已搬 {len(r['moved'])}"
            if r['skipped']:
                note += f"·跳过 {len(r['skipped'])}（目的地已存在同名·未覆盖）"
        print(note)
    print(f"  目的地：library/<slug>/art/  ·  URL 契约 /games/<slug>/art/** 不变（伺服层已回退）")
    if apply and total_tracked:
        print('\n⚠ 已 `git rm --cached` 取消跟踪，改动**留在暂存区未提交**——')
        print('  请自己 `git status` 过目后再决定提交（本脚本绝不代你提交）。')
    if not apply:
        print('\n体检完毕，未动任何文件。加 --apply 执行。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
