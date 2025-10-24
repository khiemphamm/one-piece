import db from '../database/db';
import logger from '../utils/logger';

export interface Proxy {
  id?: number;
  proxy_url: string;
  type: 'http' | 'https' | 'socks5';
  status: 'active' | 'failed' | 'pending';
  last_checked?: Date;
  fail_count: number;
  success_count: number;
  max_viewers_per_proxy: number;
  current_viewers: number;
}

export class ProxyManager {
  private readonly MAX_FAIL_COUNT = 3;

  /**
   * Add new proxies to the database
   */
  addProxies(proxyUrls: string[], maxViewersPerProxy: number = 5): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO proxies (proxy_url, type, status, fail_count, success_count, max_viewers_per_proxy, current_viewers)
      VALUES (?, ?, 'pending', 0, 0, ?, 0)
    `);

    const insertMany = db.transaction((proxies: Array<{ url: string; type: string; maxViewers: number }>) => {
      for (const proxy of proxies) {
        stmt.run(proxy.url, proxy.type, proxy.maxViewers);
      }
    });

    const parsedProxies = proxyUrls.map(url => ({
      url,
      type: this.detectProxyType(url),
      maxViewers: maxViewersPerProxy,
    }));

    insertMany(parsedProxies);
    logger.info(`Added ${proxyUrls.length} proxies to database with max ${maxViewersPerProxy} viewers per proxy`);
  }

  /**
   * Get an available proxy
   */
  getAvailableProxy(): Proxy | null {
    const proxy = db.prepare(`
      SELECT * FROM proxies 
      WHERE status = 'active' OR status = 'pending'
      ORDER BY fail_count ASC, success_count DESC
      LIMIT 1
    `).get() as Proxy | undefined;

    return proxy || null;
  }

  /**
   * Get an available proxy with capacity for viewers (NEW FEATURE)
   * Returns a proxy that hasn't reached its max_viewers_per_proxy limit
   */
  getAvailableProxyWithCapacity(): Proxy | null {
    const proxy = db.prepare(`
      SELECT * FROM proxies 
      WHERE (status = 'active' OR status = 'pending')
        AND current_viewers < max_viewers_per_proxy
      ORDER BY 
        current_viewers ASC,
        fail_count ASC, 
        success_count DESC
      LIMIT 1
    `).get() as Proxy | undefined;

    return proxy || null;
  }

  /**
   * Allocate a viewer slot to a proxy (NEW FEATURE)
   * Increments current_viewers count
   */
  allocateViewerToProxy(proxyId: number): boolean {
    try {
      const result = db.prepare(`
        UPDATE proxies 
        SET current_viewers = current_viewers + 1
        WHERE id = ? AND current_viewers < max_viewers_per_proxy
      `).run(proxyId);

      if (result.changes > 0) {
        logger.debug(`Allocated viewer slot to proxy ${proxyId}`);
        return true;
      } else {
        logger.warn(`Failed to allocate viewer slot to proxy ${proxyId} - capacity reached`);
        return false;
      }
    } catch (error) {
      logger.error(`Error allocating viewer to proxy ${proxyId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Release a viewer slot from a proxy (NEW FEATURE)
   * Decrements current_viewers count
   */
  releaseViewerFromProxy(proxyId: number): void {
    try {
      db.prepare(`
        UPDATE proxies 
        SET current_viewers = CASE 
          WHEN current_viewers > 0 THEN current_viewers - 1 
          ELSE 0 
        END
        WHERE id = ?
      `).run(proxyId);

      logger.debug(`Released viewer slot from proxy ${proxyId}`);
    } catch (error) {
      logger.error(`Error releasing viewer from proxy ${proxyId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all proxies
   */
  getAllProxies(): Proxy[] {
    return db.prepare('SELECT * FROM proxies ORDER BY status, fail_count ASC').all() as Proxy[];
  }

  /**
   * Mark proxy as successful
   */
  markProxySuccess(proxyId: number): void {
    db.prepare(`
      UPDATE proxies 
      SET status = 'active', 
          success_count = success_count + 1,
          last_checked = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(proxyId);
  }

  /**
   * Mark proxy as failed
   */
  markProxyFailed(proxyId: number): void {
    const proxy = db.prepare('SELECT fail_count FROM proxies WHERE id = ?').get(proxyId) as Proxy;
    
    const newFailCount = (proxy?.fail_count || 0) + 1;
    const newStatus = newFailCount >= this.MAX_FAIL_COUNT ? 'failed' : 'active';

    db.prepare(`
      UPDATE proxies 
      SET fail_count = ?,
          status = ?,
          last_checked = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newFailCount, newStatus, proxyId);

    if (newStatus === 'failed') {
      logger.warn(`Proxy ${proxyId} marked as failed after ${newFailCount} attempts`);
    }
  }

  /**
   * Remove a proxy
   */
  removeProxy(proxyId: number): void {
    db.prepare('DELETE FROM proxies WHERE id = ?').run(proxyId);
    logger.info(`Removed proxy ${proxyId}`);
  }

  /**
   * Reset proxy fail counts
   */
  resetProxyStats(): void {
    db.prepare(`
      UPDATE proxies 
      SET fail_count = 0, 
          success_count = 0,
          current_viewers = 0,
          status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END
    `).run();
    logger.info('Reset all proxy statistics');
  }

  /**
   * Update max viewers per proxy for a specific proxy (NEW FEATURE)
   */
  updateMaxViewersPerProxy(proxyId: number, maxViewers: number): void {
    db.prepare(`
      UPDATE proxies 
      SET max_viewers_per_proxy = ?
      WHERE id = ?
    `).run(maxViewers, proxyId);
    logger.info(`Updated proxy ${proxyId} max viewers to ${maxViewers}`);
  }

  /**
   * Update max viewers per proxy for all proxies (NEW FEATURE)
   */
  updateAllProxiesMaxViewers(maxViewers: number): void {
    db.prepare(`
      UPDATE proxies 
      SET max_viewers_per_proxy = ?
    `).run(maxViewers);
    logger.info(`Updated all proxies max viewers to ${maxViewers}`);
  }

  /**
   * Get proxies with current allocation info (NEW FEATURE)
   */
  getProxiesWithAllocation(): Array<Proxy & { availableSlots: number }> {
    const proxies = db.prepare(`
      SELECT *, (max_viewers_per_proxy - current_viewers) as availableSlots
      FROM proxies 
      ORDER BY status, current_viewers ASC
    `).all() as Array<Proxy & { availableSlots: number }>;

    return proxies;
  }

  /**
   * Detect proxy type from URL
   */
  private detectProxyType(url: string): 'http' | 'https' | 'socks5' {
    if (url.startsWith('socks5://') || url.startsWith('socks://')) {
      return 'socks5';
    } else if (url.startsWith('https://')) {
      return 'https';
    }
    return 'http';
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const stats = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(current_viewers) as totalViewers,
        SUM(max_viewers_per_proxy) as totalCapacity
      FROM proxies
      GROUP BY status
    `).all() as Array<{ status: string; count: number; totalViewers: number; totalCapacity: number }>;

    const totals = stats.reduce(
      (acc, s) => ({
        count: acc.count + s.count,
        viewers: acc.viewers + (s.totalViewers || 0),
        capacity: acc.capacity + (s.totalCapacity || 0),
      }),
      { count: 0, viewers: 0, capacity: 0 }
    );

    return {
      total: totals.count,
      active: stats.find(s => s.status === 'active')?.count || 0,
      failed: stats.find(s => s.status === 'failed')?.count || 0,
      pending: stats.find(s => s.status === 'pending')?.count || 0,
      currentViewers: totals.viewers,
      totalCapacity: totals.capacity,
      availableCapacity: totals.capacity - totals.viewers,
    };
  }
}

export default new ProxyManager();
