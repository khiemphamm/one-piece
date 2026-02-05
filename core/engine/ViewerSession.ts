import type { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';
import { generateFingerprint, applyFingerprint } from '../anti-detection/fingerprint';
import type { Proxy } from '../proxy/ProxyManager';
import logger from '../utils/logger';
import { resolveChromePath } from '../utils/chrome-path-manager';

puppeteerExtra.use(StealthPlugin());

export interface ViewerSessionConfig {
  url: string;
  proxy?: Proxy;
  sessionId: number;
  viewerIndex: number;
  platform?: 'youtube' | 'tiktok';
}

export class ViewerSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ViewerSessionConfig;
  private isActive = false;
  private fingerprint: any;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor(config: ViewerSessionConfig) {
    this.config = {
      ...config,
      platform: config.platform || 'youtube',
    };
    this.fingerprint = generateFingerprint(
      this.config.platform === 'tiktok' ? 'mobile' : 'desktop'
    );
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
          '--disable-infobars',
          '--window-position=0,0',
          '--disable-extensions',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--hide-scrollbars',
          '--disable-notifications',
          '--disable-device-discovery-notifications',
          '--disable-gpu', // Use CPU rendering to save some specific GPU memory overhead
          '--disable-software-rasterizer',
          '--disable-dev-shm-usage',
          '--disable-renderer-backgrounding',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--js-flags="--max-old-space-size=256"', // Limit JS heap memory

          // CRITICAL: Prevent network requests during launch that cause socket hang up
          '--disable-component-update',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-default-apps',
          '--no-default-browser-check',
          '--disable-client-side-phishing-detection',
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

      // Use ChromePathManager to resolve Chrome executable path
      // Supports both auto-detection and user-configured custom path
      try {
        const chromePath = resolveChromePath();
        
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          logger.info(`Using Chrome: ${chromePath}`);
        } else {
          logger.warn('No Chrome/Chromium executable found');
        }
      } catch (pathError) {
        logger.error('Failed to set executable path', {
          error: pathError instanceof Error ? pathError.message : String(pathError),
        });
      }

      this.browser = await puppeteerExtra.launch(launchOptions);
      this.page = await this.browser!.newPage();

      // Authenticate proxy if credentials are present
      if (proxyUsername && proxyPassword && this.page) {
        await this.page.authenticate({
          username: proxyUsername,
          password: proxyPassword,
        });
        logger.debug(`Authenticated proxy for viewer #${this.config.viewerIndex}`);
      }

      // OPTIMIZATION: Block resources to reduce CPU/RAM
      await this.page.setRequestInterception(true);
      this.page.on('request', req => {
        const resourceType = req.resourceType();
        const platform = this.config.platform || 'youtube';

        // List of resources to block
        const blockedTypes = ['image', 'font'];

        // YouTube can block CSS and media more aggressively
        if (platform === 'youtube') {
          blockedTypes.push('stylesheet', 'media');
        }

        if (blockedTypes.includes(resourceType)) {
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
        await Promise.race([
          applyFingerprint(this.page, this.fingerprint),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fingerprint timeout')), 30000)
          ),
        ]);
        logger.debug(`Fingerprint applied for viewer #${this.config.viewerIndex}`);
      } catch (fpError) {
        logger.warn(`Fingerprint injection failed for viewer #${this.config.viewerIndex}`, {
          error: fpError instanceof Error ? fpError.message : String(fpError),
        });
      }

      // Navigate to URL
      await this.page.goto(this.config.url, {
        waitUntil: 'domcontentloaded',
        timeout: 180000,
      });

      // Wait for player to load
      await new Promise(resolve =>
        setTimeout(resolve, this.config.platform === 'tiktok' ? 15000 : 5000)
      );

      if (this.config.platform === 'tiktok') {
        await this.handleTikTokStart();
      } else {
        await this.handleYouTubeStart();
      }

      this.isActive = true;
      logger.info(`Viewer session #${this.config.viewerIndex} started successfully`);

      this.startKeepAlive();
      if (this.config.platform === 'tiktok') {
        this.startTikTokInteractions();
      }
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
      this.isActive = false;
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }

      if (this.page) {
        try {
          this.page.removeAllListeners();
          await this.page.close();
          this.page = null;
        } catch (e) {
          // Ignore cleanup errors during shutdown.
        }
      }

      if (this.browser) {
        try {
          await this.browser.close();
          this.browser = null;
        } catch (e) {
          // Ignore cleanup errors during shutdown.
        }
      }
      logger.info(`Viewer session #${this.config.viewerIndex} stopped`);
    } catch (error) {
      logger.error(`Error stopping viewer session #${this.config.viewerIndex}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startKeepAlive(): void {
    const intervalMs = (120 + Math.random() * 120) * 1000;
    this.keepAliveInterval = setInterval(async () => {
      if (!this.isActive || !this.page) return;
      try {
        const actionType = Math.floor(Math.random() * 2);
        if (actionType === 0) {
          const isPlaying = await this.page
            .evaluate(() => {
              const video = document.querySelector('video') as HTMLVideoElement;
              return video && !video.paused;
            })
            .catch(() => false);

          if (!isPlaying && this.isActive) {
            await this.page
              .evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                if (video) video.play().catch(() => {});
              })
              .catch(() => {});
          }
        } else {
          await this.page
            .evaluate(() => {
              self.scrollBy(0, Math.random() * 100 - 50);
            })
            .catch(() => {});
        }
      } catch (e) {
        // Ignore transient keep-alive errors.
      }
    }, intervalMs);
  }

  private async handleTikTokStart(): Promise<void> {
    if (!this.page) return;
    try {
      await this.page
        .evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const closeBtn = buttons.find(
            b =>
              b.innerText.includes('Not now') ||
              b.innerText.includes('Close') ||
              b.innerText.includes('Click to watch LIVE')
          );
          if (closeBtn) (closeBtn as HTMLElement).click();
        })
        .catch(() => {});

      await this.page.evaluate(async () => {
        const video = document.querySelector('video');
        if (video) {
          video.muted = false;
          video.volume = 0.5;
          video.play().catch(() => {});
        }
      });
    } catch (e) {
      // Ignore TikTok start errors to keep session alive.
    }
  }

  private async handleYouTubeStart(): Promise<void> {
    if (!this.page) return;
    try {
      const playButton = await this.page.$('button.ytp-large-play-button');
      if (playButton) await playButton.click();
      await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.play().catch(() => {});
          video.muted = false;
        }
      });
    } catch (e) {
      // Ignore YouTube start errors to keep session alive.
    }
  }

  private startTikTokInteractions(): void {
    const runInteractions = async () => {
      if (!this.isActive || !this.page) return;
      try {
        const randomAction = Math.random();
        if (randomAction < 0.3) {
          await this.page.evaluate(() => {
            const player = document.querySelector('.video-card-container') || document.body;
            player.dispatchEvent(new MouseEvent('dblclick', { view: window, bubbles: true }));
          });
        }
        setTimeout(runInteractions, (30 + Math.random() * 90) * 1000);
      } catch (e) {
        setTimeout(runInteractions, 60000);
      }
    };
    setTimeout(runInteractions, 15000);
  }

  getStatus(): boolean {
    return this.isActive;
  }

  getInfo() {
    return {
      viewerIndex: this.config.viewerIndex,
      sessionId: this.config.sessionId,
      isActive: this.isActive,
      proxy: this.config.proxy?.proxy_url,
      platform: this.config.platform,
    };
  }
}
