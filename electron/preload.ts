import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Session management
  startSession: (url: string, viewerCount: number) =>
    ipcRenderer.invoke('start-session', url, viewerCount),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  forceStopSession: () => ipcRenderer.invoke('force-stop-session'), // NEW: Force stop
  getSessionStatus: () => ipcRenderer.invoke('get-session-status'),

  // Proxy management
  addProxies: (proxies: string[]) => ipcRenderer.invoke('add-proxies', proxies),
  getProxies: () => ipcRenderer.invoke('get-proxies'),
  removeProxy: (proxyId: number) => ipcRenderer.invoke('remove-proxy', proxyId),

  // Logs
  onLog: (callback: (log: any) => void) => {
    ipcRenderer.on('log', (_event: any, log: any) => callback(log));
  },

  // Stats updates
  onStatsUpdate: (callback: (stats: any) => void) => {
    ipcRenderer.on('stats-update', (_event: any, stats: any) => callback(stats));
  },
});

// Type definitions for window.electron
export interface ElectronAPI {
  startSession: (url: string, viewerCount: number) => Promise<void>;
  stopSession: () => Promise<void>;
  forceStopSession: () => Promise<void>; // NEW: Force stop
  getSessionStatus: () => Promise<any>;
  addProxies: (proxies: string[]) => Promise<void>;
  getProxies: () => Promise<any[]>;
  removeProxy: (proxyId: number) => Promise<void>;
  onLog: (callback: (log: any) => void) => void;
  onStatsUpdate: (callback: (stats: any) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
