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

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
];

const LANGUAGES = ['en-US', 'en-GB', 'en-CA', 'en-AU'];
const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64'];
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateFingerprint(): BrowserFingerprint {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' });

  return {
    userAgent: userAgent.toString(),
    viewport: randomChoice(VIEWPORTS),
    language: randomChoice(LANGUAGES),
    platform: randomChoice(PLATFORMS),
    timezone: randomChoice(TIMEZONES),
  };
}

export function applyFingerprint(page: any, fingerprint: BrowserFingerprint) {
  return page.evaluateOnNewDocument((fp: BrowserFingerprint) => {
    // Override navigator properties
    Object.defineProperty(self.navigator, 'language', {
      get: () => fp.language,
    });
    Object.defineProperty(self.navigator, 'languages', {
      get: () => [fp.language],
    });
    Object.defineProperty(self.navigator, 'platform', {
      get: () => fp.platform,
    });
  }, fingerprint);
}
