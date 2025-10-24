# Tool Live - YouTube Livestream Viewer Bot

<div align="center">

![Tool Live](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

A powerful desktop application for managing YouTube livestream viewer engagement. Built with Electron, React, and Puppeteer.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing)

</div>

---

## 🎯 Features

- **Automated Viewer Management**: Simulate 20-30 concurrent viewers for YouTube livestreams
- **Smart Proxy Support**: Rotate between HTTP, HTTPS, and SOCKS5 proxies
- **🆕 Proxy Allocation System**: Intelligently distribute viewers across proxies with capacity limits
- **Anti-Detection**: Advanced browser fingerprinting and stealth techniques
- **Resource Monitoring**: Real-time CPU and memory usage tracking
- **User-Friendly UI**: Clean, modern interface built with React and Tailwind CSS
- **Session Management**: Track viewer sessions with SQLite database
- **Cross-Platform**: Works on Windows, macOS, and Linux

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (Download from [nodejs.org](https://nodejs.org/))
- **npm** or **yarn** package manager

### Installation

```powershell
# Clone the repository
git clone https://github.com/khiemphamm/tool-live.git
cd tool-live

# Install dependencies
npm install

# Run in development mode
npm run dev
```

The application will start on `http://localhost:5173` and Electron will launch automatically.

## 📖 Usage

### Basic Workflow

1. **Launch the App**: Run `npm run dev` or use the packaged executable
2. **Enter Livestream URL**: Paste your YouTube livestream URL
3. **Configure Proxies** (Optional): Add proxy servers for better anonymity
4. **Start Session**: Click "Start Session" to begin simulating viewers
5. **Monitor**: Watch real-time stats and logs

### Adding Proxies

Create `config/proxies.json` with your proxy list:

```json
[
  "http://proxy1.example.com:8080",
  "socks5://proxy2.example.com:1080",
  "http://username:password@proxy3.example.com:3128"
]
```

## 🛠️ Development

### Project Structure

```
tool-live/
├── electron/          # Electron main process
├── src/               # React frontend
├── core/              # Backend automation logic
│   ├── engine/        # Session & viewer management
│   ├── proxy/         # Proxy management
│   ├── database/      # SQLite database
│   ├── anti-detection/# Fingerprinting & stealth
│   └── utils/         # Utilities (logging, monitoring)
├── config/            # Configuration files
└── dist/              # Build output
```

### Available Scripts

```powershell
# Development
npm run dev                 # Start dev server with hot reload
npm run dev:vite           # Start Vite only
npm run dev:electron       # Start Electron only

# Build
npm run build              # Build for production
npm run build:renderer     # Build React app
npm run build:main         # Build Electron main process

# Package
npm run package            # Package for all platforms
npm run package:win        # Package for Windows
npm run package:mac        # Package for macOS
npm run package:linux      # Package for Linux

# Code Quality
npm run type-check         # TypeScript type checking
npm run lint               # ESLint
npm run format             # Prettier formatting
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Desktop**: Electron 28
- **Automation**: Puppeteer with stealth plugin
- **Database**: SQLite (better-sqlite3)
- **Build**: Vite, electron-builder

## ⚙️ Configuration

Edit `config/default.json` to customize behavior:

```json
{
  "app": {
    "maxViewers": 30,
    "defaultViewerCount": 20
  },
  "browser": {
    "headless": true
  },
  "session": {
    "minDurationMs": 300000,
    "maxDurationMs": 900000
  },
  "proxy": {
    "maxFailCount": 3
  }
}
```

## 🔒 Security & Anti-Detection

This tool implements several techniques to avoid detection:

- **Puppeteer Stealth Plugin**: Removes automation markers
- **Browser Fingerprinting**: Randomized user agents, viewports, timezones
- **Proxy Rotation**: Different IP per viewer session
- **Human-like Behavior**: Random scrolling, pauses, view durations
- **Headless Mode**: Runs without visible browser windows

## 📊 Database Schema

SQLite database stores:
- **sessions**: Livestream session history
- **proxies**: Proxy pool with health status (now with allocation tracking)
- **viewer_sessions**: Individual viewer instances
- **logs**: Application logs

## 🆕 New Feature: Proxy Allocation System

The Proxy Allocation feature intelligently distributes viewers across proxies with capacity limits:

- **Smart Load Balancing**: Automatically distributes viewers evenly across available proxies
- **Capacity Control**: Set max viewers per proxy to avoid detection
- **Real-time Tracking**: Monitor current viewer allocation per proxy
- **Auto Release**: Automatically frees up proxy slots when viewers stop

### Quick Example

```typescript
// Start session with smart proxy allocation
await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=YOUR_VIDEO',
  viewerCount: 20,
  maxViewersPerProxy: 5  // Max 5 viewers per proxy
});

// Check proxy capacity
const stats = ProxyManager.getStats();
console.log(`Available capacity: ${stats.availableCapacity} viewers`);
```

📖 **Full Documentation**: See [PROXY_ALLOCATION_FEATURE.md](./PROXY_ALLOCATION_FEATURE.md) for complete guide  
⚡ **Quick Start**: See [PROXY_ALLOCATION_QUICK_START.md](./PROXY_ALLOCATION_QUICK_START.md)  
🧪 **Examples**: See [examples/proxy-allocation-examples.ts](./examples/proxy-allocation-examples.ts)

## ⚠️ Disclaimer

This tool is for **educational purposes only**. Using bots to artificially inflate viewer counts may violate YouTube's Terms of Service. Use responsibly and at your own risk.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Puppeteer](https://pptr.dev/) - Browser automation
- [Electron](https://www.electronjs.org/) - Desktop framework
- [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) - Anti-detection

---

<div align="center">

**Made with ❤️ by Khiem Pham**

[Report Bug](https://github.com/khiemphamm/tool-live/issues) • [Request Feature](https://github.com/khiemphamm/tool-live/issues)

</div>
