#!/bin/bash
# 双击我：去掉「已损坏 / 未公证」的隔离属性（com.apple.quarantine）并打开 App。
# 仅对本机已安装的 App 生效；不联网、不改系统设置，只动这一个 App。
set -e
cd "$(dirname "$0")"

# 在常见位置找 ZeroCraft 系列 App（应用程序 / 用户应用程序 / 本文件夹旁）。
APP=""
for DIR in "/Applications" "$HOME/Applications" "."; do
  CAND=$(ls -dt "$DIR"/*.app 2>/dev/null | grep -iE 'Fateflip|ZeroCraft|Balatro|Pixel|Kingdoms|Poker' | head -1 || true)
  if [ -n "$CAND" ]; then APP="$CAND"; break; fi
done

if [ -z "$APP" ]; then
  echo "✗ 没找到 App。请先把 dmg 里的 App 拖进「应用程序」文件夹，再双击我。"
  echo "（按回车关闭）"; read _; exit 1
fi

echo "→ 放行并打开：$APP"
xattr -cr "$APP"            # 递归清掉隔离属性
open "$APP" && echo "✓ 已打开。以后正常双击 App 即可。"
echo "（按回车关闭）"; read _
