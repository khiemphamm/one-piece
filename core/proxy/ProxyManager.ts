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
}

export class ProxyManager {
  private readonly MAX_FAIL_COUNT = 3;

  /**
   * Add new proxies to the database
   */
  addProxies(proxyUrls: string[]): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO proxies (proxy_url, type, status, fail_count, success_count)
      VALUES (?, ?, 'pending', 0, 0)
    `);

    const insertMany = db.transaction((proxies: Array<{ url: string; type: string }>) => {
      for (const proxy of proxies) {
        stmt.run(proxy.url, proxy.type);
      }
    });

    const parsedProxies = proxyUrls.map(url => ({
      url,
      type: this.detectProxyType(url),
    }));

    insertMany(parsedProxies);
    logger.info(`Added ${proxyUrls.length} proxies to database`);
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
          status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END
    `).run();
    logger.info('Reset all proxy statistics');
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
        COUNT(*) as count
      FROM proxies
      GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    return {
      total: stats.reduce((sum, s) => sum + s.count, 0),
      active: stats.find(s => s.status === 'active')?.count || 0,
      failed: stats.find(s => s.status === 'failed')?.count || 0,
      pending: stats.find(s => s.status === 'pending')?.count || 0,
    };
  }
}

export default new ProxyManager();
