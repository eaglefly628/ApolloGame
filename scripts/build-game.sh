#!/usr/bin/env bash
# ZeroCraft Game Builder — packages a single game for RK3562 Linux deployment
set -euo pipefail
cd "$(dirname "$0")/.."

GAME_IDS=(game-e game-g game-i game-z)
GAME_NAMES=(
  "Game E: Balatro-like      · 小丑牌 · 卡牌构建"
  "Game G: Fateflip Poker    · 翻命扑克"
  "Game I: UI Gallery        · 控件测试场"
  "Game Z: Diorama           · 盒庭 · 3D渲染线"
)

# ── Menu ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║         ZEROCRAFT CARTRIDGE BUILDER             ║"
echo "  ║         Target: RK3562 · Linux               ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo "  Select game:"
echo ""
for i in "${!GAME_IDS[@]}"; do
  printf "    [%d]  %s\n" "$((i+1))" "${GAME_NAMES[$i]}"
done
echo ""
echo "    [0]  Build ALL games (separate packages)"
echo ""
read -r -p "  › " choice

# ── Validate ──────────────────────────────────────────────────────────────────
if [[ "$choice" == "0" ]]; then
  targets=("${GAME_IDS[@]}")
else
  idx=$(( choice - 1 ))
  if [[ $idx -lt 0 || $idx -ge ${#GAME_IDS[@]} ]]; then
    echo "  Invalid selection." >&2
    exit 1
  fi
  targets=("${GAME_IDS[$idx]}")
fi

# ── Build function ─────────────────────────────────────────────────────────────
build_game() {
  local game_id="$1"
  local out_pkg="apollo-${game_id}-rk3562.tar.gz"

  echo ""
  echo "  ▶ Building ${game_id}..."
  echo ""

  VITE_TARGET_GAME="$game_id" npx vite build --config vite.config.cartridge.ts

  # Start script for RK3562
  cat > dist-cartridge/start.sh << 'STARTSCRIPT'
#!/bin/sh
# ZeroCraft Game Launcher — RK3562 Linux
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
cd "$SCRIPT_DIR"

echo "  Starting ZeroCraft server on port $PORT..."
python3 -m http.server $PORT --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

URL="http://127.0.0.1:$PORT/cartridge.html"

# Try Chromium in kiosk mode (hides all browser chrome)
if command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --kiosk --noerrdialogs --disable-infobars \
    --no-sandbox --disable-gpu-sandbox "$URL"
elif command -v chromium >/dev/null 2>&1; then
  chromium --kiosk --noerrdialogs --disable-infobars \
    --no-sandbox --disable-gpu-sandbox "$URL"
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome --kiosk --noerrdialogs --disable-infobars "$URL"
else
  echo "  No Chromium found. Open manually: $URL"
fi

kill $SERVER_PID 2>/dev/null || true
STARTSCRIPT

  chmod +x dist-cartridge/start.sh

  # Package
  tar -czf "$out_pkg" -C dist-cartridge .
  local size
  size=$(du -sh "$out_pkg" | cut -f1)

  echo ""
  echo "  ✓  ${out_pkg}  (${size})"
  echo ""
  echo "  Deploy:"
  echo "    scp ${out_pkg} user@<device>:/home/user/"
  echo "    ssh user@<device> 'mkdir -p apollo && tar xzf ${out_pkg} -C apollo && cd apollo && ./start.sh'"
  echo ""
}

# ── Run ───────────────────────────────────────────────────────────────────────
for gid in "${targets[@]}"; do
  build_game "$gid"
done

echo "  Done."
