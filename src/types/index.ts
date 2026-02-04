// Type definitions for Electron IPC

export interface SessionStats {
  activeViewers: number;
  totalViewers: number;
  failedViewers: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface ProxyStats {
  total: number;
  active: number;
  failed: number;
  pending: number;
  currentViewers?: number;
  totalCapacity?: number;
  availableCapacity?: number;
}

export interface Proxy {
  id: number;
  proxy_url: string;
  type: 'http' | 'https' | 'socks5';
  status: 'active' | 'failed' | 'pending';
  fail_count: number;
  success_count: number;
  max_viewers_per_proxy: number;
  current_viewers: number;
}

export interface StatsUpdate {
  session: {
    isRunning: boolean;
    activeViewers: number;
    totalViewers: number;
    failedViewers: number;
    cpuUsage: number;
    memoryUsage: number;
    startTime?: number; // Unix timestamp for uptime calculation
  };
  proxies: ProxyStats & {
    list?: Proxy[]; // Full proxy list for table display
  };
}

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
