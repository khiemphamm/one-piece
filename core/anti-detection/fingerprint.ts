import UserAgent from 'user-agents';

export interface BrowserFingerprint {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  language: string;
  platform: string;
  timezone: string;
}

const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
];

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 }, // ID12 Pro / 13 / 14
  { width: 428, height: 926 }, // ID12 Pro Max / 13 Pro Max / 14 Plus
  { width: 375, height: 667 }, // IDSE / 7 / 8
  { width: 412, height: 915 }, // Pixel 6/7
  { width: 360, height: 800 }, // S20 / S21 / S22
];

const LANGUAGES = ['en-US', 'en-GB', 'vi-VN', 'en-CA', 'en-AU'];
const DESKTOP_PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64'];
const MOBILE_PLATFORMS = ['iPhone', 'Android', 'Linux armv8l'];

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateFingerprint(platform: 'desktop' | 'mobile' = 'desktop'): BrowserFingerprint {
  const userAgent = new UserAgent({ deviceCategory: platform });

  return {
    userAgent: userAgent.toString(),
    viewport: platform === 'mobile' ? randomChoice(MOBILE_VIEWPORTS) : randomChoice(DESKTOP_VIEWPORTS),
    language: randomChoice(LANGUAGES),
    platform: platform === 'mobile' ? randomChoice(MOBILE_PLATFORMS) : randomChoice(DESKTOP_PLATFORMS),
    timezone: randomChoice(TIMEZONES),
  };
}

export function applyFingerprint(page: any, fingerprint: BrowserFingerprint) {
  return page.evaluateOnNewDocument((fp: BrowserFingerprint) => {
    // Mask webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Mask hardware concurrency (random but realistic)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 4 + (Math.floor(Math.random() * 4) * 2), // 4, 6, 8, 10
    });

    // Mask device memory (4, 8GB)
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => Math.random() > 0.5 ? 8 : 4,
    });

    // Override navigator properties
    Object.defineProperty(navigator, 'language', {
      get: () => fp.language,
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => [fp.language, fp.language.split('-')[0]],
    });
    Object.defineProperty(navigator, 'platform', {
      get: () => fp.platform,
    });
    
    // WebGL Vendor/Renderer masking (placeholder for better stealth)
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) return 'Google Inc. (Intel)';
      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) return 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
      return getParameter.apply(this, [parameter]);
    };
  }, fingerprint);
}
