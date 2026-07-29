#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  scripts/build-mac-dmg.sh —— 在「你自己的 Mac」上一条命令产出整套平台的 .dmg 安装包。
#  （docs/workflow/platform-packaging-spec.md D5 的本地版：把 mac CI 那几步串成一个脚本。）
#
#  用法（在仓库根目录）：
#      bash scripts/build-mac-dmg.sh
#
#  产物：release/platform/bin/ZeroCraft Engine-<版本>-arm64.dmg
#  完事把这个 .dmg 拷到演讲者 Mac，双击装 → 拖进「应用程序」→ 首次右键「打开」绕 Gatekeeper。
#
#  前提（脚本会自检，不满足会明确报错停下）：
#    · macOS + Apple Silicon（M 系列）—— python 随包与 electron 目标都是 arm64（owner 07-26 拍板）。
#    · 已装 Node 18+（含 npm）。装法：https://nodejs.org 下 LTS 双击，或 `brew install node`。
#    · 能联网（要下 npm 依赖 + Electron 33 二进制 + 可搬迁 python 约 30MB）。
#  首次跑约 10~20 分钟（大头是下载）；之后重跑快很多。
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# —— 定位仓库根（本脚本在 scripts/ 下，根 = 上一级），无论从哪里调用都切过去 ——
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ───────────────────────── 预检 ─────────────────────────
say "预检环境"

[ "$(uname)" = "Darwin" ] || die "这个脚本只能在 macOS 上跑（当前：$(uname)）。.dmg 安装包格式是 mac 独有的，别的系统造不出。"

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
  die "需要 Apple Silicon（M 系列）Mac（当前架构：$ARCH）。随包 python 与 electron 目标都是 arm64；Intel Mac 暂不在本次范围。"
fi
ok "macOS · Apple Silicon (arm64)"

command -v node >/dev/null 2>&1 || die "没找到 node。先装 Node 18+：https://nodejs.org 下 LTS 双击安装，或 brew install node，然后重开终端再跑本脚本。"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node 版本太低（当前 v$(node -p 'process.versions.node')），需要 18+。升级后重跑。"
fi
ok "Node $(node -p 'process.versions.node')"

[ -f package.json ] || die "当前目录不像仓库根（没有 package.json）。请先 cd 进 ApolloGame 仓库目录再跑。"

# ───────────────────────── 步骤 ─────────────────────────
say "1/5 安装 node 依赖（npm ci）"
npm ci
ok "依赖就绪"

say "2/5 组装平台产物（前端 + 后端源码 + 9 游戏白名单 → platform-dist/）"
node scripts/build-platform.mjs
ok "platform-dist/ 组装完成"

say "3/5 灌入可搬迁 Python（下载 standalone python + 装 Pillow → platform-dist/pybundle/）"
node scripts/bundle-python-mac.mjs
ok "随包 python 就绪"

say "4/5 安全红线：扫描产物零 key（任何我们的 key 都不许进包）"
node scripts/assert-no-baked-key.mjs platform-dist
ok "零 key 断言通过"

say "5/5 打包成 .dmg（electron-builder·arm64·未签名）"
npm run pack:platform:mac
ok "electron-builder 完成"

# ───────────────────────── 交付 ─────────────────────────
DMG="$(ls -t release/platform/bin/*.dmg 2>/dev/null | head -1 || true)"
if [ -n "$DMG" ]; then
  say "完成 🎉"
  printf '   安装包：\033[1;33m%s\033[0m\n' "$ROOT/$DMG"
  printf '   大小：%s\n' "$(du -h "$DMG" | cut -f1)"
  echo   '   拷到演讲者 Mac → 双击 .dmg → 把 ZeroCraft Engine 拖进「应用程序」。'
  echo   '   首次启动：右键图标 →「打开」→ 再点一次「打开」（未签名，需绕一次 Gatekeeper，之后正常双击）。'
  echo   '   首启会引导粘贴生图 key（不粘也能跑：平台 UI + 9 游戏离线照玩，只是实时生成灰掉）。'
else
  die "没在 release/platform/bin/ 找到 .dmg —— electron-builder 可能报错了，往上翻它的输出看具体原因。"
fi
