import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Session management
  startSession: (url: string, viewerCount: number, platform?: 'youtube' | 'tiktok') =>
    ipcRenderer.invoke('start-session', url, viewerCount, platform),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  forceStopSession: () => ipcRenderer.invoke('force-stop-session'), // NEW: Force stop
  getSessionStatus: () => ipcRenderer.invoke('get-session-status'),

  // Proxy management
  addProxies: (proxies: string[]) => ipcRenderer.invoke('add-proxies', proxies),
  getProxies: () => ipcRenderer.invoke('get-proxies'),
  removeProxy: (proxyId: number) => ipcRenderer.invoke('remove-proxy', proxyId),

  // Chrome path management
  getChromePath: () => ipcRenderer.invoke('get-chrome-path'),
  setChromePath: (mode: 'auto' | 'manual', customPath?: string) =>
    ipcRenderer.invoke('set-chrome-path', mode, customPath),
  browseChromePath: () => ipcRenderer.invoke('browse-chrome-path'),
  validateChromePath: (path: string) => ipcRenderer.invoke('validate-chrome-path', path),

  // Logs
  onLog: (callback: (log: any) => void) => {
    ipcRenderer.on('log', (_event: any, log: any) => callback(log));
  },

  // Stats updates
  onStatsUpdate: (callback: (stats: any) => void) => {
    ipcRenderer.on('stats-update', (_event: any, stats: any) => callback(stats));
  },

  // Auto-update
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-available', (_event: any, info: UpdateInfo) => callback(info));
  },
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-not-available', (_event: any, info: UpdateInfo) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-downloaded', (_event: any, info: UpdateInfo) => callback(info));
  },
  onUpdateError: (callback: (error: UpdateError) => void) => {
    ipcRenderer.on('update-error', (_event: any, error: UpdateError) => callback(error));
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});

// Type definitions for window.electron
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UpdateInfo {
  version?: string;
  releaseName?: string;
  releaseNotes?: unknown;
  releaseDate?: string;
}

export interface UpdateError {
  message: string;
}

export interface ChromePathConfig {
  mode: 'auto' | 'manual';
  customPath?: string;
}

export interface DetectedChromePath {
  path: string;
  source: string;
}

export interface ChromePathData {
  config: ChromePathConfig;
  detectedPaths: DetectedChromePath[];
  currentPath: string | null;
}

export interface BrowsePathResult {
  canceled: boolean;
  path?: string;
}

export interface ElectronAPI {
  startSession: (
    url: string,
    viewerCount: number,
    platform?: 'youtube' | 'tiktok'
  ) => Promise<IPCResponse>;
  stopSession: () => Promise<IPCResponse>;
  forceStopSession: () => Promise<IPCResponse>;
  getSessionStatus: () => Promise<IPCResponse>;
  addProxies: (proxies: string[]) => Promise<IPCResponse>;
  getProxies: () => Promise<IPCResponse>;
  removeProxy: (proxyId: number) => Promise<IPCResponse>;
  
  // Chrome path management
  getChromePath: () => Promise<IPCResponse<ChromePathData>>;
  setChromePath: (mode: 'auto' | 'manual', customPath?: string) => Promise<IPCResponse<{ config: ChromePathConfig; currentPath: string | null }>>;
  browseChromePath: () => Promise<IPCResponse<BrowsePathResult>>;
  validateChromePath: (path: string) => Promise<IPCResponse<{ valid: boolean; error?: string }>>;

  onLog: (callback: (log: any) => void) => void;
  onStatsUpdate: (callback: (stats: any) => void) => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onUpdateError: (callback: (error: UpdateError) => void) => void;
  installUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<IPCResponse<{ updateInfo?: UpdateInfo }>>;
  getAppVersion: () => Promise<IPCResponse<{ version: string }>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
