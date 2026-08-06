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
# ① 清隔离属性（解决 Gatekeeper 的「未公证」拦截）
xattr -cr "$APP"

# ② **补 ad-hoc 自签**（解决 Apple Silicon 的「已损坏」——owner 2026-08-05 客户机实测事故）：
#    M 系列芯片要求所有可执行文件必须带签名，未签名的会被系统直接拒绝加载，
#    而系统给的文案偏偏是"已损坏"，极易被误当成包下载坏了（重下多少次都一样）。
#    只做 ① 不够：那管的是"信不信任"，这管的是"能不能执行"，两件事都得满足。
if ! codesign --verify --no-strict "$APP" >/dev/null 2>&1; then
  echo "→ 未检出有效签名，正在补 ad-hoc 自签（不联网·只动这一个 App）…"
  codesign --force --deep --sign - "$APP" || {
    echo "✗ 自签失败。请把上面整段报错发给我们。"; echo "（按回车关闭）"; read _; exit 1; }
fi

open "$APP" && echo "✓ 已打开。以后正常双击 App 即可。"
echo "（按回车关闭）"; read _
