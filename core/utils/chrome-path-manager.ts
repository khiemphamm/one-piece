import fs from 'fs';
import os from 'os';
import path from 'path';
import * as puppeteer from 'puppeteer';
import logger from './logger';

export interface ChromePathConfig {
  mode: 'auto' | 'manual';
  customPath?: string;
}

// Store config in memory (will be loaded from DB)
let currentConfig: ChromePathConfig = {
  mode: 'auto',
  customPath: undefined,
};

/**
 * Set the Chrome path configuration
 */
export function setChromePath(config: ChromePathConfig): void {
  currentConfig = { ...config };
  logger.info('Chrome path configuration updated', {
    mode: config.mode,
    customPath: config.customPath,
  });
}

/**
 * Get the current Chrome path configuration
 */
export function getChromePath(): ChromePathConfig {
  return { ...currentConfig };
}

/**
 * Auto-detect Chrome path based on the operating system
 */
export function autoDetectChromePath(): string | null {
  const platform = os.platform();
  let chromePath: string | null = null;

  try {
    if (platform === 'darwin') {
      // macOS - Try standard app path first, then common user paths
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          chromePath = testPath;
          break;
        }
      }
    } else if (platform === 'win32') {
      // Windows - check common installation paths
      const possiblePaths = [
        path.join(
          process.env['PROGRAMFILES'] || 'C:\\Program Files',
          'Google\\Chrome\\Application\\chrome.exe'
        ),
        path.join(
          process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
          'Google\\Chrome\\Application\\chrome.exe'
        ),
        path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          chromePath = testPath;
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

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          chromePath = testPath;
          break;
        }
      }
    }

    if (chromePath) {
      logger.info(`Auto-detected Chrome at: ${chromePath}`);
    } else {
      logger.warn('Could not auto-detect Chrome installation');
    }
  } catch (error) {
    logger.error('Error during Chrome auto-detection', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return chromePath;
}

/**
 * Get the Puppeteer bundled Chromium path as fallback
 */
export function getPuppeteerChromiumPath(): string | null {
  try {
    const executablePath = puppeteer.executablePath();
    if (executablePath && fs.existsSync(executablePath)) {
      return executablePath;
    }
  } catch (error) {
    logger.warn('Could not get Puppeteer Chromium path', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

/**
 * Resolve the effective Chrome path based on current configuration
 * Returns the path to use, or null if none available
 */
export function resolveChromePath(): string | null {
  if (currentConfig.mode === 'manual' && currentConfig.customPath) {
    // Validate custom path exists
    if (fs.existsSync(currentConfig.customPath)) {
      logger.info(`Using custom Chrome path: ${currentConfig.customPath}`);
      return currentConfig.customPath;
    } else {
      logger.warn(`Custom Chrome path does not exist: ${currentConfig.customPath}, falling back to auto`);
    }
  }

  // Auto mode or fallback
  const autoPath = autoDetectChromePath();
  if (autoPath) {
    return autoPath;
  }

  // Final fallback: Puppeteer's bundled Chromium
  const puppeteerPath = getPuppeteerChromiumPath();
  if (puppeteerPath) {
    logger.info(`Using Puppeteer Chromium as fallback: ${puppeteerPath}`);
    return puppeteerPath;
  }

  logger.error('No Chrome/Chromium executable found');
  return null;
}

/**
 * Validate if a path points to a valid Chrome executable
 */
export function validateChromePath(chromePath: string): { valid: boolean; error?: string } {
  if (!chromePath || chromePath.trim() === '') {
    return { valid: false, error: 'Path is empty' };
  }

  if (!fs.existsSync(chromePath)) {
    return { valid: false, error: 'File does not exist' };
  }

  // Check if it's a file (not a directory)
  try {
    const stat = fs.statSync(chromePath);
    if (!stat.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }
  } catch (error) {
    return { valid: false, error: 'Cannot read file info' };
  }

  // Basic filename validation
  const filename = path.basename(chromePath).toLowerCase();
  const validNames = ['chrome', 'chrome.exe', 'google chrome', 'chromium', 'chromium-browser'];
  const isValidName = validNames.some(name => filename.includes(name.replace(' ', '')));

  if (!isValidName) {
    // Just a warning, don't fail validation
    logger.warn(`Chrome path filename may not be valid: ${filename}`);
  }

  return { valid: true };
}

/**
 * Get all detected Chrome paths (for UI display)
 */
export function getAllDetectedPaths(): { path: string; source: string }[] {
  const paths: { path: string; source: string }[] = [];
  const platform = os.platform();

  const checkAndAdd = (testPath: string, source: string) => {
    if (fs.existsSync(testPath)) {
      paths.push({ path: testPath, source });
    }
  };

  if (platform === 'darwin') {
    checkAndAdd('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'System Chrome');
    checkAndAdd(
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      'User Chrome'
    );
  } else if (platform === 'win32') {
    checkAndAdd(
      path.join(
        process.env['PROGRAMFILES'] || 'C:\\Program Files',
        'Google\\Chrome\\Application\\chrome.exe'
      ),
      'Program Files Chrome'
    );
    checkAndAdd(
      path.join(
        process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
        'Google\\Chrome\\Application\\chrome.exe'
      ),
      'Program Files (x86) Chrome'
    );
    checkAndAdd(
      path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'Local AppData Chrome'
    );
  } else if (platform === 'linux') {
    checkAndAdd('/usr/bin/google-chrome', 'Google Chrome');
    checkAndAdd('/usr/bin/google-chrome-stable', 'Google Chrome Stable');
    checkAndAdd('/usr/bin/chromium-browser', 'Chromium Browser');
    checkAndAdd('/usr/bin/chromium', 'Chromium');
  }

  // Add Puppeteer Chromium
  const puppeteerPath = getPuppeteerChromiumPath();
  if (puppeteerPath) {
    paths.push({ path: puppeteerPath, source: 'Puppeteer Chromium (Bundled)' });
  }

  return paths;
}

export default {
  setChromePath,
  getChromePath,
  autoDetectChromePath,
  getPuppeteerChromiumPath,
  resolveChromePath,
  validateChromePath,
  getAllDetectedPaths,
};
