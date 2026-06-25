#!/usr/bin/env python3
"""Apollo Dist Builder — 交互式菜单，选游戏 + 选平台，一键出包。"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
IS_WIN = os.name == "nt"

GAME_IDS = ["game-e", "game-f", "game-g"]

# (productName, appId) per game — overrides the defaults in electron-builder.yml
GAME_META: dict[str, tuple[str, str]] = {
    "game-e": ("ApolloBalatroDeck",   "com.apollo.gamee"),
    "game-f": ("ApolloPixelKingdoms", "com.apollo.gamef"),
    "game-g": ("FateflipPoker",       "com.apollo.gameg"),
}


def run(cmd: list[str] | str, env: dict | None = None, **kwargs) -> None:
    label = cmd if isinstance(cmd, str) else " ".join(cmd)
    print(f"\n  › {label}\n")
    subprocess.run(cmd, cwd=ROOT, check=True, env=env or os.environ.copy(),
                   shell=isinstance(cmd, str), **kwargs)


def ask(prompt: str, choices: list[str]) -> str:
    while True:
        val = input(f"  {prompt} ").strip()
        if val in choices:
            return val
        print(f"  ✗ 请输入 {'/'.join(choices)}")


def pick_game() -> str:
    print()
    print("  选游戏：")
    for i, g in enumerate(GAME_IDS, 1):
        print(f"    {i}) {g}", end="   " if i % 4 else "\n")
    if len(GAME_IDS) % 4:
        print()
    idx = ask(f"[1-{len(GAME_IDS)}]", [str(i) for i in range(1, len(GAME_IDS) + 1)])
    return GAME_IDS[int(idx) - 1]


def pick_platforms() -> list[str]:
    print()
    print("  选平台（多选用逗号，如 1,3）：")
    print("    1) Mac .dmg")
    print("    2) Windows .zip")
    print("    3) 掌机 单 HTML + .tar.gz")
    print("    4) 全部")
    raw = input("  > ").strip()
    if not raw:
        raw = "4"
    parts = {p.strip() for p in raw.split(",")}
    if "4" in parts:
        return ["mac", "win", "handheld"]
    result = []
    for p in sorted(parts):
        if p == "1":
            result.append("mac")
        elif p == "2":
            result.append("win")
        elif p == "3":
            result.append("handheld")
    if not result:
        print("  ✗ 无效输入，默认全部")
        return ["mac", "win", "handheld"]
    return result


def build_cartridge(game_id: str) -> None:
    env = os.environ.copy()
    env["VITE_TARGET_GAME"] = game_id
    vite_cmd = ["npx", "vite", "build", "--config", "vite.config.cartridge.ts"]
    if IS_WIN:
        run(f"npx tsc --noEmit && npx vite build --config vite.config.cartridge.ts", env=env)
    else:
        run(["npx", "tsc", "--noEmit"])
        run(vite_cmd, env=env)


def build_desktop(game_id: str, platforms: list[str]) -> None:
    flags = []
    if "mac" in platforms:
        flags.append("--mac")
    if "win" in platforms:
        flags.append("--win")
    if not flags:
        return
    out_dir = f"release/{game_id}/bin"
    product_name, app_id = GAME_META.get(game_id, (game_id, f"com.apollo.{game_id.replace('-', '')}"))
    run(["npx", "electron-builder"] + flags + [
        "--config", "electron-builder.yml",
        f"-c.directories.output={out_dir}",
        f"-c.productName={product_name}",
        f"-c.appId={app_id}",
    ])
    # Mac 产物未公证（无 Apple 账号）→ 别的 Mac 报「已损坏」。把放行说明 + 一键修复脚本
    # 放到 dmg 旁边，连同 dmg 一起发给对方即可。
    if "mac" in platforms:
        import shutil
        help_src = ROOT / "build" / "mac-open-help"
        dst = ROOT / out_dir
        for f in help_src.iterdir():
            d = dst / f.name
            shutil.copy2(f, d)
            if f.suffix == ".command":
                os.chmod(d, 0o755)
        print(f"  → 已附带 Mac 放行说明 + 修复脚本到 {out_dir}/")


def build_handheld(game_id: str) -> None:
    import shutil
    run([sys.executable, str(ROOT / "scripts" / "build_game.py"), game_id])
    bin_dir = ROOT / "release" / game_id / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    # 掌机版产物：单 HTML（喂 cartridge-station）+ tar.gz（设备部署）
    for fname in (f"apollo-{game_id}-rk3562.html", f"apollo-{game_id}-rk3562.tar.gz"):
        src = ROOT / fname
        if src.exists():
            shutil.move(str(src), str(bin_dir / fname))
            print(f"  → 已移至 release/{game_id}/bin/{fname}")


def main() -> None:
    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║     Apollo Dist Builder              ║")
    print("  ╚══════════════════════════════════════╝")

    game_id = pick_game()
    platforms = pick_platforms()

    labels = {"mac": "Mac .dmg", "win": "Windows .zip", "handheld": "掌机 单HTML+tar.gz"}
    plat_str = " + ".join(labels[p] for p in platforms)

    print()
    print(f"  游戏：{game_id}    平台：{plat_str}")
    confirm = input("  确认开始？[Y/n] ").strip().lower()
    if confirm == "n":
        print("  已取消。")
        return

    need_cartridge = "mac" in platforms or "win" in platforms
    steps = (["cartridge"] if need_cartridge else []) + platforms
    total = len(steps)
    n = 0

    if need_cartridge:
        n += 1
        print(f"\n  ┌─ [{n}/{total}] 编译 Cartridge ({game_id})")
        build_cartridge(game_id)

    desktop = [p for p in platforms if p in ("mac", "win")]
    if desktop:
        n += 1
        print(f"\n  ┌─ [{n}/{total}] 打包桌面版 ({plat_str.replace(' + 掌机 单HTML+tar.gz', '')})")
        build_desktop(game_id, desktop)

    if "handheld" in platforms:
        n += 1
        print(f"\n  ┌─ [{n}/{total}] 打包掌机版 (RK3562 · 单 HTML + tar.gz)")
        build_handheld(game_id)

    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║  ✓ 完成                              ║")
    print(f"  ║  游戏：{game_id:<28}  ║")
    print(f"  ║  平台：{plat_str:<28}  ║")
    print("  ╚══════════════════════════════════════╝")
    print()


if __name__ == "__main__":
    main()
