'use strict';
// preload — 在隔离的渲染进程里经 contextBridge 暴露最小 Steam 桥 window.__APOLLO_STEAM__。
// 渲染进程不直接碰 ipcRenderer/原生模块（contextIsolation:true 安全约束）；只见这层白名单函数。
// 同步状态（available/name/appId）在加载时一次性 sendSync 取回；写操作 fire-and-forget(send)；
// getStat 需返回值 → sendSync。主进程对应 IPC 处理在 main.cjs。

const { contextBridge, ipcRenderer } = require('electron');

const status = (() => {
  try { return ipcRenderer.sendSync('steam:status') || {}; } catch (e) { return {}; }
})();

contextBridge.exposeInMainWorld('__APOLLO_STEAM__', {
  available: !!status.available,
  name: status.name ?? null,
  appId: status.appId ?? 0,
  unlockAchievement: (id) => ipcRenderer.send('steam:unlockAchievement', id),
  clearAchievement: (id) => ipcRenderer.send('steam:clearAchievement', id),
  setStat: (id, value) => ipcRenderer.send('steam:setStat', id, value),
  getStat: (id) => { try { return ipcRenderer.sendSync('steam:getStat', id) || 0; } catch (e) { return 0; } },
  uploadLeaderboard: (boardId, score) => ipcRenderer.send('steam:uploadLeaderboard', boardId, score),
  setRichPresence: (key, value) => ipcRenderer.send('steam:setRichPresence', key, value),
  store: () => ipcRenderer.send('steam:store'),
});
