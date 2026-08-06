'use strict';
// ═══════════════════════════════════════════════════════════════
//  scripts/mac-adhoc-sign.cjs —— electron-builder `afterSign` 钩子：**兜底 ad-hoc 自签**。
//
//  治的病（owner 2026-08-05 客户机实测事故）：客户 Mac 上双击报「**已损坏，无法打开**」。
//  真因不是包坏了——**Apple Silicon 要求所有可执行文件必须带签名**（哪怕只是 ad-hoc 自签），
//  未签名的二进制会被系统直接拒绝加载，而系统给出的文案偏偏是"已损坏"，极具误导性
//  （客户第一反应是重新下载，下多少次都一样）。
//
//  为什么单靠 `xattr -cr` 不够：那只清掉「从网络下载」的隔离标记（quarantine），
//  解决的是 Gatekeeper 的**信任**问题；而这里缺的是**签名本身**，是能不能执行的问题。
//  两件事，必须都满足。
//
//  本钩子的行为（幂等·失败不静默）：
//    · 已有有效签名（真 Developer ID 走了 CSC_* 流程）→ **原样不动**，绝不覆盖真签名。
//    · 无签名 / 签名无效 → `codesign --force --deep --sign -` 打 ad-hoc 签名。
//    · 非 mac 目标 → 直接跳过（Linux/Windows 构建不受影响）。
//  ad-hoc 签名**不提供来源可信度**（客户首次仍需「右键→打开」过 Gatekeeper 一次），
//  但它让 app 技术上可执行——这是 arm64 的硬要求，与"是否被信任"是两回事。
// ═══════════════════════════════════════════════════════════════

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/** 该路径是否已带有效签名。`codesign -v` 退出码 0 = 有效。 */
function hasValidSignature(appPath) {
  try {
    execFileSync('codesign', ['--verify', '--no-strict', appPath], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

exports.default = async function macAdhocSign(context) {
  const platformName = context.packager?.platform?.name;
  if (platformName !== 'mac') return; // 只管 mac

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  if (hasValidSignature(appPath)) {
    console.log(`[mac-adhoc-sign] 已有有效签名，保持不动：${appName}`);
    return;
  }

  console.log(`[mac-adhoc-sign] 未检出有效签名 → 打 ad-hoc 自签：${appName}`);
  // --deep：连同内部 Helper/Framework 一起签（Electron 有多个嵌套可执行体，漏签任何一个都仍会被拒）。
  // --force：覆盖可能存在的残缺签名。--sign -：ad-hoc（无证书）。
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });

  if (!hasValidSignature(appPath)) {
    // 签完仍无效 = 真出问题了，**必须让构建红掉**，不能把一个客户打不开的包当成功产物交出去。
    throw new Error(`[mac-adhoc-sign] ad-hoc 签名后校验仍失败：${appPath}——不产出不可运行的包`);
  }
  console.log('[mac-adhoc-sign] ✅ ad-hoc 签名完成并校验通过');
};
