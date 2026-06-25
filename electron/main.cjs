'use strict';
// Electron main process — loads the pre-built cartridge bundle + 主进程 Steam 绑定。
// CJS extension required: package.json has "type":"module" which would break a plain .js.

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const steam = require('./steam.cjs');

// Steam 自检：装了 Steam 客户端的机器上应打印 available:true + 玩家名；
// 远程/CI/没装 Steam → available:false（预期降级，不是错误）。
const steamStatus = steam.init();
console.log('[steam] init →', JSON.stringify(steamStatus));

// ── 渲染进程 IPC：preload 桥的另一端（写操作 fire-and-forget；状态/读统计 sendSync）──
ipcMain.on('steam:status', (e) => { e.returnValue = steam.status(); });
ipcMain.on('steam:getStat', (e, id) => { e.returnValue = steam.getStat(id); });
ipcMain.on('steam:unlockAchievement', (_e, id) => steam.unlockAchievement(id));
ipcMain.on('steam:clearAchievement', (_e, id) => steam.clearAchievement(id));
ipcMain.on('steam:setStat', (_e, id, value) => steam.setStat(id, value));
ipcMain.on('steam:uploadLeaderboard', (_e, boardId, score) => steam.uploadLeaderboard(boardId, score));
ipcMain.on('steam:setRichPresence', (_e, key, value) => steam.setRichPresence(key, value));
ipcMain.on('steam:store', () => steam.store());

// Steam 云存储：异步 IO 用 handle/invoke（返回值回渲染进程）。
ipcMain.handle('steam:cloud:read', (_e, name) => steam.cloudRead(name));
ipcMain.handle('steam:cloud:write', (_e, name, content) => steam.cloudWrite(name, content));
ipcMain.handle('steam:cloud:delete', (_e, name) => steam.cloudDelete(name));
ipcMain.handle('steam:cloud:list', () => steam.cloudList());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#050510',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  win.loadFile(path.join(app.getAppPath(), 'dist-cartridge', 'cartridge.html'));
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
