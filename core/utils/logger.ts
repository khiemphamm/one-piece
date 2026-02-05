import winston from 'winston';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Transport from 'winston-transport';

// Safely determine a default log directory that isn't root
// Use temp dir as fallback to avoid Permission Denied on /logs
const getDefaultLogDir = () => {
  try {
    // Try current directory first (fine for dev)
    const cwd = process.cwd();
    if (cwd === '/') {
      return path.join(os.tmpdir(), 'one-piece-logs');
    }
    return path.join(cwd, 'logs');
  } catch {
    return path.join(os.tmpdir(), 'one-piece-logs');
  }
};

let logDir = getDefaultLogDir();

// Callback to send logs to renderer (will be set by main.ts)
let logBroadcastCallback: ((log: LogMessage) => void) | null = null;

// Buffer to store logs before callback is set
const logBuffer: LogMessage[] = [];
const MAX_BUFFER_SIZE = 100;

export interface LogMessage {
  level: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Custom transport to broadcast logs to renderer
class RendererTransport extends Transport {
  log(info: Record<string, unknown>, callback: () => void) {
    setImmediate(() => {
      const { level, message, timestamp, ...metadata } = info;
      // Remove ANSI color codes from level using escape sequence
      // eslint-disable-next-line no-control-regex
      const ansiRegex = new RegExp('\\x1b\\[\\d+m', 'g');
      const cleanLevel = typeof level === 'string' 
        ? level.replace(ansiRegex, '') 
        : String(level);
      
      const logMessage: LogMessage = {
        level: cleanLevel,
        message: typeof message === 'string' ? message : String(message),
        timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
        context: Object.keys(metadata).length > 0 ? metadata as Record<string, unknown> : undefined,
      };

      if (logBroadcastCallback) {
        logBroadcastCallback(logMessage);
      } else {
        // Buffer logs until callback is set
        logBuffer.push(logMessage);
        if (logBuffer.length > MAX_BUFFER_SIZE) {
          logBuffer.shift(); // Remove oldest log
        }
      }
    });
    callback();
  }
}

// Set the broadcast callback (called from main.ts)
// Also flushes any buffered logs
export const setLogBroadcastCallback = (callback: (log: LogMessage) => void) => {
  logBroadcastCallback = callback;
  
  // Flush buffered logs
  while (logBuffer.length > 0) {
    const log = logBuffer.shift();
    if (log) {
      callback(log);
    }
  }
};

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger with only console initially to avoid early file system errors
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}] ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    }),
    // Add renderer transport for UI logs
    new RendererTransport({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.json()
      ),
    }),
  ],
});

// Production transport setup
export const setLogDirectory = (dir: string) => {
  logDir = dir;
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Add file transports now that we have a safe path
    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
      })
    );
    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
      })
    );

    logger.info(`Log directory set to: ${logDir}`);
  } catch (err) {
    console.error(`Failed to set log directory: ${err}`);
  }
};

// If we're in dev mode, we can set the log directory immediately
if (process.env.NODE_ENV === 'development') {
  setLogDirectory(path.join(process.cwd(), 'logs'));
}

export default logger;
