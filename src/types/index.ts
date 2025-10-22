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
}

export interface Proxy {
  id: number;
  proxy_url: string;
  type: 'http' | 'https' | 'socks5';
  status: 'active' | 'failed' | 'pending';
  fail_count: number;
  success_count: number;
}

export interface StatsUpdate {
  session: {
    isRunning: boolean;
    activeViewers: number;
    totalViewers: number;
    failedViewers: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  proxies: ProxyStats;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
