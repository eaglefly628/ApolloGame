#!/usr/bin/env python3
"""Apollo Dist Builder — 一键出三个包 (Mac .dmg · Windows .zip · 掌机 .tar.gz)

必须在 Mac 上运行（Windows 交叉编译 + Mac 原生打包）。

Usage:
    python3 scripts/dist.py             # 默认 game-g
    python3 scripts/dist.py game-g      # 指定游戏
"""
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

GAME_IDS = ["game-a", "game-b", "game-c", "game-d", "game-e", "game-f", "game-g", "game-h"]


def run(cmd: list[str] | str, env: dict | None = None, **kwargs) -> None:
    label = cmd if isinstance(cmd, str) else " ".join(cmd)
    print(f"\n  › {label}\n")
    subprocess.run(cmd, cwd=ROOT, check=True, env=env or os.environ.copy(),
                   shell=isinstance(cmd, str), **kwargs)


def step(n: int, total: int, label: str) -> None:
    print(f"\n  ┌─ [{n}/{total}] {label}")


def build_cartridge(game_id: str) -> None:
    """tsc 类型检查 + Vite 打包 → dist-cartridge/"""
    env = os.environ.copy()
    env["VITE_TARGET_GAME"] = game_id
    vite_cmd = ["npx", "vite", "build", "--config", "vite.config.cartridge.ts"]
    if IS_WIN:
        run(f"npx tsc --noEmit && npx vite build --config vite.config.cartridge.ts", env=env)
    else:
        run(["npx", "tsc", "--noEmit"])
        run(vite_cmd, env=env)


def build_desktop(game_id: str) -> None:
    """electron-builder：Mac .dmg + Windows .zip（Mac 上交叉编译 Win 无需 wine）"""
    if IS_WIN:
        run(["npx", "electron-builder", "--win",
             "--config", "electron-builder.yml"])
    else:
        # --mac --win in one call shares the download of Electron binaries
        run(["npx", "electron-builder", "--mac", "--win",
             "--config", "electron-builder.yml"])


def build_handheld(game_id: str) -> None:
    """复用 build_game.py → apollo-{game_id}-rk3562.tar.gz"""
    run([sys.executable, str(ROOT / "scripts" / "build_game.py"), game_id])


def main() -> None:
    game_id = (sys.argv[1].strip().lower() if len(sys.argv) > 1 else "game-g")
    if game_id not in GAME_IDS:
        print(f"  ✗ 未知游戏 '{game_id}'。可选: {', '.join(GAME_IDS)}", file=sys.stderr)
        sys.exit(1)

    print()
    print("  ╔══════════════════════════════════════════════════════════════╗")
    print(f"  ║  Apollo Dist Builder · {game_id:<8}                            ║")
    print("  ║  输出：Mac .dmg · Windows .zip · 掌机 .tar.gz               ║")
    print("  ╚══════════════════════════════════════════════════════════════╝")

    TOTAL = 3
    step(1, TOTAL, f"编译 Cartridge ({game_id})")
    build_cartridge(game_id)

    step(2, TOTAL, "打包桌面版 (Mac .dmg + Windows .zip)")
    build_desktop(game_id)

    step(3, TOTAL, "打包掌机版 (RK3562 .tar.gz)")
    build_handheld(game_id)

    print()
    print("  ╔══════════════════════════════════════════════════════════════╗")
    print("  ║  ✓ 全部完成                                                  ║")
    print("  ╠══════════════════════════════════════════════════════════════╣")
    print(f"  ║  release/               ← Mac .dmg + Windows .zip           ║")
    print(f"  ║  apollo-{game_id}-rk3562.tar.gz  ← 掌机版                  ║")
    print("  ╚══════════════════════════════════════════════════════════════╝")
    print()


if __name__ == "__main__":
    main()
