# Claudet

A full-stack web application that provides an interactive chat interface for Claude AI, built with Bun, React 19, and Tailwind CSS.

## Features

- 🤖 **Claude CLI Integration** - Persistent Claude Code session with streaming JSON I/O
- 📱 **Progressive Web App** - Installable on mobile devices with offline support
- 🔒 **HTTPS Development** - Secure local development with TLS certificates
- 📲 **Mobile-First Design** - Responsive UI with safe area utilities for iOS devices
- ⚡ **Hot Module Reloading** - Fast development with Bun's built-in HMR
- 🎨 **Modern UI** - Built with shadcn/ui components and Tailwind CSS 4
- 🔌 **WebSocket Streaming** - Real-time log streaming from Claude process
- 📦 **Zero Config** - All-in-one Bun runtime (no separate bundler needed)

## Prerequisites

- [Bun](https://bun.sh) v1.2.22 or later
- [ImageMagick](https://imagemagick.org/) (optional, for regenerating PWA icons)
  ```bash
  brew install imagemagick
  ```

## Getting Started

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd claudet

# Install dependencies
bun install
```

### Development

```bash
# Start development server with hot reload
bun dev
```

The server will start on `https://0.0.0.0:3000` with:
- ✅ HTTPS enabled (uses certificates in `./certs/`)
- ✅ QR code displayed in terminal for easy mobile access
- ✅ Hot module reloading for instant updates

Access the app:
- **Desktop:** `https://localhost:3000`
- **Mobile:** Scan the QR code shown in terminal

### Production

```bash
# Build for production
bun run build

# Run production server
bun start
```

Production builds are output to the `dist/` folder with:
- Minified code
- Source maps
- Optimized assets

## Documentation

- [Bun Guidelines](docs/bun.md) - Comprehensive Bun-specific development guidelines and best practices
- [CLAUDE.md](CLAUDE.md) - Project instructions for Claude Code AI assistant

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server with hot reload (HTTPS on port 3000) |
| `bun start` | Run production server |
| `bun run build` | Build for production to `dist/` folder |
| `bun run generate:icons` | Generate PWA icon files from `src/assets/icon.svg` |
| `bun test` | Run tests with Bun's built-in test runner |
| `bun test <file>` | Run specific test file |
| `bun test --test-name-pattern "<pattern>"` | Run tests matching pattern |

## Project Structure

```
src/
├── index.tsx              # Bun server entry point (routing, WebSockets, Claude CLI)
├── index.html             # HTML entry with React imports
├── frontend.tsx           # React root component
├── App.tsx                # Main application component
├── APITester.tsx          # Chat interface component
├── index.css              # Main CSS with Tailwind + mobile utilities
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker for offline support
├── components/ui/         # shadcn/ui components
├── lib/utils.ts           # Utility functions
└── assets/                # Icons and images

scripts/
├── build.ts               # Production build script
└── generate-pwa-icons.js  # Icon generation from SVG

docs/
└── bun.md                 # Bun best practices guide

certs/
├── localhost+3.pem        # HTTPS certificate
└── localhost+3-key.pem    # HTTPS private key
```

## Technology Stack

- **Runtime:** [Bun](https://bun.sh) - All-in-one JavaScript runtime
- **Framework:** [React 19](https://react.dev/) - UI library
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS framework
- **Components:** [shadcn/ui](https://ui.shadcn.com/) - Re-usable components built with Radix UI
- **AI Integration:** Claude Code CLI - Persistent session with streaming I/O
- **PWA:** Service Worker + Web App Manifest - Offline-first progressive web app

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/*` | GET | Serves `index.html` (SPA fallback) |
| `/api/chat` | POST | Send messages to Claude CLI |
| `/api/hello` | GET/PUT | Example API endpoint |
| `/api/hello/:name` | GET | Dynamic parameter example |
| `/ws` | WebSocket | Real-time log streaming |
| `/manifest.json` | GET | PWA manifest |
| `/sw.js` | GET | Service worker |

## Development Notes

### TypeScript Configuration
- **Strict mode enabled** with additional safety checks
- **Module:** "Preserve" with bundler resolution
- **JSX:** react-jsx (React 19)
- **Path alias:** `@/*` → `./src/*`

### PWA Support
- Icons generated from `src/assets/icon.svg`
- Service worker handles offline caching
- Installable on iOS and Android devices
- Safe area utilities for notch/status bar support

### Testing
- Uses Bun's built-in test runner (not Jest or Vitest)
- 5-second timeout per test
- Supports snapshots with `--update-snapshots`

## License

This project was created using `bun init`. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
