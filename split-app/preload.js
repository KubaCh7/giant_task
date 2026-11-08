'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('split', {
  getState: () => ipcRenderer.invoke('state:get'),
  update: (patch) => ipcRenderer.invoke('settings:update', patch),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openUpdate: () => ipcRenderer.invoke('update:open'),
  toggle: () => ipcRenderer.invoke('run:toggle'),
  test: () => ipcRenderer.invoke('run:test'),
  pick: () => ipcRenderer.invoke('target:pick'),
  askPermission: () => ipcRenderer.invoke('mac:permission'),
  onState: (fn) => {
    const handler = (_e, s) => fn(s);
    ipcRenderer.on('state', handler);
    return () => ipcRenderer.removeListener('state', handler);
  }
});
