'use strict';
// Steam 主进程绑定 — steamworks.js（原生 N-API 模块，只能跑主进程）的防御式封装。
// 设计红线：**任何失败都不崩壳**。无 Steam 客户端 / 未登录 / 模块没装 / SDK 缺失 →
// available=false，所有方法 no-op，游戏经 NullPlatformPort 静默降级（与 web 一致）。
// appId：默认读环境变量 STEAM_APPID，否则 480（SpaceWar 测试位）；owner 拿到真 appid 后替换。
//
// ⚠️ 自检边界：真正「SteamAPI_Init 连上 Steam」需本机装了 Steam 客户端并登录 —— 远程/CI
// 环境无 Steam，init 必然返回 available=false（这是预期，不是 bug）。本文件保证：装了
// Steam 的机器上能 init 成功、读到玩家名、解锁成就；没装的机器上干净降级。

const fs = require('fs');
const path = require('path');

// AppID 解析：单一真相是与可执行文件同目录的 steam_appid.txt（发布工具 gen-vdf 会把真 AppID
// 写进它，electron-builder 经 extraResources 打进包）。旧实现只读 env/480、完全无视该文件，
// 导致「文件写了真 ID，运行时却 init 到 480(SpaceWar)」的 split-brain。优先级：
//   ① STEAM_APPID 环境变量（显式覆盖·CI/调试用）② steam_appid.txt（打包/开发同目录）③ 480 兜底。
function resolveAppId() {
  const env = Number(process.env.STEAM_APPID);
  if (Number.isFinite(env) && env > 0) return { appId: env, source: 'env STEAM_APPID' };
  // 打包态：resources/../steam_appid.txt；开发态：electron/../steam_appid.txt 或 cwd。
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, '..', 'steam_appid.txt'),
    path.join(__dirname, '..', 'steam_appid.txt'),
    path.join(process.cwd(), 'steam_appid.txt'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const n = Number(String(fs.readFileSync(p, 'utf8')).trim());
      if (Number.isFinite(n) && n > 0) return { appId: n, source: p };
    } catch { /* 试下一个候选 */ }
  }
  return { appId: 480, source: '兜底 480(SpaceWar)' };
}

const { appId: APP_ID, source: APP_ID_SOURCE } = resolveAppId();

let client = null;       // steamworks.js init 句柄
let available = false;
let lastError = null;
const _warned = new Set();

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

// 可观测降级：Steam 已连上（available）但某能力的底层 API 在本 steamworks.js 版本缺失时，
// 打印一次告警。旧实现全靠 safe() 静默吞 —— 真机上「什么都没解锁」却零日志，调试全盲。
function warnMissing(feature, detail) {
  if (_warned.has(feature)) return;
  _warned.add(feature);
  console.warn(`[steam] "${feature}" 不可用（${detail}）—— 已跳过。真机接线请核对 steamworks.js API 版本。`);
}

/** 初始化 Steam。返回 { available, name, appId, error }。重复调用幂等。 */
function init() {
  if (client) return status();
  let steamworks;
  try {
    steamworks = require('steamworks.js');     // optionalDependency：没装/没编译就走 catch
  } catch (e) {
    lastError = 'steamworks.js 未安装/未编译: ' + (e && e.message || e);
    available = false;
    return status();
  }
  try {
    client = steamworks.init(APP_ID);
    available = true;
    lastError = null;
    // 在 Electron 渲染窗口启用 Steam Overlay（steamworks.js 提供；老版本可能无此方法）。
    safe(() => steamworks.electronEnableSteamOverlay && steamworks.electronEnableSteamOverlay(), undefined);
  } catch (e) {
    client = null;
    available = false;
    lastError = 'SteamAPI_Init 失败（未开 Steam / 未登录 / appId 无效）: ' + (e && e.message || e);
  }
  return status();
}

function cloudAvailable() { return available && !!(client && client.cloud); }

function status() {
  return {
    available,
    cloudAvailable: cloudAvailable(),
    appId: APP_ID,
    appIdSource: APP_ID_SOURCE,   // 自检：确认 init 连的是真 App 而非兜底 480
    name: available ? safe(() => client.localplayer.getName(), null) : null,
    error: lastError,
  };
}

// ── Steam Cloud（Remote Storage）·防御式（API 形态各版本略异，真机 P2 验收坐实）──
function cloudRead(name)   { return cloudAvailable() ? safe(() => client.cloud.readFile(name), null) : null; }
function cloudWrite(name, content) { return cloudAvailable() ? !!safe(() => { client.cloud.writeFile(name, content); return true; }, false) : false; }
function cloudDelete(name) { return cloudAvailable() ? !!safe(() => client.cloud.deleteFile(name), false) : false; }
function cloudList() {
  if (!cloudAvailable()) return [];
  // steamworks.js client.cloud.listFiles() 返回 FileInfo{name,size}[]，但桥契约（渲染侧
  // SteamCloudBridge / SteamCloudStoragePort）要的是 string[]。旧实现直接透传对象数组 →
  // 真机上索引重建时对对象调 f.startsWith 抛错。这里取 name 归一化（兼容未来返回 string）。
  return safe(() => {
    const files = client.cloud.listFiles ? client.cloud.listFiles() : [];
    return files.map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
  }, []);
}

// ── PlatformPort 镜像（防御式；API 缺失即 warnMissing 一次，不再静默吞）──────────
function unlockAchievement(id) { if (available) safe(() => client.achievement.activate(id)); }
function clearAchievement(id)  { if (available) safe(() => client.achievement.clear(id)); }
function setStat(id, value) {
  if (!available) return;
  if (client.stats && typeof client.stats.setInt === 'function') safe(() => client.stats.setInt(id, value));
  else warnMissing('stats.setInt', '本 steamworks.js 版本无 stats.setInt');
}
function getStat(id) {
  if (!available) return 0;
  if (client.stats && typeof client.stats.getInt === 'function') return safe(() => client.stats.getInt(id) || 0, 0);
  warnMissing('stats.getInt', '本 steamworks.js 版本无 stats.getInt');
  return 0;
}
function uploadLeaderboard(boardId, score) {
  // ⚠️ steamworks.js（0.4.x）不提供 leaderboard 命名空间 —— client.leaderboard 恒为 undefined。
  // 旧代码靠 safe() 静默吞 → 排行榜「代码绿但真机永不上传且零报错」。改为可观测降级：将来换的
  // 绑定若提供该 API 就走它，否则明确告警。排行榜要真上线需另接 Steamworks Web API。
  if (!available) return;
  const lb = client.leaderboard;
  if (lb && typeof lb.uploadScore === 'function') { safe(() => lb.uploadScore(boardId, score)); return; }
  warnMissing('leaderboard.uploadScore', 'steamworks.js 未提供 leaderboard 命名空间');
}
function setRichPresence(key, value) {
  if (!available) return;
  const lp = client.localplayer;
  if (lp && typeof lp.setRichPresence === 'function') safe(() => lp.setRichPresence(key, value));
  else warnMissing('localplayer.setRichPresence', '本 steamworks.js 版本无 setRichPresence');
}
function store() {
  if (!available) return;
  if (client.stats && typeof client.stats.store === 'function') safe(() => client.stats.store());
  else warnMissing('stats.store', '本 steamworks.js 版本无 stats.store');
}

module.exports = {
  APP_ID, init, status,
  unlockAchievement, clearAchievement, setStat, getStat,
  uploadLeaderboard, setRichPresence, store,
  cloudAvailable, cloudRead, cloudWrite, cloudDelete, cloudList,
};
