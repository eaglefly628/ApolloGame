'use strict';
// Electron main process — loads the pre-built cartridge bundle.
// CJS extension required: package.json has "type":"module" which would break a plain .js.

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#050510',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  win.loadFile(path.join(app.getAppPath(), 'dist-cartridge', 'cartridge.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.webContents.openDevTools();
  });
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
