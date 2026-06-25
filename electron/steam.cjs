'use strict';
// Steam 主进程绑定 — steamworks.js（原生 N-API 模块，只能跑主进程）的防御式封装。
// 设计红线：**任何失败都不崩壳**。无 Steam 客户端 / 未登录 / 模块没装 / SDK 缺失 →
// available=false，所有方法 no-op，游戏经 NullPlatformPort 静默降级（与 web 一致）。
// appId：默认读环境变量 STEAM_APPID，否则 480（SpaceWar 测试位）；owner 拿到真 appid 后替换。
//
// ⚠️ 自检边界：真正「SteamAPI_Init 连上 Steam」需本机装了 Steam 客户端并登录 —— 远程/CI
// 环境无 Steam，init 必然返回 available=false（这是预期，不是 bug）。本文件保证：装了
// Steam 的机器上能 init 成功、读到玩家名、解锁成就；没装的机器上干净降级。

const APP_ID = Number(process.env.STEAM_APPID || '480') || 480;

let client = null;       // steamworks.js init 句柄
let available = false;
let lastError = null;

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
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

function status() {
  return {
    available,
    appId: APP_ID,
    name: available ? safe(() => client.localplayer.getName(), null) : null,
    error: lastError,
  };
}

// ── PlatformPort 镜像（全部防御式；不可用即 no-op / 0）─────────────────────
function unlockAchievement(id) { if (available) safe(() => client.achievement.activate(id)); }
function clearAchievement(id)  { if (available) safe(() => client.achievement.clear(id)); }
function setStat(id, value)    { if (available) safe(() => client.stats && client.stats.setInt(id, value)); }
function getStat(id)           { return available ? safe(() => (client.stats && client.stats.getInt(id)) || 0, 0) : 0; }
function uploadLeaderboard(boardId, score) {
  // steamworks.js 排行榜 API 在不同版本形态不一 → 防御式，真机 P3 再坐实。
  if (available) safe(() => client.leaderboard && client.leaderboard.uploadScore && client.leaderboard.uploadScore(boardId, score));
}
function setRichPresence(key, value) { if (available) safe(() => client.localplayer && client.localplayer.setRichPresence && client.localplayer.setRichPresence(key, value)); }
function store() { if (available) safe(() => client.stats && client.stats.store && client.stats.store()); }

module.exports = {
  APP_ID, init, status,
  unlockAchievement, clearAchievement, setStat, getStat,
  uploadLeaderboard, setRichPresence, store,
};
