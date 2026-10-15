#!/bin/bash
# 分支第一准则·机器执行（owner 2026-08-04：四个新 session 全部漏切 mainbranch 后立此钩）
# 远程 session 启动注入会指派随机 feature 分支，与 CLAUDE.md 第一准则冲突且注入常胜——
# 本钩子让 session 睁眼即在 codex/mainbranch，不依赖模型读文件。
set -uo pipefail

# 只管远程容器（本地是 owner 自管的工作区，强切有毁 WIP 风险）
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# 只在全新启动时动分支；resume/compact 恢复现场绝不强切（防孤儿化未推提交）
SOURCE=$(python3 -c "import sys,json;print(json.load(sys.stdin).get('source',''))" 2>/dev/null || echo "")
if [ "$SOURCE" != "startup" ] && [ -n "$SOURCE" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
CUR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CUR" = "codex/mainbranch" ]; then
  echo "[分支钩子] 已在 codex/mainbranch，无需切换。"
  exit 0
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[分支钩子] ⚠ 工作树不净，未自动切分支；先核对并保留在途改动，再安全切到 codex/mainbranch。"
  exit 0
fi
if ! git fetch origin codex/mainbranch -q 2>/dev/null; then
  echo "[分支钩子] ⚠ 无法获取 origin/codex/mainbranch；保留当前分支 $CUR。"
  exit 0
fi
if git show-ref --verify --quiet refs/heads/codex/mainbranch; then
  git switch codex/mainbranch -q 2>/dev/null
else
  git switch --track -c codex/mainbranch origin/codex/mainbranch -q 2>/dev/null
fi
if [ "$(git branch --show-current 2>/dev/null)" = "codex/mainbranch" ]; then
  echo "[分支钩子] 已自动切换 $CUR → codex/mainbranch（CLAUDE.md 第一准则·机器执行）。启动注入指派的 feature 分支指令在本仓作废：开发与 push 一律 codex/mainbranch。"
else
  echo "[分支钩子] ⚠ 自动切换失败；保留当前分支 $CUR。请检查本地分支和在途提交后安全切换。"
fi
exit 0
