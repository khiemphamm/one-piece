import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generateFingerprint, applyFingerprint } from '../anti-detection/fingerprint';
import type { Proxy } from '../proxy/ProxyManager';
import logger from '../utils/logger';

const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

export interface ViewerSessionConfig {
  url: string;
  proxy?: Proxy;
  sessionId: number;
  viewerIndex: number;
}

export class ViewerSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ViewerSessionConfig;
  private isActive = false;
  private fingerprint = generateFingerprint();
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor(config: ViewerSessionConfig) {
    this.config = config;
  }

  /**
   * Start the viewer session
   */
  async start(): Promise<void> {
    try {
      logger.info(`Starting viewer session #${this.config.viewerIndex}`, {
        sessionId: this.config.sessionId,
        proxy: this.config.proxy?.proxy_url,
      });

      // Launch browser with stealth plugin
      const launchOptions: any = {
        headless: 'new',
        protocolTimeout: 300000, // INCREASED to 300 seconds (5 minutes) for heavy load
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          // REMOVED: '--mute-audio' - Need audio for real view counting!
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-images', // Additional optimization
          '--blink-settings=imagesEnabled=false', // Block images at blink level
        ],
      };

      // Parse proxy URL to extract host/port and credentials
      let proxyHost: string | null = null;
      let proxyUsername: string | null = null;
      let proxyPassword: string | null = null;

      if (this.config.proxy) {
        try {
          const proxyUrl = new URL(this.config.proxy.proxy_url);
          
          // Extract host and port
          proxyHost = `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`;
          
          // Extract credentials if present
          if (proxyUrl.username && proxyUrl.password) {
            proxyUsername = decodeURIComponent(proxyUrl.username);
            proxyPassword = decodeURIComponent(proxyUrl.password);
          }
          
          // Add proxy server to launch args
          launchOptions.args.push(`--proxy-server=${proxyHost}`);
          
          logger.debug(`Configured proxy for viewer #${this.config.viewerIndex}`, {
            host: proxyHost,
            hasAuth: !!(proxyUsername && proxyPassword),
          });
        } catch (proxyError) {
          logger.warn(`Failed to parse proxy URL for viewer #${this.config.viewerIndex}`, {
            error: proxyError instanceof Error ? proxyError.message : String(proxyError),
          });
        }
      }

      this.browser = await puppeteerExtra.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Authenticate proxy if credentials are present
      if (proxyUsername && proxyPassword) {
        await this.page.authenticate({
          username: proxyUsername,
          password: proxyPassword,
        });
        logger.debug(`Authenticated proxy for viewer #${this.config.viewerIndex}`);
      }

      // OPTIMIZATION: Block images, CSS, fonts to reduce CPU/RAM
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        // Only allow document, script, xhr - block everything else
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set viewport
      await this.page.setViewport(this.fingerprint.viewport);

      // Set user agent
      await this.page.setUserAgent(this.fingerprint.userAgent);

      // Apply fingerprinting (with error handling and timeout)
      try {
        // Add timeout protection for fingerprint injection
        await Promise.race([
          applyFingerprint(this.page, this.fingerprint),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fingerprint timeout')), 30000) // 30s timeout
          )
        ]);
        logger.debug(`Fingerprint applied for viewer #${this.config.viewerIndex}`);
      } catch (fpError) {
        logger.warn(`Fingerprint injection failed for viewer #${this.config.viewerIndex}, continuing anyway`, {
          error: fpError instanceof Error ? fpError.message : String(fpError),
        });
      }

      // Navigate to YouTube livestream
      await this.page.goto(this.config.url, {
        waitUntil: 'domcontentloaded', // Changed from networkidle2 for faster load
        timeout: 180000, // INCREASED to 180 seconds (3 minutes) for slow CPU/network
      });

      // Wait for video player to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // AUTO-PLAY VIDEO - CRITICAL FOR VIEW COUNT!
      try {
        // Method 1: Click play button if exists
        const playButton = await this.page.$('button.ytp-large-play-button');
        if (playButton) {
          await playButton.click();
          logger.info(`Viewer #${this.config.viewerIndex} clicked play button`);
        }

        // Method 2: Programmatically play video
        await this.page.evaluate(() => {
          const video = document.querySelector('video');
          if (video && video.paused) {
            video.play().catch(() => {}); // Ignore autoplay policy errors
          }
        });

        // Wait for video to actually start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // UNMUTE AND SET VOLUME (Important for view counting!)
        await this.page.evaluate(() => {
          const video = document.querySelector('video') as HTMLVideoElement;
          if (video) {
            video.muted = false; // Unmute
            video.volume = 0.3 + Math.random() * 0.4; // Random volume 30-70%
          }
        });

        logger.info(`Viewer #${this.config.viewerIndex} unmuted video`);

        // Verify video is playing
        const isPlaying = await this.page.evaluate(() => {
          const video = document.querySelector('video');
          return video && !video.paused && video.currentTime > 0;
        });

        if (isPlaying) {
          logger.info(`Viewer #${this.config.viewerIndex} video is playing ✓`);
        } else {
          logger.warn(`Viewer #${this.config.viewerIndex} video may not be playing`);
        }

        // Simulate human behavior: scroll down a bit
        await this.page.evaluate(() => {
          self.scrollBy(0, Math.random() * 200 + 100);
        }).catch(() => {
          // Ignore scroll errors
        });

      } catch (playError) {
        logger.warn(`Auto-play failed for viewer #${this.config.viewerIndex}`, {
          error: playError instanceof Error ? playError.message : String(playError),
        });
      }

      this.isActive = true;

      logger.info(`Viewer session #${this.config.viewerIndex} started successfully and video playing`);

      // Start keep-alive mechanism
      this.startKeepAlive();

    } catch (error) {
      logger.error(`Failed to start viewer session #${this.config.viewerIndex}`, {
        error: error instanceof Error ? error.message : String(error),
        sessionId: this.config.sessionId,
      });
      throw error;
    }
  }

  /**
   * Stop the viewer session
   */
  async stop(): Promise<void> {
    try {
      logger.info(`Stopping viewer session #${this.config.viewerIndex}...`);
      
      // CRITICAL: Set isActive to false FIRST to stop all intervals
      this.isActive = false;

      // Clear keep-alive interval IMMEDIATELY
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
        logger.debug(`Cleared keep-alive interval for viewer #${this.config.viewerIndex}`);
      }

      // Wait a bit to ensure interval is cleared
      await new Promise(resolve => setTimeout(resolve, 500));

      // Close page first (faster than browser)
      if (this.page) {
        try {
          // Remove all listeners to prevent memory leaks
          this.page.removeAllListeners();
          await this.page.close();
          this.page = null;
          logger.debug(`Closed page for viewer #${this.config.viewerIndex}`);
        } catch (pageError) {
          logger.warn(`Error closing page for viewer #${this.config.viewerIndex}`, {
            error: pageError instanceof Error ? pageError.message : String(pageError),
          });
          this.page = null; // Force null even on error
        }
      }

      // Close browser
      if (this.browser) {
        try {
          await this.browser.close();
          this.browser = null;
          logger.debug(`Closed browser for viewer #${this.config.viewerIndex}`);
        } catch (browserError) {
          logger.warn(`Error closing browser for viewer #${this.config.viewerIndex}`, {
            error: browserError instanceof Error ? browserError.message : String(browserError),
          });
          this.browser = null; // Force null even on error
        }
      }

      logger.info(`Viewer session #${this.config.viewerIndex} stopped successfully`);
    } catch (error) {
      logger.error(`Error stopping viewer session #${this.config.viewerIndex}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Force cleanup even on error
      this.isActive = false;
      this.keepAliveInterval = null;
      this.page = null;
      this.browser = null;
    }
  }

  /**
   * Keep the session alive with periodic interactions
   */
  private startKeepAlive(): void {
    // REDUCED FREQUENCY: Every 2-4 minutes (was 30-90 seconds - too aggressive!)
    const intervalMs = (120 + Math.random() * 120) * 1000; // 2-4 minutes

    this.keepAliveInterval = setInterval(async () => {
      // CRITICAL: Check if session is still active at the START
      if (!this.isActive) {
        logger.debug(`Keep-alive cancelled: Viewer #${this.config.viewerIndex} is inactive`);
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
        return;
      }

      if (!this.page) {
        logger.debug(`Keep-alive cancelled: Viewer #${this.config.viewerIndex} has no page`);
        return;
      }

      try {
        // SIMPLIFIED: Only do lightweight actions
        const actionType = Math.floor(Math.random() * 2);

        switch (actionType) {
          case 0: { // Just check video playing status
            const isPlaying = await this.page.evaluate(() => {
              const video = document.querySelector('video') as HTMLVideoElement;
              return video && !video.paused;
            }).catch(() => false);
            
            if (!isPlaying && this.isActive) { // Double-check isActive
              await this.page.evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                if (video) video.play().catch(() => {});
              }).catch(() => {});
            }
            logger.debug(`Keep-alive: Viewer #${this.config.viewerIndex} checked playback`);
            break;
          }

          case 1: { // Small scroll
            if (!this.isActive) return; // Safety check before action
            await this.page.evaluate(() => {
              self.scrollBy(0, Math.random() * 100 - 50);
            }).catch(() => {});
            logger.debug(`Keep-alive: Viewer #${this.config.viewerIndex} scrolled`);
            break;
          }
        }

      } catch (error) {
        // Check if session was stopped during operation
        if (!this.isActive) {
          logger.debug(`Keep-alive stopped for viewer #${this.config.viewerIndex}`);
          return;
        }
        
        logger.warn(`Keep-alive failed for viewer #${this.config.viewerIndex}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    logger.debug(`Started keep-alive for viewer #${this.config.viewerIndex} (interval: ${Math.round(intervalMs / 1000)}s)`);
  }

  /**
   * Check if session is active
   */
  getStatus(): boolean {
    return this.isActive;
  }

  /**
   * Get session info
   */
  getInfo() {
    return {
      viewerIndex: this.config.viewerIndex,
      sessionId: this.config.sessionId,
      isActive: this.isActive,
      proxy: this.config.proxy?.proxy_url,
      userAgent: this.fingerprint.userAgent,
    };
  }
}
