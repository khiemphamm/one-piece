import { ViewerSession } from './ViewerSession';
import ProxyManager from '../proxy/ProxyManager';
import db from '../database/db';
import logger from '../utils/logger';
import { ResourceMonitor } from '../utils/resource-monitor';

export interface SessionConfig {
  livestreamUrl: string;
  viewerCount: number;
  useProxyAllocation?: boolean; // Enable smart proxy allocation feature
  maxViewersPerProxy?: number; // Override default max viewers per proxy
}

export interface SessionStats {
  activeViewers: number;
  totalViewers: number;
  failedViewers: number;
  cpuUsage: number;
  memoryUsage: number;
}

export class SessionManager {
  private sessions: ViewerSession[] = [];
  private currentSessionId: number | null = null;
  private isRunning = false;
  private resourceMonitor = new ResourceMonitor();
  private statsInterval: NodeJS.Timeout | null = null;
  private proxyAllocations: Map<number, number[]> = new Map(); // Track which viewers use which proxy

  /**
   * Start a new viewing session
   */
  async startSession(config: SessionConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('A session is already running. Stop it before starting a new one.');
    }

    try {
      logger.info('Starting new session', config);

      // Create session in database
      const result = db.prepare(`
        INSERT INTO sessions (livestream_url, viewer_count, status)
        VALUES (?, ?, 'active')
      `).run(config.livestreamUrl, config.viewerCount);

      this.currentSessionId = result.lastInsertRowid as number;
      
      // CRITICAL: Validate sessionId before continuing
      if (!this.currentSessionId || this.currentSessionId === 0) {
        throw new Error('Failed to create session in database: Invalid session ID');
      }
      
      this.isRunning = true;

      logger.info(`Starting ${config.viewerCount} viewers with session ID ${this.currentSessionId}`);

      // Update max viewers per proxy if specified
      if (config.maxViewersPerProxy && config.maxViewersPerProxy > 0) {
        ProxyManager.updateAllProxiesMaxViewers(config.maxViewersPerProxy);
        logger.info(`Updated all proxies to max ${config.maxViewersPerProxy} viewers per proxy`);
      }

      // Check if we should use proxy allocation feature
      const useProxyAllocation = config.useProxyAllocation !== false; // Default to true
      
      if (useProxyAllocation) {
        logger.info('Using smart proxy allocation feature');
        const proxyStats = ProxyManager.getStats();
        
        if (proxyStats.availableCapacity < config.viewerCount) {
          logger.warn(`Insufficient proxy capacity! Needed: ${config.viewerCount}, Available: ${proxyStats.availableCapacity}`);
          logger.warn('Some viewers will share proxies or may not have proxies assigned');
        }
      }

      // Start viewers with staggered delays
      const STAGGER_DELAY = 5000; // INCREASED: 5 seconds (was 2s - too fast causing CPU spike!)

      for (let i = 0; i < config.viewerCount; i++) {
        // Get proxy based on allocation strategy
        let proxy = null;
        
        if (useProxyAllocation) {
          // NEW: Use smart allocation - get proxy with available capacity
          proxy = ProxyManager.getAvailableProxyWithCapacity();
          
          if (proxy && proxy.id) {
            // Allocate viewer slot to this proxy
            const allocated = ProxyManager.allocateViewerToProxy(proxy.id);
            
            if (!allocated) {
              // Allocation failed, try to get another proxy
              proxy = ProxyManager.getAvailableProxyWithCapacity();
              if (proxy && proxy.id) {
                ProxyManager.allocateViewerToProxy(proxy.id);
              }
            }
            
            // Track allocation
            if (proxy && proxy.id) {
              if (!this.proxyAllocations.has(proxy.id)) {
                this.proxyAllocations.set(proxy.id, []);
              }
              this.proxyAllocations.get(proxy.id)!.push(i);
            }
          }
        } else {
          // OLD: Use legacy method - simple round-robin
          proxy = ProxyManager.getAvailableProxy();
        }

        if (!proxy) {
          logger.warn(`No available proxy for viewer #${i + 1}`);
        }

        const viewerSession = new ViewerSession({
          url: config.livestreamUrl,
          proxy: proxy || undefined,
          sessionId: this.currentSessionId,
          viewerIndex: i + 1,
        });

        this.sessions.push(viewerSession);

        // Start viewer (don't await, let them start in parallel with delay)
        setTimeout(async () => {
          try {
            await viewerSession.start();
            
            // Mark proxy as successful if used
            if (proxy) {
              ProxyManager.markProxySuccess(proxy.id!);
            }

            // Record viewer session in database (with validation)
            if (this.currentSessionId && this.currentSessionId > 0) {
              db.prepare(`
                INSERT INTO viewer_sessions (session_id, proxy_id, status)
                VALUES (?, ?, 'active')
              `).run(this.currentSessionId, proxy?.id || null);
            } else {
              logger.warn(`Viewer #${i + 1} started but currentSessionId is invalid: ${this.currentSessionId}`);
            }

          } catch (error) {
            logger.error(`Failed to start viewer #${i + 1}`, {
              error: error instanceof Error ? error.message : String(error),
            });

            // Release proxy allocation on failure
            if (proxy && proxy.id && useProxyAllocation) {
              ProxyManager.releaseViewerFromProxy(proxy.id);
            }

            // Mark proxy as failed if used
            if (proxy && proxy.id) {
              ProxyManager.markProxyFailed(proxy.id);
            }

            // Record failed viewer session (with validation)
            if (this.currentSessionId && this.currentSessionId > 0) {
              db.prepare(`
                INSERT INTO viewer_sessions (session_id, proxy_id, status, error_message, ended_at)
                VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
              `).run(
                this.currentSessionId,
                proxy?.id || null,
                error instanceof Error ? error.message : String(error)
              );
            } else {
              logger.warn(`Cannot record failed viewer #${i + 1}: invalid sessionId ${this.currentSessionId}`);
            }
          }
        }, i * STAGGER_DELAY);
      }

      // Start monitoring
      this.startStatsMonitoring();

      logger.info(`Session started with ${config.viewerCount} viewers`);

    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the current session
   */
  async stopSession(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('No active session to stop');
      return;
    }

    try {
      logger.info(`Stopping session with ${this.sessions.length} viewers...`);

      // CRITICAL: Set flag FIRST to prevent new operations
      this.isRunning = false;

      // Stop monitoring interval FIRST
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
        logger.debug('Stopped stats interval');
      }

      // Stop all viewers with timeout protection
      const stopPromises = this.sessions.map(async (session, index) => {
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Stop timeout')), 10000) // 10s timeout
          );
          
          await Promise.race([
            session.stop(),
            timeoutPromise
          ]);
          
          logger.debug(`Stopped viewer ${index + 1}/${this.sessions.length}`);
        } catch (error) {
          logger.error(`Failed to stop viewer ${index + 1}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue stopping other sessions
        }
      });

      await Promise.all(stopPromises);

      logger.info(`All ${this.sessions.length} viewers stopped`);

      // Release all proxy allocations
      for (const [proxyId, viewerIndices] of this.proxyAllocations.entries()) {
        for (let j = 0; j < viewerIndices.length; j++) {
          ProxyManager.releaseViewerFromProxy(proxyId);
        }
        logger.debug(`Released ${viewerIndices.length} viewer slots from proxy ${proxyId}`);
      }
      this.proxyAllocations.clear();

      // Update database
      if (this.currentSessionId) {
        db.prepare(`
          UPDATE sessions 
          SET status = 'stopped', ended_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(this.currentSessionId);

        db.prepare(`
          UPDATE viewer_sessions 
          SET status = 'stopped', ended_at = CURRENT_TIMESTAMP 
          WHERE session_id = ? AND status = 'active'
        `).run(this.currentSessionId);
        
        logger.debug('Updated database records');
      }

      // Force cleanup
      this.sessions = [];
      this.currentSessionId = null;

      logger.info('Session stopped successfully');

    } catch (error) {
      logger.error('Error stopping session', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // FORCE CLEANUP even on error
      this.isRunning = false;
      this.sessions = [];
      this.currentSessionId = null;
      this.proxyAllocations.clear();
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }
      
      throw error;
    }
  }

  /**
   * Force stop all sessions (emergency stop)
   * Use when normal stop fails
   */
  async forceStopAll(): Promise<void> {
    logger.warn('FORCE STOPPING all sessions...');
    
    // Stop everything immediately
    this.isRunning = false;
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Try to kill all browser processes
    const killPromises = this.sessions.map(async (session) => {
      try {
        // Force stop without waiting
        await session.stop();
      } catch (error) {
        // Ignore errors
      }
    });

    // Wait max 5 seconds
    await Promise.race([
      Promise.all(killPromises),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // Force cleanup
    this.sessions = [];
    this.currentSessionId = null;
    this.proxyAllocations.clear();

    logger.info('Force stop completed');
  }

  /**
   * Get current session statistics
   */
  getStats(): SessionStats {
    const activeViewers = this.sessions.filter(s => s.getStatus()).length;
    const resources = this.resourceMonitor.getStats(activeViewers);

    return {
      activeViewers,
      totalViewers: this.sessions.length,
      failedViewers: this.sessions.length - activeViewers,
      cpuUsage: resources.cpuUsage,
      memoryUsage: resources.memoryUsage.percentage,
    };
  }

  /**
   * Check if session is running
   */
  isSessionRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Start monitoring and logging stats
   */
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      logger.info('Session stats', stats);

      // TODO: Send stats to renderer process via IPC
    }, 10000); // Every 10 seconds
  }

  /**
   * Get session history
   */
  getSessionHistory(limit = 10) {
    return db.prepare(`
      SELECT * FROM sessions 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
  }
}

export default new SessionManager();
