#!/usr/bin/env python3
"""Apollo Cartridge Builder — packages a single game for RK3562 Linux deployment.

Cross-platform (Windows / macOS / Linux). Run from VS Code (F5) or terminal:

    python scripts/build_game.py            # interactive menu
    python scripts/build_game.py game-f     # build one game directly
    python scripts/build_game.py all        # build every game
"""
from __future__ import annotations

import os
import subprocess
import sys
import tarfile
from pathlib import Path

# UTF-8 stdout so box-drawing + 中文 render on Windows terminals too.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
IS_WIN = os.name == "nt"
DIST_DIR = ROOT / "dist-cartridge"
CONFIG = "vite.config.cartridge.ts"

GAMES: list[tuple[str, str]] = [
    ("game-e", "Game E: Balatro-like      · 小丑牌 · 卡牌构建"),
    ("game-f", "Game F: Pixel 3 Kingdoms  · 像素三分天下 · 自走棋"),
    ("game-g", "Game G: Fateflip Poker    · 翻命扑克 · 3D 掷命骨架"),
]
GAME_IDS = [g[0] for g in GAMES]

START_SH = """#!/bin/sh
# Apollo Game Launcher — RK3562 Linux
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
cd "$SCRIPT_DIR"

echo "  Starting Apollo server on port $PORT..."
python3 -m http.server $PORT --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

URL="http://127.0.0.1:$PORT/cartridge.html"

# Try Chromium in kiosk mode (hides all browser chrome)
if command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --kiosk --noerrdialogs --disable-infobars \\
    --no-sandbox --disable-gpu-sandbox "$URL"
elif command -v chromium >/dev/null 2>&1; then
  chromium --kiosk --noerrdialogs --disable-infobars \\
    --no-sandbox --disable-gpu-sandbox "$URL"
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome --kiosk --noerrdialogs --disable-infobars "$URL"
else
  echo "  No Chromium found. Open manually: $URL"
fi

kill $SERVER_PID 2>/dev/null || true
"""


def run_vite_build(game_id: str) -> None:
    """Invoke `npx vite build` with VITE_TARGET_GAME baked in."""
    env = os.environ.copy()
    env["VITE_TARGET_GAME"] = game_id
    env["VITE_SINGLEFILE"] = "1"   # 手街机版 = 单文件：JS/CSS 全内联进自包含 cartridge.html

    args = ["vite", "build", "--config", CONFIG]
    if IS_WIN:
        # cmd.exe resolves npx.cmd; args have no spaces so a joined string is safe.
        subprocess.run("npx " + " ".join(args), cwd=ROOT, env=env, check=True, shell=True)
    else:
        subprocess.run(["npx", *args], cwd=ROOT, env=env, check=True)


def write_start_script() -> None:
    # newline="\n" forces LF even on Windows — this script runs on Linux.
    (DIST_DIR / "start.sh").write_text(START_SH, encoding="utf-8", newline="\n")


def package(game_id: str) -> Path:
    out_pkg = ROOT / f"apollo-{game_id}-rk3562.tar.gz"

    def _exec_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo:
        if ti.name.endswith("start.sh"):
            ti.mode = 0o755  # ensure executable on the device
        return ti

    with tarfile.open(out_pkg, "w:gz") as tar:
        tar.add(DIST_DIR, arcname=".", filter=_exec_filter)
    return out_pkg


def build_one(game_id: str) -> None:
    import shutil

    print(f"\n  ▶ Building {game_id}...\n")
    run_vite_build(game_id)
    write_start_script()

    # 单 HTML 产物：自包含的 cartridge.html → apollo-{game}-rk3562.html
    out_html = ROOT / f"apollo-{game_id}-rk3562.html"
    shutil.copyfile(DIST_DIR / "cartridge.html", out_html)
    html_kb = out_html.stat().st_size / 1024

    # tar.gz 仍产出（单 cartridge.html + start.sh），设备部署不变
    out_pkg = package(game_id)
    pkg_kb = out_pkg.stat().st_size / 1024

    print(f"\n  ✓  {out_html.name}  ({html_kb:.0f} kB)   ← 单 HTML（喂给 cartridge-station）")
    print(f"  ✓  {out_pkg.name}  ({pkg_kb:.0f} kB)   ← 掌机 tar.gz（设备部署）\n")
    print("  Deploy to RK3562:")
    print(f"    scp {out_pkg.name} user@<device>:/home/user/")
    print(
        f"    ssh user@<device> 'mkdir -p apollo && "
        f"tar xzf {out_pkg.name} -C apollo && cd apollo && ./start.sh'\n"
    )


def menu() -> list[str]:
    print()
    print("  ╔══════════════════════════════════════════════╗")
    print("  ║          APOLLO CARTRIDGE BUILDER            ║")
    print("  ║          Target: RK3562 · Linux              ║")
    print("  ╚══════════════════════════════════════════════╝")
    print()
    print("  Select game:\n")
    for i, (_, name) in enumerate(GAMES, start=1):
        print(f"    [{i}]  {name}")
    print()
    print("    [0]  Build ALL games (separate packages)")
    print()

    choice = input("  › ").strip()
    if choice == "0":
        return GAME_IDS
    if choice.isdigit() and 1 <= int(choice) <= len(GAMES):
        return [GAME_IDS[int(choice) - 1]]
    print("  Invalid selection.", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    arg = sys.argv[1].strip().lower() if len(sys.argv) > 1 else None

    if arg == "all":
        targets = GAME_IDS
    elif arg in GAME_IDS:
        targets = [arg]
    elif arg is not None:
        print(f"  Unknown game '{arg}'. Valid: {', '.join(GAME_IDS)}, all", file=sys.stderr)
        sys.exit(1)
    else:
        targets = menu()

    for gid in targets:
        build_one(gid)

    print("  Done.")


if __name__ == "__main__":
    main()
