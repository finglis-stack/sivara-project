const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, state) => callback(state));
  },

  // File system
  readSivaraFile: (filePath) => ipcRenderer.invoke('read-sivara-file', filePath),
  writeSivaraFile: (filePath, data) => ipcRenderer.invoke('write-sivara-file', filePath, data),
  saveSivaraDialog: () => ipcRenderer.invoke('save-sivara-dialog'),
  openSivaraDialog: () => ipcRenderer.invoke('open-sivara-dialog'),

  // .sivara file open event
  onOpenSivaraFile: (callback) => {
    ipcRenderer.on('open-sivara-file', (_event, filePath) => callback(filePath));
  },

  // Account
  getAccount: () => ipcRenderer.invoke('get-account'),
  saveAccount: (data) => ipcRenderer.invoke('save-account', data),
  deleteAccount: () => ipcRenderer.invoke('delete-account'),

  // Sync queue
  getSyncQueue: () => ipcRenderer.invoke('get-sync-queue'),
  addToSyncQueue: (entry) => ipcRenderer.invoke('add-to-sync-queue', entry),
  removeSyncEntry: (id) => ipcRenderer.invoke('remove-sync-entry', id),

  // Connectivity
  checkOnline: () => ipcRenderer.invoke('check-online'),

  // Pending file (from browser to editor page transition)
  getPendingFile: () => ipcRenderer.invoke('get-pending-file'),
  setPendingFile: (filePath) => ipcRenderer.invoke('set-pending-file', filePath),
  clearPendingFile: () => ipcRenderer.invoke('clear-pending-file'),
});
