# Claudet

A full-stack web application that provides an interactive chat interface for Claude AI, built with Bun, React 19, and Tailwind CSS.

## Features

- 🤖 **Claude CLI Integration** - Simple `--print` / `--resume` invocations per message, no persistent processes
- 📱 **Progressive Web App** - Installable on mobile devices with offline support
- 🔒 **HTTPS Development** - Secure local development with TLS certificates
- 📲 **Mobile-First Design** - Responsive UI with safe area utilities for iOS devices
- ⚡ **Hot Module Reloading** - Fast development with Bun's built-in HMR
- 🎨 **Modern UI** - Built with shadcn/ui components and Tailwind CSS 4
- 🌓 **Dark Mode** - Light, dark, and system theme support with FOUC prevention
- 🔌 **Socket.IO** - Real-time connection with automatic reconnection
- 📦 **Zero Config** - All-in-one Bun runtime (no separate bundler needed)
- 🧪 **Comprehensive Testing** - Unit tests with Bun and E2E tests with Playwright

## Prerequisites

- [Bun](https://bun.sh) v1.2.22 or later
- [mkcert](https://github.com/FiloSottile/mkcert) (for HTTPS certificates)
  ```bash
  brew install mkcert
  ```
- [ImageMagick](https://imagemagick.org/) (for generating PWA icons)
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

# Generate certificates and PWA icons
bun run setup
```

### Development

```bash
# Start development server with hot reload
bun dev
```

The server will start on `https://0.0.0.0:3000` with:
- ✅ HTTPS enabled (uses self-signed certificates in `./certs/`)
- ✅ QR code displayed in terminal for easy mobile access
- ✅ Hot module reloading for instant updates

Access the app:
- **Desktop:** `https://localhost:3000`
- **Mobile:** Scan the QR code shown in terminal

> **Note:** If you see a certificate error, make sure you've run `bun run setup` to generate the certificates. The `mkcert` tool will install a local CA so your browser trusts the certificates.

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

- [Architecture Guide](docs/architecture.md) - Complete architecture, project structure, and technology stack
- [Bun Guidelines](docs/bun.md) - Comprehensive Bun-specific development guidelines and best practices
- [CLAUDE.md](CLAUDE.md) - Project instructions for Claude Code AI assistant

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run setup` | **First-time setup:** Generate HTTPS certificates and PWA icons |
| `bun dev` | Start development server with hot reload (HTTPS on port 3000) |
| `bun start` | Run production server |
| `bun run build` | Build for production to `dist/` folder |
| `bun run validate` | Run all checks: type-check, format, lint, unit tests, E2E tests, and build |
| `bun run format` | Format all files with Biome |
| `bun run format:check` | Check formatting without modifying files |
| `bun run lint` | Run linting with Biome |
| `bun run lint:fix` | Apply safe automatic lint fixes |
| `bun run generate:icons` | Generate PWA icon files from `src/frontend/assets/icon.svg` to `src/frontend/assets/gen/` |
| `bun run generate:certs` | Generate HTTPS certificates using mkcert |
| `bun test` | Run unit tests with Bun's built-in test runner |
| `bun test <file>` | Run specific test file |
| `bun test --test-name-pattern "<pattern>"` | Run tests matching pattern |
| `bun run test:e2e` | Run E2E tests with Playwright (headless) |
| `bun run test:e2e:ui` | Run E2E tests with Playwright UI |
| `bun run test:e2e:headed` | Run E2E tests with visible browser |
| `npx playwright show-report` | View latest Playwright test report |

## Architecture

For complete details on the project architecture, technology stack, project structure, and development patterns, see the [Architecture Guide](docs/architecture.md).

**Quick Overview**:
- **Backend**: Bun.serve() + Socket.IO; each chat message invokes `claude --print` / `claude --resume` as a one-shot process
- **Frontend**: React 19 + XState 5 + Tailwind CSS 4 + shadcn/ui with dark mode support
- **Testing**: Bun test runner (unit) + Playwright (E2E); set `CLAUDE_TEST_FAKE=true` to skip real CLI calls
- **PWA**: Offline-first with service worker and installable on mobile devices

## License

This project was created using `bun init`. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
