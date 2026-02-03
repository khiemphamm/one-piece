# AGENTS.md - Developer Guidelines for Tool-Live

## Project Overview

**Tool-Live** is a desktop application (Electron) designed to manage YouTube/TikTok livestream engagement by simulating concurrent viewers using Puppeteer.

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Zustand.
- **Backend (Core)**: Node.js, Puppeteer (with stealth plugin), SQLite.
- **Inter-process Communication**: Electron IPC (Main <-> Renderer).

---

## 🛠 Build & Development Commands

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Start Electron and Vite dev servers concurrently       |
| `npm run build`       | Build both renderer (Vite) and main process (TSC)      |
| `npm run type-check`  | Run TypeScript compiler without emitting files         |
| `npm run lint`        | Run ESLint across the project                          |
| `npm run format`      | Format all files using Prettier                        |
| `npm run package:win` | Package application for Windows (Installer + Portable) |

**Note on Testing**: Currently, the project does not have a formal test suite implemented. When adding tests, use `jest` or `vitest` and follow the `*.test.ts` or `*.spec.ts` naming convention.

---

## 🎨 Code Style & Guidelines

### 1. Types & Naming

- **TypeScript**: Strictly use TypeScript for all new code. Avoid `any` where possible.
- **Interfaces**: Prefer `interface` for public APIs and `type` for internal unions/aliases.
- **Naming**:
  - Components: `PascalCase` (e.g., `Dashboard.tsx`)
  - Functions/Variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `camelCase` for utilities, `PascalCase` for components.

### 2. Imports & Exports

- Use **ES Modules** (`import`/`export`) everywhere.
- Order: Built-in modules -> Third-party -> Local imports -> Types.
- Use path aliases if configured, otherwise use relative paths.

### 3. React Components

- Use **Functional Components** with hooks.
- State Management: Use **Zustand** for global state; `useState` for local component state.
- Styles: Use **Tailwind CSS** utility classes. Avoid inline styles.
- Props: Always define types for component props.

### 4. Backend & Automation (Puppeteer)

- **Async/Await**: All browser operations MUST be async and wrapped in `try-catch`.
- **Resource Management**: Always close pages and browser instances in a `finally` block or explicit `stop()` method to prevent memory leaks.
- **Stealth**: Use `puppeteer-extra-plugin-stealth` and randomized fingerprints (User Agents, Viewports) for all viewer sessions.
- **Optimization**: Block unnecessary resources (images, fonts, CSS) in viewer sessions to minimize CPU/RAM usage.

---

## 🚨 Error Handling & Logging

- **Try-Catch**: Mandatory for all IPC handlers and Puppeteer interactions.
- **Logging**: Use the central logger (`core/utils/logger.ts`) powered by Winston.
- **Context**: When logging errors, include relevant context (e.g., `sessionId`, `viewerIndex`, `proxyUrl`).

```typescript
try {
  await page.goto(url);
} catch (error) {
  logger.error(`Navigation failed for viewer #${index}`, { error: error.message, url });
  throw error; // Re-throw if the caller needs to handle it (e.g., for auto-restart)
}
```

---

## 📂 Project Structure

- `electron/`: Main process and IPC bridge.
- `src/`: React frontend (Renderer process).
- `core/`: Automation engine, proxy management, and database logic.
- `config/`: JSON configuration templates.
- `data/`: Local SQLite database storage.

---

## 🤖 Automation Rules (from .github/copilot-instructions.md)

- **Wait Policy**: Use `networkidle2` or specific element visibility for navigation.
- **Human-like Behavior**: Implement random delays, scrolls, and interactions.
- **Proxy Health**: Implement a "3-strikes" rule for failing proxies before blacklisting.
- **Local-First**: Keep logic local to the machine; minimize external dependencies.

---

_Created: Feb 03, 2026 | Maintainer: Agentic Workflow_
