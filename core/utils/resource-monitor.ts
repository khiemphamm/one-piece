import os from 'os';

export interface ResourceStats {
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activeSessions: number;
}

export class ResourceMonitor {
  private previousCpuInfo: os.CpuInfo[] | null = null;

  /**
   * Get SYSTEM-WIDE CPU usage (includes all Chrome processes!)
   * This is what user sees in Task Manager
   */
  getCPUUsage(): number {
    const cpus = os.cpus();

    if (!this.previousCpuInfo) {
      // First call - initialize
      this.previousCpuInfo = cpus;
      return 0;
    }

    // Calculate total CPU time difference
    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const prevCpu = this.previousCpuInfo[i];

      // Current times
      const idle = cpu.times.idle;
      const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;

      // Previous times
      const prevIdle = prevCpu.times.idle;
      const prevTotal = prevCpu.times.user + prevCpu.times.nice + prevCpu.times.sys + prevCpu.times.irq + prevCpu.times.idle;

      // Differences
      totalIdle += idle - prevIdle;
      totalTick += total - prevTotal;
    }

    // Calculate percentage
    const usage = 100 - (100 * totalIdle / totalTick);

    // Update for next call
    this.previousCpuInfo = cpus;

    return Math.min(100, Math.max(0, usage));
  }

  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
      usedMB: Math.round(usedMemory / 1024 / 1024),
      totalMB: Math.round(totalMemory / 1024 / 1024),
    };
  }

  getStats(activeSessions: number): ResourceStats {
    return {
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      activeSessions,
    };
  }

  reset() {
    // Reset CPU monitoring baseline
    this.previousCpuInfo = os.cpus();
  }
}
