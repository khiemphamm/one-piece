# Copilot Instructions for tool-live

## Project Overview
**tool-live** is a desktop application for managing YouTube livestream viewer engagement. Built as an Electron app with automation capabilities to simulate 20-30 concurrent viewers for YouTube livestreams.

**Primary Goal**: Create a stable, local-first tool with potential for production scaling.

## Technology Stack

### Frontend (UI Layer)
- **Electron.js** - Desktop application framework
- **React 18 + Vite** - Modern UI with fast HMR
- **TypeScript** - Type-safe development
- **Tailwind CSS + Shadcn/ui** - Rapid UI development
- **Zustand** - Lightweight state management

### Backend (Core Engine)
- **Node.js + TypeScript** - Runtime and type safety
- **Puppeteer** - Browser automation (Chrome DevTools Protocol)
- **puppeteer-extra-plugin-stealth** - Anti-detection measures
- **Express.js** - Internal API server (if needed)

### Data Layer
- **SQLite (better-sqlite3)** - Local database for sessions, configs, and logs
- **Migration Path**: PostgreSQL for future production deployment

### Infrastructure
- **Proxy Management**: SOCKS5/HTTP proxy rotation system
- **Logging**: Winston for structured logging
- **Build**: electron-builder for packaging

## Architecture Overview

```
┌─────────────────────────────────────────┐
│    Electron App (Main + Renderer)      │
│  ┌───────────────────────────────────┐  │
│  │  React UI (Dashboard)             │  │
│  │  - Session controls               │  │
│  │  - Live viewer count              │  │
│  │  - Proxy management               │  │
│  │  - Real-time logs                 │  │
│  └───────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │ IPC Communication
               ▼
┌─────────────────────────────────────────┐
│         Core Engine (Node.js)           │
│  ┌─────────────────────────────────┐    │
│  │  SessionManager                 │    │
│  │  - Orchestrates viewer sessions │    │
│  │  - Health monitoring            │    │
│  │  - Auto-restart failed sessions │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  BrowserPool                    │    │
│  │  - 20-30 Puppeteer instances    │    │
│  │  - Randomized fingerprints      │    │
│  │  - Cookie/session management    │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  ProxyManager                   │    │
│  │  - Proxy rotation & validation  │    │
│  │  - Health checks                │    │
│  │  - Fallback strategies          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Project Structure

```
tool-live/
├── electron/              # Electron main process
│   ├── main.ts           # App entry point, window management
│   ├── preload.ts        # IPC bridge between main and renderer
│   └── config.ts         # Electron app configuration
│
├── src/                  # React frontend (renderer process)
│   ├── components/       # UI components
│   │   ├── Dashboard.tsx         # Main control panel
│   │   ├── ViewerControl.tsx     # Start/stop controls
│   │   ├── LogsPanel.tsx         # Real-time logs display
│   │   └── ProxyManager.tsx      # Proxy configuration
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Frontend services (IPC calls)
│   ├── types/            # TypeScript type definitions
│   ├── stores/           # Zustand state stores
│   └── App.tsx           # Root component
│
├── core/                 # Backend automation logic
│   ├── engine/
│   │   ├── SessionManager.ts     # Orchestrates all viewer sessions
│   │   ├── BrowserPool.ts        # Manages Puppeteer instances
│   │   └── ViewerSession.ts      # Individual viewer logic
│   ├── proxy/
│   │   ├── ProxyManager.ts       # Proxy pool management
│   │   └── ProxyRotator.ts       # Rotation strategies
│   ├── database/
│   │   ├── db.ts                 # SQLite connection
│   │   └── models/               # Database models
│   ├── anti-detection/
│   │   ├── fingerprint.ts        # Browser fingerprinting
│   │   └── behavior.ts           # Human-like behavior simulation
│   └── utils/
│       ├── logger.ts             # Winston logging setup
│       └── resource-monitor.ts   # CPU/RAM monitoring
│
├── config/
│   ├── default.json      # Default app configuration
│   └── proxies.json      # Proxy list template
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.json
```

## Key Development Patterns

### 1. Session Management Pattern
```typescript
// SessionManager orchestrates multiple viewer sessions
// Each ViewerSession runs in isolated Puppeteer instance
// Auto-restart on failure, resource monitoring

SessionManager
  └─> ViewerSession[] (20-30 instances)
      └─> Puppeteer Browser Instance
          └─> YouTube Livestream Page
```

### 2. Anti-Detection Strategy
- **Stealth Plugin**: puppeteer-extra-plugin-stealth
- **Randomization**: User agents, viewport sizes, fonts
- **Behavioral**: Random scroll, pause, duration (5-15 mins)
- **Network**: Proxy rotation per session
- **Fingerprint**: Canvas, WebGL, audio context randomization

### 3. Resource Optimization
- **Headless Mode**: Chromium without GUI
- **Lazy Loading**: Stagger browser startup (avoid spike)
- **Resource Limits**: Monitor and cap CPU/RAM usage
- **Cleanup**: Graceful shutdown, memory leak prevention

## Development Workflow

### Setup
```powershell
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package Electron app
npm run package
```

### Common Commands
```powershell
# Start dev server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm run test

# Build renderer (Vite)
npm run build:renderer

# Build main process (Electron)
npm run build:main

# Package for Windows
npm run package:win
```

## Critical Implementation Notes

### YouTube Automation
- Use `page.goto()` with `waitUntil: 'networkidle2'`
- Keep session alive with periodic interaction
- Handle CAPTCHA detection (log and skip)
- Monitor for "unusual traffic" warnings

### Proxy Management
- Validate proxies before use (test connection)
- Blacklist failed proxies (3 strikes rule)
- Support both HTTP/HTTPS and SOCKS5
- Graceful fallback to next proxy

### Error Handling
- All async operations must have try-catch
- Log errors with context (session ID, proxy, timestamp)
- Auto-retry with exponential backoff
- User-friendly error notifications in UI

### Database Schema
```sql
-- Sessions table
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  livestream_url TEXT NOT NULL,
  viewer_count INTEGER,
  started_at DATETIME,
  ended_at DATETIME,
  status TEXT -- 'active', 'stopped', 'failed'
);

-- Proxies table
CREATE TABLE proxies (
  id INTEGER PRIMARY KEY,
  proxy_url TEXT UNIQUE,
  type TEXT, -- 'http', 'socks5'
  status TEXT, -- 'active', 'failed'
  last_checked DATETIME,
  fail_count INTEGER DEFAULT 0
);

-- Logs table
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  level TEXT, -- 'info', 'warn', 'error'
  message TEXT,
  context TEXT, -- JSON
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Testing Strategy
- **Unit Tests**: Core logic (SessionManager, ProxyManager)
- **Integration Tests**: Database operations, IPC communication
- **E2E Tests**: Full workflow with mock YouTube page
- **Manual Testing**: Real YouTube livestream (use test stream)

## Security Considerations
- **Rate Limiting**: Max 30 sessions per instance
- **IP Rotation**: Different proxy per session
- **User Data**: No storage of YouTube credentials
- **Logs**: Sanitize URLs and sensitive data

## Deployment & Distribution
- **Target Platforms**: Windows (priority), macOS, Linux
- **Auto-Update**: electron-updater for seamless updates
- **Installer**: NSIS for Windows, DMG for macOS
- **Portable**: ZIP/TAR for portable versions

## Future Production Enhancements
- **Cloud Mode**: Central server managing multiple workers
- **API Service**: REST API for programmatic control
- **Database**: Migrate to PostgreSQL with connection pooling
- **Monitoring**: Grafana + Prometheus for metrics
- **Scaling**: Kubernetes for worker orchestration

## Troubleshooting Common Issues

### High CPU/RAM Usage
- Reduce concurrent sessions
- Enable headless mode
- Disable images/CSS loading
- Check for memory leaks in Puppeteer

### Proxies Not Working
- Verify proxy format: `protocol://host:port`
- Check proxy authentication if required
- Test proxy independently (curl/wget)
- Review proxy blacklist in database

### YouTube Detection
- Increase randomization variance
- Use residential proxies (not datacenter)
- Reduce session duration
- Add longer delays between actions

## Contributing Guidelines
- **Code Style**: ESLint + Prettier configured
- **Commits**: Conventional commits (feat:, fix:, docs:)
- **Branches**: feature/*, bugfix/*, hotfix/*
- **PRs**: Include tests and update documentation

---

*Last updated: October 22, 2025*
*Project Status: Planning phase → Implementation starting*
