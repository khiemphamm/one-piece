import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import SessionManager from '../core/engine/SessionManager';
import ProxyManager from '../core/proxy/ProxyManager';
import logger, { setLogDirectory } from '../core/utils/logger';
import { dbReady, setDatabasePath } from '../core/database/db';

const isDev = !app.isPackaged;

// Set up paths for production
if (!isDev) {
  const userDataPath = app.getPath('userData');
  setLogDirectory(path.join(userDataPath, 'logs'));
  setDatabasePath(path.join(userDataPath, 'data', 'tool-live.db'));
}

let mainWindow: BrowserWindow | null = null;

// Configure autoUpdater logging
autoUpdater.logger = logger;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1a1a1a',
    show: false,
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In packaged app: __dirname is resources/app/dist/electron/electron
    // We need to go to: resources/app/dist/renderer/index.html
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Start broadcasting stats
    startStatsBroadcast();

    // Check for updates
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// AutoUpdater events
autoUpdater.on('update-available', info => {
  logger.info('Update available', { version: info?.version });
  mainWindow?.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', info => {
  logger.info('Update not available', { version: info?.version });
  mainWindow?.webContents.send('update-not-available', info);
});

autoUpdater.on('update-downloaded', info => {
  logger.info('Update downloaded', { version: info?.version });
  mainWindow?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', error => {
  logger.error('Auto update error', {
    error: error instanceof Error ? error.message : String(error),
  });
  mainWindow?.webContents.send('update-error', {
    message: error instanceof Error ? error.message : String(error),
  });
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-updates', async () => {
  if (isDev) {
    return { success: false, error: 'Auto-update is disabled in development mode.' };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, data: { updateInfo: result?.updateInfo } };
  } catch (error) {
    logger.error('Manual update check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('get-app-version', () => {
  return { success: true, data: { version: app.getVersion() } };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC HANDLERS
// ============================================

/**
 * Start a new viewer session
 */
ipcMain.handle(
  'start-session',
  async (_event, livestreamUrl: string, viewerCount: number, platform?: 'youtube' | 'tiktok') => {
    try {
      logger.info('IPC: start-session called', { livestreamUrl, viewerCount, platform });

      await SessionManager.startSession({
        livestreamUrl,
        viewerCount,
        platform,
      });

      return { success: true };
    } catch (error) {
      logger.error('IPC: start-session failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

/**
 * Stop the current session
 */
ipcMain.handle('stop-session', async _event => {
  try {
    logger.info('IPC: stop-session called');

    await SessionManager.stopSession();

    return { success: true };
  } catch (error) {
    logger.error('IPC: stop-session failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Force stop all sessions (emergency)
 */
ipcMain.handle('force-stop-session', async _event => {
  try {
    logger.warn('IPC: force-stop-session called');

    await SessionManager.forceStopAll();

    return { success: true };
  } catch (error) {
    logger.error('IPC: force-stop-session failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Get current session status
 */
ipcMain.handle('get-session-status', async _event => {
  try {
    const stats = SessionManager.getStats();
    const isRunning = SessionManager.isSessionRunning();

    return {
      success: true,
      data: {
        isRunning,
        stats,
      },
    };
  } catch (error) {
    logger.error('IPC: get-session-status failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Add proxies to the pool
 */
ipcMain.handle('add-proxies', async (_event, proxyUrls: string[]) => {
  try {
    logger.info('IPC: add-proxies called', { count: proxyUrls.length });

    ProxyManager.addProxies(proxyUrls);

    return { success: true };
  } catch (error) {
    logger.error('IPC: add-proxies failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Get all proxies
 */
ipcMain.handle('get-proxies', async _event => {
  try {
    const proxies = ProxyManager.getAllProxies();
    const stats = ProxyManager.getStats();

    return {
      success: true,
      data: {
        proxies,
        stats,
      },
    };
  } catch (error) {
    logger.error('IPC: get-proxies failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Remove a proxy
 */
ipcMain.handle('remove-proxy', async (_event, proxyId: number) => {
  try {
    logger.info('IPC: remove-proxy called', { proxyId });

    ProxyManager.removeProxy(proxyId);

    return { success: true };
  } catch (error) {
    logger.error('IPC: remove-proxy failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// STATS BROADCASTING
// ============================================

/**
 * Send stats updates to renderer every 5 seconds
 */
let statsInterval: NodeJS.Timeout | null = null;

async function startStatsBroadcast() {
  // Wait for database to be fully initialized before broadcasting stats
  await dbReady;
  logger.info('Database ready, starting stats broadcast');

  if (statsInterval) {
    clearInterval(statsInterval);
  }

  statsInterval = setInterval(() => {
    if (!mainWindow) return;

    try {
      const stats = SessionManager.getStats();
      const isRunning = SessionManager.isSessionRunning();
      const proxyStats = ProxyManager.getStats();
      const proxyList = ProxyManager.getAllProxies(); // Get full proxy list

      mainWindow.webContents.send('stats-update', {
        session: {
          isRunning,
          ...stats,
        },
        proxies: {
          ...proxyStats,
          list: proxyList, // Include proxy list for table display
        },
      });
    } catch (error) {
      logger.error('Failed to broadcast stats', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 5000); // Every 5 seconds
}

// Stop stats broadcast when app quits
app.on('before-quit', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});
