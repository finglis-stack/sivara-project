const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow;
let pendingSivaraFile = null;

// ============================================
// User Data Paths
// ============================================
const userDataPath = app.getPath('userData');
const syncQueuePath = path.join(userDataPath, 'sync-queue.json');
const accountPath = path.join(userDataPath, 'account.json');

// ============================================
// Single Instance Lock
// ============================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const sivaraFile = argv.find((a) => a.endsWith('.sivara'));
    if (sivaraFile && mainWindow) {
      mainWindow.webContents.send('open-sivara-file', sivaraFile);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ============================================
// Check if launched with a .sivara file
// ============================================
function getSivaraFileFromArgs() {
  return process.argv.find((a) => a.endsWith('.sivara')) || null;
}

// ============================================
// Window Creation
// ============================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#FAFAF8',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', 'maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', 'normal');
  });

  // On every page load (browser → editor transition), send pending file
  mainWindow.webContents.on('did-finish-load', () => {
    // Check command-line args first
    if (!pendingSivaraFile) {
      pendingSivaraFile = getSivaraFileFromArgs();
    }
    if (pendingSivaraFile) {
      mainWindow.webContents.send('open-sivara-file', pendingSivaraFile);
      // Don't clear it here — editor might not have loaded yet
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// Window Controls (IPC)
// ============================================
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow.isMaximized();
});

// ============================================
// File System (IPC)
// ============================================
ipcMain.handle('read-sivara-file', async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: new Uint8Array(data), fileName: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-sivara-file', async (_event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-sivara-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le document Sivara',
    defaultPath: 'document.sivara',
    filters: [{ name: 'Sivara Document', extensions: ['sivara'] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('open-sivara-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un document Sivara',
    filters: [{ name: 'Sivara Document', extensions: ['sivara'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ============================================
// Account Management (IPC)
// ============================================
ipcMain.handle('get-account', () => {
  try {
    if (fs.existsSync(accountPath)) {
      const data = JSON.parse(fs.readFileSync(accountPath, 'utf-8'));
      return data;
    }
  } catch (_) {}
  return null;
});

ipcMain.handle('save-account', (_event, accountData) => {
  try {
    fs.writeFileSync(accountPath, JSON.stringify(accountData, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-account', () => {
  try {
    if (fs.existsSync(accountPath)) fs.unlinkSync(accountPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============================================
// Sync Queue (IPC)
// ============================================
function readSyncQueue() {
  try {
    if (fs.existsSync(syncQueuePath)) {
      return JSON.parse(fs.readFileSync(syncQueuePath, 'utf-8'));
    }
  } catch (_) {}
  return [];
}

function writeSyncQueue(queue) {
  fs.writeFileSync(syncQueuePath, JSON.stringify(queue, null, 2));
}

ipcMain.handle('get-sync-queue', () => readSyncQueue());

ipcMain.handle('add-to-sync-queue', (_event, entry) => {
  const queue = readSyncQueue();
  // Avoid duplicates by filePath
  const existing = queue.findIndex((e) => e.filePath === entry.filePath);
  if (existing >= 0) {
    queue[existing] = { ...queue[existing], ...entry, lastModified: new Date().toISOString() };
  } else {
    queue.push({
      id: require('crypto').randomUUID(),
      ...entry,
      lastModified: new Date().toISOString(),
      status: 'pending',
    });
  }
  writeSyncQueue(queue);
  return { success: true };
});

ipcMain.handle('remove-sync-entry', (_event, id) => {
  const queue = readSyncQueue().filter((e) => e.id !== id);
  writeSyncQueue(queue);
  return { success: true };
});

// ============================================
// Connectivity Check (IPC)
// ============================================
ipcMain.handle('check-online', () => {
  return new Promise((resolve) => {
    const req = https.get('https://sivara.ca', { timeout: 5000 }, (res) => {
      resolve(true);
      res.destroy();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
});

// ============================================
// Pending File (IPC)
// ============================================
ipcMain.handle('get-pending-file', () => {
  return pendingSivaraFile;
});

ipcMain.handle('set-pending-file', (_event, filePath) => {
  pendingSivaraFile = filePath;
  return { success: true };
});

ipcMain.handle('clear-pending-file', () => {
  pendingSivaraFile = null;
  return { success: true };
});

