import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

const DB_PATH = path.join(process.cwd(), 'data', 'tool-live.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: SqlJsDatabase;

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Try to load existing database
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    logger.info('Loaded existing database');
  } else {
    db = new SQL.Database();
    logger.info('Created new database');
  }

  // Initialize tables
  initializeTables();
  
  // Save database to disk
  saveDatabase();
}

// Save database to disk
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Wrapper class to make sql.js compatible with better-sqlite3 API
class DatabaseWrapper {
  run(sql: string, ...params: any[]) {
    try {
      db.run(sql, params);
      // Get lastInsertRowid IMMEDIATELY after run, before any other operation
      const result = db.exec('SELECT last_insert_rowid() as id');
      const lastId = result[0]?.values[0]?.[0] || 0;
      saveDatabase();
      
      return {
        lastInsertRowid: lastId,
        changes: 1,
      };
    } catch (error) {
      logger.error('Database run error', { 
        sql, 
        params, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  prepare(sql: string) {
    return {
      run: (...params: any[]) => {
        try {
          db.run(sql, params);
          // Get lastInsertRowid IMMEDIATELY
          const result = db.exec('SELECT last_insert_rowid() as id');
          const lastId = result[0]?.values[0]?.[0] || 0;
          saveDatabase();
          
          // Log for debugging
          if (sql.includes('INSERT INTO sessions')) {
            logger.debug('Session inserted', { lastId, sql: sql.substring(0, 50) });
          }
          
          return {
            lastInsertRowid: lastId,
            changes: 1,
          };
        } catch (error) {
          logger.error('Database prepare.run error', { 
            sql, 
            params, 
            error: error instanceof Error ? error.message : String(error) 
          });
          throw error;
        }
      },
      get: (...params: any[]) => {
        const results = db.exec(sql, params);
        if (results.length === 0) return undefined;
        
        const columns = results[0].columns;
        const values = results[0].values[0];
        if (!values) return undefined;
        
        const row: any = {};
        columns.forEach((col, idx) => {
          row[col] = values[idx];
        });
        return row;
      },
      all: (...params: any[]) => {
        const results = db.exec(sql, params);
        if (results.length === 0) return [];
        
        const columns = results[0].columns;
        const values = results[0].values;
        
        return values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });
      },
    };
  }

  exec(sql: string) {
    db.exec(sql);
    saveDatabase();
  }

  pragma(_sql: string) {
    // sql.js doesn't support pragma in the same way, but we can ignore for now
  }

  transaction(fn: (db: any) => void) {
    return (param: any) => {
      fn(param);
      saveDatabase();
    };
  }
}

const dbWrapper = new DatabaseWrapper();

function initializeTables() {
  logger.info('Initializing database tables...');

  // Sessions table
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      livestream_url TEXT NOT NULL,
      viewer_count INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT NOT NULL CHECK(status IN ('active', 'stopped', 'failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Proxies table
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS proxies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proxy_url TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('http', 'https', 'socks5')),
      status TEXT NOT NULL CHECK(status IN ('active', 'failed', 'pending')) DEFAULT 'pending',
      last_checked DATETIME,
      fail_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Logs table
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error', 'debug')),
      message TEXT NOT NULL,
      context TEXT,
      session_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Viewer sessions table (tracks individual viewer instances)
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS viewer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      proxy_id INTEGER,
      status TEXT NOT NULL CHECK(status IN ('starting', 'active', 'stopped', 'failed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      error_message TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (proxy_id) REFERENCES proxies(id)
    )
  `);

  logger.info('Database tables initialized successfully');
}

// Initialize on import (async)
initDatabase().catch(err => {
  logger.error('Failed to initialize database', { error: err.message });
});

export default dbWrapper as any;
