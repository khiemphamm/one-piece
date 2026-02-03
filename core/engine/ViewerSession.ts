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
    this.fingerprint = generateFingerprint(this.config.platform === 'tiktok' ? 'mobile' : 'desktop');
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

      // WORKAROUND: Use system Chrome instead of Puppeteer's Chromium
      // Puppeteer's Chromium may have system-level issues (socket hang up on some macOS systems)
      try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        let systemChromePath: string | null = null;
        const platform = os.platform();
        
        // Detect Chrome path based on platform
        if (platform === 'darwin') {
          // macOS
          systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else if (platform === 'win32') {
          // Windows - check common installation paths
          const possiblePaths = [
            path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
          ];
          
          for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
              systemChromePath = chromePath;
              break;
            }
          }
        } else if (platform === 'linux') {
          // Linux
          const possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
          ];
          
          for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
              systemChromePath = chromePath;
              break;
            }
          }
        }
        
        if (systemChromePath && fs.existsSync(systemChromePath)) {
          launchOptions.executablePath = systemChromePath;
          logger.info(`Using system Chrome: ${systemChromePath}`);
        } else {
          // Fallback to Puppeteer's Chromium
          const puppeteer = require('puppeteer');
          const executablePath = puppeteer.executablePath();
          
          if (executablePath) {
            launchOptions.executablePath = executablePath;
            logger.info(`System Chrome not found, using Puppeteer Chromium: ${executablePath}`);
          } else {
            logger.warn('No Chrome/Chromium executable found, Puppeteer will attempt to download');
          }
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
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        const platform = this.config.platform || 'youtube';
        
        // List of resources to block
        const blockedTypes = ['image', 'font'];
        
        // YouTube can block CSS and media more aggressively
        if (platform === 'youtube') {
          blockedTypes.push('stylesheet', 'media');
        } 
        // TikTok needs CSS and Media to count views properly
        
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

      // Navigate to URL
      await this.page.goto(this.config.url, {
        waitUntil: 'domcontentloaded',
        timeout: 180000,
      });

      // Wait for player to load (longer for TikTok)
      await new Promise(resolve => setTimeout(resolve, this.config.platform === 'tiktok' ? 15000 : 5000));

      if (this.config.platform === 'tiktok') {
        await this.handleTikTokStart();
      } else {
        await this.handleYouTubeStart();
      }

      this.isActive = true;
      logger.info(`Viewer session #${this.config.viewerIndex} started successfully`);

      // Start keep-alive and interactions
      this.startKeepAlive();
      if (this.config.platform === 'tiktok') {
        this.startTikTokInteractions();
      }

    } catch (error) {
      // Enhanced error logging - serialize full error object
      const errorDetails: any = {
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name || typeof error,
        sessionId: this.config.sessionId,
      };

      // Special handling for ErrorEvent (browser/Puppeteer errors)
      if (error && typeof error === 'object' && 'type' in error && error.type === 'error') {
        const errorEvent = error as any;
        errorDetails.eventType = 'ErrorEvent';
        errorDetails.message = errorEvent.message || errorEvent.error?.message || 'Unknown error';
        errorDetails.filename = errorEvent.filename;
        errorDetails.lineno = errorEvent.lineno;
        errorDetails.colno = errorEvent.colno;
        if (errorEvent.error) {
          errorDetails.errorMessage = errorEvent.error.message;
          errorDetails.errorStack = errorEvent.error.stack;
        }
      }

      // Add stack trace if available
      if (error instanceof Error && error.stack) {
        errorDetails.stack = error.stack;
      }

      // Add all enumerable properties from error object
      if (typeof error === 'object' && error !== null) {
        Object.keys(error).forEach(key => {
          if (!errorDetails[key]) {
            try {
              const value = (error as any)[key];
              // Only add serializable values
              if (value !== undefined && value !== null && typeof value !== 'function') {
                errorDetails[key] = value;
              }
            } catch (e) {
              // Skip non-serializable properties
            }
          }
        });
      }

      logger.error(`Failed to start viewer session #${this.config.viewerIndex}`, errorDetails);
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
   * Handle TikTok-specific initialization
   */
  private async handleTikTokStart(): Promise<void> {
    if (!this.page) return;

    try {
      logger.info(`Viewer #${this.config.viewerIndex} handling TikTok start...`);

      // 1. Click "Watch Now" or similar if needed (mobile web often has interstitials)
      // Use standard CSS selectors or XPath for better compatibility
      const dismissButtons = [
        'button[data-e2e="close-icon"]',
        '.tiktok-cookie-banner-close',
        'button[aria-label="Close"]',
        '.emu-close-button',
        'button:has-text("Click to watch LIVE")',
        'button:has-text("Watch more")',
      ];

      for (const selector of dismissButtons) {
        try {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click().catch(() => {});
            logger.debug(`Viewer #${this.config.viewerIndex} clicked button: ${selector}`);
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (e) {}
      }

      // Also try clicking by text content using evaluate for better reliability
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const closeBtn = buttons.find(b => 
          b.innerText.includes('Not now') || 
          b.innerText.includes('Close') || 
          b.innerText.includes('X') ||
          b.innerText.includes('Click to watch LIVE')
        );
        if (closeBtn) (closeBtn as HTMLElement).click();
      }).catch(() => {});

      // 2. Unmute & Play
      const playSuccess = await this.page.evaluate(async () => {
        // Multi-layered unmuting
        const unmute = () => {
          const video = document.querySelector('video');
          if (video) {
            video.muted = false;
            video.volume = 0.5 + Math.random() * 0.4;
            video.play().catch(() => {});
          }
          
          const muteBtn = document.querySelector('[class*="Volume"], [class*="mute"], [aria-label*="unmute"]');
          if (muteBtn) (muteBtn as HTMLElement).click();
        };

        unmute();
        
        // Wait and check
        await new Promise(r => setTimeout(r, 2000));
        const video = document.querySelector('video');
        return video && !video.paused;
      });

      if (playSuccess) {
        logger.info(`Viewer #${this.config.viewerIndex} TikTok video is playing ✓`);
      } else {
        logger.warn(`Viewer #${this.config.viewerIndex} TikTok video failed to play automatically`);
      }
    } catch (error) {
      logger.warn(`TikTok start handling failed for viewer #${this.config.viewerIndex}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle YouTube-specific initialization
   */
  private async handleYouTubeStart(): Promise<void> {
    if (!this.page) return;

    try {
      // Method 1: Click play button if exists
      const playButton = await this.page.$('button.ytp-large-play-button');
      if (playButton) {
        await playButton.click();
      }

      // Method 2: Programmatically play video
      await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play().catch(() => {});
        }
        if (video) {
          video.muted = false;
          video.volume = 0.3 + Math.random() * 0.4;
        }
      });
    } catch (error) {
      logger.warn(`YouTube start handling failed for viewer #${this.config.viewerIndex}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start TikTok-specific interactions (likes, comments)
   */
  private startTikTokInteractions(): void {
    // Randomized interaction interval
    const runInteractions = async () => {
      if (!this.isActive || !this.page) return;

      try {
        const randomAction = Math.random();

        if (randomAction < 0.3) {
          // 30% chance to Like (Double Click/Tap)
          logger.debug(`Viewer #${this.config.viewerIndex} liking TikTok stream...`);
          await this.page.evaluate(() => {
            const player = document.querySelector('.video-card-container') || document.body;
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            // Dispatch double click for hearts
            const clickEvent = new MouseEvent('dblclick', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y
            });
            player.dispatchEvent(clickEvent);
          });
        } else if (randomAction < 0.45) {
          // 15% chance to Send Comment (Placeholder logic)
          const comments = ["Hay quá!", "Tuyệt vời", "Xịn xò", "Hello ae", "❤️❤️❤️", "🔥 🔥 🔥"];
          const comment = comments[Math.floor(Math.random() * comments.length)];
          
          logger.debug(`Viewer #${this.config.viewerIndex} sending comment: ${comment}`);
          
          // Note: Sending comments usually requires login. 
          // For guest views, we might just simulate clicking the comment box.
          await this.page.evaluate((text) => {
            const input = document.querySelector('div[contenteditable="true"]') || document.querySelector('input[placeholder*="comment"]');
            if (input) {
              // Simulating typing is complex in guest mode, just a placeholder
              console.log("Simulating comment input for:", text);
            }
          }, comment);
        }

        // Schedule next interaction
        const nextDelay = (30 + Math.random() * 90) * 1000; // 30s to 2min
        setTimeout(runInteractions, nextDelay);
      } catch (error) {
        logger.debug(`TikTok interaction failed for #${this.config.viewerIndex}: ${error}`);
        setTimeout(runInteractions, 60000); 
      }
    };

    // Initial delay
    setTimeout(runInteractions, (10 + Math.random() * 20) * 1000);
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
      platform: this.config.platform,
    };
  }
}
