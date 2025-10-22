export const APP_CONFIG = {
  name: 'Tool Live',
  version: '1.0.0',
  maxViewers: 30,
  minViewers: 1,
  defaultViewerCount: 20,
  
  // Browser settings
  browser: {
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },

  // Session settings
  session: {
    minDuration: 5 * 60 * 1000, // 5 minutes
    maxDuration: 15 * 60 * 1000, // 15 minutes
    startupStagger: 2000, // 2 seconds between each browser launch
  },

  // Proxy settings
  proxy: {
    maxFailCount: 3,
    healthCheckInterval: 60000, // 1 minute
  },
};
